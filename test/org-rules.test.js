// node test/org-rules.test.js
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { ROOT } from "./mocks.js";
import { assess, assessAll, buildDF, band, scoreTier, DEFAULT_WEIGHTS, callFingerprint, mandatorySummary, HIGH, MEDIUM, setGlossary, expandText, norm, terms } from "../site/org/rules.js";
import { detectLang, foldText, textHash } from "../site/org/lang.js";
import { cleanProfile, completeness, contextFrom, changedFields } from "../site/org/schema.js";

const TAX = JSON.parse(readFileSync(path.join(ROOT, "site/data/taxonomy.json"), "utf8"));
const CALLS = JSON.parse(readFileSync(path.join(ROOT, "site/data/calls.json"), "utf8")).calls;
const NOW = Date.parse("2026-11-13T12:00:00Z");
let pass = 0;
const t = (name, fn) => { try { fn(); pass++; console.log("ok  ", name); } catch (e) { console.log("FAIL", name); throw e; } };

const ngo = {
  name: "Udruženje Mladi Novi Sad", orgType: "ngo", country: "RS", city: "Novi Sad", yearEstablished: 2015,
  description: "Youth organisation running non-formal education, digital skills and social inclusion programmes for young people.",
  objectives: "Improve digital skills and employability of young people with fewer opportunities; support youth participation.",
  activityAreas: ["youth", "education", "social-inclusion", "digital"], targetGroups: ["youth", "fewer-opportunities"],
  employees: 6, volunteers: 30, euFunding: "partner", erasmus: "coordinator", previousProjects: "Erasmus+ youth exchanges and training courses on digital skills.",
  partnerCountries: ["HR", "IT", "SI"],
};
const call = (o = {}) => ({
  id: "TEST-1", title: "Digital skills for young people", callTitle: "", programme: "CERV", programmeName: "CERV",
  keywords: ["digital skills", "youth"], description: "Projects that build digital skills of young people with fewer opportunities.",
  conditions: "", sectors: ["youth", "digital"], applicants: ["organisation", "ngo"], partnership: "unspecified",
  eligibility: { RS: ["Y", 0], DE: ["Y", 0], AL: ["N", 1] }, reasons: ["", "Not listed."], funding: { maxPerGrant: 200000 },
  nextDeadline: "2027-03-05", ...o,
});

t("eligible call: status eligible, score high, strengths name shared sectors and groups", () => {
  const r = assess(ngo, call(), { now: NOW });
  assert.equal(r.status, "eligible");
  assert.ok(r.score >= HIGH, "score " + r.score);
  assert.deepEqual(r.strengths.find((s) => s.code === "str.sectors").params.sectors, ["youth", "digital"]);
  assert.ok(r.strengths.some((s) => s.code === "str.groups"));
});

t("experience 'both partner and coordinator' is a valid choice and counts like coordinator experience", () => {
  assert.equal(cleanProfile({ ...ngo, euFunding: "both", erasmus: "both" }, contextFrom(TAX, 2026)).profile.euFunding, "both");
  const both = assess({ ...ngo, euFunding: "both" }, call(), { now: NOW }), coord = assess({ ...ngo, euFunding: "coordinator" }, call(), { now: NOW });
  assert.equal(both.dims.experience.s, coord.dims.experience.s);
  assert.equal(both.strengths.find((s) => s.code === "str.experience").params.role, "both");
});

t("a failed country check makes the call ineligible, whatever the score", () => {
  const r = assess(ngo, call({ eligibility: { RS: ["N", 0] }, reasons: ["Not a participating country."] }), { now: NOW });
  assert.equal(r.status, "ineligible");
  assert.equal(r.checks.find((x) => x.id === "country").result, "fail");
  assert.ok(r.score > 50, "score stays a separate output: " + r.score);
  const all = assessAll(ngo, [call({ id: "A", eligibility: { RS: ["N", 0] }, reasons: ["x"] }), call({ id: "B", sectors: ["health"], keywords: [], description: "Hospitals." })], { now: NOW });
  assert.deepEqual(all.map((x) => x.callId), ["B", "A"], "ineligible goes last even with a higher score");
});

