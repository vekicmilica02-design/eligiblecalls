// Retrieval and prompt building for the chat assistant. Pure functions, no I/O.
// The index is site/data/index.json, written by ingest/build.py.

export const DL_TZ = "Europe/Brussels";
const DAY = 864e5;

// Brussels time without Intl (Intl time-zone formatting is slow on a cold Worker).
// EU rule (Directive 2000/84/EC): summer time from 01:00 UTC on the last Sunday of March
// to 01:00 UTC on the last Sunday of October. CET = UTC+1, CEST = UTC+2.
const lastSunday = (y, m) => { const d = new Date(Date.UTC(y, m + 1, 0)); return Date.UTC(y, m, d.getUTCDate() - d.getUTCDay(), 1); };
export function brusselsOffsetMin(utcMs) {
  const y = new Date(utcMs).getUTCFullYear();
  return utcMs >= lastSunday(y, 2) && utcMs < lastSunday(y, 9) ? 120 : 60;
}
const dlCache = new Map();
// Deadline strings (same forms as ingest/deadlines.py):
//   "2026-11-30"                        EU Portal grant topic: 17:00 Brussels time on that date
//   "2026-11-30T12:00|Europe/Belgrade"  time and zone stated by the organiser
//   "2026-11-30|~"                      only a date is stated: open until 23:59 Brussels time
// index.json carries precomputed instants (dm), so this is a fallback.
const FULL = /^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d)\|([A-Za-z_]+\/[A-Za-z_]+)$/;
function zoneOffsetMin(utcMs, tz) {
  const p = {}; new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(new Date(utcMs)).forEach((x) => (p[x.type] = x.value));
  return (Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute) - Math.floor(utcMs / 6e4) * 6e4) / 6e4;
}
export function deadlineMs(iso) {
  let v = dlCache.get(iso);
  if (v === undefined) {
    const f = FULL.exec(iso);
    if (f) {
      const local = Date.UTC(+f[1], +f[2] - 1, +f[3], +f[4], +f[5]);
      v = local - zoneOffsetMin(local, f[6]) * 6e4;
    } else {
      const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
      const [h, mi] = iso.endsWith("|~") ? [23, 59] : [17, 0];
      const local = Date.UTC(y, m - 1, d, h, mi);
      v = local - brusselsOffsetMin(local - 2 * 36e5) * 6e4;
    }
    dlCache.set(iso, v);
  }
  return v;
}
export function deadlineLabel(iso) {
  const f = FULL.exec(iso);
  if (f) return `${iso.slice(0, 10)} ${f[4]}:${f[5]} ${f[6]} time`;
  if (iso.endsWith("|~")) return `${iso.slice(0, 10)} (time not stated by the source)`;
  return `${iso} 17:00 Brussels time`;
}

const STOP = new Set(("the and for with that this from are our we you your have has was were will can not but all any its into about what which who how when where why their they them also more most than then there these those such only other some very just over under onto via per our ours i me my am is be been being do does did a an of to in on at by or as it if so no yes " +
  "i u na za sa se je su da od do po iz kao koji koja koje ili ali smo ste sam bi biti mi vi oni ona ono to taj ta te tu ovo ovaj ova kako sta šta gde kada zašto zasto koliko").split(/\s+/));

export function norm(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "dj");
}
export function terms(s) {
  return norm(s).split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !STOP.has(w)).map((w) => (w.length > 5 ? w.slice(0, w.length - 2) : w)); // crude stem
}

