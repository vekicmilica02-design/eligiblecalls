// Deterministic eligibility checks and compatibility score for one organisation profile against one call.
// Pure functions shared by the browser (all calls, instantly) and the API (stored reports).
//
// Two separate outputs, as required:
//   status  eligible | potential | ineligible | insufficient    (hard requirements only)
//   score   0..100 weighted compatibility                         (never changes the status)
// A failed mandatory check always sets status "ineligible", whatever the score.
//
// Results carry codes and parameters, not sentences: the page renders them in English or Serbian.

import { ORG_TYPES, completeness } from "./schema.js";
import { CALL_RULES } from "./call_rules.js";

export const DEFAULT_WEIGHTS = { orgType: 20, country: 20, objectives: 20, experience: 15, targetGroups: 10, capacity: 10, partnerships: 5 };
// Per-programme overrides (same keys). Empty until a programme's guide gives a reason to differ.
export const PROGRAMME_WEIGHTS = {};
export const BANDS = [[90, "excellent"], [75, "strong"], [60, "moderate"], [40, "low"], [0, "verylow"]];
export const band = (score) => BANDS.find(([min]) => score >= min)[1];
// Colour tier of a compatibility score: red below 50, yellow 50-69, green from 70. It describes the score only;
// the eligibility status comes from the mandatory checks and is never derived from this tier.
export const SCORE_TIERS = [[70, "high"], [50, "medium"], [0, "low"]];
export const scoreTier = (score) => SCORE_TIERS.find(([min]) => (Number(score) || 0) >= min)[1];
export const STATUS_ORDER = { eligible: 0, potential: 1, insufficient: 2, ineligible: 3 };

const TYPE = Object.fromEntries(ORG_TYPES.map((t) => [t.id, t]));
const INDIVIDUAL_ONLY = new Set(["researcher", "student", "individual"]);

// ---------- text ----------
const STOP = new Set(("the and for with that this from are our we you your have has was were will can not but all any its into about what which who how when where why their they them also more most than then there these those such only other some very just over under onto via per i me my am is be been being do does did a an of to in on at by or as it if so no yes " +
  "call calls topic project projects proposal proposals action actions programme programmes program programs support supports supported funding fund funded eu european union expected outcome outcomes scope objective objectives activities activity applicant applicants " +
  "non form forms make makes making help helps large small new based including include includes use used using well within across towards toward each one two three first level high key per year years way ways part parts work works working org organisation organisations organization organizations " +
  "i u na za sa se je su da od do po iz kao koji koja koje ili ali smo ste sam bi biti mi vi oni ona ono to taj ta te tu ovo ovaj ova kako sta šta gde kada zašto zasto koliko").split(/\s+/));
export function norm(s) { return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "dj"); }
export function terms(s) {
  return norm(s).split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !STOP.has(w) && !/^\d+$/.test(w)).map((w) => (w.length > 5 ? w.slice(0, w.length - 2) : w));
}
const callText = (c) => [c.title, c.callTitle, (c.keywords || []).join(" "), c.description, c.programmeName].join(" ");
const profileText = (p) => [p.description, p.mission, p.objectives, p.expertise].filter(Boolean).join(" ");

