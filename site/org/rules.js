// Deterministic eligibility checks and compatibility score for one organisation profile against one call.
// Pure functions shared by the browser (all calls, instantly) and the API (stored reports).
//
// Two separate outputs, as required:
//   status  eligible | potential | ineligible | insufficient    mandatory eligibility: can the organisation apply?
//           (country, organisation type, consortium and the conditions read from the call's official documents)
//   score   0..100 strategic compatibility                        how well the call fits the organisation's mission,
//           experience, target groups and capacity; country and organisation type are not part of it
// A failed mandatory check always sets status "ineligible", whatever the score. A condition that could not be
// verified (no official document read, data missing) is "unknown", never counted as met.
//
// Results carry codes and parameters, not sentences: the page renders them in English or Serbian.

import { ORG_TYPES, completeness } from "./schema.js";
import { CALL_RULES } from "./call_rules.js";
import { foldText, TEXT_FIELDS, detectLang } from "./lang.js";

// Strategic compatibility only: mandatory conditions (country, organisation type, consortium) decide the status.
export const DEFAULT_WEIGHTS = { objectives: 35, experience: 25, targetGroups: 20, capacity: 10, partnerships: 10 };
// Per-programme overrides (same keys). Empty until a programme's guide gives a reason to differ.
export const PROGRAMME_WEIGHTS = {};
// Compatibility classes, the same everywhere (labels, colours, filters, "70%+" statistics): high from 70, medium 50-69, low below 50.
export const HIGH = 70, MEDIUM = 50;
export const BANDS = [[HIGH, "high"], [MEDIUM, "medium"], [0, "low"]];
export const band = (score) => BANDS.find(([min]) => score >= min)[1];
// Colour tier of a compatibility score: red below 50, yellow 50-69, green from 70. It describes the score only;
// the eligibility status comes from the mandatory checks and is never derived from this tier.
export const SCORE_TIERS = BANDS;
export const scoreTier = (score) => SCORE_TIERS.find(([min]) => (Number(score) || 0) >= min)[1];
export const STATUS_ORDER = { eligible: 0, potential: 1, insufficient: 2, ineligible: 3 };

const TYPE = Object.fromEntries(ORG_TYPES.map((t) => [t.id, t]));
const INDIVIDUAL_ONLY = new Set(["researcher", "student", "individual"]);

// ---------- text ----------
const STOP = new Set(("the and for with that this from are our we you your have has was were will can not but all any its into about what which who how when where why their they them also more most than then there these those such only other some very just over under onto via per i me my am is be been being do does did a an of to in on at by or as it if so no yes " +
  "call calls topic project projects proposal proposals action actions programme programmes program programs support supports supported funding fund funded eu european union expected outcome outcomes scope objective objectives activities activity applicant applicants " +
  "non form forms make makes making help helps large small new based including include includes use used using well within across towards toward each one two three first level high key per year years way ways part parts work works working org organisation organisations organization organizations " +
  "i u na za sa se je su da od do po iz kao koji koja koje ili ali smo ste sam bi biti mi vi oni ona ono to taj ta te tu ovo ovaj ova kako sta šta gde kada zašto zasto koliko").split(/\s+/));
// Lowercase, Cyrillic transliterated to Latin, diacritics folded (č ć -> c, š -> s, ž -> z, đ -> dj): Serbian text in
// either script and the calls' English text meet on the same plain letters.
export const norm = foldText;
export function terms(s) {
  return norm(s).split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !STOP.has(w) && !/^\d+$/.test(w)).map((w) => (w.length > 5 ? w.slice(0, w.length - 2) : w));
}

