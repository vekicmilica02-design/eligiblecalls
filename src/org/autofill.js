// Automatic profile fill from an extraction run (document or web pages).
// A value goes into the profile without a click when its quote was found in the source and the model's
// confidence is high or medium, and the field is empty (lists: new items are added). A value that differs
// from what the profile already has is not written: it is listed as a conflict for the user to decide.
// Values whose quote was not found, or with low confidence, are listed as "not applied" with their quote.
// Every written value keeps its source (file name or page), the quote and the confidence in profile._meta.

import { FIELD } from "../../site/org/schema.js";

const isList = (k) => ["multi", "countries"].includes(FIELD[k] && FIELD[k].kind);
const empty = (v) => v === undefined || v === null || v === "" || (Array.isArray(v) && !v.length);
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const norm = (v) => (typeof v === "string" ? v.trim().toLowerCase().replace(/\s+/g, " ") : v);

export const reliable = (e) => !!e && e.found === true && !e.note && (e.confidence === "high" || e.confidence === "medium");

function metaFor(run, e, at) {
  return {
    source: run.kind === "web" ? "web" : "document", sourceName: run.sourceName,
    ...(e.sourceUrl || run.sourceUrl ? { sourceUrl: e.sourceUrl || run.sourceUrl } : {}),
    evidence: e.evidence, confidence: e.confidence, verified: false, at,
  };
}

// profile: current profile; run: {kind, sourceName, sourceUrl, fields}; take: field ids the user chose to apply
// over a conflict or a doubtful value. Returns {profile, filled, conflicts, notApplied}.
export function planFill(profile, run, { take = [], at = new Date().toISOString() } = {}) {
  const next = JSON.parse(JSON.stringify(profile || {}));
  next._meta = { ...(next._meta || {}) };
  const filled = [], conflicts = [], notApplied = [];
  for (const [k, e] of Object.entries(run.fields || {})) {
    if (!FIELD[k] || !e || empty(e.value)) continue;
    const cur = next[k], forced = take.includes(k);
    if (isList(k)) {
      const add = e.value.filter((x) => !(cur || []).includes(x));
      if (!add.length) continue;
      if (!reliable(e) && !forced) { notApplied.push({ id: k, value: add, evidence: e.evidence, confidence: e.confidence, why: e.found ? (e.note || "low_confidence") : "quote_not_found" }); continue; }
      next[k] = [...(cur || []), ...add];
      next._meta[k] = metaFor(run, e, at);
      filled.push({ id: k, value: add, added: !empty(cur) });
      continue;
    }
    if (!empty(cur) && (same(cur, e.value) || norm(cur) === norm(e.value))) continue;    // already there
    if (!reliable(e) && !forced) { notApplied.push({ id: k, value: e.value, evidence: e.evidence, confidence: e.confidence, why: e.found ? (e.note || "low_confidence") : "quote_not_found" }); continue; }
    if (!empty(cur) && !forced) { conflicts.push({ id: k, current: cur, proposed: e.value, evidence: e.evidence, confidence: e.confidence, currentSource: (next._meta[k] || {}).source || "manual" }); continue; }
    next[k] = e.value;
    next._meta[k] = metaFor(run, e, at);
    filled.push({ id: k, value: e.value, replaced: !empty(cur) ? cur : undefined });
  }
  if (!Object.keys(next._meta).length) delete next._meta;
  return { profile: next, filled, conflicts, notApplied };
}
