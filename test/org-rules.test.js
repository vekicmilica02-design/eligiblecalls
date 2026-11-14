// node test/org-rules.test.js
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { ROOT } from "./mocks.js";
import { assess, assessAll, buildDF, band, scoreTier, DEFAULT_WEIGHTS, callFingerprint } from "../site/org/rules.js";
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
  assert.ok(r.score >= 75, "score " + r.score);
  assert.deepEqual(r.strengths.find((s) => s.code === "str.sectors").params.sectors, ["youth", "digital"]);
  assert.ok(r.strengths.some((s) => s.code === "str.groups"));
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

t("bands follow the brief", () => {
  assert.deepEqual([95, 80, 65, 45, 10].map(band), ["excellent", "strong", "moderate", "low", "verylow"]);
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
  assert.ok(r.capApplied);
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
console.log(`${pass} passed`);
