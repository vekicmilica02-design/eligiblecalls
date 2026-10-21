"""European Institute of Innovation and Technology (EIT) and its Knowledge and Innovation Communities.

Source: https://www.eit.europa.eu/our-activities/opportunities (Drupal HTML). Each opportunity has its own
page on eit.europa.eu with start and end date and time (CET) and the KIC that runs it.
"""
import re
from . import common as C

KEY = "eit"
NAME = "EIT opportunities (eit.europa.eu, European Institute of Innovation and Technology)"
BASE = "https://www.eit.europa.eu"
LIST = BASE + "/our-activities/opportunities"


def dmy_time(s):
    m = re.search(r"(\d\d)/(\d\d)/(\d{4})(?:\s*<span>\s*(\d\d)[.:](\d\d))?", s or "")
    if not m:
        return None, None
    return f"{m.group(3)}-{m.group(2)}-{m.group(1)}", (f"{m.group(4)}:{m.group(5)}" if m.group(4) else None)


def details(h):
    m = re.search(r'(?s)<article.*?</article>', h)
    body = C.text_of(m.group(0) if m else h)
    return {"desc": C.meta_description(h) or body[:1500], "body": body[:3500]}


def run(cache, fp_names):
    import sys, os
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    import deadlines as D
    r = C.get(LIST)
    if r is None or r.status_code != 200:
        raise RuntimeError("EIT opportunities page unavailable")
    rows = re.split(r'<div class="views-row-wrapper">', r.text)[1:]
    today = C.NOW.astimezone(C.BRU).strftime("%Y-%m-%d")
    out, stats = [], {"listed": len(rows), "noFutureDeadline": 0, "linkNotVerified": 0, "published": 0}
    for b in rows:
        m = re.search(r'<div class="teaser-title"><a href="([^"]+)"[^>]*>(.*?)</a>', b, re.S)
        if not m:
            continue
        url = BASE + m.group(1) if m.group(1).startswith("/") else m.group(1)
        title = re.sub(r"\s*:?\s*Apply now!?$", "", C.text_of(m.group(2))).strip()
        sd, _ = dmy_time((re.search(r'<div class="start-date">(.*?)</div>', b, re.S) or [None, ""])[1])
        ed, et = dmy_time((re.search(r'<div class="end-date">(.*?)</div>', b, re.S) or [None, ""])[1])
        if not ed:
            stats["noFutureDeadline"] += 1; continue
        dl = f"{ed}T{et}|Europe/Brussels" if et else f"{ed}|~"
        if D.instant(dl) <= C.NOW:
            stats["noFutureDeadline"] += 1; continue
        kic = C.text_of((re.search(r'<div class="teaser-kics">(.*?)</div>', b, re.S) or [None, ""])[1]) or "EIT"
        ok, final, why = C.verify(url, title, cache, trusted="eit.europa.eu")
        if not ok:
            stats["linkNotVerified"] += 1; continue
        d = C.cached_fields(url, cache, details) or {}
        out.append(C.record(
            id="EIT-" + url.rstrip("/").split("/")[-1][:90], title=title, callTitle=kic, url=final, urlVerified=why,
            dl=[dl], callStatus="forthcoming" if sd and sd > today else "open", opens=sd,
            description=d.get("desc", ""), conditions=d.get("body", "")[:3000],
            prog="EIT", progName="European Institute of Innovation and Technology (EIT)", progShort="EIT",
            countries={"eligible": None, "complete": False, "quote": ""}, organiser=kic,
            sectors=["innovation"], typeHint="prize" if re.search(r"\bprize|award", title, re.I) else None,
            source=KEY, sourceName=NAME,
        ))
        stats["published"] += 1
    return out, stats
