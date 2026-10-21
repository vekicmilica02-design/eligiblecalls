"""UK Research and Innovation funding opportunities (ukri.org Funding Finder).

Source: https://www.ukri.org/opportunity/?filter_status[]=open&filter_status[]=upcoming (WordPress HTML,
labelled fields: status, funders, funding type, total fund, maximum award, opening and closing date with
UK time). Each opportunity has its own page on ukri.org; its "Who can apply" section is quoted for
eligibility. Invitation-only opportunities are not published.
"""
import datetime, os, re, sys
from . import common as C
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import deadlines as D

KEY = "ukri"
NAME = "UKRI Funding Finder (ukri.org)"
LIST = "https://www.ukri.org/opportunity/{page}?filter_status%5B%5D=open&filter_status%5B%5D=upcoming"
MONTHS = {m: i for i, m in enumerate(["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"], 1)}


def uk_time(s):
    """'24 November 2026 4:00pm UK time' -> ('2026-11-24', '16:00')"""
    m = re.search(r"(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})(?:\s+(\d{1,2})(?::(\d\d))?\s*(am|pm))?", s or "")
    if not m or m.group(2).lower() not in MONTHS:
        return None, None
    d = f"{m.group(3)}-{MONTHS[m.group(2).lower()]:02d}-{int(m.group(1)):02d}"
    if not m.group(4):
        return d, None
    h = int(m.group(4)) % 12 + (12 if m.group(6) == "pm" else 0)
    return d, f"{h:02d}:{m.group(5) or '00'}"


def money(s):
    m = re.search(r"([\d,]+(?:\.\d+)?)", (s or "").replace("&pound;", "£"))
    return float(m.group(1).replace(",", "")) if m else None


def who(h):
    t = C.text_of(h)
    m = re.search(r"\n\s*Who can apply\s*\n(.*?)(?:\n\s*(?:What we're looking for|What we are looking for|How to apply|Funding available|What we will fund)\s*\n)", "\n" + t, re.S)
    return {"who": re.sub(r"\s+", " ", m.group(1)).strip()[:1500] if m else "", "desc": C.meta_description(h)}


def run(cache, fp_names):
    out, stats, seen = [], {"listed": 0, "inviteOnly": 0, "noFutureDeadline": 0, "published": 0}, set()
    for p in range(1, 40):
        r = C.get(LIST.format(page="" if p == 1 else f"page/{p}/"))
        if r is None or r.status_code != 200:
            if p == 1:
                raise RuntimeError("UKRI listing unavailable")
            break
        posts = re.split(r'<div id="post-\d+" class="post-\d+ opportunity ', r.text)[1:]
        if not posts:
            break
        new = 0
        for b in posts:
            m = re.search(r'<a class="ukri-funding-opp__link" href="([^"]+)"[^>]*>(.*?)</a>', b, re.S)
            if not m or m.group(1) in seen:
                continue
            url, title = m.group(1), C.text_of(m.group(2))
            seen.add(url); new += 1; stats["listed"] += 1
            if re.search(r"invite[- ]only|invitation only", title + url, re.I):
                stats["inviteOnly"] += 1; continue
            f = {C.text_of(dt).rstrip(": ").lower(): C.text_of(dd) for dt, dd in re.findall(r"<dt[^>]*>(.*?)</dt>\s*<dd[^>]*>(.*?)</dd>", b, re.S)}
            cd, ct = uk_time(f.get("closing date"))
            od, _ = uk_time(f.get("opening date"))
            if not cd:
                stats["noFutureDeadline"] += 1; continue
            dls = f"{cd}T{ct}|Europe/London" if ct else f"{cd}|~"
            if D.instant(dls) <= C.NOW:
                stats["noFutureDeadline"] += 1; continue
            summary = C.text_of((re.search(r'<div class="entry-content">(.*?)</div>', b, re.S) or [None, ""])[1])
            w = C.cached_fields(url, cache, who, hours=48) or {}
            wtxt = w.get("who", "")
            status = "forthcoming" if (f.get("opportunity status", "").lower() == "upcoming") else "open"
            total, mx = money(f.get("total fund")), money(f.get("maximum award"))
            el = {"eligible": ["GB"], "complete": bool(wtxt and re.search(r"\bUK\b|United Kingdom|standard eligibility", wtxt)), "ukri": True,
                  "norway": bool(re.search(r"Money Follows Cooperation", wtxt)), "quote": wtxt[:600]}
            if not wtxt:
                el = {"eligible": None, "complete": False, "quote": ""}
            ftype = f.get("funding type", "")
            out.append(C.record(
                id="UKRI-" + url.rstrip("/").split("/")[-1][:90], title=title, callTitle=f.get("funders"),
                url=url, urlVerified="ukri.org opportunity page", dl=[dls], callStatus=status, opens=od,
                budget={"total": total, "grants": None, "min": None, "max": mx} if (total or mx) else None, currency="GBP" if (total or mx) else None,
                description=summary[:2500], conditions=wtxt,
                prog="UKRI", progName="UK Research and Innovation (UKRI)", progShort="UKRI",
                countries=el, organiser=f.get("funders"), keywords=[x for x in [ftype] if x],
                typeHint={"grant": "grant", "studentship": "grant", "fellowship": "research-funding"}.get(ftype.lower(), None),
                sectors=None, applicants=None, source=KEY, sourceName=NAME,
            ))
            stats["published"] += 1
        if new == 0:
            break
    return out, stats