// Inverted index (term -> [call position, weight, ...]) comes precomputed from ingest/build.py.
export function prepare(index) {
  if (index._prepared) return index;
  if (!index.inv) {
    const inv = {};
    index.calls.forEach((c, i) => {
      const tf = {};
      const add = (text, w) => { for (const t of terms(text)) tf[t] = (tf[t] || 0) + w; };
      add(c.t, 3); add((c.k || []).join(" "), 2); add((c.s || []).join(" "), 2); add(c.x, 1); add(c.p, 1);
      for (const t in tf) (inv[t] = inv[t] || []).push(i, tf[t]);
    });
    index.inv = inv;
  }
  index._cidx = Object.fromEntries(index.countries.map((c, i) => [c, i]));
  // Country names in English and Serbian. A name ending in a vowel or y also matches inflected and
  // adjective forms: Srbija/Srbije/Srbiji, Serbia/Serbian, Hrvatska/Hrvatskoj, Germany/German.
  index._names = [];
  for (const [code, names] of Object.entries(index.countryNames || {})) for (const n of names) {
    if (!n) continue;
    const k = norm(n).replace(/[^a-z]+/g, " ").trim();
    const flex = k.split(" ").map((w) => (w.length >= 4 && /[aeiouy]$/.test(w) ? w.slice(0, -1) + "[aeioujnmsky]{0,3}" : w)).join(" ");
    index._names.push([new RegExp(" " + flex + " "), code, k.length]);
  }
  index._names.sort((a, b) => b[2] - a[2]);
  index._prepared = true;
  return index;
}

export function detectCountry(index, text) {
  const t = " " + norm(text).replace(/[^a-z]+/g, " ") + " ";
  for (const [re, code] of index._names) if (re.test(t)) return code;
  return null;
}

const dlInstant = (c, i) => (c.dm ? c.dm[i] : deadlineMs(c.dl[i]));
export function nextDeadline(c, now) { const dl = c.dl || []; for (let i = 0; i < dl.length; i++) if (dlInstant(c, i) > now) return dl[i]; return null; }
const ndMs = (c, nd) => dlInstant(c, c.dl.indexOf(nd));

export function eligibilityFor(index, c, cc) {
  const i = index._cidx[cc];
  if (i === undefined) return null;
  return { status: c.e[i], reason: c.rs[c.r[i]] || "" };
}

// Rank open calls for a query. Excludes calls closed by now and calls not open to the country.
export function rank(index, { query, country, sectors = [], applicants = [], now = Date.now(), limit = 8, mention = [] }) {
  prepare(index);
  const N = index.calls.length;
  const qc = new Map();
  for (const t of terms(query)) qc.set(t, (qc.get(t) || 0) + 1);
  const score = new Float64Array(N);
  for (const [t, n] of qc) {
    const post = index.inv[t];
    if (!post || !Object.prototype.hasOwnProperty.call(index.inv, t)) continue;
    const w = Math.log(1 + N / (post.length / 2)) * (1 + Math.log(n));
    for (let j = 0; j < post.length; j += 2) score[post[j]] += post[j + 1] * w;
  }
  const out = [];
  index.calls.forEach((c, i) => {
    let s = score[i];
    if (sectors.length && c.s.some((x) => sectors.includes(x))) s += 4;
    if (applicants.length && c.a.some((x) => applicants.includes(x))) s += 2;
    if (mention.includes(c.id)) s += 1000;
    if (s <= 0) return;
    const nd = nextDeadline(c, now);
    if (!nd) return;
    const el = country ? eligibilityFor(index, c, country) : null;
    if (el && el.status === "N") return;
    if (el && el.status === "Y") s += 1;
    out.push({ c, s, nd, el });
  });
  out.sort((a, b) => b.s - a.s || (a.nd < b.nd ? -1 : a.nd > b.nd ? 1 : 0));
  return out.slice(0, limit);
}

function money(v) { return v ? "EUR " + String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ",") : null; }



