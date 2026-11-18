// One non-streaming model call for the Organization Intelligence agents, through the same providers and
// daily budgets as the assistant. Organisation work may use only a share of each daily budget
// (ORG_BUDGET_SHARE, default 0.6), so the public assistant keeps working, and each user has a daily
// number of AI actions (ORG_AI_PER_USER, default 20). `agent` names the function that asks (extract, research, ideas,
// fit, proposal, evaluate, official, translate) and is only used for the usage counters.
//
// Provider order: Workers AI, then Cerebras (only when CEREBRAS_API_KEY is set), then the Groq chain. With
// prefer: "fast" (evaluations) Cerebras and Groq come first and Workers AI last.
//
// Answer cache (table ai_cache, migration 0008): a caller that passes `cacheOrg` gets the stored answer for exactly the
// same prompt (agent, output limit and every message, as a SHA-256 key) made for the same organisation in the last
// AI_CACHE_DAYS days (default 30). A stored answer uses no AI action and no provider allowance. The caller decides
// whether an answer is worth keeping and calls `r.keep()` after checking it. Rows belong to the organisation and are
// deleted with it (src/org/api.js deleteOrg). Without the table the cache is skipped.

import { workersAI, groq, groqModels, cerebras, cerebrasModel, neurons, ProviderError } from "../providers.js";
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

// ---------- answer cache ----------
const cacheDays = (env) => Math.max(0, num(env.AI_CACHE_DAYS, 30));
export async function cacheKey(agent, maxOut, messages) {
  const data = new TextEncoder().encode(JSON.stringify([agent, maxOut, messages.map((m) => [m.role, m.content])]));
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", data))].map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function cacheGet(db, orgId, key, since) {
  try { return await db.prepare("SELECT text, model FROM ai_cache WHERE org_id = ? AND key = ? AND created_at > ?").bind(orgId, key, since).first(); }
  catch { return null; } // table not created yet (migration 0008): no cache
}
async function cachePut(db, orgId, key, agent, text, model, now, days) {
  try {
    await db.prepare("INSERT INTO ai_cache (org_id, key, agent, text, model, created_at) VALUES (?, ?, ?, ?, ?, ?) " +
      "ON CONFLICT(org_id, key) DO UPDATE SET text = excluded.text, model = excluded.model, created_at = excluded.created_at").bind(orgId, key, agent, text, model || null, now).run();
    if (Math.random() < 0.05) await db.prepare("DELETE FROM ai_cache WHERE created_at < ?").bind(now - days * 864e5).run();
  } catch { /* no table: nothing kept */ }
}
// The action is reserved before the model is asked and given back if no provider answered, so two requests running at
// the same time cannot both pass the limit.
async function reserveUser(env, userId, now, limit) {
  const r = await env.DB.prepare("INSERT INTO ai_usage (day, user_id, count) VALUES (?, ?, 1) ON CONFLICT(day, user_id) DO UPDATE SET count = count + 1 RETURNING count").bind(utcDay(now), userId).first();
  if (r && r.count > limit) { await releaseUser(env, userId, now); return false; }
  return true;
}
const provKey = (o) => (o.provider === "groq" ? groqKey(o.model) : o.provider === "cerebras" ? "cerebras:" + o.model : "workers-ai");
const releaseUser = (env, userId, now) => env.DB.prepare("UPDATE ai_usage SET count = MAX(0, count - 1) WHERE day = ? AND user_id = ?").bind(utcDay(now), userId).run();

