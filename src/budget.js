// Daily usage counters in D1. Days are UTC because the Workers AI free allocation resets at 00:00 UTC.

export const utcDay = (now) => new Date(now).toISOString().slice(0, 10);
export const nextReset = (now) => { const d = new Date(now); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1); };

export async function getUsage(db, day) {
  const out = { "workers-ai": { neurons: 0, tokens: 0, requests: 0 }, groq: { neurons: 0, tokens: 0, requests: 0 } };
  if (!db) return out;
  const { results } = await db.prepare("SELECT provider, neurons, tokens, requests FROM usage WHERE day = ?").bind(day).all();
  for (const r of results || []) out[r.provider] = { neurons: r.neurons, tokens: r.tokens, requests: r.requests };
  return out;
}

export async function addUsage(db, day, provider, neurons, tokens) {
  if (!db) return;
  await db.prepare(
    "INSERT INTO usage (day, provider, neurons, tokens, requests) VALUES (?, ?, ?, ?, 1) " +
    "ON CONFLICT(day, provider) DO UPDATE SET neurons = neurons + excluded.neurons, tokens = tokens + excluded.tokens, requests = requests + 1"
  ).bind(day, provider, neurons, tokens).run();
}

// Counts one message for a visitor. The visitor key is a salted hash of IP and day; the IP is not stored.
export async function visitorHit(db, day, vhash) {
  if (!db) return 1;
  const r = await db.prepare(
    "INSERT INTO visitor_usage (day, vhash, count) VALUES (?, ?, 1) " +
    "ON CONFLICT(day, vhash) DO UPDATE SET count = count + 1 RETURNING count"
  ).bind(day, vhash).first();
  if (Math.random() < 0.02) await db.prepare("DELETE FROM visitor_usage WHERE day < ?").bind(day).run();
  return r ? r.count : 1;
}

export async function visitorHash(ip, day, salt) {
  const data = new TextEncoder().encode(`${ip}|${day}|${salt}`);
  const h = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(h)].slice(0, 12).map((b) => b.toString(16).padStart(2, "0")).join("");
}
