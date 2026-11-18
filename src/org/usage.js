// AI usage for the administration page: today's counters per provider against the daily budgets the site enforces,
// assistant messages, workspace AI actions per user, use per function (agents), and the last 7 days. Days are UTC (the free allowances reset
// at 00:00 UTC). Read-only; the counters are written by src/budget.js and src/org/ai.js.

import { utcDay, nextReset, getUsage, groqTokens } from "../budget.js";
import { groqModels, GROQ_FREE, cerebrasModel, CEREBRAS_FREE } from "../providers.js";

const num = (v, d) => (v !== undefined && v !== "" && !isNaN(+v) ? +v : d);
const WORKERS_AI_FREE = 10000; // neurons a day on the Workers free plan

export async function usageReport({ env, db, now }) {
  const day = utcDay(now);
  const usage = await getUsage(db, day);
  const share = num(env.ORG_BUDGET_SHARE, 0.6);
  const w = usage["workers-ai"] || { neurons: 0, tokens: 0, requests: 0 };
  const providers = [{
    key: "workers-ai", name: env.AI_MODEL || "@cf/meta/llama-4-scout-17b-16e-instruct", unit: "neurons", configured: !!env.AI,
    used: Math.round(w.neurons), budget: num(env.DAILY_NEURON_BUDGET, 9000), free: WORKERS_AI_FREE, tokens: w.tokens, requests: w.requests,
  }];
  for (const g of groqModels(env)) {
    const u = usage["groq:" + g.model] || { tokens: 0, requests: 0 };
    const known = GROQ_FREE.find((m) => m.model === g.model);
    providers.push({ key: "groq:" + g.model, name: g.model, unit: "tokens", configured: !!env.GROQ_API_KEY,
      used: groqTokens(usage, g.model), budget: g.budget, free: known ? known.tpd : null, tokens: groqTokens(usage, g.model), requests: u.requests + (g.model === "openai/gpt-oss-120b" && usage.groq ? usage.groq.requests : 0) });
  }
  const cb = cerebrasModel(env);
  if (cb) {
    const u = usage["cerebras:" + cb.model] || { tokens: 0, requests: 0 };
    providers.splice(1, 0, { key: "cerebras:" + cb.model, name: "Cerebras " + cb.model, unit: "tokens", configured: true, used: u.tokens, budget: cb.budget,
      free: cb.model === CEREBRAS_FREE.model ? CEREBRAS_FREE.tpd : null, tokens: u.tokens, requests: u.requests });
  }
  const vis = await db.prepare("SELECT COALESCE(SUM(count), 0) AS messages, COUNT(*) AS visitors FROM visitor_usage WHERE day = ?").bind(day).first();
  const users = (await db.prepare("SELECT u.email, a.count FROM ai_usage a JOIN users u ON u.id = a.user_id WHERE a.day = ? ORDER BY a.count DESC LIMIT 50").bind(day).all()).results || [];
  const since = utcDay(now - 6 * 864e5);
  const week = (await db.prepare("SELECT day, provider, neurons, tokens, requests FROM usage WHERE day >= ? ORDER BY day DESC, provider").bind(since).all()).results || [];
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = utcDay(now - i * 864e5), rows = week.filter((r) => r.day === d);
    days.push({ day: d, requests: rows.filter((r) => !r.provider.startsWith("agent:") && !r.provider.startsWith("cache:")).reduce((s, r) => s + r.requests, 0), neurons: Math.round(rows.filter((r) => r.provider === "workers-ai").reduce((s, r) => s + r.neurons, 0)),
      groqTokens: rows.filter((r) => r.provider.startsWith("groq")).reduce((s, r) => s + r.tokens, 0),
      cached: rows.filter((r) => r.provider.startsWith("cache:")).reduce((s, r) => s + r.requests, 0) });
  }
  // Today's use per function (rows "agent:<name>", written by src/org/ai.js), largest first.
  const agents = Object.entries(usage).filter(([k]) => k.startsWith("agent:")).map(([k, v]) => ({ key: k.slice(6), neurons: Math.round(v.neurons), tokens: v.tokens, requests: v.requests }))
    .sort((a, b) => b.neurons - a.neurons || b.tokens - a.tokens);
  // Answers given from the cache today (rows "cache:<agent>"): requests and tokens the providers did not have to serve.
  const cached = Object.entries(usage).filter(([k]) => k.startsWith("cache:")).map(([k, v]) => ({ key: k.slice(6), requests: v.requests, tokens: v.tokens }));
  return {
    day, resetAt: nextReset(now), agents, cached, workspaceShare: share, perUserLimit: num(env.ORG_AI_PER_USER, 20), visitorLimit: num(env.DAILY_VISITOR_LIMIT, 10),
    providers, assistant: { messages: vis ? vis.messages : 0, visitors: vis ? vis.visitors : 0 },
    workspace: { actions: users.reduce((s, u) => s + u.count, 0), users: users.map((u) => ({ email: u.email, count: u.count })) }, days,
  };
}