// Serbian to English glossary (site/org/glossary-sr-en.json, loaded by the page with setGlossary): when Serbian
// words of an entry occur in a text, its English words are added, so a Serbian profile meets English call texts
// and an English profile meets Serbian call texts. Without a glossary the text is used as it is.
let GLOSS = null;
const MAX_ENDING = 6;
export function setGlossary(g) {
  const idx = new Map();
  for (const e of (g && g.terms) || []) {
    const words = String(e.sr || "").trim().split(/\s+/).filter(Boolean);
    if (!words.length || !e.en) continue;
    // each word slot: one or more alternatives (a|b|c), each exact or a beginning (ending in *)
    const entry = { words: words.map((w) => w.split("|").map((a) => (a.endsWith("*") ? { pre: a.slice(0, -1) } : { eq: a }))), en: String(e.en), not: e.not || [] };
    for (const k of new Set(words[0].split("|").map((a) => a.replace(/\*$/, "").slice(0, 3)))) {
      if (!idx.has(k)) idx.set(k, []);
      idx.get(k).push(entry);
    }
  }
  GLOSS = idx.size ? { idx, version: (g && g.version) || "" } : null;
  termMemo.clear(); surfMemo.clear(); expMemo.clear(); vecMemo.clear(); unknownOf.clear(); textOf = new WeakMap(); profMemo = new WeakMap();
}
export const glossaryVersion = () => (GLOSS ? GLOSS.version : "");
const wordMatch = (w, p, not) => (p.eq !== undefined ? w === p.eq : w.startsWith(p.pre) && w.length - p.pre.length <= MAX_ENDING && !not.some((x) => w.startsWith(x)));
// English text is left as it is, so English profiles and calls score exactly as without the glossary.
const EN_FAST = /\b(the|and|of|for|with|to)\b/g, NOT_EN = /[čćšžđČĆŠŽĐ\u0400-\u04FF]/;
function looksEnglish(text) {
  const head = text.slice(0, 800);
  if (NOT_EN.test(head)) return false;
  const n = (head.toLowerCase().match(EN_FAST) || []).length;
  return n >= 3 || (n >= 1 && detectLang(head).lang === "en");
}
const expMemo = new Map();
export function expandText(text) {
  if (!GLOSS || !text) return text || "";
  const hit = expMemo.get(text);
  if (hit !== undefined) return hit;
  const out = looksEnglish(text) ? text : expandWords(text);
  if (expMemo.size > 400) { expMemo.clear(); unknownOf.clear(); }
  expMemo.set(text, out);
  return out;
}
function expandWords(text) {
  const words = norm(text).split(/[^a-z0-9]+/).filter(Boolean);
  const add = [], used = new Set();
  for (let i = 0; i < words.length; i++) {
    const cand = GLOSS.idx.get(words[i].slice(0, 3));
    if (!cand) continue;
    for (const e of cand) {
      if (i + e.words.length > words.length) continue;
      let ok = true;
      for (let j = 0; j < e.words.length && ok; j++) ok = e.words[j].some((p) => wordMatch(words[i + j], p, e.not));
      if (ok) { add.push(e.en); for (let j = 0; j < e.words.length; j++) used.add(i + j); }
    }
  }
  const out = add.length ? text + " " + add.join(" ") : text;
  // Words the glossary did not translate: they still belong to the text's vocabulary, so the thematic share
  // counts them as unmatched (see coverage). Without this, a translated handful of generic terms would cover a
  // Serbian text "fully" and score it higher than the same text in English.
  const rest = new Set();
  words.forEach((w, i) => { if (!used.has(i)) for (const t of terms(w)) rest.add(t); });
  unknownOf.set(out, rest);
  return out;
}
const unknownOf = new Map();   // expanded text -> stems of its words the glossary left untranslated
// Weight of an untranslated word relative to the text's mean word weight. 0.15 brings the five Serbian sample
// profiles closest to their English versions (mean score difference over all calls, and calls at 70%+);
// measured on 15 Nov 2026 with 0, 0.15, 0.25, 0.35 and 0.5. Applies only to text without an English copy.
const UNKNOWN_SHARE = 0.15;