export async function complete({ env, userId, messages, agent = "other", maxOut = 1500, now = Date.now(), fetchImpl = fetch, waitUntil = (p) => p, cacheOrg = null, fresh = false, prefer = null }) {
  const db = env.DB;
  const day = utcDay(now);
  const tokIn = estTokens(messages.map((m) => m.content).join("\n"));
  const days = cacheDays(env);
  const key = cacheOrg && days > 0 ? await cacheKey(agent, maxOut, messages) : null;
  if (key && !fresh) {
    const hit = await cacheGet(db, cacheOrg, key, now - days * 864e5);
    if (hit && hit.text) {
      // Counted as "cache:<agent>" (requests and tokens not spent), so the administration page shows what the cache saves.
      waitUntil(addUsage(db, day, "cache:" + agent, 0, tokIn + estTokens(hit.text)).catch(() => {}));
      return { text: hit.text, provider: "cache", model: hit.model || null, cached: true, keep: async () => {} };
    }
  }
  const a = await userAllowance(env, userId, now);
  if (a.used >= a.limit) throw new HttpError(429, "ai_user_limit", { limit: a.limit });
  const reserve = () => reserveUser(env, userId, now, a.limit);
  const share = num(env.ORG_BUDGET_SHARE, 0.6);
  const usage = await getUsage(db, day);
  const wModel = env.AI_MODEL || "@cf/meta/llama-4-scout-17b-16e-instruct";
  let order = [];
  if (env.AI && usage["workers-ai"].neurons + neurons(wModel, tokIn, maxOut) <= share * num(env.DAILY_NEURON_BUDGET, 9000)) order.push({ provider: "workers-ai" });
  const cb = cerebrasModel(env);
  if (cb && tokIn + maxOut <= 0.9 * cb.tpm && ((usage["cerebras:" + cb.model] || {}).tokens || 0) + tokIn + maxOut <= share * cb.budget) order.push({ provider: "cerebras", model: cb.model, budget: cb.budget });
  if (env.GROQ_API_KEY) for (const g of groqModels(env)) {
    if (tokIn + maxOut > 0.9 * g.tpm) continue; // larger than the model's per-minute limit
    if (groqTokens(usage, g.model) + tokIn + maxOut <= share * g.budget) order.push({ provider: "groq", model: g.model, budget: g.budget });
  }
  // prefer "fast": the hosted providers (Cerebras, Groq) before Workers AI, for long answers a user waits for.
  if (prefer === "fast") order = [...order.filter((o) => o.provider !== "workers-ai"), ...order.filter((o) => o.provider === "workers-ai")];
  if (!order.length) throw new HttpError(503, "ai_resting");
  if (!(await reserve())) throw new HttpError(429, "ai_user_limit", { limit: a.limit });

  const errs = [];
  for (const o of order) {
    try {
      const run = o.provider === "workers-ai" ? await workersAI(env, messages, maxOut) : o.provider === "cerebras" ? await cerebras(env, messages, maxOut, fetchImpl, o.model) : await groq(env, messages, maxOut, fetchImpl, o.model);
      let text = "";
      for await (const t of run.stream) text += t;
      const u = run.usage() || { in: tokIn, out: estTokens(text) };
      const used = o.provider === "workers-ai" ? neurons(run.model, u.in, u.out) : 0;
      await addUsage(db, day, provKey(o), used, u.in + u.out).catch(() => {});
      // The same use again under the agent that asked for it ("agent:<name>"), so the administration page can show
      // which function spends the daily allowance. Counters only; no text is stored.
      await addUsage(db, day, "agent:" + agent, used, u.in + u.out).catch(() => {});
      // An empty answer is a provider failure: the next provider is asked instead of returning nothing.
      if (!text.trim()) throw new ProviderError("empty", 0, "empty answer");
      return { text, provider: run.provider, model: run.model, keep: () => (key ? cachePut(db, cacheOrg, key, agent, text, run.model, now, days) : Promise.resolve()) };
    } catch (e) {
      errs.push(e);
      // Shown in the Pages Functions log: which provider failed and why (status and the provider's short message).
      console.warn("org ai: provider failed", o.provider, o.model || "", (e && e.code) || "", (e && e.status) || "", String((e && e.detail) || (e && e.message) || "").slice(0, 200));
      if (e instanceof ProviderError && e.code === "quota") {
        waitUntil(addUsage(db, day, provKey(o), o.provider === "workers-ai" ? num(env.DAILY_NEURON_BUDGET, 9000) : 0, o.provider === "workers-ai" ? 0 : o.budget).catch(() => {}));
      }
    }
  }
  await releaseUser(env, userId, now).catch(() => {});   // nothing answered: the action is not used
  // A per-minute limit anywhere in the chain is reported as such (the request can be repeated shortly), even when a
  // later provider failed for another reason: the last error alone hid it.
  throw new HttpError(503, errs.some((e) => e instanceof ProviderError && e.code === "busy") ? "ai_busy" : "ai_unavailable");
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
