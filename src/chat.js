// POST /api/chat handler. Shared by the Pages Function and the local test server.
import { cleanRequest, buildMessages, estTokens, LIMITS } from "./core.js";
import { workersAI, groq, groqModels, neurons, ProviderError } from "./providers.js";
import { utcDay, nextReset, getUsage, addUsage, groqKey, groqTokens, visitorHit, visitorHash } from "./budget.js";

let INDEX = null;
async function loadIndex(env, url) {
  if (INDEX) return INDEX;
  const r = await env.ASSETS.fetch(new URL("/data/index.json", url));
  if (!r.ok) throw new Error("index " + r.status);
  INDEX = await r.json();
  return INDEX;
}
export function _resetIndex() { INDEX = null; }

const num = (v, d) => (v !== undefined && v !== "" && !isNaN(+v) ? +v : d);
const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });

async function verifyTurnstile(env, token, ip, fetchImpl) {
  if (!env.TURNSTILE_SECRET) return true;
  if (!token) return false;
  const form = new FormData();
  form.append("secret", env.TURNSTILE_SECRET); form.append("response", token); if (ip) form.append("remoteip", ip);
  const r = await fetchImpl("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: form });
  const j = await r.json().catch(() => ({}));
  return !!j.success;
}

export async function handleChat({ request, env, waitUntil = (p) => p, now = Date.now(), fetchImpl = fetch }) {
  if (env.CHAT_ENABLED === "false") return json({ error: "disabled" }, 503);
  const len = +(request.headers.get("content-length") || 0);
  if (len > 80000) return json({ error: "too_large" }, 413);
  let body;
  try { body = await request.json(); } catch { return json({ error: "bad_request" }, 400); }
  const req = cleanRequest(body);
  if (req.error) return json({ error: req.error }, 400);

  const ip = request.headers.get("cf-connecting-ip") || "";
  if (!(await verifyTurnstile(env, req.turnstile, ip, fetchImpl))) return json({ error: "verification" }, 403);

  const db = env.DB || null;
  const day = utcDay(now);
  const index = await loadIndex(env, request.url);
  const built = buildMessages(index, req, now);
  const tokIn = estTokens(built.messages.map((m) => m.content).join("\n"));
  const maxOut = LIMITS.maxOutput;

  const usage = await getUsage(db, day);
  const neuronBudget = num(env.DAILY_NEURON_BUDGET, 9000);
  const wModel = env.AI_MODEL || "@cf/meta/llama-4-scout-17b-16e-instruct";
  // Fallback chain: Workers AI, then each Groq model with daily tokens left. A Groq model whose
  // per-minute limit is smaller than the request gets the same question with fewer matching calls
  // (built only when that model is actually tried, to keep CPU time low).
  const order = [];
  if (env.AI && usage["workers-ai"].neurons + neurons(wModel, tokIn, maxOut) <= neuronBudget) order.push({ provider: "workers-ai", built, maxOut });
  if (env.GROQ_API_KEY) {
    for (const g of groqModels(env)) {
      if (groqTokens(usage, g.model) + Math.min(tokIn + maxOut, 0.9 * g.tpm) <= g.budget) order.push({ provider: "groq", model: g.model, budget: g.budget, tpm: g.tpm, built, maxOut });
    }
  }
  const fit = (o) => {
    let t = tokIn;
    for (const limit of [5, 3]) {
      if (t + o.maxOut <= 0.9 * o.tpm) return true;
      o.built = buildMessages(index, req, now, { limit }); o.maxOut = Math.min(maxOut, 800);
      t = estTokens(o.built.messages.map((m) => m.content).join("\n"));
    }
    return t + o.maxOut <= 0.9 * o.tpm;
  };
  if (!order.length) return json({ error: "resting", resetAt: new Date(nextReset(now)).toISOString() }, 503);

  const perVisitor = num(env.DAILY_VISITOR_LIMIT, 10);
  const count = await visitorHit(db, day, await visitorHash(ip, day, env.HASH_SALT || "eligiblecalls"));
  if (count > perVisitor) return json({ error: "visitor_limit", limit: perVisitor, resetAt: new Date(nextReset(now)).toISOString() }, 429);

  let run = null, used = null, lastErr = null, busy = false;
  for (const o of order) {
    if (o.provider === "groq" && !fit(o)) continue;
    try {
      run = o.provider === "workers-ai" ? await workersAI(env, o.built.messages, o.maxOut) : await groq(env, o.built.messages, o.maxOut, fetchImpl, o.model);
      used = o;
      break;
    } catch (e) {
      lastErr = e;
      const code = e instanceof ProviderError ? e.code : "";
      if (code === "busy") busy = true;
      // Allowance used up outside our counter: mark it as spent for today.
      if (code === "quota" && o.provider === "workers-ai") waitUntil(addUsage(db, day, "workers-ai", neuronBudget, 0).catch(() => {}));
      if (code === "quota" && o.provider === "groq") waitUntil(addUsage(db, day, groqKey(o.model), 0, o.budget).catch(() => {}));
    }
  }
  if (!run) {
    if (busy) return json({ error: "rate_limited" }, 429);
    const quota = lastErr instanceof ProviderError && lastErr.code === "quota";
    return json({ error: quota ? "resting" : "provider_error", resetAt: quota ? new Date(nextReset(now)).toISOString() : undefined }, 503);
  }
  const usageKey = run.provider === "groq" ? groqKey(run.model) : run.provider;

  const enc = new TextEncoder();
  const { readable, writable } = new TransformStream();
  const w = writable.getWriter();
  const send = (obj) => w.write(enc.encode("data: " + JSON.stringify(obj) + "\n\n"));
  const pump = (async () => {
    let out = "";
    try {
      await send({ meta: { provider: run.provider, model: run.model, country: used.built.country, calls: used.built.hits } });
      // Small batches instead of one event per token: fewer writes, less CPU time.
      let buf = "";
      for await (const t of run.stream) {
        out += t; buf += t;
        if (buf.length >= 48 || buf.includes("\n")) { await send({ d: buf }); buf = ""; }
      }
      if (buf) await send({ d: buf });
      await send({ done: true, provider: run.provider });
    } catch (e) {
      try { await send({ error: "interrupted" }); } catch {}
    } finally {
      try { await w.close(); } catch {}
      const u = run.usage() || { in: estTokens(used.built.messages.map((m) => m.content).join("\n")), out: estTokens(out) };
      const n = run.provider === "workers-ai" ? neurons(run.model, u.in, u.out) : 0;
      await addUsage(db, day, usageKey, n, u.in + u.out).catch(() => {});
    }
  })();
  waitUntil(pump);
  return new Response(readable, { headers: { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-store", "x-accel-buffering": "no" } });
}

export async function handleHealth({ env, now = Date.now() }) {
  const db = env.DB || null;
  const day = utcDay(now);
  let usage = null;
  try { usage = await getUsage(db, day); } catch { usage = null; }
  const wModel = env.AI_MODEL || "@cf/meta/llama-4-scout-17b-16e-instruct";
  const est = neurons(wModel, 5000, LIMITS.maxOutput);
  const wOk = !!env.AI && (!usage || usage["workers-ai"].neurons + est <= num(env.DAILY_NEURON_BUDGET, 9000));
  const gOk = !!env.GROQ_API_KEY && groqModels(env).some((g) => !usage || groqTokens(usage, g.model) + Math.min(6000, 0.9 * g.tpm) <= g.budget);
  return json({
    ok: true,
    chat: env.CHAT_ENABLED !== "false" && (wOk || gOk),
    resting: env.CHAT_ENABLED !== "false" && !!(env.AI || env.GROQ_API_KEY) && !wOk && !gOk,
    resetAt: new Date(nextReset(now)).toISOString(),
    turnstile: !!env.TURNSTILE_SECRET,
    visitorLimit: num(env.DAILY_VISITOR_LIMIT, 10),
  });
}