const rawCallText = (c) => expandText([c.title, c.callTitle, (c.keywords || []).join(" "), c.description, c.programmeName].join(" "));
let textOf = new WeakMap();   // call -> its (expanded) text, computed once per call object and glossary
const callText = (c) => { let t = textOf.get(c); if (t === undefined) { t = rawCallText(c); textOf.set(c, t); } return t; };
// The profile's free text for the thematic match. A field with an English copy (machine translation or the user's
// edit, kept per profile version on the server and passed in as profile.textEn) is matched in English.
let profMemo = new WeakMap();
const profileText = (p) => {
  let t = profMemo.get(p);
  if (t === undefined) { t = expandText(TEXT_FIELDS.map((k) => (p.textEn && p.textEn[k]) || p[k]).filter(Boolean).join(" ")); profMemo.set(p, t); }
  return t;
};

// Word sets of every call and document frequencies over all calls (rare words count more). Built once per data load.
export function buildDF(calls) {
  const df = new Map(), sets = new WeakMap(), tfs = new WeakMap();
  for (const c of calls) {
    const tf = new Map(); for (const t of terms(callText(c))) tf.set(t, (tf.get(t) || 0) + 1);
    tfs.set(c, tf); sets.set(c, new Set(tf.keys())); for (const t of tf.keys()) df.set(t, (df.get(t) || 0) + 1);
  }
  return { df, n: calls.length, sets, tfs, text: new WeakMap(), calls };
}
const idfOf = (t, stats) => (stats ? Math.log(1 + stats.n / (1 + (stats.df.get(t) || 0))) : 1);
function callSet(c, stats) {
  if (stats && stats.sets && stats.sets.has(c)) return stats.sets.get(c);
  const v = new Set(terms(callText(c)));
  if (stats && stats.sets) stats.sets.set(c, v);
  return v;
}
// The profile's own words for each stem, so strengths show "young", not the stem "youn".
const surfMemo = new Map();
function surface(text) {
  let m = surfMemo.get(text);
  if (m) return m;
  m = new Map();
  for (const w of String(text || "").toLowerCase().split(/[^\p{L}\p{N}]+/u)) {
    const t = terms(w)[0];
    if (t && !m.has(t)) m.set(t, w);
  }
  if (surfMemo.size > 200) surfMemo.clear();
  surfMemo.set(text, m);
  return m;
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
  // Untranslated words of a non-English text that no call uses count as unmatched, at UNKNOWN_SHARE of the mean weight.
  const rest = stats && unknownOf.get(aText);
  if (rest && rest.size) {
    let n = 0; for (const t of rest) if (!a.has(t) || !stats.df.get(t)) n++;
    const counted = [...a].filter((t) => stats.df.get(t)).length;
    total += UNKNOWN_SHARE * n * (counted ? total / counted : idfOf("", stats));
  }
  if (!total) return null;
  const surf = surface(aText);
  return { ratio: shared / total, words: hits.sort((x, y) => y[1] - x[1]).slice(0, 8).map(([t]) => surf.get(t) || t) };
}
// TF-IDF vectors (term counts dampened with 1 + log, times rarity across calls) and their lengths.
function tfVec(list, stats, counted = null) {
  let tf = counted;
  if (!tf) { tf = new Map(); for (const t of list) tf.set(t, (tf.get(t) || 0) + 1); }
  const v = new Map(); let n2 = 0;
  for (const [t, k] of tf) { if (stats && !stats.df.get(t)) continue; const w = (1 + Math.log(k)) * idfOf(t, stats); v.set(t, w); n2 += w * w; }
  return { v, n: Math.sqrt(n2) };
}
function callVec(c, stats) {
  if (stats && !stats.vec) stats.vec = new WeakMap();
  let x = stats && stats.vec.get(c);
  if (!x) { const tf = stats && stats.tfs && stats.tfs.get(c); x = tf ? tfVec(null, stats, tf) : tfVec(terms(callText(c)), stats); if (stats) stats.vec.set(c, x); }
  return x;
}
const vecMemo = new Map();
// Thematic similarity of a profile text and a call: cosine of the two TF-IDF vectors. Both lengths are
// normalised, so a fuller profile or a longer call text neither lowers nor raises the match by itself; what
// counts is whether the words that carry most weight in the profile also carry weight in the call.
function similarity(aText, c, stats) {
  let a = vecMemo.get(aText);
  if (!a || a.stats !== stats) {
    a = tfVec(terms(aText), stats); a.stats = stats;
    // Untranslated words of a non-English text that no call uses still belong to the text: they lengthen its vector
    // at UNKNOWN_SHARE of the mean word weight, so a few translated generic words do not make a "perfect" match.
    const rest = stats && unknownOf.get(aText);
    if (rest && rest.size && a.v.size) {
      let k = 0; for (const t of rest) if (!a.v.has(t)) k++;
      const mean = a.n / Math.sqrt(a.v.size);
      a.n = Math.sqrt(a.n * a.n + k * (UNKNOWN_SHARE * mean) ** 2);
    }
    if (vecMemo.size > 50) vecMemo.clear();
    vecMemo.set(aText, a);
  }
  if (!a.n) return null;
  const b = callVec(c, stats);
  if (!b.n) return { ratio: 0, words: [] };
  let dot = 0; const hits = [];
  const [small, big] = a.v.size < b.v.size ? [a.v, b.v] : [b.v, a.v];
  for (const [t, w] of small) { const u = big.get(t); if (u) { dot += w * u; hits.push([t, w * u]); } }
  const surf = surface(aText);
  return { ratio: dot / (a.n * b.n), words: hits.sort((x, y) => y[1] - x[1]).slice(0, 8).map(([t]) => surf.get(t) || t) };
}
// Coverage of 7% or less is what unrelated calls share through common words; 30% is a close thematic match.
const TEXT_FLOOR = 0.07, TEXT_FULL = 0.3;
const textScore = (ratio) => Math.max(0, Math.min(1, (ratio - TEXT_FLOOR) / (TEXT_FULL - TEXT_FLOOR)));
// Cosine of 3% or less is what unrelated calls share; 13% is a close thematic match. Measured on 15 Nov 2026 over
// the open calls with six sample profiles (environment short and full, youth, culture, AI company, Cyrillic): the
// median call scores about 2%, the closest calls 13% to 25%, and a full profile no longer scores lower than a short one.
const SIM_FLOOR = 0.03, SIM_FULL = 0.13;
const simScore = (r) => Math.max(0, Math.min(1, (r - SIM_FLOOR) / (SIM_FULL - SIM_FLOOR)));

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