export function callBlock(index, hit, now, country) {
  const { c, nd, el } = hit;
  const later = c.dl.filter((d) => d > nd);
  const lines = [
    `### ${c.id}`,
    `Title: ${c.t}`,
    `Programme: ${c.p} | Type: ${c.ty} | Partnership: ${c.pt}`,
    ...(c.st === "forthcoming" ? [`Status: FORTHCOMING. Submission opens on ${c.op || "a date not yet published"}; applications cannot be submitted before then.`] : []),
    `Next deadline: ${deadlineLabel(nd)} (${Math.floor((ndMs(c, nd) - now) / 36e5)} hours from now, about ${Math.floor((ndMs(c, nd) - now) / DAY)} days)${later.length ? ` | later cut-offs: ${later.map((d) => d.slice(0, 10)).join(", ")}` : ""}`,
    `Funding: ${[c.f ? "per project up to " + money(c.f) : null, c.fb ? "topic budget " + money(c.fb) : null].filter(Boolean).join("; ") || "not stated in the data"}`,
    `Sectors (derived): ${c.s.join(", ")} | Applicants (derived): ${c.a.join(", ")}`,
  ];
  if (country && el) lines.push(`Eligibility for ${country}: ${el.status}${el.reason ? " (" + el.reason + ")" : ""}`);
  else {
    const open = index.countries.filter((cc, i) => !/^(AT|BE|BG|HR|CY|CZ|DK|EE|FI|FR|DE|GR|HU|IE|IT|LV|LT|LU|MT|NL|PL|PT|RO|SK|SI|ES|SE)$/.test(cc) && (c.e[i] === "Y" || c.e[i] === "P"));
    const check = index.countries.filter((cc, i) => c.e[i] === "C");
    lines.push(`Eligibility: non-EU countries eligible (Y/P): ${open.join(" ") || "none"}${check.length ? " | check call document: " + check.join(" ") : ""}`);
  }
  if (c.n && c.n.length) lines.push(`Notes: ${c.n.join(" ")}`);
  lines.push(`Official page: ${c.u}`);
  lines.push(`Excerpt: ${c.x}`);
  return lines.join("\n");
}

const WD = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MO = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export function brusselsNow(now) {
  const off = brusselsOffsetMin(now); const d = new Date(now + off * 6e4); const p = (n) => String(n).padStart(2, "0");
  return `${WD[d.getUTCDay()]} ${d.getUTCDate()} ${MO[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${p(d.getUTCHours())}:${p(d.getUTCMinutes())} ${off === 120 ? "CEST" : "CET"}`;
}

export function systemPrompt({ index, hits, now, country, profileText, docName }) {
  return [
    "You are the project-match assistant of Eligible Calls, a search engine for open EU funding calls imported from the EU Funding & Tenders Portal.",
    "",
    "RULES",
    "- Recommend ONLY calls listed under CANDIDATE CALLS, by their exact ID. Never invent calls, programmes, amounts, deadlines, eligibility rules, URLs or partners. If something is not in the data, say so and point to the call's official page.",
    `- Current time: ${brusselsNow(now)}. EU Portal grant topics close at 17:00 Brussels time; other organisers close at the time shown with each deadline, and when the time is not stated, say so. Give the exact deadline and the time left. Call deadlines under 14 days very tight and say whether a realistic application is still possible.`,
    "- Eligibility codes: Y eligible, P eligible with a condition, N not eligible, C not available from the source data (the Portal data refers to a call document). They come from the Commission's official lists of participating countries and the call text. Never present C or P as a plain yes. If the applicant's country is unknown and it matters, ask for it.",
    "- Calls marked FORTHCOMING are announced but not open yet. Say when submission opens; they are useful for planning ahead.",
    "- Sector and applicant tags are derived by Eligible Calls and are hints only. Judge fit from the title and excerpt.",
    `- The candidate calls were picked by keyword search from ${index.calls.length} calls imported on ${index.generated.slice(0, 10)}. Other open calls may fit too; suggest search words the user can try on the site.`,
    "- This is guidance, not an eligibility decision. The official call documents prevail.",
    "- Reply in the language the user writes in (Serbian in Latin script if they write Serbian).",
    "",
    "WHEN THE USER DESCRIBES A PROJECT OR ATTACHES AN APPLICATION",
    "1. Restate the project in two lines and list missing facts that would change the answer.",
    "2. Give a ranked shortlist of at most 4 calls: ID and title, why it fits, eligibility for their country, next deadline and time left, funding, partnership, main risk.",
    "3. Recommend which call to target first, what to adapt, partners needed, documents to prepare, and a dated plan counted back from the deadline.",
    "4. If nothing fits well, say so plainly. Do not stretch a weak match.",
    "Use short headings and bullet lists. Write call IDs exactly as given.",
    "",
    `APPLICANT: ${[country ? "country " + country : "country unknown", profileText].filter(Boolean).join("; ")}`,
    docName ? `The user attached a document named "${docName}"; its text is in the last user message.` : "",
    "",
    `CANDIDATE CALLS (${hits.length})`,
    hits.length ? hits.map((h) => callBlock(index, h, now, country)).join("\n\n") : "No open call matched the keywords. Say so and ask for more detail about the project.",
  ].filter((x) => x !== "").join("\n");
}

