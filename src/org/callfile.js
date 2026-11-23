// One call's data from its own small file, site/org/call/<call id>.json (ingest/call_files.py): the call's record from the
// index, the country list its eligibility codes refer to, its award criteria, its application form and its official
// eligibility entry. The free plan stops a request after 10 ms of CPU; parsing the full index (1.2 MB) took about 50 ms on
// a fresh server instance, and the criteria and forms files about 25 ms each. A call file is a few kilobytes.
//
// The returned objects have the shapes of the full files (index, criteria.json, forms.json, eligibility.json) cut to this
// call, so callBlock, rubricFor and templateFor work on them unchanged. Before the refresh has written the call files
// (no site/org/call/_ready.json), the full files are read as before.

import { loadIndex } from "./ideas.js";
import { loadCriteria } from "./evaluate.js";
import { loadForms } from "./proposal.js";

export const callFileName = (id) => String(id).replace(/[^A-Za-z0-9._-]/g, "_") + ".json";

const CACHE = new Map(), MAX = 64;
let READY = null;
export function _resetCallFiles() { CACHE.clear(); READY = null; }

// Pages answers a missing file with the site's index.html (status 200), so anything that is not JSON counts as missing.
async function asset(env, url, path) {
  try {
    const r = await env.ASSETS.fetch(new URL(path, url));
    if (!r.ok) return null;
    const t = await r.text();
    return t[0] === "{" ? JSON.parse(t) : null;
  } catch { return null; }
}

function miniIndex(f) {
  const index = { countries: f.countries || [], countryNames: f.countryNames || {}, calls: f.call ? [f.call] : [] };
  index._cidx = Object.fromEntries(index.countries.map((c, i) => [c, i]));
  index._byId = new Map(index.calls.map((c) => [c.id, c]));
  return index;
}

async function fromFile(env, url, id) {
  if (CACHE.has(id)) return CACHE.get(id);
  const f = await asset(env, url, "/org/call/" + callFileName(id));
  if (!f) return null;
  const d = { c: f.call || null, index: miniIndex(f), crit: f.crit || { calls: {}, frameworks: {} }, forms: f.forms || { calls: {}, forms: {} }, elig: f.elig || { calls: {} } };
  if (CACHE.size >= MAX) CACHE.delete(CACHE.keys().next().value);
  CACHE.set(id, d);
  return d;
}

const NONE = { calls: {} };
// need: { crit, forms, elig } — which of the full files the fallback reads (the call file always has all of them).
export async function callData(env, url, id, need = {}) {
  const d = await fromFile(env, url, id);
  if (d) return d;
  if (READY === null) READY = !!(await asset(env, url, "/org/call/_ready.json"));
  // The call files exist and this call has none: it is not in the published data.
  if (READY) return { c: null, index: miniIndex({}), crit: { calls: {}, frameworks: {} }, forms: { calls: {}, forms: {} }, elig: NONE };
  const [index, crit, forms] = await Promise.all([
    loadIndex(env, url).catch(() => null),
    need.crit ? loadCriteria(env, url).catch(() => null) : null,
    need.forms ? loadForms(env, url) : null,
  ]);
  let elig = NONE;
  if (need.elig) { try { const r = await env.ASSETS.fetch(new URL("/org/eligibility.json", url)); if (r.ok) elig = await r.json(); } catch { /* no data */ } }
  return { c: index ? index._byId.get(id) || null : null, index: index || miniIndex({}), crit: crit || { calls: {}, frameworks: {} }, forms: forms || { calls: {}, forms: {} }, elig };
}