// ---------- conditions read from the call's official documents (site/org/eligibility.json) ----------
// elig: the call's entry ({status, title, docUrl, verified, conditions: [{type, value, quote | ref}]}); quotes of
// framework conditions (Horizon Europe General Annex B) come from frameworks. ai: conditions checked by the AI against
// the official text for this profile ({result, condition, quote, reason, field}), each quote verified by the server.
const FOR_PROFIT = new Set(["sme", "startup", "company"]);
const EU27 = new Set(["AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE"]);
// The closed list of eligible countries read from the call document (ingest/eligibility_docs.py, condition "countries"):
// true or false when the list decides for this country, null when it has a category the document does not enumerate
// (associated or third countries and the like), so nothing can be concluded from it.
export function countryInList(cond, cc) {
  if (!cond || cond.open || !cc) return null;
  if ((cond.excluded || []).includes(cc)) return false;
  return (!!cond.eu && EU27.has(cc)) || (cond.named || []).includes(cc);
}
const PUBLIC = new Set(["public-authority", "public-body", "university", "school", "research"]);
function officialChecks(p, c, elig, frameworks, ai) {
  const out = [];
  if (!elig || elig.status !== "verified") {
    out.push(chk("official", "unknown", "off.unverified", { status: (elig && elig.status) || "not_researched", url: (elig && elig.docUrl) || c.url || "" }, "official"));
  } else {
    const src = { title: elig.title || "", url: elig.docUrl || c.url || "", verified: elig.verified || "", published: elig.published || "" };
    const q = (x) => ({ ...src, quote: x.quote || (x.ref && frameworks && frameworks[x.ref] ? frameworks[x.ref].consortium.quote : ""), ...(x.ref && frameworks && frameworks[x.ref] ? { title: frameworks[x.ref].title, url: frameworks[x.ref].url } : {}) });
    const by = Object.fromEntries((elig.conditions || []).map((x) => [x.type, x]));
    const t = p.orgType, typ = TYPE[t];
    if (by.naturalPersons && by.naturalPersons.value === false) {
      out.push(!t ? chk("off.natural", "missing", "off.natural.missing", { ...q(by.naturalPersons), fields: ["orgType"] }, "official")
        : INDIVIDUAL_ONLY.has(t) ? chk("off.natural", "fail", "off.natural.fail", q(by.naturalPersons), "official") : chk("off.natural", "pass", "off.natural.pass", q(by.naturalPersons), "official"));
    }
    if (by.legalEntity && t && typ && !typ.legal && !INDIVIDUAL_ONLY.has(t)) {
      out.push(by.noLegalPersonality ? chk("off.legal", "warn", "off.legal.exceptional", q(by.noLegalPersonality), "official") : chk("off.legal", "fail", "off.legal.fail", q(by.legalEntity), "official"));
    }
    if (by.coordinatorNonProfit && t && FOR_PROFIT.has(t)) out.push(chk("off.coordinator", "warn", "off.coordinator.forProfit", q(by.coordinatorNonProfit), "official"));
    else if (by.forProfitPartnerOnly && t && FOR_PROFIT.has(t)) out.push(chk("off.coordinator", "warn", "off.forProfit.partner", q(by.forProfitPartnerOnly), "official"));
    if (by.publicOnly && t) out.push(PUBLIC.has(t) ? chk("off.public", "pass", "off.public.pass", q(by.publicOnly), "official") : chk("off.public", "warn", "off.public.check", q(by.publicOnly), "official"));
    const minA = by.minApplicants && by.minApplicants.value, minC = by.minCountries && by.minCountries.value;
    if ((minA && minA > 1) || (minC && minC > 1)) {
      const needC = minC ? minC - 1 : null, have = (p.partnerCountries || []).filter((x) => x !== p.country).length;
      const prm = { ...q(by.minCountries || by.minApplicants), minApplicants: minA || null, minCountries: minC || null, have, need: needC };
      out.push(!p.partnerCountries && !p.partnerships ? chk("off.consortium", "missing", "off.consortium.missing", { ...prm, fields: ["partnerCountries"] }, "official")
        : (needC === null || have >= needC) ? chk("off.consortium", "pass", "off.consortium.met", prm, "official")
        : chk("off.consortium", "unknown", "off.consortium.gap", prm, "official"));
    } else if (minA === 1) out.push(chk("off.consortium", "pass", "off.consortium.single", q(by.minApplicants), "official"));
    const inList = countryInList(by.countries, p.country);
    if (!out.length && inList !== false) out.push(chk("official", "pass", "off.read", { ...src, n: (elig.conditions || []).length }, "official"));
    if (inList !== null) out.unshift(chk("off.country", inList ? "pass" : "fail", inList ? "off.country.pass" : "off.country.fail", { ...q(by.countries), cc: p.country }, "official"));
  }
  for (const a of ai || []) {
    if (!a || !["pass", "fail", "unknown"].includes(a.result)) continue;
    out.push(chk("ai." + (a.id || out.length), a.result, "off.ai", { condition: a.condition, quote: a.quote, reason: a.reason, field: a.field || "", title: a.title || (elig && elig.title) || "", url: a.url || (elig && elig.docUrl) || "" }, "official-ai"));
  }
  return out;
}