t("condition (P) and unknown (C) country answers need verification", () => {
  assert.equal(assess(ngo, call({ eligibility: { RS: ["P", 0] }, reasons: ["Some strands only."] }), { now: NOW }).status, "potential");
  assert.equal(assess(ngo, call({ eligibility: { RS: ["C", 0] }, reasons: ["Not stated."] }), { now: NOW }).status, "potential");
});

t("calls for individuals only exclude organisations; other unlisted types need checking", () => {
  assert.equal(assess(ngo, call({ applicants: ["researcher"] }), { now: NOW }).status, "ineligible");
  const r = assess(ngo, call({ applicants: ["university", "sme"] }), { now: NOW });
  assert.equal(r.status, "potential");
  assert.equal(r.checks.find((x) => x.id === "applicant").code, "applicant.notListed");
  assert.equal(assess(ngo, call({ partnership: "individual" }), { now: NOW }).status, "ineligible");
});

t("missing country or type: insufficient information, listed as missing", () => {
  const r = assess({ ...ngo, country: undefined }, call(), { now: NOW });
  assert.equal(r.status, "insufficient");
  assert.ok(r.missing.includes("country"));
  assert.equal(assess({ name: "x" }, call(), { now: NOW }).status, "insufficient");
});

t("consortium: partner countries counted against the Erasmus+ minimum", () => {
  const ka220 = call({ id: "ERASMUS-NA-2027-KA220-2027-03-05", erasmusAction: "KA220", programme: "ERASMUS", partnership: "consortium", nextDeadline: "2027-03-05T12:00|Europe/Brussels" });
  assert.equal(assess(ngo, ka220, { now: NOW }).checks.find((x) => x.id === "partnership").result, "pass");
  const r = assess({ ...ngo, partnerCountries: ["HR"] }, ka220, { now: NOW });
  assert.equal(r.checks.find((x) => x.id === "partnership").code, "partnership.consortiumGap");
  assert.equal(r.status, "potential");
  assert.equal(assess({ ...ngo, partnerCountries: undefined, partnerships: undefined }, ka220, { now: NOW }).checks.find((x) => x.id === "partnership").result, "missing");
});

t("KA220: legally established at least 2 years before the deadline", () => {
  const ka220 = call({ erasmusAction: "KA220", programme: "ERASMUS", partnership: "consortium", nextDeadline: "2027-03-05T12:00|Europe/Brussels" });
  const est = (y) => assess({ ...ngo, yearEstablished: y }, ka220, { now: NOW }).checks.find((x) => x.id === "established");
  assert.equal(est(2024).result, "pass");
  assert.equal(est(2025).result, "unknown");
  assert.equal(est(2026).result, "fail");
  assert.equal(assess({ ...ngo, yearEstablished: 2026 }, ka220, { now: NOW }).status, "ineligible");
  assert.equal(est(undefined).result, "missing");
});

t("European Universities: a non-university gets a possible disqualifier quoted from the call", () => {
  const c = CALLS.find((x) => x.id.startsWith("ERASMUS-EDU-2027-EUR-UNIV")) || call({ id: "ERASMUS-EDU-2027-EUR-UNIV", description: "This call supports alliances of higher education institutions." });
  const r = assess(ngo, c, { now: NOW });
  const h = r.checks.find((x) => x.id === "heis");
  assert.equal(h.result, "warn");
  assert.ok(/higher education institutions/i.test(h.params.quote));
  assert.notEqual(r.status, "eligible");
  assert.equal(assess({ ...ngo, orgType: "university" }, c, { now: NOW }).checks.find((x) => x.id === "heis").result, "pass");
});

t("weights are configurable and change the score, never the status", () => {
  const a = assess(ngo, call(), { now: NOW });
  const b = assess(ngo, call(), { now: NOW, weights: { partnerships: 80 } }); // partnership not stated scores 0.6
  assert.notEqual(a.score, b.score);
  assert.equal(a.status, b.status);
  assert.equal(Object.values(DEFAULT_WEIGHTS).reduce((x, y) => x + y, 0), 100);
});