// Word sets of every call and document frequencies over all calls (rare words count more). Built once per data load.
export function buildDF(calls) {
  const df = new Map(), sets = new WeakMap();
  for (const c of calls) { const u = new Set(terms(callText(c))); sets.set(c, u); for (const t of u) df.set(t, (df.get(t) || 0) + 1); }
  return { df, n: calls.length, sets, text: new WeakMap() };
}
const idfOf = (t, stats) => (stats ? Math.log(1 + stats.n / (1 + (stats.df.get(t) || 0))) : 1);
function callSet(c, stats) {
  if (stats && stats.sets && stats.sets.has(c)) return stats.sets.get(c);
  const v = new Set(terms(callText(c)));
  if (stats && stats.sets) stats.sets.set(c, v);
  return v;
}
const termMemo = new Map();
function termSet(text) {
  let v = termMemo.get(text);
  if (!v) { v = new Set(terms(text)); if (termMemo.size > 200) termMemo.clear(); termMemo.set(text, v); }
  return v;
}
// Share of the profile text's vocabulary that the call text also uses, each word weighted by how rare it is
// across all calls. Words that occur in no call cannot match anything and are left out of the total.
function coverage(aText, c, stats) {
  const a = termSet(aText);
  const callWords = callSet(c, stats);
  let shared = 0, total = 0; const hits = [];
  for (const t of a) {
    if (stats && !stats.df.get(t)) continue;
    const w = idfOf(t, stats);
    total += w;
    if (callWords.has(t)) { shared += w; hits.push([t, w]); }
  }
  if (!total) return null;
  return { ratio: shared / total, words: hits.sort((x, y) => y[1] - x[1]).slice(0, 8).map(([t]) => t) };
}
// Coverage of 7% or less is what unrelated calls share through common words; 30% is a close thematic match.
const TEXT_FLOOR = 0.07, TEXT_FULL = 0.3;
const textScore = (ratio) => Math.max(0, Math.min(1, (ratio - TEXT_FLOOR) / (TEXT_FULL - TEXT_FLOOR)));

// Target groups as they are written in (English) call texts.
const GROUP_RE = {
  children: /\bchild|\bpupil/i, youth: /\byouth\b|young people|\bNEETs?\b/i, students: /\bstudent/i, adults: /\badult (learner|education)|\badults\b/i,
  teachers: /\bteacher|\beducator|school staff|\btrainers?\b/i, "youth-workers": /youth work/i, "fewer-opportunities": /fewer opportunities|disadvantaged|vulnerable|social inclusion|marginali[sz]ed/i,
  disabilities: /disabilit/i, women: /\bwomen\b|\bgirls\b|gender equality/i, minorities: /minorit|\broma\b/i, migrants: /migrant|refugee|asylum|third-country national/i,
  elderly: /older (people|persons|adults)|elderly|ageing|aging/i, unemployed: /unemploy|jobseeker|job seeker/i, rural: /\brural\b/i,
  artists: /\bartists?\b|cultural (and creative )?(professionals|operators|organisations)|creative sector/i, researchers: /\bresearchers?\b/i,
  smes: /\bSMEs?\b|entrepreneur|start-?ups?\b/i, "public-sector": /public (authorit|administration|sector|bodies)/i, "civil-society": /civil society|\bNGOs?\b|non-governmental/i,
  "general-public": /\bcitizens?\b|general public|public awareness/i,
};

// ---------- one check result ----------
// result: pass | fail | warn (possible disqualifier from text, not a verified rule) | unknown | missing (profile data needed)
const chk = (id, result, code, params = {}, source = null) => ({ id, result, code, params, source });

function countryCheck(p, c) {
  if (!p.country) return chk("country", "missing", "country.missing");
  const e = (c.eligibility || {})[p.country];
  const reason = e && c.reasons ? c.reasons[e[1]] || "" : "";
  if (!e) return chk("country", "unknown", "country.notListed", { cc: p.country });
  return chk("country", { Y: "pass", P: "unknown", N: "fail", C: "unknown" }[e[0]], "country." + e[0], { cc: p.country, reason }, c.ruleSource || null);
}

function applicantCheck(p, c) {
  if (!p.orgType) return chk("applicant", "missing", "applicant.missing");
  const t = TYPE[p.orgType];
  const apps = c.applicants || [];
  if (!apps.length) return chk("applicant", "unknown", "applicant.notStated");
  if (!t.legal && !apps.includes("individual")) return chk("applicant", "unknown", "applicant.informal", { listed: apps });
  if (apps.some((a) => t.cats.includes(a))) return chk("applicant", "pass", "applicant.listed", { listed: apps, note: c.applicantNote || "" }, "derived");
  if (apps.every((a) => INDIVIDUAL_ONLY.has(a))) return chk("applicant", "fail", "applicant.individualsOnly", { listed: apps }, "derived");
  return chk("applicant", "unknown", "applicant.notListed", { listed: apps, type: p.orgType });
}

