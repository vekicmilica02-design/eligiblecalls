"""Erasmus+ award criteria and decentralised rounds, read from the Programme Guide (HTML, Part B).

Writes site/org/erasmus-<year>.json, the evaluation framework used by Organization Intelligence.
Award criteria (names, maximum points, the "extent to which" points, thresholds) are parsed from
the official pages, so a new guide only needs a new run and a check of the diff. Eligibility facts
and deadlines are encoded by hand below, each with the sentence of the guide it comes from.

    python ingest/erasmus_guide.py            # writes site/org/erasmus-2026.json
    GUIDE_YEAR=2027 python ingest/erasmus_guide.py   # after the Commission publishes the 2027 guide

The script refuses to write if the guide's version line or any criterion cannot be parsed.
"""
import html, json, os, re, sys, datetime
import requests

HERE = os.path.dirname(os.path.abspath(__file__))
YEAR = int(os.environ.get("GUIDE_YEAR", "2026"))
OUT = os.path.join(HERE, "..", "site", "org", f"erasmus-{YEAR}.json")
BASE = "https://erasmus-plus.ec.europa.eu/programme-guide/part-b/"
UA = {"User-Agent": "eligiblecalls-ingest/1.0"}

# Hand-encoded facts. Every "quote" is copied from the page named in "url" (2026 guide, version 1 of 12.11.2025).
ACTIONS = [
    {
        "id": "KA210", "slug": "key-action-2/small-scale-partnerships",
        "name": {"en": "Small-scale Partnerships", "sr": "Partnerstva malog obima"},
        "fields": ["school", "vet", "adult", "youth"],
        "managedBy": "national-agency",
        "rounds": [
            {"deadline": "{Y}-03-05T12:00|Europe/Brussels", "kind": "main",
             "quote": "Applicants have to submit their grant application by 5 March at 12:00:00 (midday Brussels time) for projects starting between 1 September and 31 December of the same year."},
            {"deadline": "{Y}-10-01T12:00|Europe/Brussels", "kind": "optional",
             "quote": "If the additional round is organised, applicants have to submit their grant application by 1 October at 12:00:00 (midday Brussels time ), for projects starting between 1 January and 31 August of the following year."},
        ],
        "rules": {
            "applicantCountries": "EU27+ASSOC",
            "minOrganisations": 2, "minCountries": 2,
            "minYearsEstablished": None,
            "lumpSums": [30000, 60000], "durationMonths": [6, 24],
        },
        "quotes": {
            "applicant": "Any participating organisation established in an EU Member State or third country associated to the Programme can be the applicant.",
            "partners": "A Small-scale Partnership is transnational and involves minimum two organisations from two different EU Member States or third countries associated to the Programme.",
            "lumpSums": "There are two pre-defined lump sums grants : EUR 30 000 and EUR 60 000.",
        },
    },
    {
        "id": "KA220", "slug": "key-action-2/cooperation-partnerships",
        "name": {"en": "Cooperation Partnerships", "sr": "Partnerstva za saradnju"},
        "fields": ["school", "vet", "adult", "youth", "higher"],
        "managedBy": "national-agency",
        "rounds": [
            {"deadline": "{Y}-03-05T12:00|Europe/Brussels", "kind": "main",
             "quote": "Applicants have to submit their grant application by 5 March at 12:00:00 (midday Brussels time) for projects starting between 1 September and 31 December of the same year."},
            {"deadline": "{Y}-10-01T12:00|Europe/Brussels", "kind": "optional",
             "quote": "If a second round is organised, applicants must submit their grant application by 1 October at 12:00:00 (midday Brussels time) for projects starting between 1 January and 31 August of the following year"},
        ],
        "rules": {
            "applicantCountries": "EU27+ASSOC",
            "minOrganisations": 3, "minCountries": 3,
            "minYearsEstablished": 2,
            "lumpSums": [120000, 250000, 400000], "durationMonths": [12, 36],
        },
        "quotes": {
            "applicant": "Any participating organisation established in an EU Member State or third country associated to the Programme can be the applicant/coordinator.",
            "established": "In order to be eligible, applicant/coordinator organisations must have been legally established at least 2 years before the application deadline.",
            "partners": "A Cooperation Partnership is a transnational project and must involve minimum three organisations from three different EU Member States or third countries associated to the Programme.",
            "nonAssociated": "However, organisations from third countries not associated to the Programme (regions 1 to 3, with the exception of Belarus) can be involved as partners (not as applicants), if their participation brings an essential added value to the project and as long as the minimum participation from three organisations from three different EU Member States or third countries associated to the Programme is fulfilled.",
        },
    },
]