t("score colours: red below 50, yellow 50-69, green from 70; status stays with the mandatory checks", () => {
  assert.deepEqual([0, 49, 49.9, 50, 69, 69.9, 70, 100].map(scoreTier), ["low", "low", "low", "medium", "medium", "medium", "high", "high"]);
  const failed = assess(ngo, call({ eligibility: { RS: ["N", 0] }, reasons: ["Not a participating country."] }), { now: NOW, relevanceCap: false, weights: { country: 0 } });
  assert.equal(failed.status, "ineligible");
  assert.equal(scoreTier(failed.score), "high", "a green score does not lift a failed mandatory check (score " + failed.score + ")");
  const low = assess(ngo, call({ title: "Nuclear fusion materials", keywords: ["plasma"], description: "Tokamak plasma-facing materials research.", sectors: ["energy"] }), { now: NOW });
  assert.equal(scoreTier(low.score), "low"); assert.equal(low.status, "eligible", "a red score is not a legal ineligibility");
});

t("one classification everywhere: high from 70, medium 50-69, low below 50", () => {
  assert.deepEqual([100, 70, 69, 50, 49, 0].map(band), ["high", "high", "medium", "medium", "low", "low"]);
  assert.deepEqual([70, 69, 50, 49].map(scoreTier), ["high", "medium", "medium", "low"]);
});

t("all live calls: bounded scores, valid statuses, assessment under 250 ms", () => {
  const t00 = performance.now();
  const stats = buildDF(CALLS); // once per data load
  const buildMs = performance.now() - t00;
  const t0 = performance.now();
  const all = assessAll(ngo, CALLS, { now: NOW, stats });
  const ms = performance.now() - t0;
  assert.equal(all.length, CALLS.length);
  for (const r of all) { assert.ok(r.score >= 0 && r.score <= 100); assert.ok(["eligible", "potential", "ineligible", "insufficient"].includes(r.status)); }
  console.log(`      ${CALLS.length} calls in ${ms.toFixed(0)} ms (text statistics ${buildMs.toFixed(0)} ms once); ` + JSON.stringify(all.reduce((o, r) => ((o[r.status] = (o[r.status] || 0) + 1), o), {})));
  assert.ok(ms < 250, "assessment " + ms);
  assert.ok(buildMs < 2000, "statistics " + buildMs);
});

t("profile cleaning: unknown keys dropped, bad values reported, provenance kept", () => {
  const ctx = contextFrom(TAX, 2026);
  const { profile, errors } = cleanProfile({ ...ngo, hack: "<script>", orgType: "spaceship", country: "rs", yearEstablished: 2099, website: "example.org",
    _meta: { name: { source: "document", sourceName: "Statut.pdf", evidence: "Udruženje Mladi Novi Sad", confidence: "high", verified: true }, nope: { source: "web" } } }, ctx);
  assert.equal(profile.hack, undefined);
  assert.equal(profile.country, "RS");
  assert.equal(profile.website, "https://example.org/");
  assert.deepEqual(Object.keys(errors).sort(), ["orgType", "yearEstablished"]);
  assert.deepEqual(Object.keys(profile._meta), ["name"]);
  assert.equal(profile._meta.name.verified, true);
  assert.equal(cleanProfile({ activityAreas: ["youth", "made-up"] }, ctx).errors.activityAreas, "option");
});

t("completeness and change list", () => {
  const c = completeness(ngo);
  assert.ok(c.pct > 70 && c.pct < 100, String(c.pct));
  assert.ok(c.missing.includes("mission"));
  assert.equal(completeness({}).pct, 0);
  assert.deepEqual(changedFields(ngo, { ...ngo, city: "Beograd" }), ["city"]);
});

t("completeness: optional registration number and OID never count as missing", () => {
  const full = { ...ngo, website: "https://example.org", mission: "m", geoScope: "national", fundingDetails: "d", partnerships: "p", infrastructure: "i", capacity: "c", expertise: "e" };
  const c = completeness(full);
  assert.ok(!c.missing.includes("registrationNumber") && !c.missing.includes("oid"), c.missing.join(","));
  assert.equal(c.pct, 100, c.missing.join(","));
});

