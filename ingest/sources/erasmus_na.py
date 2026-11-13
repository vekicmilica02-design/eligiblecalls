"""Erasmus+ actions run by the national agencies (decentralised): Small-scale Partnerships (KA210) and
Cooperation Partnerships (KA220) in school education, VET, adult education and youth.

These actions have no topic page on the Funding & Tenders Portal. Their deadlines are fixed in the
Erasmus+ Programme Guide of each call year. Source data: site/org/erasmus-<year>.json, written by
ingest/erasmus_guide.py from the official guide pages (deadline sentences are checked against the page).
A round is published only while its deadline is in the future, and only if the guide page still answers.
Optional rounds (1 October) are labelled: a national agency may or may not organise them.
"""
import glob, json, os, re
from . import common as C

KEY = "erasmus_na"
NAME = "Erasmus+ Programme Guide (actions managed by the national agencies)"
EU27 = ["AT","BE","BG","HR","CY","CZ","DK","EE","FI","FR","DE","GR","HU","IE","IT","LV","LT","LU","MT","NL","PL","PT","RO","SK","SI","ES","SE"]
ASSOC = ["IS", "LI", "NO", "MK", "RS", "TR"]
# Cooperation Partnerships: third countries not associated, regions 1 to 3 (Belarus excepted), as partners only.
REGIONS_1_2 = ["AL", "BA", "XK", "ME", "UA", "MD", "GE", "AM"]
FIELDS = {"school": ("School education", "Školsko obrazovanje"), "vet": ("Vocational education and training", "Stručno obrazovanje i obuka"),
          "adult": ("Adult education", "Obrazovanje odraslih"), "youth": ("Youth", "Omladina"), "higher": ("Higher education", "Visoko obrazovanje")}
SECTORS = {"school": "education", "vet": "education", "adult": "education", "youth": "youth", "higher": "education"}


def latest_guide():
    files = sorted(glob.glob(os.path.join(C.HERE, "..", "site", "org", "erasmus-*.json")))
    if not files:
        raise RuntimeError("no Erasmus+ guide data (run ingest/erasmus_guide.py)")
    return json.load(open(files[-1], encoding="utf-8"))


def run(cache, fp_names):
    g = latest_guide()
    now = C.NOW
    out, stats = [], {"guideYear": g["guideYear"], "rounds": 0, "noFutureDeadline": 0, "pageUnavailable": 0, "published": 0}
    for a in g["actions"]:
        r = C.get(a["url"])
        ok = r is not None and r.status_code == 200 and a["name"]["en"].lower() in r.text.lower()
        for rd in a["rounds"]:
            stats["rounds"] += 1
            day = rd["deadline"][:10]
            if day < now.astimezone(C.BRU).strftime("%Y-%m-%d"):
                stats["noFutureDeadline"] += 1; continue
            if not ok:
                stats["pageUnavailable"] += 1; continue
            fields = [f for f in a["fields"] if f != "higher" or a["id"] == "KA220"]
            rules = a["rules"]
            partners = REGIONS_1_2 if a["id"] == "KA220" else []
            optional = rd["kind"] == "optional"
            cond = " ".join(v for v in a["quotes"].values())
            out.append(C.record(
                id=f"ERASMUS-NA-{g['callYear']}-{a['id']}-{day}", type="x",
                title=f"Erasmus+ {a['name']['en']} ({a['id']}), national agencies: {'possible additional round' if optional else 'main round'} {day}",
                callTitle=f"Erasmus+ {g['callYear']} call for proposals: {a['name']['en']}",
                url=a["url"], urlVerified="Erasmus+ Programme Guide page (official)", dl=[rd["deadline"]],
                callStatus="open", opens=None,
                description=(f"Fields: {', '.join(FIELDS[f][0] for f in fields)}. Apply to the Erasmus+ national agency of the country where the applicant is established. "
                             f"Lump sums: {', '.join('EUR ' + format(x, ',') for x in rules['lumpSums'])}. Duration {rules['durationMonths'][0]} to {rules['durationMonths'][1]} months. "
                             + ("A national agency may or may not organise this additional round; check its website. " if optional else "")
                             + f"Source: Erasmus+ Programme Guide {g['guideYear']} ({g['guideVersion']}). " + rd["quote"]),
                conditions=cond,
                prog="ERASMUS", progName="Erasmus+", progShort="Erasmus+",
                countries={"eligible": EU27 + ASSOC, "complete": True, "quote": a["quotes"]["applicant"], "erasmus": True, "partners": partners},
                organiser="Erasmus+ national agencies", sectors=sorted({SECTORS[f] for f in fields}),
                applicants=["organisation", "ngo", "public", "university"] if "higher" in fields else ["organisation", "ngo", "public"],
                partnership="consortium", erasmusAction=a["id"], guideYear=g["guideYear"],
                budget={"total": None, "grants": None, "min": min(rules["lumpSums"]), "max": max(rules["lumpSums"])},
                source=KEY, sourceName=NAME,
            ))
            stats["published"] += 1
    return out, stats
