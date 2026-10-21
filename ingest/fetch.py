"""Fetch open EU grant topics from the EU Funding & Tenders Portal.

Output: ingest/raw.json in the format build.py reads.

Sources
- Search API:  POST https://api.tech.ec.europa.eu/search-api/prod/rest/search?apiKey=SEDIA&text=***
               (multipart form with JSON parts: query, languages, sort)
- Facet API:   POST .../rest/facet  (programme and division names)
- Topic JSON:  GET  https://ec.europa.eu/info/funding-tenders/opportunities/data/topicDetails/<id>.json

Only grant topics (type 1) are kept. Calls run by EU-funded projects (type 8) and EU external
action calls (type 2) are counted but not published: their links could not be verified as
call-specific.

A topic's details are fetched again only when the search result checksum (esST_checksum)
changes or the topic is new. Everything else comes from ingest/state.json.
"""
import json, os, re, sys, time, html, datetime
from concurrent.futures import ThreadPoolExecutor
from zoneinfo import ZoneInfo
import requests

HERE = os.path.dirname(os.path.abspath(__file__))
SEARCH = "https://api.tech.ec.europa.eu/search-api/prod/rest/search"
FACET = "https://api.tech.ec.europa.eu/search-api/prod/rest/facet"
TOPIC = "https://ec.europa.eu/info/funding-tenders/opportunities/data/topicDetails/{}.json"
STATUS_OPEN = "31094502"
STATUS_FORTHCOMING = "31094501"
BRU = ZoneInfo("Europe/Brussels")
UA = {"User-Agent": "eligiblecalls-ingest/1.0 (+https://github.com/; contact via repository)"}
S = requests.Session(); S.headers.update(UA)

RESTRICTION_RE = re.compile(r"[^.]*(limited to legal entities|participation is limited|restricted to|22\(5\)|22\(6\)|12\(5\)|12\(6\)|Participating States|only legal entities established)[^.]*", re.I)


def form(query, sort=True):
    parts = {
        "query": ("blob", json.dumps(query), "application/json"),
        "languages": ("blob", json.dumps(["en"]), "application/json"),
    }
    if sort:
        # identifier gives a stable order across pages (sortStatus ties made pages overlap and skip calls)
        parts["sort"] = ("blob", json.dumps({"field": "identifier", "order": "ASC"}), "application/json")
    return parts


def post(url, params, files, tries=4):
    for i in range(tries):
        try:
            r = S.post(url, params=params, files=files, timeout=60)
            if r.status_code == 200:
                return r.json()
            print(f"  HTTP {r.status_code} from {url}", file=sys.stderr)
        except requests.RequestException as e:
            print(f"  {e}", file=sys.stderr)
        time.sleep(3 * (i + 1))
    raise SystemExit(f"Giving up on {url}")


def search_all(types=("1", "2", "8"), status=STATUS_OPEN, tag="open"):
    """All results for the query. Pages can still overlap where identifiers tie (calls by EU-funded projects
    share their topic's identifier), so the listing is repeated (at most 4 passes) until every result in
    totalResults has been seen."""
    q = {"bool": {"must": [{"terms": {"type": list(types)}}, {"terms": {"status": [status]}}]}}
    seen = {}
    total = None
    for _ in range(4):
        page = 1
        while True:
            j = post(SEARCH, {"apiKey": "SEDIA", "text": "***", "pageSize": 100, "pageNumber": page}, form(q))
            total = j.get("totalResults", total)
            res = j.get("results") or []
            for r in res:
                k = (r.get("reference"), f1(r.get("metadata") or {}, "identifier"), f1(r.get("metadata") or {}, "type"))
                seen.setdefault(k, dict(r, _status=tag))
            if len(res) < 100 or page >= 30:
                break
            page += 1
        if total is None or len(seen) >= total:
            break
    if total and len(seen) < total:
        print(f"  search {tag} types {types}: {len(seen)} of {total} results after 4 passes", file=sys.stderr)
    return list(seen.values())


def facet_names():
    names = {}
    for types in (["0", "1", "2", "8"], ["1"]):
        q = {"bool": {"must": [{"terms": {"type": types}}, {"terms": {"status": [STATUS_OPEN]}}]}}
        j = post(FACET, {"apiKey": "SEDIA", "text": "***"}, form(q, sort=False))
        for f in j.get("facets") or []:
            for v in f.get("values") or []:
                names[f"{f['name']}:{v['rawValue']}"] = v["value"]
    return names


