// Organisation profile: one schema for the browser form, the API validation and the AI extraction.
// Plain ES module, no dependencies. Served to the browser from /org/schema.js and imported by src/org/*.

export const ORG_TYPES = [
  // id, applicant categories of the call data (taxonomy.json "applicants") the type falls under, legal entity?
  { id: "ngo", en: "NGO / association", sr: "Udruženje / NVO", cats: ["ngo", "organisation"], legal: true },
  { id: "foundation", en: "Foundation or endowment", sr: "Fondacija ili zadužbina", cats: ["ngo", "organisation"], legal: true },
  { id: "social-enterprise", en: "Social enterprise or cooperative", sr: "Socijalno preduzeće ili zadruga", cats: ["ngo", "sme", "organisation"], legal: true },
  { id: "public-authority", en: "Public authority (local, regional, national)", sr: "Javni organ (lokalni, pokrajinski, republički)", cats: ["public", "organisation"], legal: true },
  { id: "public-body", en: "Other public body or institution", sr: "Druga javna ustanova", cats: ["public", "organisation"], legal: true },
  { id: "university", en: "University or higher education institution", sr: "Univerzitet ili visokoškolska ustanova", cats: ["university", "organisation"], legal: true },
  { id: "research", en: "Research organisation", sr: "Istraživačka organizacija", cats: ["university", "organisation"], legal: true },
  { id: "school", en: "School (primary or secondary)", sr: "Škola (osnovna ili srednja)", cats: ["organisation"], legal: true },
  { id: "vet", en: "VET provider or training centre", sr: "Ustanova za stručno obrazovanje ili centar za obuku", cats: ["organisation"], legal: true },
  { id: "adult-education", en: "Adult education organisation", sr: "Organizacija za obrazovanje odraslih", cats: ["organisation"], legal: true },
  { id: "sme", en: "Company: micro, small or medium (SME)", sr: "Preduzeće: mikro, malo ili srednje (MSP)", cats: ["sme", "organisation"], legal: true },
  { id: "startup", en: "Startup", sr: "Startap", cats: ["startup", "sme", "organisation"], legal: true },
  { id: "company", en: "Large company", sr: "Veliko preduzeće", cats: ["organisation"], legal: true },
  { id: "cultural", en: "Cultural organisation (museum, theatre, gallery, library)", sr: "Ustanova kulture (muzej, pozorište, galerija, biblioteka)", cats: ["organisation"], legal: true },
  { id: "informal-group", en: "Informal group (not registered)", sr: "Neformalna grupa (nije registrovana)", cats: [], legal: false },
  { id: "other", en: "Other legal entity", sr: "Drugo pravno lice", cats: ["organisation"], legal: true },
];

export const TARGET_GROUPS = [
  ["children", "Children", "Deca"], ["youth", "Young people", "Mladi"], ["students", "Students", "Studenti"],
  ["adults", "Adult learners", "Odrasli polaznici"], ["teachers", "Teachers and educators", "Nastavnici i edukatori"],
  ["youth-workers", "Youth workers", "Omladinski radnici"], ["fewer-opportunities", "People with fewer opportunities", "Osobe sa manje mogućnosti"],
  ["disabilities", "People with disabilities", "Osobe sa invaliditetom"], ["women", "Women and girls", "Žene i devojčice"],
  ["minorities", "Ethnic minorities, including Roma", "Nacionalne manjine, uključujući Rome"], ["migrants", "Migrants and refugees", "Migranti i izbeglice"],
  ["elderly", "Older people", "Starije osobe"], ["unemployed", "Unemployed people", "Nezaposleni"], ["rural", "Rural communities", "Ruralne zajednice"],
  ["artists", "Artists and cultural professionals", "Umetnici i profesionalci u kulturi"], ["researchers", "Researchers", "Istraživači"],
  ["smes", "SMEs and entrepreneurs", "MSP i preduzetnici"], ["public-sector", "Public sector staff", "Zaposleni u javnom sektoru"],
  ["civil-society", "Civil society organisations", "Organizacije civilnog društva"], ["general-public", "General public", "Šira javnost"],
].map(([id, en, sr]) => ({ id, en, sr }));

export const SCOPES = [["local", "Local", "Lokalni"], ["regional", "Regional", "Regionalni"], ["national", "National", "Nacionalni"], ["international", "International", "Međunarodni"]].map(([id, en, sr]) => ({ id, en, sr }));
export const EXPERIENCE = [["none", "None", "Nema"], ["partner", "As partner", "Kao partner"], ["coordinator", "As coordinator", "Kao koordinator"]].map(([id, en, sr]) => ({ id, en, sr }));

