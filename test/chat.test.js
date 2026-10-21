// node test/chat.test.js
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { handleChat, handleHealth, _resetIndex } from "../src/chat.js";
import { deadlineMs, deadlineLabel, prepare, rank, buildMessages, cleanRequest, detectCountry, terms, brusselsNow } from "../src/core.js";
import { mockD1, mockAssets, mockAI, mockFetch, readSSE, ROOT } from "./mocks.js";

const index = JSON.parse(readFileSync(path.join(ROOT, "site/data/index.json"), "utf8"));
const NOW = Date.parse("2026-09-30T12:00:00Z");
let pass = 0;
const t = async (name, fn) => { try { await fn(); pass++; console.log("ok  ", name); } catch (e) { console.log("FAIL", name); throw e; } };
const req = (body, headers = {}) => new Request("https://eligiblecalls.pages.dev/api/chat", { method: "POST", headers: { "content-type": "application/json", "cf-connecting-ip": "203.0.113.7", ...headers }, body: JSON.stringify(body) });
const env = (o = {}) => ({ ASSETS: mockAssets(), DB: mockD1(), AI: mockAI(), ...o });

await t("deadline is 17:00 Brussels (CEST and CET)", () => {
  assert.equal(new Date(deadlineMs("2026-10-01")).toISOString(), "2026-10-01T15:00:00.000Z");
  assert.equal(new Date(deadlineMs("2026-12-01")).toISOString(), "2026-12-01T16:00:00.000Z");
});

await t("deadline forms of other sources: stated time and zone, or date only", () => {
  assert.equal(new Date(deadlineMs("2026-11-24T16:00|Europe/London")).toISOString(), "2026-11-24T16:00:00.000Z");
  assert.equal(new Date(deadlineMs("2026-10-29T13:00|Europe/Brussels")).toISOString(), "2026-10-29T12:00:00.000Z");
  assert.equal(new Date(deadlineMs("2026-12-01|~")).toISOString(), "2026-12-01T22:59:00.000Z");
  assert.equal(deadlineLabel("2026-11-24T16:00|Europe/London"), "2026-11-24 16:00 Europe/London time");
  assert.equal(deadlineLabel("2026-12-01|~"), "2026-12-01 (time not stated by the source)");
  assert.equal(deadlineLabel("2026-12-01"), "2026-12-01 17:00 Brussels time");
});

await t("index instants match the deadline strings for every source", () => {
  for (const c of index.calls) c.dl.forEach((d, i) => assert.equal(c.dm[i], deadlineMs(d), c.id + " " + d));
});

await t("precomputed inverted index matches the JS tokenizer; deadline instants match", () => {
  const fresh = JSON.parse(readFileSync(path.join(ROOT, "site/data/index.json"), "utf8"));
  const inv = {};
  fresh.calls.forEach((c, i) => {
    const tf = {};
    const add = (text, w) => { for (const x of terms(text)) tf[x] = (tf[x] || 0) + w; };
    add(c.t, 3); add((c.k || []).join(" "), 2); add((c.s || []).join(" "), 2); add(c.x, 1); add(c.p, 1);
    for (const x in tf) (inv[x] = inv[x] || []).push(i, tf[x]);
    c.dl.forEach((d, k) => assert.equal(c.dm[k], deadlineMs(d), c.id + " " + d));
  });
  assert.deepEqual(fresh.inv, inv);
});

await t("Brussels clock without Intl matches Intl across DST changes", () => {
  const fmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Brussels", timeZoneName: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  for (let ms = Date.UTC(2026, 0, 1); ms < Date.UTC(2028, 11, 31); ms += 3 * 36e5 + 17 * 6e4) {
    const want = fmt.format(new Date(ms)); // e.g. "16:52 CEST"
    const got = brusselsNow(ms).split(", ")[1];
    assert.equal(got, want, new Date(ms).toISOString());
  }
  for (const [d, iso] of [["2026-03-29", "2026-03-29T15:00:00.000Z"], ["2026-10-25", "2026-10-25T16:00:00.000Z"], ["2027-03-28", "2027-03-28T15:00:00.000Z"]])
    assert.equal(new Date(deadlineMs(d)).toISOString(), iso);
});