// Areas of activity as phrases in a call's own text (folded, lowercase), for a profile that has areas but no free
// text yet. The call's sector tags come from its identifier (a whole Horizon cluster shares them), so on their own
// they cannot tell a quantum-computing call from a film-education call for a "research, digital, culture" profile.
const AREA_RE = {
  culture: /\bcultur/, film: /\bfilm|\bcinema|audiovisual/, tv: /televis|\btv\b|broadcast/, media: /\bmedia\b|journalis|\bnews\b/,
  "creative-industries": /creative (and cultural )?(industr|sector)|cultural and creative|creative economy/, architecture: /architect/,
  design: /\bdesign(ers?)?\b(?! (of|and implement))/, digital: /\bdigital/, it: /computing|information technolog|\bict\b|software/,
  ai: /artificial intelligence|\bai\b|machine learning/, cybersecurity: /cyber/, innovation: /innovat/, research: /\bresearch/,
  education: /educat|\bschool|\bteach|\blearners?\b|\bskills\b|\btraining\b/, youth: /\byouth|young people/,
  "social-inclusion": /inclusion|inclusive|disadvantaged|vulnerable/, employment: /employ|labour market|\bjobs?\b/,
  "human-rights": /human rights|equality|discriminat/, democracy: /democra|\bcivic|citizen/, "civil-society": /civil society|\bngos?\b|non-governmental/,
  justice: /justice|judicial/, security: /security/, defence: /defen[cs]e|military/, health: /health/,
  environment: /environment|biodivers|pollution|ecosystem/, climate: /climate/, energy: /energy/, sustainability: /sustainab/,
  food: /\bfood|agricultur|\bfarm/, transport: /transport|mobility/, cities: /\bcit(y|ies)\b|urban/, "regional-dev": /regional|cohesion|territorial/,
  "intl-cooperation": /international cooperation|third countr/, entrepreneurship: /entrepreneur/, startups: /start-?ups?\b/,
  smes: /\bsmes?\b|small and medium/,
};
const AREA_LABEL = { "creative-industries": "creative industries", it: "IT", ai: "AI", "social-inclusion": "social inclusion", "human-rights": "human rights",
  "civil-society": "civil society", "regional-dev": "regional development", "intl-cooperation": "international cooperation", smes: "SMEs", tv: "television" };
