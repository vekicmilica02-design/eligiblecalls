// Scoring rubric of one call, built from the call's own evaluation documentation:
//   - Horizon Europe calls: General Annex D of the Work Programme (site/org/criteria.json, "framework" entries)
//   - calls with a call document: its award criteria section and, when present, its table of maximum and minimum scores
//   - calls whose funder page describes the assessment (UKRI): that page's text
//   - Erasmus+ actions managed by the national agencies (KA210, KA220): the Erasmus+ Programme Guide (erasmus-2026.json)
// Pure functions, shared by the browser (to show which criteria an evaluation will use) and the API (which decides).
// A rubric with criteria: null is "text mode": the documentation names criteria in prose only; the model must quote
// each criterion it uses from that text, and scores stay on an indicative 0-5 scale without thresholds.

const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[‘’'"“”]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const clip = (s, n) => { s = String(s ?? "").replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n - 1) + "…" : s; };
const num = (v) => { const m = String(v ?? "").replace(",", ".").match(/^\s*(\d+(?:\.\d+)?)\s*$/); return m ? +m[1] : null; };
const POINTS = /\(\s*(?:max(?:imum)?\.?\s*)?(\d{1,3}(?:\.\d)?)\s*points?\s*\)/i;

const ERASMUS_NA = /^ERASMUS-NA-\d{4}-(KA210|KA220)-/;
export const erasmusAction = (callId) => { const m = String(callId || "").match(ERASMUS_NA); return m ? m[1] : null; };

// Words of a document block that describe the criterion, without its own name and points.
function aspectText(text, name) {
  let t = String(text || "");
  const i = t.indexOf(":");
  if (i > 0 && i < 90 && norm(t.slice(0, i)).startsWith(norm(name).slice(0, 12))) t = t.slice(i + 1);
  else if (norm(t).startsWith(norm(name))) t = t.slice(name.length);
  return clip(t.replace(POINTS, "").replace(/^[\s:–-]+/, ""), 400);
}

// The block that introduces a criterion and the blocks after it, up to the next criterion of the call.
function sectionOf(blocks, name, names) {
  const keys = [name, ...String(name).split(/\s+[—–-]\s+/).slice(1)].map(norm).filter((k) => k.length > 2);
  const starts = (b, k) => { const n = norm(b.text); return n === k || n.startsWith(k + " ") || n.startsWith(k); };
  let i = -1;
  for (const k of keys) { i = blocks.findIndex((b) => starts(b, k)); if (i >= 0) break; }
  if (i < 0) return null;
  const others = (names || []).filter((x) => x !== name).flatMap((x) => [x, ...String(x).split(/\s+[—–-]\s+/).slice(1)]).map(norm).filter((k) => k.length > 2 && !keys.some((m) => m.startsWith(k)));
  const out = [];
  const own = aspectText(blocks[i].text, name);
  if (own) out.push(own);
  for (let j = i + 1; j < blocks.length && out.length < 12; j++) {
    const t = blocks[j].text.trim();
    if (others.some((k) => starts(blocks[j], k)) || /^proposals? that pass|^individual threshold|^the award criteria/i.test(t)) break;
    if (POINTS.test(t) && t.replace(POINTS, "").trim().length < 3) continue;
    out.push(clip(t, 300));
  }
  return out;
}

const fullText = (e) => [e.heading, ...(e.blocks || []).map((b) => b.text), ...(e.summary || [])].filter(Boolean).join("\n");

// Notes that are not criteria: introductions, footnotes, threshold and scale sentences.
const NOT_CRITERION = /^(the award criteria|award criteria|\*|proposals? that pass|individual threshold|overall threshold|each award criterion|there is no minimum|\d+\s*[—–-]\s)/i;

// A call document without a parsed score table: criteria are the blocks at the level of the first criterion.
function parseBlocks(e) {
  const blocks = (e.blocks || []).filter((b) => b.text && !NOT_CRITERION.test(b.text.trim()));
  if (!blocks.length) return null;
  const lv = blocks[0].level || 0;
  const heads = [];
  for (let i = 0; i < blocks.length; i++) {
    if ((blocks[i].level || 0) < lv) break;
    if ((blocks[i].level || 0) !== lv) continue;
    const t = blocks[i].text.trim(), colon = t.indexOf(":");
    const name = colon > 1 && colon < 70 ? t.slice(0, colon) : t.replace(POINTS, "").trim();
    if (name.length > 90) return null;
    const pm = t.match(POINTS);
    heads.push({ name: clip(name, 90), max: pm ? +pm[1] : null, at: i });
  }
  if (heads.length < 2 || heads.length > 8) return null;
  const all = fullText(e);
  let scale = null;
  const sm = all.match(/scored from 0 to (\d{1,2})/i);
  if (heads.some((h) => h.max === null)) { if (!sm) return null; scale = +sm[1]; }
  const half = /half[- ]points?/i.test(all);
  const criteria = heads.map((h, k) => {
    const next = k + 1 < heads.length ? heads[k + 1].at : blocks.length;
    const own = aspectText(blocks[h.at].text, h.name);
    const aspects = [own, ...blocks.slice(h.at + 1, next).map((b) => clip(b.text, 300))].filter(Boolean).slice(0, 12);
    return { name: h.name, max: h.max ?? scale, min: null, aspects };
  });
  // "Individual threshold for the criterion 'Relevance': 25/40 points."
  for (const m of all.matchAll(/individual thresholds? for the criteri(?:on|a)\s*[‘'"“]?([^’'"”:]{2,60})[’'"”]?\s*:\s*(\d+(?:\.\d+)?)\s*\/\s*(\d+)/gi)) {
    const c = criteria.find((x) => norm(x.name).startsWith(norm(m[1]).slice(0, 10)));
    if (c) c.min = +m[2];
  }
  const om = all.match(/overall threshold(?:\s+of|\s*:)?\s*(\d+(?:\.\d+)?)\s*(?:points|\/)/i);
  const max = criteria.reduce((s, c) => s + c.max, 0);
  for (const c of criteria) if (c.min !== null && !(c.min <= c.max)) c.min = null;
  return { criteria, threshold: om && +om[1] <= max ? +om[1] : null, half: half || criteria.every((c) => c.max <= 5) };
}

const withIds = (criteria) => criteria.map((c, i) => ({ id: "c" + (i + 1), ...c }));

// call: { id, programme } (the programme only labels the rubric). crit: criteria.json. guide: erasmus-2026.json (may be null).
export function rubricFor(call, crit, guide) {
  const id = call && call.id;
  if (!id) return null;
  const act = erasmusAction(id);
  if (act) {
    const a = guide && guide.actions.find((x) => x.id === act);
    if (!a) return null;
    return {
      key: a.id, kind: "erasmus", title: `Erasmus+ ${a.id} ${a.name.en}`, sourceTitle: `Erasmus+ Programme Guide ${guide.guideYear} (${guide.guideVersion})`, url: a.url,
      half: false, criteria: withIds(a.criteria.map((c) => ({ name: c.name, max: c.max, min: c.min, aspects: c.points || [] }))),
      total: { max: a.criteria.reduce((s, c) => s + c.max, 0), threshold: a.threshold.total },
      notes: a.threshold.perCriterion ? [a.threshold.perCriterion] : [],
    };
  }
  const e = crit && crit.calls ? crit.calls[id] : null;
  if (!e) return null;
  if (e.kind === "framework") {
    const fw = crit.frameworks[e.framework];
    const row = fw && fw.rows[e.row];
    if (!row) return null;
    const sc = fw.scale || { max: 5, threshold: 3, overall: 10, of: 15 };
    const two = !!e.twoStage;
    const crits = row.criteria.filter((c) => !two || c.aspects.some((a) => a.stage1));
    const notes = [...(two ? fw.twoStage : fw.scoring.slice(0, 2))];
    if (e.ia) notes.push(fw.scoring.find((s) => /weight of 1\.5/.test(s)) || "Impact has a weight of 1.5 for ranking innovation actions.");
    return {
      key: "HE-" + e.row + (two ? "-S1" : ""), kind: "horizon", title: `Horizon Europe · ${row.name}${two ? " · first stage" : ""}`,
      sourceTitle: fw.title || "Horizon Europe Work Programme, General Annex D", url: fw.url, half: true,
      criteria: withIds(crits.map((c) => ({ name: c.name, max: sc.max, min: two ? 4 : sc.threshold, aspects: c.aspects.filter((a) => !two || a.stage1).map((a) => a.text) }))),
      total: { max: sc.max * crits.length, threshold: two ? 8 : sc.overall }, notes,
    };
  }
  if (e.kind === "document") {
    const src = { sourceTitle: `Call document, ${e.heading || "award criteria"}`, url: e.url, docText: fullText(e).slice(0, 4000) };
    const t = e.table;
    if (t && t.rows && t.rows.length >= 2) {
      const criteria = t.rows.map((r) => ({ name: clip(r.name, 120), max: +r.max, min: num(r.min), aspects: sectionOf(e.blocks || [], r.name, t.rows.map((x) => x.name)) || [] }));
      for (const c of criteria) if (c.min !== null && !(c.min <= c.max)) c.min = null;
      const tmax = num(t.total && t.total.max) || criteria.reduce((s, c) => s + c.max, 0), tthr = num(t.total && t.total.min);
      if (criteria.every((c) => c.max > 0)) {
        const half = criteria.every((c) => c.max <= 5);
        return { key: "DOC", kind: "document", title: "Award criteria of the call", ...src, half, criteria: withIds(criteria),
          total: { max: tmax, threshold: tthr !== null && tthr <= tmax ? tthr : null }, notes: (e.summary || []).slice(0, 4) };
      }
    }
    const p = parseBlocks(e);
    if (p) return { key: "DOC", kind: "document", title: "Award criteria of the call", ...src, half: p.half, criteria: withIds(p.criteria),
      total: { max: p.criteria.reduce((s, c) => s + c.max, 0), threshold: p.threshold }, notes: (e.summary || []).slice(0, 4) };
    return textRubric(e, src);
  }
  if (e.kind === "page") return textRubric(e, { sourceTitle: `${e.source || "Funder"} page: ${e.heading || "assessment"}`, url: e.url });
  return null; // pointer: the criteria are only in documents that are not in the data
}

function textRubric(e, src) {
  const text = fullText(e);
  if (text.length < 200) return null;
  return { key: "TEXT", kind: "text", title: "Assessment described by the funder", ...src, docText: undefined, half: false, criteria: null,
    total: { max: null, threshold: null }, notes: [], sourceText: text.slice(0, 9000) };
}

// Where the criteria come from, for calls that have none in the data.
export const criteriaLink = (call, crit) => { const e = crit && crit.calls ? crit.calls[call.id] : null; return (e && e.url) || call.url || ""; };

export const _test = { norm, parseBlocks, sectionOf };
