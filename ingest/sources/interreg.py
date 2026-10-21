"""Interreg calls (EU cross-border, transnational and interregional cooperation programmes).

Source: the calls index of interreg.eu (run by Interact, data from keep.eu), read through the public
search key embedded in interreg.eu/calls-for-projects/. Each call links to the programme's own call page
(callExternalUrl), which is checked with common.verify before publishing.
Eligible countries come from the structured programme-area fields (callEligibleCountryNuts).
"""
import re
from . import common as C

KEY = "interreg"
NAME = "interreg.eu calls for projects (Interact / keep.eu), linked to each programme's call page"
URL = "https://2E032DRCNS-dsn.algolia.net/1/indexes/prod_en-us_content/query"
HDR = {"X-Algolia-Application-Id": "2E032DRCNS", "X-Algolia-API-Key": "afcd3bc5094a8f54ceb9cb221c74dbc7"}
LISTING = "https://interreg.eu/calls-for-projects/"


def run(cache, fp_names):
    r = C.S.post(URL, headers=HDR, timeout=60, json={"params": "filters=contentType%3AcallForProjectsPage%20AND%20(callStatus%3AOpen%20OR%20callStatus%3AComing)&hitsPerPage=500"})
    r.raise_for_status()
    hits = r.json().get("hits") or []
    if not hits:
        raise RuntimeError("interreg.eu index returned no calls")
    today = C.NOW.astimezone(C.BRU).strftime("%Y-%m-%d")
    out, stats = [], {"listed": len(hits), "noFutureDeadline": 0, "linkNotVerified": 0, "published": 0}
    for h in hits:
        dd = str(h.get("callDeadlineDate") or "")[:10]
        if not re.match(r"\d{4}-\d\d-\d\d$", dd) or dd < today:
            stats["noFutureDeadline"] += 1; continue
        prog = (h.get("associatedProgrammes") or [""])[0]
        raw_title = re.sub(r"\s+", " ", h.get("title") or "").strip()
        call_part = raw_title
        core = re.sub(r"^\s*20\d\d\s*-\s*20\d\d\s*", "", raw_title)
        if prog:
            pm = re.sub(r"^Interreg\s+", "", prog)
            for cand in (prog, pm):
                i = core.find(cand)
                if i >= 0:
                    call_part = core[i + len(cand):].strip(" -–:()") or core; break
            else:
                call_part = re.sub(r"^Interreg\s+(VI-[ABCD]\s+)?", "", core)
        title = f"{prog}: {call_part}" if prog and call_part and prog not in call_part else (call_part or raw_title)
        ok, url, why = C.verify(h.get("callExternalUrl"), call_part + " " + re.sub(r"^Interreg\s+", "", prog), cache, trusted="interreg.eu")
        if not ok:
            stats["linkNotVerified"] += 1; continue
        codes = sorted({c for c in (C.country_code(x) for x in h.get("callEligibleCountryNuts") or []) if c})
        names = ", ".join(h.get("callEligibleCountryNames") or [])
        status = "forthcoming" if (h.get("callStatus") == "Coming" or str(h.get("callOpenDate") or "")[:10] > today) else "open"
        aud = h.get("targetAudience") or []
        out.append(C.record(
            id="INTERREG-" + str(h.get("pageId") or h.get("objectID")), title=title, callTitle=prog,
            url=url, urlVerified=why, dl=[dd + "|~"], callStatus=status, opens=str(h.get("callOpenDate") or "")[:10] or None,
            description=("Programme area: " + names + "." if names else "") + (" Themes: " + ", ".join(h.get("callThemes") or []) + "." if h.get("callThemes") else ""),
            conditions=("Target groups listed on interreg.eu: " + ", ".join(aud) + ".") if aud else "",
            keywords=(h.get("callThemes") or [])[:8],
            prog="INTERREG", progName="Interreg (European Territorial Cooperation)", progShort="Interreg",
            countries={"eligible": codes, "complete": True, "regional": True, "quote": "Programme area on interreg.eu: " + names},
            sectors=["regional-dev", "intl-cooperation"], applicants=["organisation", "public", "ngo", "university"],
            organiser=prog, source=KEY, sourceName=NAME,
        ))
        stats["published"] += 1
    return out, stats