const areaHits = new WeakMap();   // call -> Set of area ids its text names
function callAreas(c) {
  let v = areaHits.get(c);
  if (!v) { const t = norm(callText(c)); v = new Set(Object.keys(AREA_RE).filter((a) => AREA_RE[a].test(t))); areaHits.set(c, v); }
  return v;
}
// Share of the profile's areas (weighted by how rare each is across all calls) that the call's text names.
// 10% or less is noise; 60% means the call speaks to most of what the organisation does.
const AREA_FLOOR = 0.1, AREA_FULL = 0.6;
function areaMatch(areas, c, stats) {
  const all = stats && stats.calls;
  if (all && !stats.areaW) {
    stats.areaW = {};
    for (const a of Object.keys(AREA_RE)) { let df = 0; for (const x of all) if (callAreas(x).has(a)) df++; stats.areaW[a] = df ? Math.log(1 + all.length / df) : 0; }
  }
  const w = (a) => (stats && stats.areaW ? stats.areaW[a] || 0 : AREA_RE[a] ? 1 : 0);
  const mine = areas.filter((a) => w(a) > 0), hit = callAreas(c);
  const total = mine.reduce((s, a) => s + w(a), 0);
  if (!total) return null;
  const got = mine.filter((a) => hit.has(a));
  const share = got.reduce((s, a) => s + w(a), 0) / total;
  return { score: Math.max(0, Math.min(1, (share - AREA_FLOOR) / (AREA_FULL - AREA_FLOOR))), words: got.sort((a, b) => w(b) - w(a)).map((a) => AREA_LABEL[a] || a) };
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
  // Free text when the profile has it (area names are then scored by the sector match, not twice); otherwise the
  // area names themselves, so a profile with areas only still gets a match on the call's text.
  const ov = ptext ? similarity(ptext, c, stats) : null;
  const am = !ptext && areas.length ? areaMatch(areas, c, stats) : null;
  const text = ov ? simScore(ov.ratio) : am ? am.score : null;
  if (sect === null && text === null) return { s: 0.5, missing: ["activityAreas", "objectives"] };
  const s = sect === null ? text : text === null ? 0.6 * sect : 0.3 * sect + 0.7 * text;
  return { s, sect, text, textFrom: ov ? "profile" : am ? "areas" : null, sharedSectors: shared, words: text > 0 ? (ov ? ov.words : am.words) : [] };
}

