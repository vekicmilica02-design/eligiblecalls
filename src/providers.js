// LLM providers. Each returns { stream: AsyncIterable<string>, usage: () => {in, out} | null }.
// Workers AI is the main provider (free daily allocation), Groq the fallback (free tier).

export const NEURONS_PER_M = {
  // Cloudflare Workers AI pricing page, neurons per million tokens (input, output)
  "@cf/meta/llama-4-scout-17b-16e-instruct": [24545, 77273],
  "@cf/mistralai/mistral-small-3.1-24b-instruct": [31876, 50488],
  "@cf/openai/gpt-oss-120b": [31818, 68182],
};

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

export async function groq(env, messages, maxTokens, fetchImpl = fetch) {
  if (!env.GROQ_API_KEY) throw new ProviderError("not_configured");
  const model = env.GROQ_MODEL || "openai/gpt-oss-120b";
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
    throw new ProviderError(r.status === 429 ? "quota" : "provider_error", r.status, detail);
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
