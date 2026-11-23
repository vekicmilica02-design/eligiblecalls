// English for search words the Serbian to English glossary does not know (POST /api/query-en). The home page's keyword
// search asks for the words of a query that found few calls (site/org/query.js unknownWords); the answer becomes
// one more alternative for each word.
//
// Each word's translation is kept for every visitor in the table ai_cache (organisation "_search", key "w:<word>",
// AI_CACHE_DAYS days, default 30), so a word is translated once. A visitor may have SEARCH_TRANSLATIONS_PER_DAY
// requests that reach the model (default 30); words already kept are always answered. The model call uses the
// site's provider budgets but no user's AI actions (src/org/ai.js complete with charge: false).

import { complete, parseJsonObject } from "./org/ai.js";
import { utcDay, visitorHash, visitorHit } from "./budget.js";

const ORG = "_search", MAX_WORDS = 8;
const num = (v, d) => (v !== undefined && v !== "" && !isNaN(+v) ? +v : d);
const json = (b, status = 200) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });

// Folded word (site/org/query.js queryWords) and the word as typed, for the model.
function cleanWords(body) {
  const out = new Map();
  for (const x of Array.isArray(body && body.words) ? body.words : []) {
    const w = String((x && x.w) || "").toLowerCase();
    if (!/^[a-z][a-z-]{2,39}$/.test(w) || out.has(w)) continue;
    out.set(w, String((x && x.s) || w).slice(0, 40));
    if (out.size >= MAX_WORDS) break;
  }
  return out;
}

export function queryMessages(words) {
  return [
    { role: "system", content: [
      "You translate single search words, mostly Serbian (Latin or Cyrillic script, sometimes typed without diacritics), into English keywords for searching a list of EU and international funding calls written in English.",
      "For each word give one to three English keywords as they would appear in a call text, separated by commas (for example: vodama -> water; pcelarstvo -> beekeeping, apiculture; nasledje -> heritage).",
      "Give a noun or adjective stem that matches many forms. A word that is already English, or a name or acronym, is returned as it is. A word you do not recognise gets an empty string.",
      "Answer with JSON only: {\"words\": {\"<word>\": \"<keywords>\"}}, one entry for every word given, keys exactly as given.",
    ].join("\n") },
    { role: "user", content: JSON.stringify([...words.entries()].map(([w, s]) => (s.toLowerCase() === w ? w : `${w} (typed: ${s})`))) },
  ];
}

// Keywords from the model: lowercase letters, spaces and hyphens, at most three, each at most 40 characters.
export function cleanKeywords(v) {
  return String(v || "").toLowerCase().split(/\s*[,;|/]\s*/).map((x) => x.replace(/[^a-z -]+/g, "").replace(/\s+/g, " ").trim())
    .filter((x) => x.length > 2 && x.length <= 40).slice(0, 3).join(", ");
}

export async function handleQueryEn({ request, env, now = Date.now(), fetchImpl = fetch, waitUntil = (p) => p }) {
  let body; try { body = await request.json(); } catch { return json({ error: "bad_request" }, 400); }
  const words = cleanWords(body);
  if (!words.size) return json({ en: {} });
  const db = env.DB || null, days = Math.max(1, num(env.AI_CACHE_DAYS, 30)), en = {};
  if (db) {
    try {
      const keys = [...words.keys()].map((w) => "w:" + w);
      const { results } = await db.prepare(`SELECT key, text FROM ai_cache WHERE org_id = ? AND created_at > ? AND key IN (${keys.map(() => "?").join(",")})`)
        .bind(ORG, now - days * 864e5, ...keys).all();
      for (const r of results || []) en[r.key.slice(2)] = r.text;
    } catch { /* no table: nothing kept */ }
  }
  const missing = new Map([...words].filter(([w]) => !(w in en)));
  if (!missing.size || env.CHAT_ENABLED === "false") return json({ en: pick(en) });
  // One visitor's daily requests that reach the model (salted hash of IP and day; the IP is not stored).
  const day = utcDay(now);
  const vhash = await visitorHash((request.headers.get("cf-connecting-ip") || "") + "|search", day, env.HASH_SALT || "eligiblecalls");
  if ((await visitorHit(db, day, vhash)) > num(env.SEARCH_TRANSLATIONS_PER_DAY, 30)) return json({ en: pick(en), limited: true });
  let answer;
  try {
    const r = await complete({ env, userId: null, messages: queryMessages(missing), agent: "query", maxOut: 400, now, fetchImpl, waitUntil, prefer: "fast", charge: false });
    answer = parseJsonObject(r.text);
  } catch { return json({ en: pick(en), unavailable: true }); }
  const got = (answer && typeof answer.words === "object" && answer.words) || {};
  const rows = [];
  for (const w of missing.keys()) {
    const k = cleanKeywords(got[w]);
    en[w] = k;   // an empty answer is kept too: the word is not asked about again
    rows.push(["w:" + w, k]);
  }
  if (db && rows.length) {
    waitUntil(db.batch(rows.map(([key, text]) => db.prepare("INSERT INTO ai_cache (org_id, key, agent, text, model, created_at) VALUES (?, ?, 'query', ?, NULL, ?) " +
      "ON CONFLICT(org_id, key) DO UPDATE SET text = excluded.text, created_at = excluded.created_at").bind(ORG, key, text, now))).catch(() => {}));
  }
  return json({ en: pick(en) });
}
const pick = (en) => Object.fromEntries(Object.entries(en).filter(([, v]) => v));