t("call fingerprint changes when eligibility changes", () => {
  assert.notEqual(callFingerprint(call()), callFingerprint(call({ eligibility: { RS: ["N", 0] } })));
  assert.equal(callFingerprint(call()), callFingerprint(call()));
});

t("relevance cap: an eligible but unrelated call cannot look compatible", () => {
  const unrelated = call({ title: "Nuclear fusion materials", keywords: ["plasma"], description: "Tokamak plasma-facing materials research.", sectors: ["energy", "research"] });
  const r = assess(ngo, unrelated, { now: NOW });
  assert.equal(r.status, "eligible");
  assert.ok(r.score <= 45 && r.capApplied, "score " + r.score);
  assert.ok(assess(ngo, unrelated, { now: NOW, relevanceCap: false }).score > r.score);
});
t("one broad shared sector does not make an unrelated large research call compatible", () => {
  const small = { ...ngo, employees: 3, volunteers: 25 };
  const qkd = call({
    id: "HORIZON-JU-EUROHPC-TEST", programme: "HORIZON", title: "Next-Generation QKD Systems", keywords: ["Quantum key distribution"],
    description: "Development of quantum key distribution systems with entanglement-based protocols, trusted nodes and photonic integration for secure networks.",
    sectors: ["digital", "it", "research"], applicants: ["organisation"], partnership: "unspecified",
    funding: { topicBudget: 24000000, expectedGrants: 1, minPerGrant: 21000000, maxPerGrant: 24000000 },
  });
  const r = assess(small, qkd, { now: NOW, stats: buildDF([qkd, call()]) });
  assert.equal(r.status, "eligible");
  assert.ok(r.score < 60, "score " + r.score);
  assert.equal(r.dims.capacity.size, "xlarge");
  assert.equal(r.dims.capacity.s, 0.1); // 3 employees + 25 volunteers = 5.5 staff for a EUR 24M grant
  assert.ok(r.score < 50, "low compatibility without a thematic match: " + r.score);
});

t("silent calls do not add points: unstated target groups and partnership score below the middle", () => {
  const silent = call({ title: "Media literacy", keywords: [], description: "Media literacy projects.", partnership: "unspecified" });
  const r = assess(ngo, silent, { now: NOW });
  assert.equal(r.dims.targetGroups.s, 0.3);
  assert.equal(r.dims.partnerships.s, 0.6);
  assert.equal(assess(ngo, call({ partnership: "alone" }), { now: NOW }).dims.partnerships.s, 1);
});

t("grant size from topic budget and expected grants when no per-grant amount is given", () => {
  const r = assess(ngo, call({ funding: { topicBudget: 6000000, expectedGrants: 2 } }), { now: NOW });
  assert.equal(r.dims.capacity.size, "xlarge");
  assert.equal(r.dims.capacity.perGrant, 3000000);
});

t("live data: a small youth NGO's top matches are not dominated by large research calls", () => {
  const small = { ...ngo, employees: 3, volunteers: 25 };
  const top = assessAll(small, CALLS, { now: NOW }).filter((r) => r.status !== "ineligible").slice(0, 10);
  const byId = new Map(CALLS.map((c) => [c.id, c]));
  const quantum = top.filter((r) => /quantum|QKD/i.test(byId.get(r.callId).title));
  assert.equal(quantum.length, 0, quantum.map((r) => byId.get(r.callId).title).join("; "));
});

// ---------- official documentation: mandatory conditions separate from the strategic score ----------
const FW = { "HE-GA-B": { title: "General Annexes", url: "https://example.org/annexes.pdf", consortium: { quote: "At least three legal entities from three countries." } } };
const elig = (cond, o = {}) => ({ frameworks: FW, calls: { "TEST-1": { status: "verified", title: "Call document", docUrl: "https://example.org/call.pdf", verified: "2026-11-15", published: "2026-10-01", conditions: cond, ...o } } });
const ids = (r) => Object.fromEntries(r.checks.filter((x) => x.source === "official" || x.source === "official-ai").map((x) => [x.id, x.result]));