// kind: text (one line), long (text area), int, year, enum (one of), multi (list of ids), url, bool, countries
// w: weight in the completeness percentage. req: needed for any eligibility check.
export const FIELDS = [
  { id: "name", kind: "text", max: 200, w: 4, req: true, en: "Organisation name", sr: "Naziv organizacije" },
  { id: "orgType", kind: "enum", options: ORG_TYPES, w: 6, req: true, en: "Organisation type", sr: "Tip organizacije" },
  { id: "country", kind: "country", w: 6, req: true, en: "Country of establishment", sr: "Država sedišta" },
  { id: "city", kind: "text", max: 120, w: 1, en: "City", sr: "Grad" },
  { id: "registrationNumber", kind: "text", max: 60, w: 1, en: "Registration number (optional)", sr: "Matični broj (opciono)" },
  { id: "oid", kind: "text", max: 20, w: 1, en: "Erasmus+ OID or EU PIC (optional)", sr: "Erasmus+ OID ili EU PIC (opciono)" },
  { id: "yearEstablished", kind: "year", w: 4, en: "Year of establishment", sr: "Godina osnivanja" },
  { id: "website", kind: "url", w: 2, en: "Website", sr: "Veb-sajt" },
  { id: "description", kind: "long", max: 3000, w: 6, en: "Organisation description", sr: "Opis organizacije" },
  { id: "mission", kind: "long", max: 2000, w: 5, en: "Mission and vision", sr: "Misija i vizija" },
  { id: "objectives", kind: "long", max: 3000, w: 6, en: "Main objectives", sr: "Glavni ciljevi" },
  { id: "activityAreas", kind: "multi", source: "sectors", w: 7, en: "Areas of activity", sr: "Oblasti delovanja" },
  { id: "targetGroups", kind: "multi", options: TARGET_GROUPS, w: 6, en: "Target groups", sr: "Ciljne grupe" },
  { id: "previousProjects", kind: "long", max: 4000, w: 6, en: "Previous projects and experience", sr: "Prethodni projekti i iskustvo" },
  { id: "employees", kind: "int", max: 1000000, w: 2, en: "Number of employees", sr: "Broj zaposlenih" },
  { id: "volunteers", kind: "int", max: 1000000, w: 2, en: "Number of volunteers", sr: "Broj volontera" },
  { id: "geoScope", kind: "enum", options: SCOPES, w: 2, en: "Geographic scope of activities", sr: "Geografski obuhvat aktivnosti" },
  { id: "euFunding", kind: "enum", options: EXPERIENCE, w: 4, en: "Experience with EU-funded projects", sr: "Iskustvo sa projektima finansiranim od EU" },
  { id: "erasmus", kind: "enum", options: EXPERIENCE, w: 3, en: "Previous Erasmus+ participation", sr: "Prethodno učešće u Erasmus+" },
  { id: "fundingDetails", kind: "long", max: 3000, w: 3, en: "Details of EU and Erasmus+ projects", sr: "Detalji EU i Erasmus+ projekata" },
  { id: "eche", kind: "bool", w: 0, en: "Holds an Erasmus Charter for Higher Education (ECHE)", sr: "Ima Erasmus povelju za visoko obrazovanje (ECHE)" },
  { id: "partnerCountries", kind: "countries", w: 3, en: "Countries of existing international partners", sr: "Države postojećih međunarodnih partnera" },
  { id: "partnerships", kind: "long", max: 3000, w: 3, en: "Existing partnerships and networks", sr: "Postojeća partnerstva i mreže" },
  { id: "infrastructure", kind: "long", max: 2000, w: 2, en: "Infrastructure and resources", sr: "Infrastruktura i resursi" },
  { id: "capacity", kind: "long", max: 2000, w: 3, en: "Financial and administrative capacity", sr: "Finansijski i administrativni kapacitet" },
  { id: "expertise", kind: "long", max: 3000, w: 4, en: "Expertise and competencies", sr: "Stručnost i kompetencije" },
];
export const FIELD = Object.fromEntries(FIELDS.map((f) => [f.id, f]));
export const SOURCES = ["manual", "document", "web"];
export const CONFIDENCE = ["high", "medium", "low"];

const isStr = (v) => typeof v === "string";
const clip = (s, n) => String(s).replace(/\u0000/g, "").trim().slice(0, n);

