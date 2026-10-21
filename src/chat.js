// POST /api/chat handler. Shared by the Pages Function and the local test server.
import { cleanRequest, buildMessages, estTokens, LIMITS } from "./core.js";
import { workersAI, groq, neurons, ProviderError } from "./providers.js";
import { utcDay, nextReset, getUsage, addUsage, visitorHit, visitorHash } from "./budget.js";

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
  const groqBudget = num(env.GROQ_DAILY_TOKENS, 190000);
  const wModel = env.AI_MODEL || "@cf/meta/llama-4-scout-17b-16e-instruct";
  const order = [];
  if (env.AI && usage["workers-ai"].neurons + neurons(wModel, tokIn, maxOut) <= neuronBudget) order.push("workers-ai");
  if (env.GROQ_API_KEY && usage.groq.tokens + tokIn + maxOut <= groqBudget) order.push("groq");
  if (!order.length) return json({ error: "resting", resetAt: new Date(nextReset(now)).toISOString() }, 503);

  const perVisitor = num(env.DAILY_VISITOR_LIMIT, 10);
  const count = await visitorHit(db, day, await visitorHash(ip, day, env.HASH_SALT || "eligiblecalls"));
  if (count > perVisitor) return json({ error: "visitor_limit", limit: perVisitor, resetAt: new Date(nextReset(now)).toISOString() }, 429);


  let run = null, lastErr = null;
  for (const p of order) {
    try {
      run = p === "workers-ai" ? await workersAI(env, built.messages, maxOut) : await groq(env, built.messages, maxOut, fetchImpl);
      break;
    } catch (e) {
      lastErr = e;
      if (p === "workers-ai" && e instanceof ProviderError && e.code === "quota") {
        // free allocation used up outside our counter: mark the budget as spent for today
        waitUntil(addUsage(db, day, "workers-ai", neuronBudget, 0).catch(() => {}));
      }
    }
  }
  if (!run) {
    const quota = lastErr instanceof ProviderError && lastErr.code === "quota";
    return json({ error: quota ? "resting" : "provider_error", resetAt: quota ? new Date(nextReset(now)).toISOString() : undefined }, 503);
  }

  const enc = new TextEncoder();
  const { readable, writable } = new TransformStream();
  const w = writable.getWriter();
  const send = (obj) => w.write(enc.encode("data: " + JSON.stringify(obj) + "\n\n"));
  const pump = (async () => {
    let out = "";
    try {
      await send({ meta: { provider: run.provider, country: built.country, calls: built.hits } });
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
      const u = run.usage() || { in: tokIn, out: estTokens(out) };
      const n = run.provider === "workers-ai" ? neurons(run.model, u.in, u.out) : 0;
      await addUsage(db, day, run.provider, n, u.in + u.out).catch(() => {});
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
  const gOk = !!env.GROQ_API_KEY && (!usage || usage.groq.tokens + 6000 <= num(env.GROQ_DAILY_TOKENS, 190000));
  return json({
    ok: true,
    chat: env.CHAT_ENABLED !== "false" && (wOk || gOk),
    resting: env.CHAT_ENABLED !== "false" && !!(env.AI || env.GROQ_API_KEY) && !wOk && !gOk,
    resetAt: new Date(nextReset(now)).toISOString(),
    turnstile: !!env.TURNSTILE_SECRET,
    visitorLimit: num(env.DAILY_VISITOR_LIMIT, 10),
  });
}
