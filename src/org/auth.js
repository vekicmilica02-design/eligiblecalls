// Sign-in and sessions (HttpOnly cookie; only hashes of session ids are stored).
// Google sign-in (OpenID Connect, authorisation code flow with PKCE) is the default: it confirms the
// e-mail address without sending any e-mail. Sign-in by one-time e-mail link stays available behind
// EMAIL_LOGIN = "1" for when a sending domain exists; its token travels in the URL fragment
// (#signin=...), so it never reaches server logs.

import { HttpError, json, randomToken, randomId, sha256, verifyTurnstile, bump, utcDay, cookie } from "./http.js";
import { sendEmail, mailText } from "./email.js";

export const TERMS_VERSION = "2026-11-14";
const LINK_MINUTES = 20;
const SESSION_DAYS = 30;
const COOKIE = "ec_session";
const EMAIL_RE = /^[^\s@<>()",;:]{1,64}@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/;

export function cleanEmail(v) {
  const e = String(v || "").trim().toLowerCase();
  return e.length <= 254 && EMAIL_RE.test(e) ? e : null;
}

export async function requestLink({ request, env, body, now, fetchImpl }) {
  if (env.EMAIL_LOGIN !== "1") throw new HttpError(404, "email_login_off");
  const email = cleanEmail(body.email);
  if (!email) throw new HttpError(400, "email");
  if (body.accept !== true) throw new HttpError(400, "terms");
  const ip = request.headers.get("cf-connecting-ip") || "";
  if (!(await verifyTurnstile(env, body.turnstile, ip, fetchImpl))) throw new HttpError(403, "verification");
  const day = utcDay(now);
  const db = env.DB;
  if ((await bump(db, day, "mail:" + email)) > (+env.LOGIN_LINKS_PER_EMAIL || 5)) throw new HttpError(429, "too_many");
  if ((await bump(db, day, "ip:" + (await sha256(ip + "|" + day + "|" + (env.HASH_SALT || "eligiblecalls"))).slice(0, 24))) > (+env.LOGIN_LINKS_PER_IP || 20)) throw new HttpError(429, "too_many");

  const token = randomToken();
  const lang = body.lang === "sr" ? "sr" : "en";
  await db.prepare("INSERT INTO login_tokens (token_hash, email, created_at, expires_at, lang, news_opt_in) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(await sha256(token), email, now, now + LINK_MINUTES * 60000, lang, body.news === true ? 1 : 0).run();
  if (Math.random() < 0.05) await db.prepare("DELETE FROM login_tokens WHERE expires_at < ?").bind(now - 864e5).run();

  const link = `${env.SITE_URL || new URL(request.url).origin}/#signin=${token}`;
  const T = mailText(lang);
  if (env.DEV_LOGIN_LINKS === "1") return json({ ok: true, devLink: link });
  const r = await sendEmail(env, { to: email, subject: T.signinSubject, text: T.signinBody(link, LINK_MINUTES) }, fetchImpl);
  if (!r.sent) throw new HttpError(503, "email_unavailable");
  return json({ ok: true });
}

export async function verifyLink({ env, body, now }) {
  const token = typeof body.token === "string" ? body.token : "";
  if (!/^[A-Za-z0-9_-]{30,60}$/.test(token)) throw new HttpError(400, "link_invalid");
  const db = env.DB;
  const hash = await sha256(token);
  // One use only: the UPDATE succeeds for exactly one request.
  const used = await db.prepare("UPDATE login_tokens SET used_at = ? WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?").bind(now, hash, now).run();
  if (!used.meta || used.meta.changes !== 1) throw new HttpError(400, "link_invalid");
  const tok = await db.prepare("SELECT email, lang, news_opt_in FROM login_tokens WHERE token_hash = ?").bind(hash).first();

  const session = await loginUser(env, { email: tok.email, lang: tok.lang, news: !!tok.news_opt_in, now });
  return json({ ok: true }, 200, { "set-cookie": session });
}

// Find or create the user, turn pending invitations into memberships, open a session.
// Returns the Set-Cookie value of the new session.
export async function loginUser(env, { email, googleSub = null, name = null, lang = "en", news = false, now }) {
  const db = env.DB;
  let user = googleSub ? await db.prepare("SELECT id, email FROM users WHERE google_sub = ?").bind(googleSub).first() : null;
  if (!user) user = await db.prepare("SELECT id, email FROM users WHERE email = ?").bind(email).first();
  if (!user) {
    user = { id: randomId(), email };
    await db.prepare("INSERT INTO users (id, email, google_sub, created_at, last_login_at, lang, terms_version, terms_at, news_opt_in, news_opt_in_at, name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(user.id, email, googleSub, now, now, lang, TERMS_VERSION, now, news ? 1 : 0, news ? now : null, name).run();
  } else {
    await db.prepare("UPDATE users SET last_login_at = ?, google_sub = COALESCE(google_sub, ?), name = COALESCE(?, name) WHERE id = ?").bind(now, googleSub, name, user.id).run();
    // The Google account's address changed: follow it, unless another account already uses the new address.
    if (user.email !== email && !(await db.prepare("SELECT 1 FROM users WHERE email = ?").bind(email).first())) {
      await db.prepare("UPDATE users SET email = ? WHERE id = ?").bind(email, user.id).run();
    }
    if (news) await db.prepare("UPDATE users SET news_opt_in = 1, news_opt_in_at = COALESCE(news_opt_in_at, ?) WHERE id = ?").bind(now, user.id).run();
  }
  // Invitations sent to this address become memberships.
  const inv = (await db.prepare("SELECT org_id, role, invited_by FROM org_invites WHERE email = ?").bind(email).all()).results || [];
  for (const i of inv) {
    await db.prepare("INSERT OR IGNORE INTO org_members (org_id, user_id, role, added_by, created_at) VALUES (?, ?, ?, ?, ?)").bind(i.org_id, user.id, i.role, i.invited_by, now).run();
  }
  if (inv.length) await db.prepare("DELETE FROM org_invites WHERE email = ?").bind(email).run();

  const sid = randomToken();
  await db.prepare("INSERT INTO sessions (id_hash, user_id, created_at, expires_at, last_seen) VALUES (?, ?, ?, ?, ?)")
    .bind(await sha256(sid), user.id, now, now + SESSION_DAYS * 864e5, now).run();
  if (Math.random() < 0.05) await db.prepare("DELETE FROM sessions WHERE expires_at < ?").bind(now).run();
  return `${COOKIE}=${sid}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}`;
}

// ---------- Google sign-in ----------
const OAUTH_COOKIE = "ec_oauth";
const GOOGLE_AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN = "https://oauth2.googleapis.com/token";
const siteOf = (env, request) => (env.SITE_URL || new URL(request.url).origin).replace(/\/+$/, "");
const b64urlJson = (o) => btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64url = (s) => { const t = s.replace(/-/g, "+").replace(/_/g, "/"); return decodeURIComponent(escape(atob(t + "===".slice((t.length + 3) % 4)))); };
async function pkceChallenge(verifier) {
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
  return btoa(String.fromCharCode(...h)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function redirect(location, cookies = []) {
  const h = new Headers({ location, "cache-control": "no-store" });
  for (const c of cookies) h.append("set-cookie", c);
  return new Response(null, { status: 302, headers: h });
}
const clearOauth = `${OAUTH_COOKIE}=; Path=/api/auth/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;

// GET /api/auth/google?accept=1&news=0|1&lang=en|sr
export async function googleStart({ request, env }) {
  const site = siteOf(env, request);
  const q = new URL(request.url).searchParams;
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) return redirect(site + "/#org/signin-error/google_off");
  if (q.get("accept") !== "1") return redirect(site + "/#org/signin-error/terms");
  const st = { s: randomToken(24), v: randomToken(48), n: randomToken(24), l: q.get("lang") === "sr" ? "sr" : "en", w: q.get("news") === "1" ? 1 : 0 };
  const url = new URL(GOOGLE_AUTH);
  url.search = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID, redirect_uri: site + "/api/auth/google/callback", response_type: "code", scope: "openid email profile",
    state: st.s, nonce: st.n, code_challenge: await pkceChallenge(st.v), code_challenge_method: "S256", prompt: "select_account",
  }).toString();
  return redirect(url.href, [`${OAUTH_COOKIE}=${b64urlJson(st)}; Path=/api/auth/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`]);
}

// GET /api/auth/google/callback?code=...&state=...
export async function googleCallback({ request, env, now, fetchImpl = fetch }) {
  const site = siteOf(env, request);
  const fail = (code) => redirect(site + "/#org/signin-error/" + code, [clearOauth]);
  const q = new URL(request.url).searchParams;
  if (q.get("error")) return fail("google_cancelled");
  let st = null;
  try { st = JSON.parse(fromB64url(cookie(request, OAUTH_COOKIE) || "")); } catch { st = null; }
  if (!st || !st.s || q.get("state") !== st.s || !q.get("code")) return fail("google_state");
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) return fail("google_off");
  // The ID token comes straight from Google's token endpoint over HTTPS, authenticated with the client
  // secret, so its origin is established by TLS; the claims are still checked below.
  const r = await fetchImpl(GOOGLE_TOKEN, {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code: q.get("code"), client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, redirect_uri: site + "/api/auth/google/callback", grant_type: "authorization_code", code_verifier: st.v }).toString(),
  }).catch(() => null);
  if (!r || !r.ok) return fail("google_failed");
  const tok = await r.json().catch(() => ({}));
  let claims = null;
  try { claims = JSON.parse(fromB64url(String(tok.id_token || "").split(".")[1] || "")); } catch { claims = null; }
  if (!claims || !["https://accounts.google.com", "accounts.google.com"].includes(claims.iss) || claims.aud !== env.GOOGLE_CLIENT_ID
      || !(claims.exp * 1000 > now) || claims.nonce !== st.n || !claims.sub) return fail("google_failed");
  const email = cleanEmail(claims.email);
  if (!email || claims.email_verified !== true) return fail("google_unverified");
  // Display name (scope "profile"): used in the administrator's notifications and dashboard.
  const name = typeof claims.name === "string" && claims.name.trim() ? claims.name.trim().slice(0, 120) : null;
  const session = await loginUser(env, { email, googleSub: String(claims.sub), name, lang: st.l, news: st.w === 1, now });
  return redirect(site + "/#org", [session, clearOauth]);
}

export async function currentUser(request, env, now) {
  const sid = cookie(request, COOKIE);
  if (!sid || sid.length > 100) return null;
  const hash = await sha256(sid);
  const row = await env.DB.prepare(
    "SELECT u.id, u.email, u.name, u.lang, u.news_opt_in, u.created_at, s.expires_at, s.last_seen FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id_hash = ?"
  ).bind(hash).first();
  if (!row || row.expires_at <= now) return null;
  if (now - row.last_seen > 864e5) await env.DB.prepare("UPDATE sessions SET last_seen = ?, expires_at = ? WHERE id_hash = ?").bind(now, now + SESSION_DAYS * 864e5, hash).run();
  return { id: row.id, email: row.email, name: row.name || "", lang: row.lang, news: !!row.news_opt_in, createdAt: row.created_at, sessionHash: hash };
}

export async function logout(env, user) {
  if (user) await env.DB.prepare("DELETE FROM sessions WHERE id_hash = ?").bind(user.sessionHash).run();
  return json({ ok: true }, 200, { "set-cookie": `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0` });
}