function partnershipCheck(p, c, rule) {
  if (c.partnership === "individual") return chk("partnership", "fail", "partnership.individual");
  if (c.partnership !== "consortium") return chk("partnership", "pass", c.partnership === "alone" ? "partnership.alone" : "partnership.unspecified");
  const needCountries = rule && rule.minCountries ? rule.minCountries - 1 : null; // partners from other countries
  const have = (p.partnerCountries || []).filter((x) => x !== p.country).length;
  if (!p.partnerCountries && !p.partnerships) return chk("partnership", "missing", "partnership.consortiumMissing", { need: needCountries, note: c.partnershipNote || "" });
  if (needCountries !== null && have >= needCountries) return chk("partnership", "pass", "partnership.consortiumMet", { have, need: needCountries });
  // Partners can still be found before the deadline: a gap, not a disqualification.
  return chk("partnership", "unknown", "partnership.consortiumGap", { have, need: needCountries, note: c.partnershipNote || "" });
}

// ---------- weighted dimensions (each 0..1, plus whether profile data was missing) ----------
// Call sectors are derived from the call identifier (a whole Horizon cluster or mission shares them), so a shared
// sector is weak evidence; the call's own text decides most of the thematic match.
function dimObjectives(p, c, stats) {
  const areas = p.activityAreas || [];
  const cs = (c.sectors || []).filter((s) => s !== "other");
  const shared = cs.filter((s) => areas.includes(s));
  const sect = !areas.length ? null : !cs.length ? 0.3 : shared.length ? Math.min(1, 0.5 + 0.25 * (shared.length - 1)) : 0;
  const ptext = profileText(p);
  const ov = ptext ? coverage(ptext, c, stats) : null; // area names are scored by the sector match, not twice
  const text = ov ? textScore(ov.ratio) : null;
  if (sect === null && text === null) return { s: 0.5, missing: ["activityAreas", "objectives"] };
  const s = sect === null ? text : text === null ? 0.6 * sect : 0.3 * sect + 0.7 * text;
  return { s, sect, text, sharedSectors: shared, words: ov && text > 0 ? ov.words : [] };
}

function dimExperience(p, c, stats) {
  const field = c.programme === "ERASMUS" ? (p.erasmus || p.euFunding) : p.euFunding;
  if (!field && !p.previousProjects) return { s: 0.5, missing: ["euFunding", "previousProjects"] };
  let s = { coordinator: 1, partner: 0.75, none: 0.35 }[field] ?? 0.5;
  const ov = p.previousProjects ? coverage(p.previousProjects, c, stats) : null;
  if (ov) s = Math.min(1, s + 0.15 * textScore(ov.ratio));
  return { s, role: field || null };
}

function dimTargets(p, c, stats) {
  const groups = p.targetGroups || [];
  if (!groups.length) return { s: 0.5, missing: ["targetGroups"] };
  let mentioned = stats && stats.text && stats.text.get(c);
  if (!mentioned) {
    const text = callText(c) + " " + (c.conditions || "");
    mentioned = Object.keys(GROUP_RE).filter((g) => GROUP_RE[g].test(text));
    if (stats && stats.text) stats.text.set(c, mentioned);
  }
  const hit = groups.filter((g) => mentioned.includes(g));
  // A call that names none of the groups gives no support either way: below the middle, so silence never adds points.
  return { s: hit.length >= 2 ? 1 : hit.length === 1 ? 0.7 : mentioned.length ? 0.1 : 0.3, matched: hit };
}