t("official text not verified: the requirement stays to be verified, so the call is never fully eligible", () => {
  const r = assess(ngo, call(), { now: NOW, elig: { frameworks: FW, calls: {} } });
  assert.deepEqual(ids(r), { official: "unknown" });
  assert.equal(r.status, "potential");
  assert.ok(r.next.some((x) => x.code === "rec.verifyOfficial"));
  assert.equal(assess(ngo, call(), { now: NOW, elig: { frameworks: FW, calls: { "TEST-1": { status: "robots" } } } }).checks.find((x) => x.id === "official").params.status, "robots");
});

t("official conditions: legal entity, natural persons, coordinator, consortium met or short, single applicant", () => {
  const legal = [{ type: "legalEntity", value: true, quote: "Applicants must be legal entities." }];
  const informal = assess({ ...ngo, orgType: "informal-group" }, call(), { now: NOW, elig: elig(legal) });
  assert.equal(ids(informal)["off.legal"], "fail"); assert.equal(informal.status, "ineligible");
  assert.equal(informal.checks.find((x) => x.id === "off.legal").params.quote, "Applicants must be legal entities.");
  assert.equal(ids(assess({ ...ngo, orgType: "informal-group" }, call(), { now: NOW, elig: elig([...legal, { type: "noLegalPersonality", value: true, quote: "Exceptionally, entities without legal personality may apply." }]) }))["off.legal"], "warn");
  assert.equal(ids(assess(ngo, call(), { now: NOW, elig: elig(legal) })).official, "pass", "an NGO meets the legal-entity condition: the text was read");
  assert.equal(ids(assess({ ...ngo, orgType: "sme" }, call(), { now: NOW, elig: elig([{ type: "coordinatorNonProfit", value: true, quote: "The coordinator must be a non-profit organisation." }]) }))["off.coordinator"], "warn");
  const cons = [{ type: "minApplicants", value: 3, ref: "HE-GA-B" }, { type: "minCountries", value: 3, ref: "HE-GA-B" }];
  const met = assess(ngo, call(), { now: NOW, elig: elig(cons) });
  assert.equal(ids(met)["off.consortium"], "pass"); assert.ok(!met.checks.some((x) => x.id === "partnership"), "the official condition replaces the derived one");
  assert.equal(met.checks.find((x) => x.id === "off.consortium").params.url, FW["HE-GA-B"].url);
  const short = assess({ ...ngo, partnerCountries: ["HR"] }, call(), { now: NOW, elig: elig(cons) });
  assert.equal(ids(short)["off.consortium"], "unknown", "partners can still be found: never a failure");
  assert.notEqual(short.status, "ineligible");
  assert.equal(ids(assess({ ...ngo, partnerCountries: undefined, partnerships: undefined }, call(), { now: NOW, elig: elig(cons) }))["off.consortium"], "missing");
  assert.equal(ids(assess(ngo, call(), { now: NOW, elig: elig([{ type: "minApplicants", value: 1, quote: "Single applicants only." }]) }))["off.consortium"], "pass");
});

t("AI check of the official text: a failed condition makes the call not eligible whatever the score", () => {
  const ai = { "TEST-1": [{ id: "c1", result: "pass", condition: "Country", quote: "q" }, { id: "c2", result: "fail", condition: "Only public bodies", quote: "Only public bodies may apply.", reason: "The profile says NGO." }] };
  const r = assess(ngo, call(), { now: NOW, elig: elig([]), ai });
  assert.equal(r.status, "ineligible");
  assert.ok(r.score >= HIGH, "the strategic score is still shown separately: " + r.score);
  assert.deepEqual(mandatorySummary(r.checks), { pass: r.checks.filter((x) => x.result === "pass").length, fail: 1, verify: r.checks.filter((x) => !["pass", "fail"].includes(x.result)).length });
  assert.equal(r.checks.find((x) => x.id === "ai.c2").source, "official-ai");
  assert.equal(assess(ngo, call(), { now: NOW, elig: elig([]), ai: { "TEST-1": [{ id: "c1", result: "invented" }] } }).checks.some((x) => x.id === "ai.c1"), false);
  assert.deepEqual([HIGH, MEDIUM], [70, 50]);
});

