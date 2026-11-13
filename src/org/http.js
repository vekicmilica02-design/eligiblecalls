// Small helpers shared by the Organization Intelligence API.

export const json = (obj, status = 200, headers = {}) =>
  new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers } });
export const fail = (status, error, extra = {}) => json({ error, ...extra }, status);

export class HttpError extends Error {
  constructor(status, code, extra = {}) { super(code); this.status = status; this.code = code; this.extra = extra; }
}

// Body as JSON, with a size limit. Cloudflare passes content-length for normal requests.
export async function readJson(request, max = 64000) {
  const len = +(request.headers.get("content-length") || 0);
  if (len > max) throw new HttpError(413, "too_large");
  const text = await request.text();
  if (text.length > max) throw new HttpError(413, "too_large");
  try { const v = JSON.parse(text || "{}"); if (!v || typeof v !== "object" || Array.isArray(v)) throw 0; return v; }
  catch { throw new HttpError(400, "bad_request"); }
}

// State-changing requests must carry a custom header. Browsers send it cross-site only after a CORS
// preflight, which this API never approves, so a page on another site cannot act with the user's cookie.
export function checkCsrf(request) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return;
  if (request.headers.get("x-requested-with") !== "eligiblecalls") throw new HttpError(403, "csrf");
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) throw new HttpError(403, "csrf");
}

export function cookie(request, name) {
  const h = request.headers.get("cookie") || "";
  for (const part of h.split(/;\s*/)) { const i = part.indexOf("="); if (i > 0 && part.slice(0, i) === name) return decodeURIComponent(part.slice(i + 1)); }
  return null;
}

const b64url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
export const randomToken = (n = 32) => b64url(crypto.getRandomValues(new Uint8Array(n)));
export const randomId = () => [...crypto.getRandomValues(new Uint8Array(12))].map((b) => b.toString(16).padStart(2, "0")).join("");
export async function sha256(s) {
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function verifyTurnstile(env, token, ip, fetchImpl = fetch) {
  if (!env.TURNSTILE_SECRET) return true;
  if (!token) return false;
  const form = new FormData();
  form.append("secret", env.TURNSTILE_SECRET); form.append("response", token); if (ip) form.append("remoteip", ip);
  const r = await fetchImpl("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: form });
  const j = await r.json().catch(() => ({}));
  return !!j.success;
}

export const utcDay = (now) => new Date(now).toISOString().slice(0, 10);

// Daily counter; returns the new count.
export async function bump(db, day, key) {
  const r = await db.prepare("INSERT INTO rate_limits (day, key, count) VALUES (?, ?, 1) ON CONFLICT(day, key) DO UPDATE SET count = count + 1 RETURNING count").bind(day, key).first();
  if (Math.random() < 0.02) await db.prepare("DELETE FROM rate_limits WHERE day < ?").bind(day).run();
  return r ? r.count : 1;
}

let TAX = null;
export async function taxonomy(env, url) {
  if (TAX) return TAX;
  const r = await env.ASSETS.fetch(new URL("/data/taxonomy.json", url));
  if (!r.ok) throw new HttpError(503, "data_unavailable");
  TAX = await r.json();
  return TAX;
}
export function _resetTaxonomy() { TAX = null; }
