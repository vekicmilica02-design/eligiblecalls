// Search words in Serbian meet the calls' English text. Used by the keyword search on the home page (site/index.html)
// and by the chat's call ranking (src/core.js).
//
// A query is cut into groups of words. A group is found in a call's text when all its own words are there, or when
// one of its English alternatives is. Alternatives come from the Serbian to English glossary
// (site/org/glossary-sr-en.json) and, for words the glossary does not know, from a model translation that the server
// keeps for every visitor (src/queryen.js). Alternatives only add matches: an English query finds what it found before.

import { foldText } from "./lang.js";

const MAX_ENDING = 6;
const STOP = new Set("i u na za sa se je su da od do po iz kao koji koja koje ili ali to the and for with of in on".split(" "));

// Glossary entries indexed by the first three letters of their first word (format: see "about" in the glossary file).
export function parseGlossary(g) {
  const idx = new Map();
  for (const e of (g && g.terms) || []) {
    const words = String(e.sr || "").trim().split(/\s+/).filter(Boolean);
    if (!words.length || !e.en) continue;
    const entry = {
      words: words.map((w) => w.split("|").map((a) => (a.endsWith("*") ? { pre: a.slice(0, -1) } : { eq: a }))),
      alts: searchAlternatives(e, words.length),
      show: String(e.show || e.en).trim().toLowerCase(),   // shown under the results
      not: e.not || [],
    };
    for (const k of new Set(words[0].split("|").map((a) => a.replace(/\*$/, "").slice(0, 3)))) {
      if (!idx.has(k)) idx.set(k, []);
      idx.get(k).push(entry);
    }
  }
  return idx;
}

// The English text a call must contain for the entry to count. "q" lists them (alternatives separated by |); without
// it, a one-word Serbian entry offers each of its English words, and a longer entry its English phrase.
function searchAlternatives(e, n) {
  if (e.q) return String(e.q).split("|").map((x) => x.trim().toLowerCase()).filter(Boolean);
  const en = String(e.en).trim().toLowerCase();
  return n === 1 ? en.split(/\s+/).filter((w) => w.length > 2) : [en];
}

const wordMatch = (w, p, not) => (p.eq !== undefined ? w === p.eq : w.startsWith(p.pre) && w.length - p.pre.length <= MAX_ENDING && !not.some((x) => w.startsWith(x)));

// The query's words, as the page folds them (plain, for the call text) and as the glossary is written (folded).
// Function words and words of one or two letters stay in the list (a glossary phrase can contain them, as in
// "mala i srednja preduzeca") but never make a group of their own.
export function queryWords(q, plain = (s) => foldText(s)) {
  return String(q || "").split(/\s+/).filter(Boolean)
    .map((w) => ({ plain: plain(w).replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ""), folded: foldText(w).replace(/[^a-z0-9-]+/g, "") }))
    .filter((w) => w.plain)
    .map((w) => ({ ...w, minor: STOP.has(w.folded) || (w.folded.length <= 2 && !/\d/.test(w.folded)) }));
}

// Groups for a query. extra: model translations, { folded word: "english words" }.
export function queryGroups(q, idx, { extra = null, plain } = {}) {
  const words = queryWords(q, plain);
  const groups = [], used = new Set();
  if (idx) {
    for (let i = 0; i < words.length; i++) {
      for (const e of idx.get(words[i].folded.slice(0, 3)) || []) {
        if (e.words.length < 2 || i + e.words.length > words.length) continue;
        let ok = true;
        for (let j = 0; j < e.words.length && ok; j++) ok = !used.has(i + j) && e.words[j].some((p) => wordMatch(words[i + j].folded, p, e.not));
        if (!ok) continue;
        const g = { words: words.slice(i, i + e.words.length).map((w) => w.plain), alts: [...e.alts], show: [e.show] };
        for (let j = 0; j < e.words.length; j++) used.add(i + j);
        groups.push(g);
      }
    }
  }
  words.forEach((w, i) => {
    if (used.has(i) || w.minor) return;
    const alts = new Set(), show = new Set();
    if (idx) for (const e of idx.get(w.folded.slice(0, 3)) || []) if (e.words.length === 1 && e.words[0].some((p) => wordMatch(w.folded, p, e.not))) { e.alts.forEach((a) => alts.add(a)); show.add(e.show); }
    if (extra && extra[w.folded]) for (const a of String(extra[w.folded]).toLowerCase().split(/\s*[,;|]\s*/)) if (a.trim().length > 2) { alts.add(a.trim()); show.add(a.trim()); }
    groups.push({ words: [w.plain], alts: [...alts], show: [...show], folded: w.folded });
  });
  return groups;
}

// True when every group is found in the text (already folded the way the groups' plain words were). The words as typed
// are found anywhere in the text, as before. An alternative is found when each of its words begins a word of the text
// ("city" is not found in "capacity", "manag" is found in "management").
const LETTER = /[\p{L}\p{N}]/u;
function startsWord(hay, w) {
  for (let i = hay.indexOf(w); i >= 0; i = hay.indexOf(w, i + 1)) if (i === 0 || !LETTER.test(hay[i - 1])) return true;
  return false;
}
const has = (hay, a) => a.split(" ").every((w) => startsWord(hay, w));
export const matchGroups = (hay, groups) => groups.every((g) => g.words.every((w) => hay.includes(w)) || g.alts.some((a) => has(hay, a)));

// The English words that were searched as well, for a line under the results ("also searched: education, youth").
export const groupAlternatives = (groups) => [...new Set(groups.flatMap((g) => g.show || g.alts))];

// Words worth asking the model about: no glossary alternative and found in fewer than `few` calls.
export function unknownWords(groups, hays, few = 3) {
  return groups.filter((g) => g.folded && !g.alts.length && /^[a-z][a-z-]{2,39}$/.test(g.folded) && hays.filter((h) => h.includes(g.words[0])).length < few).map((g) => g.folded);
}

// For ranking (src/core.js): the query with the English alternatives appended.
export function expandQuery(q, idx) {
  const alts = groupAlternatives(queryGroups(q, idx));
  return alts.length ? q + " " + alts.join(" ") : q;
}
