"""Calls run by EU-funded projects (financial support to third parties, "cascade funding").

Source: EU Funding & Tenders Portal search API, type 8, status Open for submission.
The Portal address of these calls is shared by several calls of the same project, so it does not lead
to the specific call. Each record is published only when one of the organiser links quoted in the
Portal record opens a page that shows this call (common.verify).
"""
import datetime, json, re
from . import common as C

SEARCH = "https://api.tech.ec.europa.eu/search-api/prod/rest/search"
STATUS_OPEN = "31094502"
KEY = "cascade"
NAME = "EU Funding & Tenders Portal: calls by EU-funded projects (organiser page checked)"
LINK = re.compile(r"https?://[^\s\"'<>)\]]+")
SKIP_HOSTS = ("europa.eu", "bit.ly", "forms.gle", "docs.google.com/forms", "linkedin.com", "facebook.com", "twitter.com", "x.com/", "youtube.com", "instagram.com")


def f1(m, k):
    v = m.get(k)
    return v[0] if isinstance(v, list) and v else None


def search():
    """All open type-8 records. Several share one identifier, so pages can overlap; the listing is repeated
    (at most 4 passes) until totalResults records have been seen."""
    q = {"bool": {"must": [{"terms": {"type": ["8"]}}, {"terms": {"status": [STATUS_OPEN]}}]}}
    files = {"query": ("blob", json.dumps(q), "application/json"),
             "languages": ("blob", json.dumps(["en"]), "application/json"),
             "sort": ("blob", json.dumps({"order": "ASC", "field": "identifier"}), "application/json")}
    seen, total = {}, None
    for _ in range(4):
        for page in range(1, 11):
            r = C.S.post(SEARCH, params={"apiKey": "SEDIA", "text": "***", "pageSize": 100, "pageNumber": page}, files=files, timeout=60)
            r.raise_for_status()
            j = r.json(); total = j.get("totalResults", total)
            res = j.get("results") or []
            for x in res:
                seen.setdefault(x.get("reference") or json.dumps(x.get("metadata", {}).get("callccm2Id")), x)
            if len(res) < 100:
                break
        if total is None or len(seen) >= total:
            break
    return list(seen.values())


def run(cache, fp_names):
    from zoneinfo import ZoneInfo
    bru = ZoneInfo("Europe/Brussels")
    rows = search()
    out, seen, stats = [], set(), {"listed": len(rows), "noFutureDeadline": 0, "noOrganiserLink": 0, "linkNotVerified": 0, "published": 0}
    for r in rows:
        m = r.get("metadata") or {}
        cid = f1(m, "callccm2Id") or r.get("reference")
        if not cid or cid in seen:
            continue
        seen.add(cid)
        title = C.text_of(f1(m, "callTitle") or f1(m, "caName") or "").strip()
        dls = []
        for v in m.get("deadlineDate") or []:
            mm = re.match(r"(\d{4}-\d\d-\d\dT\d\d:\d\d)", str(v))
            if not mm:
                continue
            # The stored instant does not reliably carry the organiser's time zone, so only the date is used;
            # the organiser page has the exact time. "|~" = time not stated.
            d = mm.group(1)[:10]
            if datetime.datetime.fromisoformat(d + "T23:59").replace(tzinfo=bru) > C.NOW:
                dls.append(d + "|~")
        if not dls or not title:
            stats["noFutureDeadline"] += 1
            continue
        blob = " ".join(str(x) for k in ("furtherInformation", "beneficiaryAdministration", "destinationDetails", "duration", "description") for x in (m.get(k) or []))
        links = []
        for u in LINK.findall(blob):
            u = u.rstrip(".,;:")
            if any(h in u for h in SKIP_HOSTS) or u in links:
                continue
            links.append(u)
        if not links:
            stats["noOrganiserLink"] += 1
            continue
        links.sort(key=lambda u: -C.path_depth(u))  # deeper paths first: more likely the call page itself
        ok, url, why = False, None, ""
        for u in links[:4]:
            ok, url, why = C.verify(u, title, cache, extra_terms=[f1(m, "projectAcronym")])
            if ok:
                break
        if not ok:
            stats["linkNotVerified"] += 1
            continue
        start = f1(m, "startDate")
        opens = str(start)[:10] if start else None
        status = "forthcoming" if opens and opens > C.NOW.astimezone(bru).strftime("%Y-%m-%d") else "open"
        budget = f1(m, "budget")
        try:
            budget = float(budget) if budget else None
        except ValueError:
            budget = None
        fp = f1(m, "frameworkProgramme")
        out.append(C.record(
            id=f"FSTP-{cid}", type="8", title=title, callId=f1(m, "identifier"), callTitle=C.text_of(f1(m, "title")),
            fp=fp, fpName=fp_names.get(fp), url=url, urlVerified=why, dl=sorted(dls), callStatus=status, opens=opens,
            model=f1(m, "deadlineModel"), budgetPlain=budget, currency="EUR" if budget else None,
            description=C.text_of(f1(m, "description"))[:4000],
            conditions=C.text_of(" ".join(m.get("beneficiaryAdministration") or []))[:3000],
            cascade={"org": title, "project": f1(m, "projectAcronym"), "projectName": f1(m, "projectName"),
                     "furtherInfo": C.text_of(f1(m, "furtherInformation"))[:2000],
                     "howTo": C.text_of(f1(m, "beneficiaryAdministration"))[:2000]},
            source=KEY, sourceName=NAME,
        ))
        stats["published"] += 1
    return out, stats