CRIT = re.compile(r"^(?P<name>[A-Z][^\n]{3,120}?)\s*\(maximum score (?P<max>\d+) points\)\s*$", re.M)
TOTAL = re.compile(r"proposals must score at least (\d+) points")


def text_of(url):
    r = requests.get(url, timeout=60, headers=UA)
    r.raise_for_status()
    t = re.sub(r"<script.*?</script>|<style.*?</style>", "", r.text, flags=re.S)
    t = re.sub(r"<(br|p|li|tr|h[1-6]|div)[^>]*>", "\n", t)
    t = html.unescape(re.sub(r"<[^>]+>", " ", t)).replace("­", "")
    t = re.sub(r"[ \t ]+", " ", t)
    return "\n".join(x.strip() for x in t.split("\n") if x.strip())


def criteria(t):
    i = t.find("Award criteria")
    j = t.find("What are the funding rules", i)
    if i < 0 or j < 0:
        raise SystemExit("award criteria section not found")
    sec = t[i:j]
    heads = list(CRIT.finditer(sec))
    out = []
    for k, h in enumerate(heads):
        body = sec[h.end(): heads[k + 1].start() if k + 1 < len(heads) else len(sec)]
        stop = body.find("To be considered for funding")
        body = body[: stop if stop >= 0 else len(body)]
        pts = [x.strip(" ;") for x in body.split("\n") if x.strip() and x.strip() != "The extent to which:"]
        out.append({"name": h.group("name").strip(), "max": int(h.group("max")), "points": pts})
    m = TOTAL.search(sec)
    if not out or not m:
        raise SystemExit("criteria or threshold not parsed")
    total = int(m.group(1))
    # "at least half of the maximum score points in each of the categories"
    if not re.search(r"at least half of the maximum (?:score )?points in each of the categories", sec):
        raise SystemExit("per-criterion threshold sentence not found")
    for c in out:
        c["min"] = -(-c["max"] // 2)
    tie = re.search(r"In cases where two or more applications have received the same total score[^\n]*", sec)
    return out, total, tie.group(0) if tie else None, sec


def main():
    g = requests.get("https://erasmus-plus.ec.europa.eu/erasmus-programme-guide", timeout=60, headers=UA)
    g.raise_for_status()
    ver = re.search(r"Version\s+(\d+(?:\.\d+)?)\s+of\s+(\d{2}\.\d{2}\.\d{4})", g.text)
    call = re.search(r"(20\d\d) Erasmus\+ Call for Proposals", g.text)
    if not ver or not call:
        raise SystemExit("guide version line not found")
    if int(call.group(1)) != YEAR:
        raise SystemExit(f"the guide online belongs to the {call.group(1)} call, not {YEAR}")
    actions = []
    for a in ACTIONS:
        url = BASE + a["slug"]
        t = text_of(url)
        crit, total, tie, sec = criteria(t)
        for q in a["quotes"].values():
            if re.sub(r"\s+", " ", q) not in re.sub(r"\s+", " ", t):
                raise SystemExit(f"{a['id']}: quoted sentence no longer on the page: {q[:80]}")
        for r in a["rounds"]:
            if re.sub(r"\s+", " ", r["quote"]) not in re.sub(r"\s+", " ", t):
                raise SystemExit(f"{a['id']}: deadline sentence no longer on the page: {r['quote'][:80]}")
        rounds = [{**r, "deadline": r["deadline"].replace("{Y}", str(YEAR))} for r in a["rounds"]]
        actions.append({k: v for k, v in a.items() if k not in ("slug", "rounds")} | {
            "url": url, "rounds": rounds,
            "criteria": [{"id": f"c{i + 1}", **c} for i, c in enumerate(crit)],
            "threshold": {"total": total, "perCriterion": "half of each maximum, rounded up"},
            "tieBreak": tie,
        })
    out = {"programme": "Erasmus+", "guideYear": YEAR, "callYear": int(call.group(1)),
           "guideVersion": f"Version {ver.group(1)} of {ver.group(2)}",
           "guideUrl": "https://erasmus-plus.ec.europa.eu/erasmus-programme-guide",
           "countriesUrl": "https://erasmus-plus.ec.europa.eu/programme-guide/part-a/eligible-countries",
           "nationalAgenciesUrl": "https://erasmus-plus.ec.europa.eu/about-erasmus/contacts/national-agencies",
           "retrieved": datetime.date.today().isoformat(),
           "notice": "Preliminary self-assessment aid. Evaluators score against the official guide of the call year; the guide prevails.",
           "actions": actions}
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(out, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    for a in actions:
        print(a["id"], [(c["name"], c["max"], c["min"], len(c["points"])) for c in a["criteria"]], "total", a["threshold"]["total"])


if __name__ == "__main__":
    main()