// ---------- profiles written in Serbian: normalisation, glossary, English copy ----------
const GLOSSARY = JSON.parse(readFileSync(path.join(ROOT, "site/org/glossary-sr-en.json"), "utf8"));
const CYR = { a: "а", b: "б", v: "в", g: "г", d: "д", đ: "ђ", e: "е", ž: "ж", z: "з", i: "и", j: "ј", k: "к", l: "л", m: "м", n: "н", o: "о", p: "п", r: "р", s: "с", t: "т", ć: "ћ", u: "у", f: "ф", h: "х", c: "ц", č: "ч", š: "ш" };
const toCyr = (x) => x.replace(/dž|lj|nj/gi, (m) => ({ dž: "џ", lj: "љ", nj: "њ" })[m.toLowerCase()]).replace(/[a-zčćšžđ]/gi, (ch) => { const c = CYR[ch.toLowerCase()]; return c ? (ch === ch.toLowerCase() ? c : c.toUpperCase()) : ch; });
const ngoSr = { ...ngo,
  description: "Omladinska organizacija koja sprovodi programe neformalnog obrazovanja, digitalnih veština i socijalne inkluzije za mlade.",
  objectives: "Unaprediti digitalne veštine i zapošljivost mladih sa manje mogućnosti; podržati učešće mladih.",
  previousProjects: "Erasmus+ razmene mladih i obuke o digitalnim veštinama." };
const ngoCyr = { ...ngoSr, description: toCyr(ngoSr.description), objectives: toCyr(ngoSr.objectives), previousProjects: toCyr(ngoSr.previousProjects).replace("Ерасмус+", "Erasmus+") };

t("language detection without a model: English, Serbian Latin with and without diacritics, Serbian Cyrillic, other, too short", () => {
  assert.equal(detectLang(ngo.description).lang, "en");
  assert.equal(detectLang(ngoSr.description).lang, "sr");
  assert.equal(detectLang("Organizacija koja radi sa mladima i podrzava ucesce gradjana u lokalnoj zajednici").lang, "sr", "no diacritics: function words decide");
  assert.deepEqual(detectLang(ngoCyr.description), { lang: "sr", script: "cyrl" });
  assert.equal(detectLang("Gemeinnütziger Verein, der Workshops für Jugendliche in Berlin organisiert").lang, "other");
  assert.equal(detectLang("Novi Sad").lang, "unknown");
  assert.equal(detectLang("").lang, "unknown");
});

t("normalisation: Cyrillic to Latin, diacritics folded the way the code already folds them (č ć -> c, š -> s, ž -> z, đ -> dj)", () => {
  assert.equal(foldText("Омладинско удружење Ђурђевак, Џон, Љиљана, Њива"), "omladinsko udruzenje djurdjevak, dzon, ljiljana, njiva");
  assert.equal(foldText("Čačak, Ćuprija, Šabac, Žabalj, Đakovica"), "cacak, cuprija, sabac, zabalj, djakovica");
  assert.equal(norm("Међународна сарадња"), norm("Međunarodna saradnja"));
  assert.deepEqual(terms(ngoCyr.description), terms(ngoSr.description), "both scripts give the same terms");
  assert.equal(textHash("abc"), textHash("abc")); assert.notEqual(textHash("abc"), textHash("abd"));
});

t("glossary: Serbian terms expanded to English, multi-word terms, exclusions; English text left as it is", () => {
  setGlossary(GLOSSARY);
  const x = expandText("Obrazovanje mladih, civilno društvo i zaštita životne sredine u ruralnim krajevima.");
  for (const w of ["education", "young people youth", "civil society", "environmental protection", "environment", "rural"]) assert.ok(x.includes(w), w);
  assert.ok(expandText("Медијска писменост и дигитализација").includes("media literacy"), "Cyrillic works through normalisation");
  assert.ok(!/ media\b/.test(expandText("Medijacija u porodičnim sporovima.").replace("Medijacija", "")), "mediation is not media");
  assert.ok(!expandText("Mladen je osnivač udruženja.").includes("young people"), "a personal name is not 'young people'");
  assert.equal(expandText(ngo.description), ngo.description, "English text unchanged");
  setGlossary(null);
  assert.equal(expandText(ngoSr.description), ngoSr.description, "no glossary: text as it is");
});

