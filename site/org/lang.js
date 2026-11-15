// Language helpers shared by the browser (site/org/rules.js, the profile page) and the API (src/org/translate.js).
// Deterministic: no model call. Serbian is written in Latin or Cyrillic script; both fold to plain Latin letters.

// Serbian Cyrillic to Latin, already folded the way norm() folds Latin diacritics (č ć -> c, š -> s, ž -> z, đ -> dj).
const CYR = { "а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "ђ": "dj", "е": "e", "ж": "z", "з": "z", "и": "i", "ј": "j", "к": "k", "л": "l", "љ": "lj", "м": "m",
  "н": "n", "њ": "nj", "о": "o", "п": "p", "р": "r", "с": "s", "т": "t", "ћ": "c", "у": "u", "ф": "f", "х": "h", "ц": "c", "ч": "c", "џ": "dz", "ш": "s" };
const CYR_RE = /[а-шђјљњћџ]/g;

// Lowercase, Cyrillic transliterated, diacritics removed, đ -> dj. Used on profile and call text alike.
export function foldText(s) {
  return String(s || "").toLowerCase().replace(CYR_RE, (ch) => CYR[ch] || ch).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "dj");
}

// Function words that are frequent in one language and rare in the other.
const SR_WORDS = new Set("i u na za sa se je su da od do iz kao koji koja koje kojih ili kroz kod prema nije smo ste bi biti ovo ova ovaj njihov naš naša naše nas svoje svojih takođe takodje kako".split(" "));
const EN_WORDS = new Set("the and of to in for with is are on by from that this our we their as an be at which who".split(" "));

// Language of a free text: "sr" (Serbian, either script), "en", "other" (a longer text with no English function words)
// or "unknown" (too short to tell). Cyrillic letters or Serbian diacritics decide at once.
export function detectLang(text) {
  const s = String(text || "");
  const letters = (s.match(/\p{L}/gu) || []).length;
  if (!letters) return { lang: "unknown", script: null };
  const cyr = (s.match(/[Ѐ-ӿ]/g) || []).length;
  if (cyr / letters > 0.3) return { lang: "sr", script: "cyrl" };
  const dia = (s.match(/[čćšžđČĆŠŽĐ]/g) || []).length;
  const words = s.toLowerCase().split(/[^\p{L}]+/u).filter(Boolean);
  let sr = 0, en = 0;
  for (const w of words) { if (SR_WORDS.has(w)) sr++; if (EN_WORDS.has(w)) en++; }
  if (dia >= 2 || (dia >= 1 && sr >= 1) || (sr >= 2 && sr > en)) return { lang: "sr", script: "latn" };
  if (en >= 2 || (en >= 1 && words.length <= 8)) return { lang: "en", script: "latn" };
  if (words.length >= 6) return { lang: "other", script: null };
  return { lang: "unknown", script: null };
}

// The free-text profile fields used for the thematic match, and the ones that get an English copy.
export const TEXT_FIELDS = ["description", "mission", "objectives", "expertise"];

// Rough token count of a text, for budget and size checks before a request is sent. Letters outside ASCII
// (Cyrillic, diacritics) cost far more tokens per character than English: measured with the o200k tokenizer on
// 15 Nov 2026, an OCR'd Serbian Cyrillic statute had 2.6 characters per token and English call texts 5.6. The
// divisors 2.2 and 3.6 keep the estimate above the real count for Cyrillic and for English.
export function estTokens(s) {
  const t = String(s ?? "");
  let wide = 0;
  for (let i = 0; i < t.length; i++) if (t.charCodeAt(i) > 127) wide++;
  return Math.ceil((t.length - wide) / 3.6 + wide / 2.2);
}

// Short fingerprint of a source text, to tell whether an English copy was made from the current text.
// FNV-1a over UTF-16 code units, hex; the same in the browser and in Workers.
export function textHash(s) {
  let h = 0x811c9dc5;
  const t = String(s || "");
  for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, "0") + ":" + t.length;
}