// Grant size per project: the stated maximum or typical amount, else the topic budget divided by the expected grants.
function grantSize(f) {
  if (f.maxPerGrant || f.approxPerGrant) return f.maxPerGrant || f.approxPerGrant;
  if (f.topicBudget && f.expectedGrants) return f.topicBudget / f.expectedGrants;
  return null;
}
// Staff needed per grant size; a volunteer counts as a tenth of an employee.
const CAPACITY = {
  small: [[1, 1], [0, 0.6]],
  medium: [[5, 1], [2, 0.7], [0, 0.4]],
  large: [[20, 1], [8, 0.7], [3, 0.4], [0, 0.2]],
  xlarge: [[50, 1], [20, 0.6], [8, 0.3], [0, 0.1]],
};
function dimCapacity(p, c, now) {
  if (p.employees === undefined && p.volunteers === undefined) return { s: 0.5, missing: ["employees", "volunteers"] };
  const staff = (p.employees || 0) + 0.1 * (p.volunteers || 0);
  const per = grantSize(c.funding || {});
  const size = !per ? "medium" : per <= 60000 ? "small" : per <= 500000 ? "medium" : per <= 2500000 ? "large" : "xlarge";
  let s = CAPACITY[size].find(([min]) => staff >= min)[1];
  const age = p.yearEstablished ? new Date(now).getUTCFullYear() - p.yearEstablished : null;
  if (age !== null && age < 2) s = Math.max(0, s - 0.2);
  return { s, size, staff: Math.round(staff * 10) / 10, perGrant: per };
}

function dimPartnerships(p, c, rule) {
  if (c.partnership === "alone") return { s: 1 };
  if (c.partnership !== "consortium") return { s: 0.6 }; // not stated: the call document may still require partners
  if (!p.partnerCountries && !p.partnerships) return { s: 0.5, missing: ["partnerCountries"] };
  const have = (p.partnerCountries || []).filter((x) => x !== p.country).length;
  const need = rule && rule.minCountries ? rule.minCountries - 1 : 2;
  return { s: have >= need ? 1 : have > 0 ? 0.6 : 0.2, have, need };
}

const RESULT_SCORE = { pass: 1, unknown: 0.5, warn: 0.3, missing: 0.5, fail: 0 };
const COUNTRY_SCORE = { Y: 1, P: 0.6, C: 0.4, N: 0 };

