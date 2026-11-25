"""Writes one small file per call: site/org/call/<call id>.json.

Each file holds what the organisation features need about one call: the call's record from site/data/index.json, the
country list its eligibility codes refer to, its award criteria (site/org/criteria.json, with the framework a Horizon
Europe call points to), its application form (site/org/forms.json), its official eligibility entry
(site/org/eligibility.json) and the content of its call document or full topic description (site/org/doc, written by
call_content.py).

Why: the server functions run on Cloudflare's free plan, which stops a request after 10 ms of CPU. Parsing the full
index (1.2 MB) takes about 50 ms on a fresh server instance, and the criteria and forms files (0.5 MB each) about 25 ms
each, so writing, evaluating or explaining an application failed after every deploy. A call file is a few kilobytes.

Run after build.py, award_criteria.py, eligibility_docs.py, app_forms.py and call_content.py. Files of calls no longer in the index are
removed. A file is rewritten only when its content changed, so unchanged calls make no commit.
"""
import json
import os
import re
import sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
SITE = os.path.join(ROOT, "site")
OUT = os.path.join(SITE, "org", "call")
SAFE = re.compile(r"[^A-Za-z0-9._-]")
READY = "_ready.json"


def file_name(call_id):
    """Same rule as callFileName in src/org/callfile.js."""
    return SAFE.sub("_", call_id) + ".json"


def load(rel, default=None):
    try:
        with open(os.path.join(SITE, rel), encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return default


def call_file(c, index, crit, forms, elig):
    cid = c["id"]
    out = {
        "countries": index.get("countries", []),
        "countryNames": index.get("countryNames", {}),
        "call": c,
        "crit": None,
        "forms": None,
        "elig": None,
    }
    e = (crit.get("calls") or {}).get(cid) if crit else None
    if e:
        fws = {}
        if e.get("kind") == "framework" and e.get("framework") in (crit.get("frameworks") or {}):
            fws[e["framework"]] = crit["frameworks"][e["framework"]]
        out["crit"] = {"calls": {cid: e}, "frameworks": fws}
    fc = (forms.get("calls") or {}).get(cid) if forms else None
    if fc:
        # templateFor (site/org/templates.js) uses a form only when the topic page links at most 4; a page listing
        # every Horizon Europe template is a general list, and its form texts are not needed.
        names = fc.get("forms", [])
        files = {f: forms["forms"][f] for f in names if f in (forms.get("forms") or {})} if len(names) <= 4 else {}
        out["forms"] = {"calls": {cid: fc}, "forms": files}
    doc = load(os.path.join("org", "doc", file_name(cid)))   # ingest/call_content.py
    if doc and doc.get("sections"):
        out["doc"] = {k: doc.get(k) for k in ("kind", "title", "version", "published", "url", "sections")}
    el = (elig.get("calls") or {}).get(cid) if elig else None
    if el:
        out["elig"] = {"calls": {cid: el}, "frameworks": elig.get("frameworks") or {}}
    return out


def main():
    index = load("data/index.json")
    if not index or not index.get("calls"):
        print("call_files: no index, nothing written", file=sys.stderr)
        return 1
    crit = load("org/criteria.json", {})
    forms = load("org/forms.json", {})
    elig = load("org/eligibility.json", {})
    os.makedirs(OUT, exist_ok=True)
    keep, written = set(), 0
    for c in index["calls"]:
        name = file_name(c["id"])
        keep.add(name)
        body = json.dumps(call_file(c, index, crit, forms, elig), ensure_ascii=False, separators=(",", ":"))
        path = os.path.join(OUT, name)
        try:
            with open(path, encoding="utf-8") as f:
                if f.read() == body:
                    continue
        except OSError:
            pass
        with open(path, "w", encoding="utf-8") as f:
            f.write(body)
        written += 1
    # Tells the server that the call files exist: a call without a file is then not in the published data, and the
    # server does not fall back to the full files (src/org/callfile.js).
    keep.add(READY)
    with open(os.path.join(OUT, READY), "w", encoding="utf-8") as f:
        f.write(json.dumps({"calls": len(index["calls"])}))
    removed = 0
    for name in os.listdir(OUT):
        if name.endswith(".json") and name not in keep:
            os.remove(os.path.join(OUT, name))
            removed += 1
    print(f"call_files: {len(keep)} calls, {written} written, {removed} removed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