export const LIMITS = { messages: 10, msgChars: 3000, docChars: 8000, maxOutput: 1100 };

// Validate and trim the request body. Returns {error} or a clean object.
export function cleanRequest(body) {
  if (!body || typeof body !== "object") return { error: "bad_request" };
  const msgs = Array.isArray(body.messages) ? body.messages : [];
  const messages = msgs.slice(-LIMITS.messages)
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .map((m) => ({ role: m.role, content: m.content.slice(0, LIMITS.msgChars) }));
  while (messages.length && messages[0].role !== "user") messages.shift();
  if (!messages.length || messages[messages.length - 1].role !== "user") return { error: "bad_request" };
  const p = body.profile && typeof body.profile === "object" ? body.profile : {};
  const list = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === "string" && /^[a-z0-9-]{1,40}$/.test(x)).slice(0, 20) : []);
  const profile = {
    country: typeof p.country === "string" && /^[A-Z]{2}$/.test(p.country) ? p.country : null,
    sectors: list(p.sectors), applicants: list(p.applicants),
    text: typeof p.text === "string" ? p.text.slice(0, 300) : "",
  };
  let doc = null;
  if (body.doc && typeof body.doc.text === "string" && body.doc.text.trim()) {
    doc = { name: String(body.doc.name || "document").slice(0, 120), text: body.doc.text.slice(0, LIMITS.docChars), truncated: body.doc.text.length > LIMITS.docChars };
  }
  return { messages, profile, doc, lang: body.lang === "sr" ? "sr" : "en", turnstile: typeof body.turnstile === "string" ? body.turnstile : "" };
}

// Assemble the provider messages. The document goes into the last user turn.
export function buildMessages(index, req, now) {
  prepare(index);
  const userText = req.messages.filter((m) => m.role === "user").map((m) => m.content).join("\n");
  const country = req.profile.country || detectCountry(index, userText + " " + (req.doc ? req.doc.text.slice(0, 3000) : ""));
  const mention = index.calls.filter((c) => userText.includes(c.id)).map((c) => c.id);
  const query = [req.messages.slice(-1)[0].content, userText, req.doc ? req.doc.text.slice(0, 4000) : ""].join(" ");
  const hits = rank(index, { query, country, sectors: req.profile.sectors, applicants: req.profile.applicants, now, mention });
  const sys = systemPrompt({ index, hits, now, country, profileText: req.profile.text, docName: req.doc && req.doc.name });
  const msgs = req.messages.map((m) => ({ ...m }));
  if (req.doc) {
    const last = msgs[msgs.length - 1];
    last.content += `\n\nATTACHED DOCUMENT "${req.doc.name}"${req.doc.truncated ? " (first " + LIMITS.docChars + " characters)" : ""}:\n<<<\n${req.doc.text}\n>>>`;
  }
  return { messages: [{ role: "system", content: sys }, ...msgs], hits: hits.map((h) => h.c.id), country };
}

export const estTokens = (s) => Math.ceil(String(s).length / 3.6);