// ---------- assessment ----------
export function assess(profile, call, { now = Date.now(), weights = null, stats = null, relevanceCap = true } = {}) {
  const p = profile || {};
  const c = call;
  const ruleFns = CALL_RULES.filter((r) => r.match(c));
  const ruleInfo = Object.assign({}, ...ruleFns.map((r) => r.info || {}));

  const checks = [countryCheck(p, c), applicantCheck(p, c), partnershipCheck(p, c, ruleInfo)];
  for (const r of ruleFns) for (const x of r.checks(p, c, { now })) checks.push(x);

  const w = { ...DEFAULT_WEIGHTS, ...(PROGRAMME_WEIGHTS[c.programme] || {}), ...(weights || {}) };
  const e = (c.eligibility || {})[p.country];
  const appl = checks.find((x) => x.id === "applicant");
  const dims = {
    orgType: { s: RESULT_SCORE[appl.result], ...(appl.result === "missing" ? { missing: ["orgType"] } : {}) },
    country: p.country ? { s: e ? COUNTRY_SCORE[e[0]] : 0.4 } : { s: 0.5, missing: ["country"] },
    objectives: dimObjectives(p, c, stats),
    experience: dimExperience(p, c, stats),
    targetGroups: dimTargets(p, c, stats),
    capacity: dimCapacity(p, c, now),
    partnerships: dimPartnerships(p, c, ruleInfo),
  };
  let sum = 0, tot = 0;
  for (const k of Object.keys(DEFAULT_WEIGHTS)) { sum += (w[k] || 0) * dims[k].s; tot += w[k] || 0; }
  let score = tot ? Math.round((100 * sum) / tot) : 0;
  // Relevance cap: eligibility alone (type + country = 40% of the weights) must not make an unrelated call look
  // compatible. With no thematic match the score stays at most 40 (low); a full match lifts the cap to 95.
  const capped = relevanceCap && !dims.objectives.missing ? Math.min(score, Math.round(40 + 55 * dims.objectives.s)) : score;
  const capApplied = capped < score;
  score = capped;

  const results = checks.map((x) => x.result);
  const status = results.includes("fail") ? "ineligible"
    : (!p.country || !p.orgType) ? "insufficient"
    : results.some((r) => r === "unknown" || r === "warn" || r === "missing") ? "potential" : "eligible";

  const missing = [...new Set([
    ...checks.filter((x) => x.result === "missing").flatMap((x) => (x.id === "country" ? ["country"] : x.id === "applicant" ? ["orgType"] : x.id === "partnership" ? ["partnerCountries"] : x.params.fields || [])),
    ...Object.values(dims).flatMap((d) => d.missing || []),
  ])];
  const strengths = [];
  if (dims.objectives.sharedSectors && dims.objectives.sharedSectors.length) strengths.push({ code: "str.sectors", params: { sectors: dims.objectives.sharedSectors } });
  if (dims.objectives.words && dims.objectives.words.length >= 3) strengths.push({ code: "str.words", params: { words: dims.objectives.words } });
  if (dims.targetGroups.matched && dims.targetGroups.matched.length) strengths.push({ code: "str.groups", params: { groups: dims.targetGroups.matched } });
  if (dims.experience.role === "coordinator" || dims.experience.role === "partner") strengths.push({ code: "str.experience", params: { role: dims.experience.role, programme: c.programme } });
  if (dims.capacity.s >= 1) strengths.push({ code: "str.capacity", params: { size: dims.capacity.size } });
  if (e && e[0] === "Y") strengths.push({ code: "str.country", params: { cc: p.country } });

  const gaps = checks.filter((x) => x.result !== "pass");
  const next = recommendations(p, c, checks, dims, missing);
  return { callId: c.id, status, score, capApplied, band: band(score), weights: w, dims, checks, gaps, strengths, missing, next, at: new Date(now).toISOString() };
}

function recommendations(p, c, checks, dims, missing) {
  const out = [];
  const by = Object.fromEntries(checks.map((x) => [x.id, x]));
  if (checks.some((x) => x.result === "fail")) out.push({ code: "rec.notEligible" });
  if (missing.length) out.push({ code: "rec.complete", params: { fields: missing.slice(0, 5) } });
  if (by.country && (by.country.result === "unknown")) out.push({ code: "rec.checkCountry", params: { cc: p.country } });
  if (by.applicant && ["unknown", "warn"].includes(by.applicant.result)) out.push({ code: "rec.checkApplicant" });
  if (by.partnership && ["unknown", "missing"].includes(by.partnership.result)) out.push({ code: "rec.partners", params: { need: by.partnership.params.need } });
  for (const x of checks) if (x.result === "warn" || (x.result === "unknown" && x.source === "call-rule")) out.push({ code: "rec.rule", params: { id: x.id } });
  if (dims.targetGroups.s <= 0.2) out.push({ code: "rec.groups" });
  if (c.conditionsTruncated || c.descriptionTruncated || /described in the call document/i.test(c.conditions || "")) out.push({ code: "rec.readDocument" });
  out.push({ code: "rec.officialPage" });
  return out;
}

// All calls at once, sorted: eligible and potential first, then by score. Ineligible calls go last,
// so a high score never hides a failed mandatory check.
export function assessAll(profile, calls, opts = {}) {
  const stats = opts.stats || buildDF(calls);
  return calls.map((c) => assess(profile, c, { ...opts, stats })).sort((a, b) => (STATUS_ORDER[a.status] - STATUS_ORDER[b.status]) || (b.score - a.score));
}

// Fingerprint of the call fields the assessment reads, to know when a stored report is out of date.
export function callFingerprint(c) {
  const s = JSON.stringify([c.title, c.nextDeadline, c.eligibility, c.reasons, c.applicants, c.partnership, c.sectors, c.funding, c.conditions, c.description]);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}

export { completeness };
