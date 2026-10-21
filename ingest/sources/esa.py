"""ESA Business Applications and Space Solutions funding (business.esa.int).

Source: https://business.esa.int/funding and each funding page (labelled "Opening date" and "Closing date",
and the sentence "your team must be based in one of the following countries: ..."). Permanently open calls
without a closing date are not published.
"""
import re
from . import common as C
from .eralearn import NAME2CODE

KEY = "esa"
NAME = "ESA Business Applications funding (business.esa.int)"
BASE = "https://business.esa.int"


def dmy(s):
    m = re.search(r"(\d\d)-(\d\d)-(\d{4})", s or "")
    return f"{m.group(3)}-{m.group(2)}-{m.group(1)}" if m else None


def parse(h):
    t = C.text_of(h)
    o = re.search(r"Opening date\s*(\d\d-\d\d-\d{4})", t)
    c = re.search(r"Closing date\s*(\d\d-\d\d-\d{4})", t)
    cs = re.search(r"based in one of the following countries:\s*([^.]+)\.", t)
    names = re.split(r",\s*|\s+and\s+", cs.group(1)) if cs else []
    title = re.search(r"<h1[^>]*>(.*?)</h1>", h, re.S)
    intro = re.search(r"(?s)(?:Introduction|The funding opportunity)\s*\n(.*?)\n\s*\n", t + "\n\n")
    return {"title": C.text_of(title.group(1)) if title else None, "open": dmy(o.group(1)) if o else None, "close": dmy(c.group(1)) if c else None,
            "countries": sorted({NAME2CODE[n.strip()] for n in names if n.strip() in NAME2CODE}), "countryText": cs.group(1).strip() if cs else "",
            "desc": C.meta_description(h) or (C.text_of(intro.group(1))[:1500] if intro else "")}


def run(cache, fp_names):
    r = C.get(BASE + "/funding")
    if r is None or r.status_code != 200:
        raise RuntimeError("ESA funding listing unavailable")
    links = list(dict.fromkeys(re.findall(r'<h3 class="title"><a href="(/funding/[^"]+)"', r.text)))
    today = C.NOW.astimezone(C.BRU).strftime("%Y-%m-%d")
    out, stats = [], {"listed": len(links), "noClosingDate": 0, "noFutureDeadline": 0, "published": 0}
    for path in links:
        url = BASE + path
        d = C.cached_fields(url, cache, parse, hours=24)
        if not d or not d.get("title"):
            continue
        if not d["close"]:
            stats["noClosingDate"] += 1; continue
        if d["close"] < today:
            stats["noFutureDeadline"] += 1; continue
        out.append(C.record(
            id="ESA-" + path.rstrip("/").split("/")[-1][:90], title=d["title"], callTitle="ESA Business Applications and Space Solutions",
            url=url, urlVerified="business.esa.int funding page", dl=[d["close"] + "|~"],
            callStatus="forthcoming" if d["open"] and d["open"] > today else "open", opens=d["open"],
            description=d["desc"], conditions=("To be eligible for funding, the team must be based in one of: " + d["countryText"] + ".") if d["countryText"] else "",
            prog="ESA", progName="European Space Agency: Business Applications and Space Solutions", progShort="ESA Space Solutions",
            countries={"eligible": d["countries"], "complete": bool(d["countries"]), "quote": d["countryText"]} if d["countries"] else {"eligible": None, "complete": False, "quote": ""},
            organiser="European Space Agency (ESA)", sectors=["innovation", "digital"], applicants=["sme", "startup", "organisation"],
            source=KEY, sourceName=NAME,
        ))
        stats["published"] += 1
    return out, stats
