// node test/org-api.test.js  (no network: D1 on node:sqlite, test doubles for the model and web pages)
import assert from "node:assert/strict";
import { handleApi } from "../src/org/api.js";
import { _resetTaxonomy } from "../src/org/http.js";
import { verifyFields, robotsAllows, checkPublicUrl, aboutLinks, matchKey } from "../src/org/extract.js";
import { parseJsonObject } from "../src/org/ai.js";
import { contextFrom } from "../site/org/schema.js";
import { mockD1, mockAssets, sseStream } from "./mocks.js";
import { readFileSync } from "node:fs";

let pass = 0;
const t = async (name, fn) => { try { await fn(); pass++; console.log("ok  ", name); } catch (e) { console.log("FAIL", name); throw e; } };
const BASE = "https://eligiblecalls.pages.dev";
let NOW = Date.parse("2026-11-13T12:00:00Z");

let aiAnswer = "{}";
const aiSeen = [];
const env = {
  DB: mockD1(), ASSETS: mockAssets(), DEV_LOGIN_LINKS: "1", EMAIL_LOGIN: "1", ADMIN_EMAILS: "admin@example.org",
  GOOGLE_CLIENT_ID: "client-123.apps.googleusercontent.com", GOOGLE_CLIENT_SECRET: "secret", SITE_URL: "https://eligiblecalls.pages.dev",
  AI: { run: async (model, input) => { aiSeen.push(input); return sseStream([{ response: aiAnswer }, { response: "", usage: { prompt_tokens: 3000, completion_tokens: 400 } }]); } },
};
let web = {};
const fetchImpl = async (url, init) => {
  const u = String(url);
  if (u in web) { const [status, type, body, headers] = web[u]; return new Response(body, { status, headers: { "content-type": type, ...(headers || {}) } }); }
  return new Response("not found", { status: 404, headers: { "content-type": "text/html" } });
};
async function call(method, path, { body, cookie, csrf = true, headers = {} } = {}) {
  const h = { "content-type": "application/json", "cf-connecting-ip": "203.0.113.9", ...headers };
  if (csrf) h["x-requested-with"] = "eligiblecalls";
  if (cookie) h.cookie = cookie;
  const req = new Request(BASE + path, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
  const r = await handleApi({ request: req, env, now: NOW, fetchImpl });
  const text = await r.text();
  let j = null; try { j = JSON.parse(text); } catch { j = text; }
  return { status: r.status, j, setCookie: r.headers.get("set-cookie") || "" };
}
async function signIn(email, extra = {}) {
  const a = await call("POST", "/api/auth/request", { body: { email, accept: true, ...extra } });
  assert.equal(a.status, 200, JSON.stringify(a.j));
  const token = a.j.devLink.split("#signin=")[1];
  const v = await call("POST", "/api/auth/verify", { body: { token } });
  assert.equal(v.status, 200);
  return v.setCookie.split(";")[0];
}

await t("state-changing requests need the site's header", async () => {
  assert.equal((await call("POST", "/api/auth/request", { body: { email: "a@example.org", accept: true }, csrf: false })).status, 403);
  assert.equal((await call("POST", "/api/auth/request", { body: { email: "a@example.org", accept: true }, headers: { origin: "https://evil.example" } })).status, 403);
});

let alice, bob;
await t("sign-in link: valid e-mail and privacy consent required; link works once", async () => {
  assert.equal((await call("POST", "/api/auth/request", { body: { email: "not-an-email", accept: true } })).j.error, "email");
  assert.equal((await call("POST", "/api/auth/request", { body: { email: "alice@example.org" } })).j.error, "terms");
  const a = await call("POST", "/api/auth/request", { body: { email: "Alice@Example.org", accept: true, news: true, lang: "sr" } });
  const token = a.j.devLink.split("#signin=")[1];
  assert.ok(a.j.devLink.startsWith(BASE + "/#signin="));
  const v = await call("POST", "/api/auth/verify", { body: { token } });
  assert.equal(v.status, 200);
  assert.match(v.setCookie, /^ec_session=[A-Za-z0-9_-]+; Path=\/; HttpOnly; Secure; SameSite=Lax/);
  assert.equal((await call("POST", "/api/auth/verify", { body: { token } })).j.error, "link_invalid");
  alice = v.setCookie.split(";")[0];
  const me = await call("GET", "/api/me", { cookie: alice });
  assert.equal(me.j.user.email, "alice@example.org");
  assert.equal(me.j.user.news, true);
  const row = env.DB._db.prepare("SELECT * FROM login_tokens").get();
  assert.notEqual(row.token_hash, token, "only the hash is stored");
});

await t("expired links fail; too many links per address are refused", async () => {
  const a = await call("POST", "/api/auth/request", { body: { email: "late@example.org", accept: true } });
  NOW += 21 * 60000;
  assert.equal((await call("POST", "/api/auth/verify", { body: { token: a.j.devLink.split("#signin=")[1] } })).j.error, "link_invalid");
  NOW -= 21 * 60000;
  for (let i = 0; i < 4; i++) await call("POST", "/api/auth/request", { body: { email: "late@example.org", accept: true } });
  assert.equal((await call("POST", "/api/auth/request", { body: { email: "late@example.org", accept: true } })).status, 429);
});

await t("signed-out requests to organisations need sign-in", async () => {
  assert.equal((await call("GET", "/api/orgs")).status, 401);
  assert.equal((await call("GET", "/api/me")).j.user, null);
});

let org;
await t("create organisation, save profile with validation and versions", async () => {
  const c = await call("POST", "/api/orgs", { cookie: alice, body: { name: "Udruženje Mladi" } });
  assert.equal(c.status, 201);
  org = c.j.id;
  let g = await call("GET", `/api/orgs/${org}`, { cookie: alice });
  assert.equal(g.j.role, "owner"); assert.equal(g.j.version, 1); assert.equal(g.j.profile.name, "Udruženje Mladi");
  const bad = await call("PUT", `/api/orgs/${org}/profile`, { cookie: alice, body: { profile: { name: "X", orgType: "spaceship" }, baseVersion: 1 } });
  assert.equal(bad.status, 400); assert.deepEqual(bad.j.fields, { orgType: "enum" });
  const ok = await call("PUT", `/api/orgs/${org}/profile`, { cookie: alice, body: { profile: { name: "Udruženje Mladi", orgType: "ngo", country: "RS", city: "Novi Sad", activityAreas: ["youth"] }, baseVersion: 1, note: "manual" } });
  assert.equal(ok.status, 200); assert.equal(ok.j.version, 2); assert.deepEqual(ok.j.changed, ["orgType", "country", "city", "activityAreas"]);
  const stale = await call("PUT", `/api/orgs/${org}/profile`, { cookie: alice, body: { profile: { name: "Other" }, baseVersion: 1 } });
  assert.equal(stale.status, 409);
  const same = await call("PUT", `/api/orgs/${org}/profile`, { cookie: alice, body: { profile: { name: "Udruženje Mladi", orgType: "ngo", country: "RS", city: "Novi Sad", activityAreas: ["youth"] }, baseVersion: 2 } });
  assert.equal(same.j.version, 2, "no new version without a change");
  const vs = await call("GET", `/api/orgs/${org}/versions`, { cookie: alice });
  assert.deepEqual(vs.j.versions.map((v) => v.version), [2, 1]);
  assert.equal(vs.j.versions[0].by, "alice@example.org");
  assert.equal((await call("GET", `/api/orgs/${org}/versions/1`, { cookie: alice })).j.profile.name, "Udruženje Mladi");
});

await t("another user cannot see or change the organisation", async () => {
  bob = await signIn("bob@example.org");
  assert.equal((await call("GET", `/api/orgs/${org}`, { cookie: bob })).status, 404);
  assert.equal((await call("PUT", `/api/orgs/${org}/profile`, { cookie: bob, body: { profile: { name: "Hijack" } } })).status, 404);
  assert.equal((await call("GET", `/api/orgs/${org}/versions/2`, { cookie: bob })).status, 404);
  assert.equal((await call("DELETE", `/api/orgs/${org}`, { cookie: bob })).status, 404);
  assert.equal((await call("POST", `/api/orgs/${org}/extract`, { cookie: bob, body: { text: "x".repeat(200) } })).status, 404);
  assert.equal((await call("GET", `/api/orgs`, { cookie: bob })).j.orgs.length, 0);
  assert.equal((await call("GET", `/api/orgs/../../me`, { cookie: bob })).status, 404);
});

let carol;
await t("roles: invited viewer reads only; editor edits; only the owner manages members and deletes", async () => {
  assert.equal((await call("POST", `/api/orgs/${org}/members`, { cookie: alice, body: { email: "carol@example.org", role: "viewer" } })).j.invited, true);
  carol = await signIn("carol@example.org"); // the invitation becomes a membership at sign-in
  assert.equal((await call("GET", `/api/orgs/${org}`, { cookie: carol })).j.role, "viewer");
  assert.equal((await call("PUT", `/api/orgs/${org}/profile`, { cookie: carol, body: { profile: { name: "Changed" } } })).status, 403);
  assert.equal((await call("POST", `/api/orgs/${org}/extract`, { cookie: carol, body: { text: "x".repeat(200) } })).status, 403);
  const members = (await call("GET", `/api/orgs/${org}/members`, { cookie: carol })).j.members;
  const carolId = members.find((m) => m.email === "carol@example.org").id;
  assert.equal((await call("PATCH", `/api/orgs/${org}/members/${carolId}`, { cookie: carol, body: { role: "owner" } })).status, 403);
  assert.equal((await call("PATCH", `/api/orgs/${org}/members/${carolId}`, { cookie: alice, body: { role: "editor" } })).status, 200);
  assert.equal((await call("PUT", `/api/orgs/${org}/profile`, { cookie: carol, body: { profile: { name: "Udruženje Mladi", orgType: "ngo", country: "RS" } } })).status, 200);
  assert.equal((await call("DELETE", `/api/orgs/${org}`, { cookie: carol })).status, 403);
  assert.equal((await call("POST", `/api/orgs/${org}/members`, { cookie: carol, body: { email: "x@example.org", role: "owner" } })).status, 403);
  const aliceId = members.find((m) => m.email === "alice@example.org").id;
  assert.equal((await call("DELETE", `/api/orgs/${org}/members/${aliceId}`, { cookie: alice })).j.error, "last_owner");
  assert.equal((await call("POST", `/api/orgs/${org}/leave`, { cookie: alice })).j.error, "last_owner");
});

await t("document extraction: quotes checked against the text, personal numbers removed, nothing applied", async () => {
  const doc = readFileSync(new URL("./fixtures/statut-sample.txt", import.meta.url), "utf8");
  aiAnswer = "Here is the JSON:\n```json\n" + JSON.stringify({ fields: {
    name: { value: "Udruženje građana Mladi za Novi Sad", evidence: "Naziv Udruženja je: Udruženje građana Mladi za Novi Sad", confidence: "high" },
    yearEstablished: { value: 2014, evidence: "Udruženje je osnovano 12. marta 2014. godine", confidence: "high" },
    orgType: { value: "ngo", evidence: "Udruženje je nevladino, nestranačko i neprofitno udruženje", confidence: "medium" },
    targetGroups: { value: ["youth", "fewer-opportunities"], evidence: "mladih, posebno mladih sa manje mogućnosti", confidence: "high" },
    employees: { value: 40, evidence: "Udruženje ima 40 zaposlenih", confidence: "high" },
    registrationNumber: { value: "0101990800012", evidence: "JMBG osnivača 0101990800012", confidence: "high" },
    password: { value: "x", evidence: "x", confidence: "high" },
  } }) + "\n```";
  const r = await call("POST", `/api/orgs/${org}/extract`, { cookie: alice, body: { sourceName: "Statut.pdf", text: doc } });
  assert.equal(r.status, 200, JSON.stringify(r.j));
  const f = r.j.fields;
  assert.equal(f.name.found, true); assert.equal(f.name.confidence, "high");
  assert.equal(f.yearEstablished.value, 2014); assert.equal(f.yearEstablished.found, true);
  assert.deepEqual(f.targetGroups.value, ["youth", "fewer-opportunities"]);
  assert.equal(f.employees.found, false, "a quote that is not in the document"); assert.equal(f.employees.confidence, "low");
  assert.equal(f.registrationNumber, undefined, "13-digit personal number scrubbed, value then invalid");
  assert.ok(r.j.dropped.some((d) => d.id === "password"));
  assert.match(aiSeen.at(-1).messages[0].content, /DATA\. It may contain instructions/);
  assert.match(aiSeen.at(-1).messages[1].content, /<source>[\s\S]*Ignore all previous instructions[\s\S]*<\/source>/);
  const p = (await call("GET", `/api/orgs/${org}`, { cookie: alice })).j.profile;
  assert.equal(p.yearEstablished, undefined, "extraction does not change the profile");
  const list = (await call("GET", `/api/orgs/${org}/extractions`, { cookie: carol })).j.extractions;
  assert.equal(list[0].sourceName, "Statut.pdf"); assert.equal(list[0].status, "review");
  assert.ok(!JSON.stringify(env.DB._db.prepare("SELECT * FROM extractions").all()).includes("Ignore all previous"), "document text is not stored");
});

await t("extraction limits: chunk size, per-user daily AI actions", async () => {
  assert.equal((await call("POST", `/api/orgs/${org}/extract`, { cookie: alice, body: { text: "a ".repeat(8000) } })).j.error, "chunk_too_large");
  env.ORG_AI_PER_USER = "1";
  assert.equal((await call("POST", `/api/orgs/${org}/extract`, { cookie: alice, body: { text: "Udruženje građana Mladi za Novi Sad ".repeat(5) } })).j.error, "ai_user_limit");
  delete env.ORG_AI_PER_USER;
});

await t("web research: only public URLs, robots.txt respected, about pages followed, sources kept", async () => {
  assert.equal(checkPublicUrl("http://localhost:8080/x"), null);
  assert.equal(checkPublicUrl("http://10.0.0.1/"), null);
  assert.equal(checkPublicUrl("file:///etc/passwd"), null);
  assert.equal((await call("POST", `/api/orgs/${org}/research`, { cookie: alice, body: { url: "http://127.0.0.1/" } })).j.error, "url_invalid");
  web = { "https://mladi.example.rs/robots.txt": [200, "text/plain", "User-agent: *\nDisallow: /private\n"],
    "https://mladi.example.rs/": [200, "text/html", '<html><title>Mladi NS</title><body><h1>Mladi za Novi Sad</h1><p>Radimo sa mladima od 2014.</p><a href="/o-nama">O nama</a><a href="/private/x">x</a><script>alert(1)</script></body></html>'],
    "https://mladi.example.rs/o-nama": [200, "text/html; charset=utf-8", "<p>Naša misija je osnaživanje mladih sa manje mogućnosti kroz neformalno obrazovanje.</p>"] };
  aiAnswer = JSON.stringify({ fields: { mission: { value: "Osnaživanje mladih sa manje mogućnosti kroz neformalno obrazovanje.", evidence: "Naša misija je osnaživanje mladih sa manje mogućnosti kroz neformalno obrazovanje.", confidence: "high" } } });
  const r = await call("POST", `/api/orgs/${org}/research`, { cookie: alice, body: { url: "mladi.example.rs" } });
  assert.equal(r.status, 200, JSON.stringify(r.j));
  assert.deepEqual(r.j.pages, ["https://mladi.example.rs/", "https://mladi.example.rs/o-nama"]);
  assert.equal(r.j.fields.mission.found, true);
  assert.equal(r.j.fields.mission.sourceUrl, "https://mladi.example.rs/o-nama");
  assert.ok(!aiSeen.at(-1).messages[1].content.includes("alert(1)"), "scripts removed");
  assert.equal((await call("POST", `/api/orgs/${org}/research`, { cookie: alice, body: { url: "https://mladi.example.rs/private/page" } })).j.error, "robots_disallow");
  assert.equal(robotsAllows("User-agent: *\nDisallow: /\nUser-agent: EligibleCallsBot\nAllow: /\n", "/x"), true);
  assert.equal(robotsAllows("User-agent: *\nDisallow: /\n", "/x"), false);
  assert.deepEqual(aboutLinks('<a href="https://other.example/about">About</a><a href="/team">Team</a>', new URL("https://a.example/")), ["https://a.example/team"]);
});

await t("quote check normalises case, accents, quotes and Cyrillic", () => {
  assert.equal(matchKey("Удружење „Млади“"), matchKey("udruzenje Mladi"));
  const ctx = contextFrom(JSON.parse(readFileSync(new URL("../site/data/taxonomy.json", import.meta.url))), 2026);
  const v = verifyFields({ fields: { city: { value: "Novi Sad", evidence: "sedište je u Novom Sadu", confidence: "high" } } }, "Sedište udruženja je u Novom Sadu.", ctx);
  assert.equal(v.fields.city.found, false, "the value itself must appear in the quote for short fields");
  assert.deepEqual(parseJsonObject('noise {"a": {"b": "}"}} tail'), { a: { b: "}" } });
});

await t("admin export lists users with their news consent; hidden from others", async () => {
  assert.equal((await call("GET", "/api/admin/users.csv", { cookie: alice })).status, 404);
  const admin = await signIn("admin@example.org");
  const r = await call("GET", "/api/admin/users.csv", { cookie: admin });
  assert.equal(r.status, 200);
  assert.match(r.j, /^email,created,/);
  assert.match(r.j, /"alice@example.org",[^\n]*,sr,yes,/);
  assert.match(r.j, /"bob@example.org",[^\n]*,en,no,/);
});

await t("account deletion: blocked while sole owner of a shared organisation; removes own data", async () => {
  assert.equal((await call("DELETE", "/api/me", { cookie: alice })).j.error, "transfer_ownership");
  const solo = (await call("POST", "/api/orgs", { cookie: bob, body: { name: "Bob's org" } })).j.id;
  const d = await call("DELETE", "/api/me", { cookie: bob });
  assert.equal(d.j.deletedOrgs, 1);
  assert.equal(env.DB._db.prepare("SELECT COUNT(*) n FROM organizations WHERE id = ?").get(solo).n, 0);
  assert.equal(env.DB._db.prepare("SELECT COUNT(*) n FROM users WHERE email = 'bob@example.org'").get().n, 0);
  assert.equal((await call("GET", "/api/me", { cookie: bob })).j.user, null, "session gone");
});

await t("owner deletes the organisation: profile versions and extractions go with it", async () => {
  assert.equal((await call("DELETE", `/api/orgs/${org}`, { cookie: alice })).status, 200);
  for (const tb of ["profile_versions", "extractions", "org_members", "org_invites"]) assert.equal(env.DB._db.prepare(`SELECT COUNT(*) n FROM ${tb} WHERE org_id = ?`).get(org).n, 0, tb);
  assert.equal((await call("GET", `/api/orgs/${org}`, { cookie: carol })).status, 404);
});

// ---------- Google sign-in ----------
const b64u = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
let googleClaims = null, tokenCalls = [];
const googleFetch = async (url, init) => {
  if (String(url) === "https://oauth2.googleapis.com/token") {
    tokenCalls.push(Object.fromEntries(new URLSearchParams(init.body)));
    return new Response(JSON.stringify({ access_token: "x", id_token: "h." + b64u(googleClaims) + ".sig" }), { headers: { "content-type": "application/json" } });
  }
  return fetchImpl(url, init);
};
async function raw(path, { cookie } = {}) {
  const r = await handleApi({ request: new Request(BASE + path, { headers: cookie ? { cookie } : {} }), env, now: NOW, fetchImpl: googleFetch });
  return { status: r.status, location: r.headers.get("location"), cookies: r.headers.getSetCookie ? r.headers.getSetCookie() : [r.headers.get("set-cookie")] };
}
async function googleLogin(claims, { accept = "1", news = "0", tamper = false } = {}) {
  const s = await raw(`/api/auth/google?accept=${accept}&news=${news}&lang=sr`);
  if (s.status !== 302 || !s.location.startsWith("https://accounts.google.com/")) return { start: s };
  const u = new URL(s.location);
  const oauth = s.cookies.find((c) => c.startsWith("ec_oauth=")).split(";")[0];
  const nonce = u.searchParams.get("nonce");
  googleClaims = { iss: "https://accounts.google.com", aud: env.GOOGLE_CLIENT_ID, exp: Math.floor(NOW / 1000) + 3600, nonce, sub: "g-" + claims.email, email_verified: true, ...claims };
  const state = tamper ? "forged" : u.searchParams.get("state");
  return { start: s, cb: await raw(`/api/auth/google/callback?code=abc&state=${state}`, { cookie: oauth }), url: u };
}

await t("Google: start needs consent and configuration; sends state, nonce and PKCE", async () => {
  assert.equal((await raw("/api/auth/google?accept=0")).location, "https://eligiblecalls.pages.dev/#org/signin-error/terms");
  const { start, url } = await googleLogin({ email: "dana@example.org" });
  assert.equal(url.searchParams.get("client_id"), env.GOOGLE_CLIENT_ID);
  assert.equal(url.searchParams.get("redirect_uri"), "https://eligiblecalls.pages.dev/api/auth/google/callback");
  assert.equal(url.searchParams.get("scope"), "openid email");
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
  assert.match(start.cookies[0], /^ec_oauth=[^;]+; Path=\/api\/auth\/; HttpOnly; Secure; SameSite=Lax; Max-Age=600$/);
  const id = env.GOOGLE_CLIENT_ID; delete env.GOOGLE_CLIENT_ID;
  assert.equal((await raw("/api/auth/google?accept=1")).location, "https://eligiblecalls.pages.dev/#org/signin-error/google_off");
  env.GOOGLE_CLIENT_ID = id;
});

await t("Google: callback checks state and the ID token, then opens a session and records consent", async () => {
  const ok = await googleLogin({ email: "Dana@Example.org" }, { news: "1" });
  assert.equal(ok.cb.status, 302); assert.equal(ok.cb.location, "https://eligiblecalls.pages.dev/#org");
  const session = ok.cb.cookies.find((c) => c.startsWith("ec_session=")).split(";")[0];
  assert.ok(ok.cb.cookies.some((c) => c.startsWith("ec_oauth=;")), "state cookie cleared");
  const last = tokenCalls.at(-1);
  assert.equal(last.grant_type, "authorization_code"); assert.ok(last.code_verifier.length >= 43); assert.equal(last.client_secret, "secret");
  const me = await call("GET", "/api/me", { cookie: session });
  assert.equal(me.j.user.email, "dana@example.org"); assert.equal(me.j.user.news, true); assert.equal(me.j.user.lang, "sr");
  assert.equal(env.DB._db.prepare("SELECT google_sub FROM users WHERE email = 'dana@example.org'").get().google_sub, "g-dana@example.org", "first Google sign-in of the test set the account id");
  assert.equal((await googleLogin({ email: "eve@example.org" }, { tamper: true })).cb.location, "https://eligiblecalls.pages.dev/#org/signin-error/google_state");
  assert.match((await googleLogin({ email: "eve@example.org", email_verified: false })).cb.location, /google_unverified$/);
  assert.match((await googleLogin({ email: "eve@example.org", aud: "someone-else" })).cb.location, /google_failed$/);
  assert.match((await googleLogin({ email: "eve@example.org", nonce: "replayed" })).cb.location, /google_failed$/);
  assert.match((await googleLogin({ email: "eve@example.org", exp: Math.floor(NOW / 1000) - 10 })).cb.location, /google_failed$/);
  assert.equal(env.DB._db.prepare("SELECT COUNT(*) n FROM users WHERE email = 'eve@example.org'").get().n, 0);
  assert.match((await raw("/api/auth/google/callback?error=access_denied&state=x")).location, /google_cancelled$/);
});

await t("Google: an invitation becomes a membership; the same Google account keeps its user", async () => {
  const o = (await call("POST", "/api/orgs", { cookie: carol, body: { name: "Carol org" } })).j.id;
  await call("POST", `/api/orgs/${o}/members`, { cookie: carol, body: { email: "frank@example.org", role: "editor" } });
  const f = await googleLogin({ email: "frank@example.org" });
  const s1 = f.cb.cookies.find((c) => c.startsWith("ec_session=")).split(";")[0];
  assert.equal((await call("GET", `/api/orgs/${o}`, { cookie: s1 })).j.role, "editor");
  const again = await googleLogin({ email: "frank.new@example.org", sub: "g-frank@example.org" });
  const s2 = again.cb.cookies.find((c) => c.startsWith("ec_session=")).split(";")[0];
  assert.equal((await call("GET", "/api/me", { cookie: s2 })).j.user.email, "frank.new@example.org", "address follows the Google account");
  assert.equal((await call("GET", `/api/orgs/${o}`, { cookie: s2 })).j.role, "editor");
});

await t("e-mail link sign-in is off unless EMAIL_LOGIN is 1; /api/me tells the page which sign-in exists", async () => {
  delete env.EMAIL_LOGIN;
  assert.equal((await call("POST", "/api/auth/request", { body: { email: "x@example.org", accept: true } })).j.error, "email_login_off");
  assert.deepEqual((await call("GET", "/api/me")).j.signin, { google: true, email: false });
  env.EMAIL_LOGIN = "1";
});

console.log(`\n${pass} passed`);