// Validate one value. Returns { ok, value } or { ok: false, error }. ctx: { countries:Set, sectors:Set, year }
export function cleanValue(f, v, ctx) {
  if (v === null || v === undefined || v === "" || (Array.isArray(v) && !v.length)) return { ok: true, value: null };
  switch (f.kind) {
    case "text": case "long":
      if (!isStr(v)) return { ok: false, error: "text" };
      return { ok: true, value: clip(v, f.max || 2000) || null };
    case "url": {
      if (!isStr(v)) return { ok: false, error: "url" };
      let s = v.trim(); if (!/^https?:\/\//i.test(s)) s = "https://" + s;
      try { const u = new URL(s); if (!/^https?:$/.test(u.protocol) || !u.hostname.includes(".")) return { ok: false, error: "url" }; return { ok: true, value: u.href.slice(0, 300) }; }
      catch { return { ok: false, error: "url" }; }
    }
    case "int": { const n = typeof v === "number" ? v : isStr(v) && /^\s*\d+\s*$/.test(v) ? +v : NaN; return Number.isInteger(n) && n >= 0 && n <= (f.max || 1e9) ? { ok: true, value: n } : { ok: false, error: "int" }; }
    case "year": { const n = typeof v === "number" ? v : isStr(v) && /^\s*\d{4}\s*$/.test(v) ? +v : NaN; return Number.isInteger(n) && n >= 1800 && n <= (ctx.year || 2100) ? { ok: true, value: n } : { ok: false, error: "year" }; }
    case "bool": return typeof v === "boolean" ? { ok: true, value: v } : { ok: false, error: "bool" };
    case "enum": return f.options.some((o) => o.id === v) ? { ok: true, value: v } : { ok: false, error: "enum" };
    case "country": return isStr(v) && ctx.countries.has(v.toUpperCase()) ? { ok: true, value: v.toUpperCase() } : { ok: false, error: "country" };
    case "countries": case "multi": {
      if (!Array.isArray(v)) return { ok: false, error: "list" };
      const allowed = f.kind === "countries" ? ctx.countries : f.source === "sectors" ? ctx.sectors : new Set(f.options.map((o) => o.id));
      const out = [...new Set(v.filter(isStr).map((x) => (f.kind === "countries" ? x.toUpperCase() : x)))];
      if (out.some((x) => !allowed.has(x))) return { ok: false, error: "option" };
      return { ok: true, value: out.slice(0, 60) };
    }
  }
  return { ok: false, error: "kind" };
}

// Provenance of one field: where the value came from and whether a person confirmed it.
export function cleanMeta(m) {
  if (!m || typeof m !== "object") return null;
  const out = { source: SOURCES.includes(m.source) ? m.source : "manual", verified: m.verified === true };
  if (isStr(m.sourceName)) out.sourceName = clip(m.sourceName, 160);
  if (isStr(m.sourceUrl) && /^https?:\/\//.test(m.sourceUrl)) out.sourceUrl = clip(m.sourceUrl, 300);
  if (isStr(m.evidence)) out.evidence = clip(m.evidence, 500);
  if (CONFIDENCE.includes(m.confidence)) out.confidence = m.confidence;
  if (isStr(m.at)) out.at = clip(m.at, 30);
  return out;
}

// Whole profile. Unknown keys are dropped. Returns { profile, errors: {field: code} }.
export function cleanProfile(input, ctx) {
  const profile = {}, errors = {}, meta = {};
  const src = input && typeof input === "object" ? input : {};
  for (const f of FIELDS) {
    const r = cleanValue(f, src[f.id], ctx);
    if (!r.ok) { errors[f.id] = r.error; continue; }
    if (r.value !== null) profile[f.id] = r.value;
  }
  for (const [k, m] of Object.entries((src._meta && typeof src._meta === "object") ? src._meta : {})) {
    if (FIELD[k] && profile[k] !== undefined) { const c = cleanMeta(m); if (c) meta[k] = c; }
  }
  if (Object.keys(meta).length) profile._meta = meta;
  return { profile, errors };
}

// Completeness: weighted share of filled fields, and the list of empty fields (most important first).
export function completeness(profile) {
  const p = profile || {};
  let have = 0, all = 0; const missing = [];
  for (const f of FIELDS) {
    if (!f.w) continue;
    all += f.w;
    const v = p[f.id];
    if (v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && !v.length)) have += f.w; else missing.push(f);
  }
  missing.sort((a, b) => b.w - a.w);
  return { pct: Math.round((100 * have) / all), missing: missing.map((f) => f.id) };
}

// Fields whose value changed between two versions (for the change log).
export function changedFields(a, b) {
  const out = [];
  for (const f of FIELDS) if (JSON.stringify((a || {})[f.id] ?? null) !== JSON.stringify((b || {})[f.id] ?? null)) out.push(f.id);
  return out;
}

export function contextFrom(taxonomy, year = new Date().getUTCFullYear()) {
  return { countries: new Set(taxonomy.countries.map((c) => c.id)), sectors: new Set(taxonomy.sectors.map((s) => s.id)), year };
}