def strip(h):
    s = str(h or "")
    s = re.sub(r"<br\s*/?>", "\n", s, flags=re.I)
    s = re.sub(r"</(p|li|h\d|div|tr)>", "\n", s, flags=re.I)
    s = re.sub(r"<li[^>]*>", "- ", s, flags=re.I)
    s = re.sub(r"<[^>]+>", " ", s)
    s = html.unescape(s)
    s = re.sub(r"[ \t]+", " ", s)
    s = re.sub(r"\n\s*\n+", "\n", s)
    return s.strip()


def f1(m, k):
    v = m.get(k)
    return v[0] if isinstance(v, list) and v else None


def topic_details(tid):
    for i in range(3):
        try:
            r = S.get(TOPIC.format(tid.lower()), timeout=30)
            if r.status_code == 404:
                return {"exists": False, "http": 404}
            if r.status_code == 200:
                td = r.json().get("TopicDetails") or {}
                acts = td.get("actions") or []
                planned = [a.get("plannedOpeningDate") for a in acts if a.get("plannedOpeningDate")]
                return {"exists": True,
                        "actionStatus": [(a.get("status") or {}).get("abbreviation") for a in acts],
                        "deadlinesMs": [d for a in acts for d in (a.get("deadlineDates") or [])],
                        "plannedOpeningMs": min(planned) if planned else None}
        except (requests.RequestException, ValueError):
            pass
        time.sleep(2 * (i + 1))
    return {"exists": False, "error": "unreachable"}


def to_date(v):
    s = str(v)
    if re.fullmatch(r"\d{10,}", s):
        return datetime.datetime.fromtimestamp(int(s) / 1000, datetime.timezone.utc).strftime("%Y-%m-%d")
    if re.match(r"\d{4}-\d\d-\d\d", s):
        return s[:10]
    return None


def deadline_instant(d):
    y, m, dd = map(int, d.split("-"))
    return datetime.datetime(y, m, dd, 17, 0, tzinfo=BRU)


