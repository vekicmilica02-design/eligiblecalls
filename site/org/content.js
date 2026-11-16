// Text written by the AI for a project idea and its evaluations, as flat {key: text | [texts]} objects, so that one
// translation request can carry all of it and the page can lay a stored translation over the original.
// Shared by the server (src/org/ideas.js, src/org/evaluate.js) and the page (site/org/app.js).

export const IDEA_TEXT = ["title", "concept", "problem", "solution", "objectives", "targetGroups", "activities", "expectedResults", "potentialPartners",
  "whyItFits", "methodology", "workPlan", "impactPathway", "dissemination", "management"];
const EX_TEXT = ["summary", "strengths", "weaknesses", "improve"];
const EV_C_TEXT = ["justification", "strengths", "weaknesses", "missing", "recommendations"];

const has = (v) => (Array.isArray(v) ? v.length > 0 : typeof v === "string" && v.trim() !== "");

export function ideaTexts(idea) {
  const out = {};
  for (const k of IDEA_TEXT) if (has(idea && idea[k])) out[k] = idea[k];
  const fit = (idea && idea.fit) || {};
  if (has(fit.reasons)) out["fit.reasons"] = fit.reasons;
  const ex = fit.explanation || {};
  for (const k of EX_TEXT) if (has(ex[k])) out["ex." + k] = ex[k];
  return out;
}

export function applyIdeaTexts(idea, t) {
  if (!idea || !t) return idea;
  const out = { ...idea };
  for (const k of IDEA_TEXT) if (t[k] !== undefined) out[k] = t[k];
  if (idea.fit) {
    out.fit = { ...idea.fit };
    if (t["fit.reasons"] !== undefined) out.fit.reasons = t["fit.reasons"];
    if (idea.fit.explanation) {
      out.fit.explanation = { ...idea.fit.explanation };
      for (const k of EX_TEXT) if (t["ex." + k] !== undefined) out.fit.explanation[k] = t["ex." + k];
    }
  }
  return out;
}

export function evalTexts(ev) {
  const out = {};
  if (has(ev && ev.summary)) out.summary = ev.summary;
  if (has(ev && ev.priorityActions)) out.priorityActions = ev.priorityActions;
  ((ev && ev.criteria) || []).forEach((c, i) => { for (const k of EV_C_TEXT) if (has(c[k])) out[`c${i}.${k}`] = c[k]; });
  return out;
}

export function applyEvalTexts(ev, t) {
  if (!ev || !t) return ev;
  const out = { ...ev };
  if (t.summary !== undefined) out.summary = t.summary;
  if (t.priorityActions !== undefined) out.priorityActions = t.priorityActions;
  out.criteria = (ev.criteria || []).map((c, i) => {
    const n = { ...c };
    for (const k of EV_C_TEXT) if (t[`c${i}.${k}`] !== undefined) n[k] = t[`c${i}.${k}`];
    return n;
  });
  return out;
}

// What the reader sees in language `lang`: the original when it was written in that language, otherwise the stored
// translation when there is one (null when there is none yet).
export const ideaIn = (x, lang) => (x.lang === lang ? x.idea : x.idea && x.idea.tr && x.idea.tr[lang] ? applyIdeaTexts(x.idea, x.idea.tr[lang]) : null);
export const evalIn = (ev, lang) => (!ev || (ev.lang || "en") === lang ? ev : ev.tr && ev.tr[lang] ? applyEvalTexts(ev, ev.tr[lang]) : null);
