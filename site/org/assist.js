// Profile assistant: shared by the browser (org/app.js) and the API (src/org/assistant.js).
// For each empty free-text field of the organisation profile there is one predefined question. The assistant answers it
// from the organisation's own sources (a statute or another document read in this browser, the organisation's website)
// and the answer can be written into the profile with one click.
// Documents can be long (a statute is often 30,000 to 80,000 characters); the browser sends only the passages that
// concern the question, chosen here by keywords in Serbian (Latin and Cyrillic) and English.

import { estTokens, foldText } from "./lang.js";

// Profile fields the assistant can write, with the question shown for each and the words that mark relevant passages
// (folded: lowercase, Cyrillic transliterated, no diacritics, "dj" for "đ").
export const ASSIST_FIELDS = {
  description: {
    en: "Who are we and what does our organisation do?", sr: "Ko smo i čime se naša organizacija bavi?",
    words: ["naziv", "osnovan", "osnivanj", "delatnost", "delovanj", "oblast", "udruzenje je", "organizacija je", "status", "sediste", "name", "founded", "established", "activit", "about us", "o nama", "who we are"],
  },
  mission: {
    en: "What are our mission and vision?", sr: "Koja je misija i vizija naše organizacije?",
    words: ["misij", "vizij", "svrh", "cilj", "ciljevi", "zalaz", "vrednost", "mission", "vision", "purpose", "values", "aim", "goal"],
  },
  objectives: {
    en: "What are our main objectives?", sr: "Koji su glavni ciljevi naše organizacije?",
    words: ["cilj", "ciljevi", "zadac", "ostvarivanj", "u cilju", "radi ostvarivanja", "objective", "goal", "aim", "task"],
  },
  previousProjects: {
    en: "What projects and experience do we have?", sr: "Koje projekte i iskustvo imamo?",
    words: ["projek", "realizova", "sproved", "program", "iskustv", "aktivnost", "radionic", "obuk", "project", "implemented", "experience", "activit", "workshop", "training"],
  },
  fundingDetails: {
    en: "Which EU and Erasmus+ projects have we carried out?", sr: "Koje smo EU i Erasmus+ projekte realizovali?",
    words: ["erasmus", "evropsk", "eu ", "horizon", "interreg", "ipa", "grant", "donator", "finansir", "partner", "koordinator", "european", "funded", "coordinator"],
  },
  partnerships: {
    en: "Which partnerships and networks are we part of?", sr: "U kojim partnerstvima i mrežama učestvujemo?",
    words: ["partner", "mrez", "saradnj", "savez", "clan", "udruzivanj", "network", "cooperat", "member", "alliance", "federation"],
  },
  infrastructure: {
    en: "What infrastructure and resources do we have?", sr: "Kojom infrastrukturom i resursima raspolažemo?",
    words: ["prostor", "imovin", "opreme", "oprema", "sredstva", "prostorij", "kancelarij", "resurs", "premises", "equipment", "facilit", "resource", "office"],
  },
  capacity: {
    en: "What is our financial and administrative capacity?", sr: "Kakav je naš finansijski i administrativni kapacitet?",
    words: ["prihod", "finansir", "sredstva", "budzet", "racun", "zaposlen", "organ", "skupstin", "upravni odbor", "predsednik", "zastup", "income", "budget", "staff", "board", "governance", "account"],
  },
  expertise: {
    en: "What expertise and competencies do we have?", sr: "Koje stručnosti i kompetencije imamo?",
    words: ["strucn", "kompeten", "znanj", "iskustv", "oblast", "obrazovanj", "edukacij", "struc", "expert", "competen", "skill", "knowledge", "specialis"],
  },
};
export const ASSIST_ORDER = ["description", "mission", "objectives", "expertise", "previousProjects", "fundingDetails", "partnerships", "capacity", "infrastructure"];

const empty = (v) => v === undefined || v === null || (typeof v === "string" && !v.trim()) || (Array.isArray(v) && !v.length);
// The fields the assistant offers to write: empty ones first, in a fixed order.
export function assistFields(profile) {
  return ASSIST_ORDER.filter((f) => empty((profile || {})[f]));
}

// Paragraphs of a document: blank lines, numbered articles ("Član 5", "Article 5") and headings start a new one.
export function paragraphs(text) {
  return String(text || "")
    .replace(/\r/g, "")
    .split(/\n\s*\n|\n(?=\s*(?:član|clan|члан|article|čl\.|чл\.)\s*\d)/i)
    .map((p) => p.replace(/[ \t]+/g, " ").trim())
    .filter((p) => p.length >= 30);
}

// Passages for one field (or a free question), most relevant first, within a token budget. Each passage keeps the name
// of its source. Passages are returned in document order so that articles read in sequence.
export function pickPassages(docs, { field = null, question = "", budget = 3600 } = {}) {
  const words = new Set([...(field && ASSIST_FIELDS[field] ? ASSIST_FIELDS[field].words : []),
    ...foldText(question).split(/[^a-z0-9]+/).filter((w) => w.length >= 4).map((w) => w.slice(0, Math.max(4, w.length - 2)))]);
  const all = [];
  (docs || []).forEach((d, di) => paragraphs(d.text).forEach((p, pi) => {
    const f = " " + foldText(p) + " ";
    let score = 0;
    for (const w of words) { const n = f.split(w).length - 1; if (n) score += 1 + Math.min(3, n - 1) * 0.5; }
    if (pi < 3) score += 0.5;   // the opening of a document usually names the organisation and its purpose
    all.push({ di, pi, source: d.name, text: p, score });
  }));
  const ranked = all.filter((x) => x.score > 0).sort((a, b) => b.score - a.score || a.di - b.di || a.pi - b.pi);
  const out = []; let used = 0;
  for (const x of ranked) {
    const t = x.text.length > 2400 ? x.text.slice(0, 2400) : x.text;
    const cost = estTokens(t) + 8;
    if (used + cost > budget) { if (used > budget * 0.8) break; continue; }
    out.push({ ...x, text: t }); used += cost;
  }
  return out.sort((a, b) => a.di - b.di || a.pi - b.pi).map(({ source, text }) => ({ source, text }));
}