def main():
    now = datetime.datetime.now(datetime.timezone.utc)
    state_path = os.path.join(HERE, "state.json")
    state = json.load(open(state_path, encoding="utf-8")) if os.path.exists(state_path) else {"topics": {}}

    rows_open = search_all()
    # Calls announced but not yet open for submission (grant topics only).
    rows_soon = search_all(types=("1",), status=STATUS_FORTHCOMING, tag="forthcoming")
    rows = rows_open + rows_soon
    names = facet_names()
    print(f"search rows: {len(rows_open)} open, {len(rows_soon)} forthcoming")

    seen, by_type, recs = set(), {}, []
    for r in rows:
        m = r.get("metadata") or {}
        tid = f1(m, "identifier") or r.get("reference")
        t = f1(m, "type")
        key = f"{t}|{tid}"
        if key in seen:
            continue
        seen.add(key)
        if r.get("_status") == "open":
            by_type[t] = by_type.get(t, 0) + 1
        if t != "1":
            continue
        budget = None
        try:
            bo = json.loads(f1(m, "budgetOverview") or "{}")
            ents = [e for a in (bo.get("budgetTopicActionMap") or {}).values() for e in a
                    if str(e.get("action", "")).startswith(tid + " ") or str(e.get("action", "")) == tid]
            if ents:
                budget = {"total": sum(sum(float(x or 0) for x in (e.get("budgetYearMap") or {}).values()) for e in ents),
                          "grants": next((e.get("expectedGrants") for e in ents if e.get("expectedGrants") is not None), None),
                          "min": max(float(e.get("minContribution") or 0) for e in ents),
                          "max": max(float(e.get("maxContribution") or 0) for e in ents)}
        except ValueError:
            pass
        try:
            actions = json.loads(f1(m, "actions") or "[]")
        except ValueError:
            actions = []
        cond_full = strip(f1(m, "topicConditions"))
        desc_full = strip(f1(m, "descriptionByte"))
        recs.append({
            "id": tid, "type": t, "title": f1(m, "title"), "callId": f1(m, "callIdentifier"), "callTitle": f1(m, "callTitle"),
            "fp": f1(m, "frameworkProgramme"), "fpName": names.get("frameworkProgramme:" + str(f1(m, "frameworkProgramme"))),
            "divNames": [names.get("programmeDivision:" + d, d) for d in (m.get("programmeDivision") or [])],
            "url": f1(m, "url") or r.get("url"), "deadlines": m.get("deadlineDate") or [], "start": f1(m, "startDate"),
            "model": f1(m, "deadlineModel"), "actionTypes": [x.get("typeOfAction") for a in actions for x in (a.get("types") or [])],
            "budget": budget, "budgetPlain": None, "currency": None, "keywords": m.get("keywords") or [], "tags": m.get("tags") or [],
            "geo": None, "geoNames": [], "cascade": None,
            "conditions": cond_full[:6000], "description": desc_full[:4000], "condLen": len(cond_full), "descLen": len(desc_full),
            "restrictionHits": sorted({x.group(0).strip()[:500] for x in RESTRICTION_RE.finditer(cond_full + " " + desc_full)}),
            "checksum": f1(m, "esST_checksum"), "searchStatus": r.get("_status", "open"),
        })

    # topic details: only for new topics or changed checksums
    def stale(x):
        st = state["topics"].get(x["id"]) or {}
        if st.get("checksum") != x["checksum"]:
            return True
        a = st.get("audit") or {}
        # a forthcoming topic whose planned opening has passed: check whether it is open now
        return "Forthcoming" in (a.get("actionStatus") or []) and float(a.get("plannedOpeningMs") or 0) <= now.timestamp() * 1000  # stored as a string of milliseconds
    todo = [x for x in recs if stale(x)]
    print(f"grant topics: {len(recs)}, details to (re)fetch: {len(todo)}")
    with ThreadPoolExecutor(max_workers=6) as ex:
        for x, audit in zip(todo, ex.map(lambda x: topic_details(x["id"]), todo)):
            state["topics"][x["id"]] = {"checksum": x["checksum"], "audit": audit, "fetched": now.isoformat()}

    kept, past, broken, soon = [], 0, 0, 0
    for x in recs:
        audit = (state["topics"].get(x["id"]) or {}).get("audit") or {"exists": False}
        x["audit"] = audit
        if not audit.get("exists"):
            broken += 1
            continue
        dl = sorted({d for d in (to_date(v) for v in audit.get("deadlinesMs") or []) if d})
        x["dl"] = dl
        x["next"] = next((d for d in dl if deadline_instant(d) > now), None)
        acts = audit.get("actionStatus") or []
        # the topic page decides the status, not the search index
        x["callStatus"] = "open" if "Open" in acts else "forthcoming" if "Forthcoming" in acts else None
        x["opens"] = to_date(audit["plannedOpeningMs"]) if x["callStatus"] == "forthcoming" and audit.get("plannedOpeningMs") else None
        if x["next"] and x["callStatus"]:
            kept.append(x)
            soon += x["callStatus"] == "forthcoming"
        else:
            past += 1

    # forget topics that left the search results
    live = {x["id"] for x in recs}
    state["topics"] = {k: v for k, v in state["topics"].items() if k in live}
    json.dump(state, open(state_path, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))

    out = {"fetchedAt": now.strftime("%Y-%m-%dT%H:%M:%S.000Z"),
           "source": "EU Funding & Tenders Portal search API (SEDIA) + topicDetails JSON",
           "query": "type 1,2,8 with status 31094502 (Open for submission); type 1 with status 31094501 (Forthcoming)",
           "deadlineRule": "Grant topic deadlines are 17:00:00 Brussels time on the listed date (as rendered by the Portal topic page)",
           "counts": {"searchResults": len(rows), "unique": len(seen), "uniqueByType": by_type, "kept": len(kept), "keptForthcoming": soon,
                      "grantTopicsPast": past, "topicPageMissing": broken},
           "records": kept}
    json.dump(out, open(os.path.join(HERE, "raw.json"), "w", encoding="utf-8"), ensure_ascii=False)
    print(json.dumps(out["counts"]))
    if len(kept) - soon < 20:
        raise SystemExit("Fewer than 20 open topics: refusing to publish (possible API problem).")


if __name__ == "__main__":
    main()
