// LLM providers. Each returns { stream: AsyncIterable<string>, usage: () => {in, out} | null }.
// Workers AI is the main provider (free daily allocation), Groq the fallback (free tier).
// Groq's free limits apply per model, so the fallback is a chain of Groq models, each with its own
// daily token counter.

export const NEURONS_PER_M = {
  // Cloudflare Workers AI pricing page, neurons per million tokens (input, output)
  "@cf/meta/llama-4-scout-17b-16e-instruct": [24545, 77273],
  "@cf/mistralai/mistral-small-3.1-24b-instruct": [31876, 50488],
  "@cf/openai/gpt-oss-120b": [31818, 68182],
};

// Groq free-tier limits per model (tokens per day, tokens per minute), from console.groq.com
// Settings > Limits as summarised in August 2026. Check them there if Groq changes its plans.
// Order = fallback order: strongest first, smallest last.
export const GROQ_FREE = [
  { model: "openai/gpt-oss-120b", tpd: 200000, tpm: 8000 },
  { model: "openai/gpt-oss-20b", tpd: 200000, tpm: 8000 },
  { model: "llama-3.3-70b-versatile", tpd: 100000, tpm: 12000 },
  { model: "llama-3.1-8b-instant", tpd: 500000, tpm: 6000 },
];

// The Groq chain for this deployment, with a daily budget at 95% of each limit.
//   GROQ_MODELS = "model:tpd:tpm,model:tpd:tpm"  replaces the chain
//   GROQ_MODEL (+ GROQ_DAILY_TOKENS)              one model only (earlier setting, still honoured)
export function groqModels(env) {
  if (env.GROQ_MODELS) {
    return String(env.GROQ_MODELS).split(",").map((x) => x.trim()).filter(Boolean).map((x) => {
      const [model, tpd, tpm] = x.split(":");
      return { model, budget: Math.floor(0.95 * (+tpd || 100000)), tpm: +tpm || 6000 };
    });
  }
  if (env.GROQ_MODEL) {
    const known = GROQ_FREE.find((m) => m.model === env.GROQ_MODEL);
    return [{ model: env.GROQ_MODEL, budget: +env.GROQ_DAILY_TOKENS || Math.floor(0.95 * (known ? known.tpd : 100000)), tpm: known ? known.tpm : 6000 }];
  }
  return GROQ_FREE.map((m) => ({ model: m.model, budget: Math.floor(0.95 * m.tpd), tpm: m.tpm }));
}

export class ProviderError extends Error {
  constructor(code, status, detail) { super(code); this.code = code; this.status = status; this.detail = detail; }
}

// Parse a Server-Sent Events byte stream into JSON payloads.
async function* sseJson(body) {
  const reader = body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      try { yield JSON.parse(data); } catch { /* ignore partial or non-JSON lines */ }
    }
  }
}

// Text from either the Workers AI native format or the OpenAI chunk format.
function deltaText(j) {
  if (typeof j.response === "string") return j.response;
  const ch = j.choices && j.choices[0];
  if (ch && ch.delta && typeof ch.delta.content === "string") return ch.delta.content;
  return "";
}
function usageOf(j) {
  const u = j.usage || (j.x_groq && j.x_groq.usage);
  if (u && (u.prompt_tokens || u.completion_tokens)) return { in: u.prompt_tokens || 0, out: u.completion_tokens || 0 };
  return null;
}

export async function workersAI(env, messages, maxTokens) {
  if (!env.AI) throw new ProviderError("not_configured");
  const model = env.AI_MODEL || "@cf/meta/llama-4-scout-17b-16e-instruct";
  let res;
  try {
    res = await env.AI.run(model, { messages, stream: true, max_tokens: maxTokens, temperature: 0.3 });
  } catch (e) {
    const msg = String((e && e.message) || e);
    // 4006: daily free allocation used up
    throw new ProviderError(/4006|allocation|neuron/i.test(msg) ? "quota" : "provider_error", 0, msg.slice(0, 300));
  }
  let usage = null;
  const body = res instanceof ReadableStream ? res : res && res.body;
  if (!body) throw new ProviderError("provider_error", 0, "no stream");
  async function* gen() {
    for await (const j of sseJson(body)) {
      const u = usageOf(j); if (u) usage = u;
      const t = deltaText(j); if (t) yield t;
    }
  }
  return { provider: "workers-ai", model, stream: gen(), usage: () => usage };
}

export async function groq(env, messages, maxTokens, fetchImpl = fetch, model = "openai/gpt-oss-120b") {
  if (!env.GROQ_API_KEY) throw new ProviderError("not_configured");
  const base = { model, messages, stream: true, max_tokens: maxTokens, temperature: 0.3 };
  const extra = /gpt-oss/.test(model) ? { reasoning_effort: "low", include_reasoning: false } : {};
  const call = (payload) => fetchImpl("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer " + env.GROQ_API_KEY },
    body: JSON.stringify(payload),
  });
  let r = await call({ ...base, ...extra });
  if (r.status === 400 && Object.keys(extra).length) r = await call(base); // older API without the reasoning options
  if (!r.ok) {
    const detail = (await r.text().catch(() => "")).slice(0, 300);
    // 429 names the limit hit: tokens/requests per day (TPD, RPD) or per minute (TPM, RPM).
    // 413: the request alone is larger than the model's per-minute limit.
    const code = r.status === 429 ? (/per day|\bTPD\b|\bRPD\b/i.test(detail) ? "quota" : "busy") : r.status === 413 ? "busy" : "provider_error";
    throw new ProviderError(code, r.status, detail);
  }
  let usage = null;
  async function* gen() {
    for await (const j of sseJson(r.body)) {
      const u = usageOf(j); if (u) usage = u;
      const t = deltaText(j); if (t) yield t;
    }
  }
  return { provider: "groq", model, stream: gen(), usage: () => usage };
}

export function neurons(model, tokIn, tokOut) {
  const [a, b] = NEURONS_PER_M[model] || [32000, 78000]; // unknown model: assume the higher rates
  return (tokIn * a + tokOut * b) / 1e6;
}