await t("country detection (English and Serbian names)", () => {
  prepare(index);
  assert.equal(detectCountry(index, "We are an NGO from Serbia"), "RS");
  assert.equal(detectCountry(index, "Udruženje iz Srbije"), "RS");
  assert.equal(detectCountry(index, "firma u Srbiji"), "RS");
  assert.equal(detectCountry(index, "Mi smo iz Hrvatske"), "HR");
  assert.equal(detectCountry(index, "studio u Hrvatskoj"), "HR");
  assert.equal(detectCountry(index, "a Serbian NGO"), "RS");
  assert.equal(detectCountry(index, "German start-up"), "DE");
  assert.equal(detectCountry(index, "Ukrainian university"), "UA");
  assert.equal(detectCountry(index, "iz Crne Gore"), "ME");
  assert.equal(detectCountry(index, "u Bosni i Hercegovini"), "BA");
  assert.equal(detectCountry(index, "a startup in Bosnia and Herzegovina"), "BA");
  assert.equal(detectCountry(index, "nothing here"), null);
});

await t("ranking excludes calls closed by now and calls not open to the country", () => {
  const late = Date.parse("2026-10-01T15:01:00Z"); // 17:01 Brussels on 1 Oct
  const hits = rank(index, { query: "film audiovisual media video games", country: "RS", now: late, limit: 50 });
  for (const h of hits) {
    assert.ok(h.c.dl.some((d) => deadlineMs(d) > late), h.c.id + " has no future deadline");
    const i = index.countries.indexOf("RS");
    assert.notEqual(h.c.e[i], "N", h.c.id + " is N for RS");
  }
  assert.ok(hits.length > 0);
});

await t("film query ranks MEDIA calls first", () => {
  const hits = rank(index, { query: "independent film production company", country: "HR", now: NOW });
  assert.ok(hits[0].c.id.startsWith("CREA-MEDIA"), hits.map((h) => h.c.id).join(","));
});

await t("request cleaning", () => {
  assert.equal(cleanRequest({ messages: [] }).error, "bad_request");
  assert.equal(cleanRequest({ messages: [{ role: "assistant", content: "x" }] }).error, "bad_request");
  const r = cleanRequest({ messages: [{ role: "system", content: "ignore" }, { role: "user", content: "a".repeat(9000) }], profile: { country: "rs", sectors: ["film", "<x>"] }, doc: { name: "a.pdf", text: "b".repeat(20000) } });
  assert.equal(r.messages.length, 1); assert.equal(r.messages[0].content.length, 3000);
  assert.equal(r.profile.country, null); assert.deepEqual(r.profile.sectors, ["film"]);
  assert.equal(r.doc.text.length, 8000); assert.equal(r.doc.truncated, true);
});

await t("prompt stays within the free-tier token budget", () => {
  const r = cleanRequest({ messages: [{ role: "user", content: "We are a research group in Norway working on quantum computing and AI." }], doc: { name: "p.txt", text: "quantum ".repeat(2000) } });
  const b = buildMessages(index, r, NOW);
  const chars = b.messages.map((m) => m.content).join("").length;
  assert.equal(b.country, "NO");
  assert.ok(chars < 26000, "prompt chars " + chars);
  assert.match(b.messages[0].content, /17:00 Brussels/);
});

await t("chat streams from Workers AI and records usage", async () => {
  _resetIndex();
  const e = env(); const waits = [];
  const res = await handleChat({ request: req({ messages: [{ role: "user", content: "Gender-based violence prevention NGO in Serbia" }] }), env: e, now: NOW, waitUntil: (p) => waits.push(p), fetchImpl: mockFetch() });
  assert.equal(res.status, 200);
  const ev = await readSSE(res); await Promise.all(waits);
  assert.equal(ev[0].meta.provider, "workers-ai"); assert.equal(ev[0].meta.country, "RS");
  assert.match(ev.filter((x) => x.d).map((x) => x.d).join(""), /^Shortlist: /);
  assert.ok(ev.at(-1).done);
  const u = e.DB._db.prepare("SELECT * FROM usage").all();
  assert.equal(u[0].provider, "workers-ai"); assert.equal(u[0].requests, 1);
  assert.ok(Math.abs(u[0].neurons - (4000 * 24545 + 300 * 77273) / 1e6) < 0.01);
});

