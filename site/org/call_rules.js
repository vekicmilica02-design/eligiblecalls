// Call-specific mandatory requirements, each quoted from an official text. A rule only adds checks;
// country eligibility stays in the call data (ingest/build.py). Add a rule only with its source sentence.
//
// match(call) -> boolean; info: facts the generic checks use (minCountries); checks(profile, call) -> [check]

const GUIDE_KA220 = "https://erasmus-plus.ec.europa.eu/programme-guide/part-b/key-action-2/cooperation-partnerships";
const GUIDE_KA210 = "https://erasmus-plus.ec.europa.eu/programme-guide/part-b/key-action-2/small-scale-partnerships";
const chk = (id, result, code, params = {}) => ({ id, result, code, params, source: "call-rule" });

// "legally established at least 2 years before the application deadline": only the year is in the profile,
// so a difference of exactly 2 calendar years cannot be decided.
function established(p, c, years, quote, url) {
  if (!p.yearEstablished) return chk("established", "missing", "rule.established.missing", { years, quote, url, fields: ["yearEstablished"] });
  const dy = +String(c.nextDeadline || "").slice(0, 4);
  const diff = dy - p.yearEstablished;
  if (diff > years) return chk("established", "pass", "rule.established.pass", { years, year: p.yearEstablished, quote, url });
  if (diff < years) return chk("established", "fail", "rule.established.fail", { years, year: p.yearEstablished, deadline: c.nextDeadline, quote, url });
  return chk("established", "unknown", "rule.established.date", { years, year: p.yearEstablished, deadline: c.nextDeadline, quote, url });
}

const Q_KA220_EST = "In order to be eligible, applicant/coordinator organisations must have been legally established at least 2 years before the application deadline.";
const Q_ENGO = "the applicant coordinator must be a European NGO active in the field of education and training or youth.";

export const CALL_RULES = [
  {
    id: "erasmus-ka220",
    match: (c) => c.erasmusAction === "KA220" || /^ERASMUS-(EDU|YOUTH)-\d{4}-PCOOP-ENGO/.test(c.id) || /^ERASMUS-SPORT-\d{4}-SCP$/.test(c.id),
    info: { minCountries: 3 },
    checks: (p, c) => [established(p, c, 2, Q_KA220_EST, GUIDE_KA220)],
  },
  {
    id: "erasmus-ka210",
    match: (c) => c.erasmusAction === "KA210" || /^ERASMUS-SPORT-\d{4}-SSCP$/.test(c.id),
    info: { minCountries: 2 },
    checks: () => [],
  },
  {
    id: "erasmus-engo",
    match: (c) => /^ERASMUS-(EDU|YOUTH)-\d{4}-PCOOP-ENGO/.test(c.id),
    checks: () => [chk("europeanNgo", "unknown", "rule.engo", { quote: Q_ENGO, url: GUIDE_KA220 })],
  },
  {
    // European Universities and the European Degree action are for higher education institutions (call objective).
    id: "erasmus-heis",
    match: (c) => /^ERASMUS-EDU-\d{4}-(EUR-UNIV|EUED)\b/.test(c.id),
    checks: (p, c) => {
      const m = String(c.description || "").match(/[^.]*higher education institutions[^.]*\./i);
      const quote = m ? m[0].trim().slice(0, 400) : "";
      if (!p.orgType) return [chk("heis", "missing", "rule.heis.missing", { quote, fields: ["orgType"] })];
      return [p.orgType === "university" ? chk("heis", "pass", "rule.heis.pass", { quote }) : chk("heis", "warn", "rule.heis.warn", { quote })];
    },
  },
];
export { GUIDE_KA210, GUIDE_KA220 };