t("the same profile in English, Serbian Latin and Serbian Cyrillic lands within a few points", () => {
  setGlossary(GLOSSARY);
  const stats = buildDF(CALLS);
  const en = assessAll(ngo, CALLS, { now: NOW, stats }), byId = (r) => Object.fromEntries(r.map((a) => [a.callId, a.score]));
  const E = byId(en), top = en.slice().sort((a, b) => b.score - a.score).slice(0, 20).map((a) => a.callId);
  // with the English copy of the free text (what a translation gives): the three agree on every call
  const textEn = { description: ngo.description, objectives: ngo.objectives };
  const L1 = byId(assessAll({ ...ngoSr, textEn }, CALLS, { now: NOW, stats })), C1 = byId(assessAll({ ...ngoCyr, textEn }, CALLS, { now: NOW, stats }));
  for (const id of Object.keys(E)) { assert.ok(Math.abs(E[id] - L1[id]) <= 5, `${id}: en ${E[id]} sr ${L1[id]}`); assert.equal(L1[id], C1[id]); }
  // without a copy (translation failed): normalisation and the glossary only; Latin and Cyrillic are identical and
  // the best English matches stay within a few points on average
  const L2 = byId(assessAll(ngoSr, CALLS, { now: NOW, stats })), C2 = byId(assessAll(ngoCyr, CALLS, { now: NOW, stats }));
  for (const id of Object.keys(E)) assert.equal(L2[id], C2[id]);
  const mean = top.reduce((a, id) => a + Math.abs(E[id] - L2[id]), 0) / top.length;
  assert.ok(mean <= 8, "top-20 mean difference " + mean.toFixed(1));
  // and an English profile scores exactly as without the glossary
  setGlossary(null);
  const E0 = byId(assessAll(ngo, CALLS, { now: NOW, stats: buildDF(CALLS) }));
  for (const id of Object.keys(E)) assert.equal(E0[id], E[id]);
});

t("Serbian call texts (national sources): Serbian and English profiles both meet them", () => {
  const srCall = call({ id: "RS-1", title: "Javni konkurs za podršku programima neformalnog obrazovanja mladih", keywords: [],
    description: "Podrška projektima udruženja koji unapređuju digitalne veštine i medijsku pismenost mladih iz ruralnih sredina.", sectors: ["youth", "education"] });
  const other = call({ id: "RS-2", title: "Konkurs za energetsku efikasnost javnih zgrada", keywords: [], description: "Sufinansiranje energetske obnove javnih zgrada u lokalnim samoupravama.", sectors: ["energy"] });
  setGlossary(GLOSSARY);
  const stats = buildDF([srCall, other]);
  const objs = (p) => assess(p, srCall, { now: NOW, stats }).dims.objectives.text;
  const enScore = objs(ngo), srScore = objs(ngoSr);
  setGlossary(null);
  const enNoGloss = assess(ngo, srCall, { now: NOW, stats: buildDF([srCall, other]) }).dims.objectives.text;
  assert.ok(srScore > 0.3, "Serbian profile, Serbian call: " + srScore);
  assert.ok(enScore > enNoGloss, `English profile, Serbian call: ${enScore} with the glossary, ${enNoGloss} without`);
});

t("an English copy is used only for the free-text fields it covers; the original stays for the rest", () => {
  const c = call({ description: "Projects that build digital skills of young people with fewer opportunities." });
  const sr = assess({ ...ngoSr, objectives: undefined, description: "Udruženje iz Novog Sada." }, c, { now: NOW }).score;
  const withCopy = assess({ ...ngoSr, objectives: undefined, description: "Udruženje iz Novog Sada.", textEn: { description: "Builds digital skills of young people with fewer opportunities." } }, c, { now: NOW }).score;
  assert.ok(withCopy > sr, `${withCopy} > ${sr}`);
});
console.log(`${pass} passed`);