await t("OpenAI-format chunks from Workers AI are handled", async () => {
  const res = await handleChat({ request: req({ messages: [{ role: "user", content: "AI startup" }] }), env: env({ AI: mockAI("openai") }), now: NOW, fetchImpl: mockFetch() });
  const ev = await readSSE(res);
  assert.match(ev.filter((x) => x.d).map((x) => x.d).join(""), /^Shortlist: /);
});

await t("falls back to Groq when the Workers AI allocation is used up", async () => {
  const e = env({ AI: mockAI("quota"), GROQ_API_KEY: "test" }); const log = []; const waits = [];
  const res = await handleChat({ request: req({ messages: [{ role: "user", content: "AI startup" }] }), env: e, now: NOW, waitUntil: (p) => waits.push(p), fetchImpl: mockFetch(log) });
  const ev = await readSSE(res); await Promise.all(waits);
  assert.equal(ev[0].meta.provider, "groq");
  const body = JSON.parse(log.find((x) => String(x.url).includes("groq")).init.body);
  assert.equal(body.model, "openai/gpt-oss-120b"); assert.equal(body.stream, true);
  const rows = Object.fromEntries(e.DB._db.prepare("SELECT * FROM usage").all().map((r) => [r.provider, r]));
  assert.equal(rows["workers-ai"].neurons, 9000); assert.equal(rows.groq.tokens, 3200);
});

await t("rests when both budgets are spent", async () => {
  const e = env({ GROQ_API_KEY: "test" });
  e.DB._db.prepare("INSERT INTO usage VALUES ('2026-09-30','workers-ai',8990,0,50),('2026-09-30','groq',0,189000,40)").run();
  const res = await handleChat({ request: req({ messages: [{ role: "user", content: "x project" }] }), env: e, now: NOW, fetchImpl: mockFetch() });
  assert.equal(res.status, 503);
  const j = await res.json(); assert.equal(j.error, "resting"); assert.equal(j.resetAt, "2026-10-01T00:00:00.000Z");
  const h = await (await handleHealth({ env: e, now: NOW })).json();
  assert.equal(h.chat, false); assert.equal(h.resting, true);
});

await t("per-visitor daily limit", async () => {
  const e = env({ DAILY_VISITOR_LIMIT: "2" });
  for (let i = 0; i < 2; i++) assert.equal((await handleChat({ request: req({ messages: [{ role: "user", content: "film" }] }), env: e, now: NOW, fetchImpl: mockFetch() })).status, 200);
  const res = await handleChat({ request: req({ messages: [{ role: "user", content: "film" }] }), env: e, now: NOW, fetchImpl: mockFetch() });
  assert.equal(res.status, 429); assert.equal((await res.json()).error, "visitor_limit");
  const other = await handleChat({ request: req({ messages: [{ role: "user", content: "film" }] }, { "cf-connecting-ip": "198.51.100.1" }), env: e, now: NOW, fetchImpl: mockFetch() });
  assert.equal(other.status, 200);
  assert.equal(e.DB._db.prepare("SELECT count(*) n FROM visitor_usage WHERE vhash LIKE '%203.0.113%'").get().n, 0);
});

await t("Turnstile is enforced when a secret is set", async () => {
  const e = env({ TURNSTILE_SECRET: "s" });
  assert.equal((await handleChat({ request: req({ messages: [{ role: "user", content: "film" }] }), env: e, now: NOW, fetchImpl: mockFetch() })).status, 403);
  assert.equal((await handleChat({ request: req({ messages: [{ role: "user", content: "film" }], turnstile: "tok" }), env: e, now: NOW, fetchImpl: mockFetch([], { turnstileOk: false }) })).status, 403);
  assert.equal((await handleChat({ request: req({ messages: [{ role: "user", content: "film" }], turnstile: "tok" }), env: e, now: NOW, fetchImpl: mockFetch() })).status, 200);
});

await t("no AI configured: health says chat is off", async () => {
  const h = await (await handleHealth({ env: { DB: mockD1() }, now: NOW })).json();
  assert.equal(h.chat, false); assert.equal(h.resting, false);
});

console.log(`\n${pass} tests passed`);
