// node test/query.test.js — Serbian search words meet the calls' English text (site/org/query.js, src/queryen.js).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseGlossary, queryGroups, matchGroups, unknownWords, expandQuery } from "../site/org/query.js";
import { handleQueryEn, cleanKeywords } from "../src/queryen.js";
import { buildMessages } from "../src/core.js";
import { mockD1, sseStream, ROOT } from "./mocks.js";

let pass = 0;
const t = async (name, fn) => { try { await fn(); pass++; console.log("ok  ", name); } catch (e) { console.log("FAIL", name); throw e; } };
const read = (p) => JSON.parse(readFileSync(path.join(ROOT, p), "utf8"));
const GL = read("site/org/glossary-sr-en.json"), idx = parseGlossary(GL);
const DATA = read("site/data/calls.json"), TAX = read("site/data/taxonomy.json");
// The home page's folding and call text (site/index.html norm and hay).
const norm = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const sect = Object.fromEntries(TAX.sectors.map((s) => [s.id, s]));
const HAYS = DATA.calls.map((c) => norm([c.title, c.id, c.callId, c.callTitle, c.programmeName, (c.keywords || []).join(" "), (c.tags || []).join(" "), c.description, (c.sectors || []).map((s) => (sect[s] ? sect[s].en + " " + sect[s].sr : s)).join(" ")].join(" ")));
const count = (q, extra) => { const g = queryGroups(q, idx, { plain: norm, extra }); return HAYS.filter((h) => matchGroups(h, g)).length; };
const asWritten = (q) => HAYS.filter((h) => norm(q).split(/\s+/).filter((w) => w.length > 2 && !["the", "and", "for", "with"].includes(w)).every((w) => h.includes(w))).length;

await t("every glossary entry is well formed", () => {
  for (const e of GL.terms) {
    assert.ok(e.sr && e.en, JSON.stringify(e));
    assert.ok(/^[a-z0-9*| -]+$/.test(e.sr), "folded Serbian: " + e.sr);
    if (e.q) assert.ok(e.q.split("|").every((a) => a.trim().length > 2), "q: " + e.q);
  }
  assert.ok(GL.terms.length > 300);
});

await t("Serbian words find about as many calls as the English words", () => {
  const pairs = [["education", "obrazovanje"], ["energy", "energija"], ["health", "zdravlje"], ["digital", "digitalna"], ["environment", "životna sredina"],
    ["employment", "zapošljavanje"], ["water management", "upravljanje vodama"], ["rural development", "ruralni razvoj"], ["cultural heritage", "kulturno nasleđe"],
    ["energy efficiency", "energetska efikasnost"], ["social inclusion", "socijalna inkluzija"], ["climate adaptation", "prilagođavanje klimatskim promenama"]];
  for (const [en, sr] of pairs) {
    const a = asWritten(en), b = count(sr);
    assert.ok(b >= 0.8 * a && b <= 1.6 * a + 3, `${sr}: ${b} calls, ${en}: ${a}`);
  }
  assert.equal(count("energija"), count("енергија"), "Cyrillic as Latin");
});

await t("English queries find what they found before (an English word that is also a Serbian stem may find a few more)", () => {
  for (const q of ["climate", "youth exchange", "artificial intelligence", "film", "HORIZON-CL5", "water"]) assert.equal(count(q), asWritten(q), q);
  assert.ok(count("small farmers") >= asWritten("small farmers"));
});

await t("glossary phrases with function words; words that only occur as written", () => {
  const g = queryGroups("inovacije za mala i srednja preduzeća", idx, { plain: norm });
  assert.ok(g.some((x) => x.alts.includes("smes")), JSON.stringify(g));
  assert.equal(g.length, 2, "inovacije + the phrase");
  assert.ok(matchGroups("support for smes and innovation", g));
  assert.ok(!matchGroups("support for smes", g));
});

await t("words the glossary does not know: asked once, then searched in English", () => {
  const g = queryGroups("pčelarstvo", idx, { plain: norm });
  assert.deepEqual(unknownWords(g, HAYS), ["pcelarstvo"].filter(() => !g[0].alts.length));
  assert.deepEqual(unknownWords(queryGroups("klimatxyz", idx, { plain: norm }), HAYS), ["klimatxyz"]);
  assert.ok(count("klimatxyz", { klimatxyz: "climate" }) > 50);
  assert.equal(cleanKeywords("Water, WATER-management; <b>x</b>; a"), "water, water-management");
});

await t("chat: a Serbian question ranks calls by the English terms too", () => {
  const index = read("site/data/index.json");
  const ask = (q, gloss) => buildMessages(index, { messages: [{ role: "user", content: q }], profile: { sectors: [], applicants: [], country: "RS", text: "" }, doc: null, lang: "sr" }, Date.parse("2026-11-23T08:00:00Z"), { gloss }).hits;
  const en = new Set(ask("call for an association working with young people on environmental protection", idx));
  const sr = ask("poziv za udruženje koje radi sa mladima na zaštiti životne sredine", idx);
  const srBefore = ask("poziv za udruženje koje radi sa mladima na zaštiti životne sredine", null);
  assert.ok(sr.filter((x) => en.has(x)).length >= 4, sr.join(" "));
  assert.ok(sr.filter((x) => en.has(x)).length > srBefore.filter((x) => en.has(x)).length);
  assert.ok(expandQuery("energija", idx).includes("energy"));
});

await t("POST /api/query-en: the model is asked once per word; kept for every visitor; daily limit", async () => {
  const seen = [];
  const AI = { run: async (model, input) => { seen.push(input.messages[1].content); const words = JSON.parse(input.messages[1].content).map((x) => x.split(" ")[0]);
    const text = JSON.stringify({ words: Object.fromEntries(words.map((w) => [w, w === "pcelarstvo" ? "beekeeping, apiculture" : ""])) });
    return sseStream([{ response: text }, { response: "", usage: { prompt_tokens: 200, completion_tokens: 30 } }]); } };
  const env = { DB: mockD1(), AI, SEARCH_TRANSLATIONS_PER_DAY: "2" };
  const req = (words, ip = "203.0.113.9") => new Request("https://x.test/api/query-en", { method: "POST", headers: { "content-type": "application/json", "cf-connecting-ip": ip }, body: JSON.stringify({ words }) });
  const waits = [], wu = (p) => waits.push(p), now = Date.parse("2026-11-23T08:00:00Z");
  let r = await (await handleQueryEn({ request: req([{ w: "pcelarstvo", s: "pčelarstvo" }, { w: "qqqzzz" }, { w: "x" }, { w: "<script>" }]), env, now, waitUntil: wu })).json();
  await Promise.all(waits);
  assert.deepEqual(r.en, { pcelarstvo: "beekeeping, apiculture" });
  assert.equal(seen.length, 1); assert.ok(seen[0].includes("pčelarstvo"), "the word as typed goes to the model");
  r = await (await handleQueryEn({ request: req([{ w: "pcelarstvo" }, { w: "qqqzzz" }], "198.51.100.1"), env, now, waitUntil: wu })).json();
  assert.deepEqual(r.en, { pcelarstvo: "beekeeping, apiculture" }); assert.equal(seen.length, 1, "both kept, also the word with no translation");
  await handleQueryEn({ request: req([{ w: "novarec" }]), env, now, waitUntil: wu });
  r = await (await handleQueryEn({ request: req([{ w: "jostjedna" }]), env, now, waitUntil: wu })).json();
  assert.equal(r.limited, true); assert.equal(seen.length, 2);
});

console.log(`\n${pass} passed`);