function dimExperience(p, c, stats) {
  const field = c.programme === "ERASMUS" ? (p.erasmus || p.euFunding) : p.euFunding;
  if (!field && !p.previousProjects) return { s: 0.5, missing: ["euFunding", "previousProjects"] };
  let s = { both: 1, coordinator: 1, partner: 0.75, none: 0.35 }[field] ?? 0.5;
  const ov = p.previousProjects ? coverage(expandText(p.previousProjects), c, stats) : null;
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
export function assess(profile, call, { now = Date.now(), weights = null, stats = null, relevanceCap = true, elig = null, ai = null } = {}) {
  const p = profile || {};
  const c = call;
  const ruleFns = CALL_RULES.filter((r) => r.match(c));
  const ruleInfo = Object.assign({}, ...ruleFns.map((r) => r.info || {}));

  const e0 = elig && elig.calls ? elig.calls[c.id] : null;
  const official = elig ? officialChecks(p, c, e0, elig.frameworks, ai && ai[c.id]) : [];
  // The official consortium condition replaces the one derived from the call data.
  const checks = [countryCheck(p, c), applicantCheck(p, c), ...(official.some((x) => x.id === "off.consortium") ? [] : [partnershipCheck(p, c, ruleInfo)])];
  for (const r of ruleFns) for (const x of r.checks(p, c, { now })) checks.push(x);
  checks.push(...official);

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
  // Relevance cap: experience, target groups and capacity alone must not make an unrelated call look compatible.
  // With no thematic match the score stays at most 40 (low); a full match lifts the cap to 95.
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
  if (dims.experience.role === "coordinator" || dims.experience.role === "partner" || dims.experience.role === "both") strengths.push({ code: "str.experience", params: { role: dims.experience.role, programme: c.programme } });
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
  if (by["off.consortium"] && ["unknown", "missing"].includes(by["off.consortium"].result)) out.push({ code: "rec.partners", params: { need: by["off.consortium"].params.need } });
  if (by.official && by.official.result === "unknown") out.push({ code: "rec.verifyOfficial" });
  for (const x of checks) if ((x.result === "warn" || (x.result === "unknown" && x.source === "call-rule")) && !String(x.id).startsWith("off") && !String(x.id).startsWith("ai.")) out.push({ code: "rec.rule", params: { id: x.id } });
  if (checks.some((x) => x.source === "official" && x.result === "warn")) out.push({ code: "rec.officialWarn" });
  if (dims.targetGroups.s <= 0.2) out.push({ code: "rec.groups" });
  if (c.conditionsTruncated || c.descriptionTruncated || /described in the call document/i.test(c.conditions || "")) out.push({ code: "rec.readDocument" });
  out.push({ code: "rec.officialPage" });
  return out;
}

// Mandatory eligibility in numbers: requirements met, failed and still to verify (unknown, warn, missing).
export function mandatorySummary(checks) {
  const n = { pass: 0, fail: 0, verify: 0 };
  for (const x of checks || []) n[x.result === "pass" ? "pass" : x.result === "fail" ? "fail" : "verify"]++;
  return n;
}

// All calls at once, sorted: eligible and potential first, then by score. Ineligible calls go last,
// so a high score never hides a failed mandatory check.
export function assessAll(profile, calls, opts = {}) {
  const stats = opts.stats || buildDF(calls);
  // Calls that fail a mandatory condition go last; the rest are ranked by compatibility, so the matching list, the
  // overview and the idea shortlist show the same order. Equal scores: eligible before "to verify".
  const last = (r) => (r.status === "ineligible" ? 1 : 0);
  return calls.map((c) => assess(profile, c, { ...opts, stats })).sort((a, b) => (last(a) - last(b)) || (b.score - a.score) || (STATUS_ORDER[a.status] - STATUS_ORDER[b.status]));
}

// Fingerprint of the call fields the assessment reads, to know when a stored report is out of date.
export function callFingerprint(c) {
  const s = JSON.stringify([c.title, c.nextDeadline, c.eligibility, c.reasons, c.applicants, c.partnership, c.sectors, c.funding, c.conditions, c.description]);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}

export { completeness };
