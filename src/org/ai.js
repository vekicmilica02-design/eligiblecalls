// One non-streaming model call for the Organization Intelligence agents, through the same providers and
// daily budgets as the assistant. Organisation work may use only a share of each daily budget
// (ORG_BUDGET_SHARE, default 0.6), so the public assistant keeps working, and each user has a daily
// number of AI actions (ORG_AI_PER_USER, default 20).

import { workersAI, groq, groqModels, neurons, ProviderError } from "../providers.js";
import { getUsage, addUsage, groqKey, groqTokens } from "../budget.js";
import { estTokens } from "../core.js";
import { HttpError, utcDay } from "./http.js";

const num = (v, d) => (v !== undefined && v !== "" && !isNaN(+v) ? +v : d);

export async function userAllowance(env, userId, now) {
  const day = utcDay(now);
  const r = await env.DB.prepare("SELECT count FROM ai_usage WHERE day = ? AND user_id = ?").bind(day, userId).first();
  const limit = num(env.ORG_AI_PER_USER, 20);
  return { used: r ? r.count : 0, limit };
}
async function countUser(env, userId, now) {
  await env.DB.prepare("INSERT INTO ai_usage (day, user_id, count) VALUES (?, ?, 1) ON CONFLICT(day, user_id) DO UPDATE SET count = count + 1").bind(utcDay(now), userId).run();
}

export async function complete({ env, userId, messages, maxOut = 1500, now = Date.now(), fetchImpl = fetch, waitUntil = (p) => p }) {
  const a = await userAllowance(env, userId, now);
  if (a.used >= a.limit) throw new HttpError(429, "ai_user_limit", { limit: a.limit });
  const db = env.DB;
  const day = utcDay(now);
  const share = num(env.ORG_BUDGET_SHARE, 0.6);
  const tokIn = estTokens(messages.map((m) => m.content).join("\n"));
  const usage = await getUsage(db, day);
  const wModel = env.AI_MODEL || "@cf/meta/llama-4-scout-17b-16e-instruct";
  const order = [];
  if (env.AI && usage["workers-ai"].neurons + neurons(wModel, tokIn, maxOut) <= share * num(env.DAILY_NEURON_BUDGET, 9000)) order.push({ provider: "workers-ai" });
  if (env.GROQ_API_KEY) for (const g of groqModels(env)) {
    if (tokIn + maxOut > 0.9 * g.tpm) continue; // larger than the model's per-minute limit
    if (groqTokens(usage, g.model) + tokIn + maxOut <= share * g.budget) order.push({ provider: "groq", model: g.model, budget: g.budget });
  }
  if (!order.length) throw new HttpError(503, "ai_resting");

  let lastErr = null;
  for (const o of order) {
    try {
      const run = o.provider === "workers-ai" ? await workersAI(env, messages, maxOut) : await groq(env, messages, maxOut, fetchImpl, o.model);
      let text = "";
      for await (const t of run.stream) text += t;
      const u = run.usage() || { in: tokIn, out: estTokens(text) };
      await addUsage(db, day, o.provider === "groq" ? groqKey(o.model) : "workers-ai", o.provider === "workers-ai" ? neurons(run.model, u.in, u.out) : 0, u.in + u.out).catch(() => {});
      await countUser(env, userId, now);
      return { text, provider: run.provider, model: run.model };
    } catch (e) {
      lastErr = e;
      if (e instanceof ProviderError && e.code === "quota") {
        waitUntil(addUsage(db, day, o.provider === "groq" ? groqKey(o.model) : "workers-ai", o.provider === "groq" ? 0 : num(env.DAILY_NEURON_BUDGET, 9000), o.provider === "groq" ? o.budget : 0).catch(() => {}));
      }
    }
  }
  throw new HttpError(503, lastErr instanceof ProviderError && lastErr.code === "busy" ? "ai_busy" : "ai_unavailable");
}

// First JSON object in a model answer (models sometimes wrap it in a code fence or add a sentence).
export function parseJsonObject(text) {
  const s = String(text || "");
  const start = s.indexOf("{");
  if (start < 0) return null;
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (inStr) { if (esc) esc = false; else if (ch === "\\") esc = true; else if (ch === '"') inStr = false; continue; }
    if (ch === '"') inStr = true;
    else if (ch === "{") depth++;
    else if (ch === "}" && --depth === 0) { try { return JSON.parse(s.slice(start, i + 1)); } catch { return null; } }
  }
  return null;
}
