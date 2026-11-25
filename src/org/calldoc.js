// The official text of a call beyond its listing: the content sections of its call document, or the full topic
// description on the Portal (ingest/call_content.py, kept in the call's own data file, src/org/callfile.js).
// The project generator, the application writer and the evaluation give the model the parts that matter for the
// request at hand, within a character budget.

const WORD = /[a-z][a-z-]{3,}/g;
const STOP = new Set("this that with from which their they will have been also into such these those within should would could must shall other more than each where when about after before between under over only both well most many some what your there were being does upon very".split(" "));
const words = (s) => new Set((String(s).toLowerCase().match(WORD) || []).filter((w) => !STOP.has(w)).map((w) => w.slice(0, 7)));

// doc: { kind, title, version, published, url, sections: [{ h, t, kind }] } or null.
export const hasDoc = (doc) => !!(doc && Array.isArray(doc.sections) && doc.sections.some((s) => s.t));

// A short label for the source, as the model and the page show it.
export function docLabel(doc) {
  if (!hasDoc(doc)) return "";
  return doc.kind === "document" ? `${doc.title || "Call document"}${doc.published ? ", " + doc.published : ""}` : doc.title || "Topic description";
}

const paras = (s) => String(s.t).split("\n").map((t) => t.trim()).filter(Boolean).map((t) => ({ h: s.h, kind: s.kind, t }));

// Up to n characters of the official text. The start of the objectives (or of the topic description) always comes
// first; the rest is the paragraphs that share most words with focus, kept in document order, each under its heading.
export function docExcerpt(doc, n, focus = "") {
  if (!hasDoc(doc) || n < 80) return "";
  const all = doc.sections.flatMap(paras);
  const lead = all.filter((p) => p.kind === "objectives" || p.kind === "topic");
  const picked = new Set(), heads = new Set();
  let size = 0;
  // A passage counts with its heading line when it is the first one taken under that heading.
  const cost = (p) => p.t.length + 1 + (heads.has(p.h) ? 0 : p.h.length + 3);
  const take = (p) => { if (picked.has(p) || size + cost(p) > n) return false; size += cost(p); picked.add(p); heads.add(p.h); return true; };
  for (const p of lead) { if (size + cost(p) > n * 0.4) break; take(p); }
  const f = words(focus);
  const scored = all.filter((p) => !picked.has(p)).map((p, i) => {
    const w = words(p.t);
    let hit = 0; for (const x of w) if (f.has(x)) hit++;
    const base = p.kind === "objectives" || p.kind === "topic" ? 1 : p.kind === "budget" || p.kind === "legal" ? 0.6 : 0.3;
    return { p, s: (f.size ? hit / Math.sqrt(w.size + 4) : 0) + base * 0.4 - i * 1e-4 };
  }).sort((a, b) => b.s - a.s);
  for (const { p } of scored) { if (size >= n - 40) break; take(p); }
  if (!picked.size) { const p = all[0]; return p ? p.t.slice(0, n - 1) + "…" : ""; }
  const out = [];
  let h = null;
  for (const p of all) {
    if (!picked.has(p)) continue;
    if (p.h !== h) { out.push(`[${p.h}]`); h = p.h; }
    out.push(p.t);
  }
  return out.join("\n").slice(0, n);
}

// The call text for a model: the listing's excerpt, then the official text, within n characters together.
// x: the listing's text excerpt (may be empty, as for calls whose topic page only points to the call document).
export function withDoc(x, doc, n, focus = "") {
  const clipX = (s, m) => (s.length > m ? s.slice(0, m - 1) + "…" : s);
  x = String(x || "").trim();
  if (!hasDoc(doc)) return clipX(x, n);
  const lx = Math.min(x.length, Math.round(n * (x.length > 600 ? 0.3 : 0.15)));
  const head = lx ? clipX(x, lx) + "\n" : "";
  const body = docExcerpt(doc, n - head.length - 80, focus);
  return body ? `${head}From the official ${doc.kind === "document" ? "call document" : "topic description"} (${docLabel(doc)}):\n${body}` : clipX(x, n);
}
