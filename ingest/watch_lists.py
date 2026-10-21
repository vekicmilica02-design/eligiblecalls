"""Check whether the Commission has published a new version of a list of participating countries.

Reads the list URL and version recorded in site/data/programmes.json, downloads each PDF,
and extracts its version line ("V4.1 – 16.09.2026"). Writes ingest/list_versions.md and exits
with code 3 if any version differs, so the workflow can open an issue. Eligibility data is
never changed automatically: a new list has to be read and encoded by hand in build.py.
"""
import io, json, os, re, sys
import requests
from pypdf import PdfReader

HERE = os.path.dirname(os.path.abspath(__file__))
progs = json.load(open(os.path.join(HERE, "..", "site", "data", "programmes.json"), encoding="utf-8"))["programmes"]
VER = re.compile(r"V\s?(\d+(?:\.\d+)?)\s*[–-]\s*(\d{2}\.\d{2}\.\d{4})")

def norm(v):
    m = VER.search(v or "")
    return f"V{m.group(1)} {m.group(2)}" if m else None

rows, changed, seen = [], [], set()
for p in progs:
    lst = p.get("list")
    if not lst or lst["url"] in seen:
        continue
    seen.add(lst["url"])
    want = norm(lst.get("version"))
    try:
        r = requests.get(lst["url"], timeout=60, headers={"User-Agent": "eligiblecalls-ingest/1.0"})
        r.raise_for_status()
        text = "\n".join((pg.extract_text() or "") for pg in PdfReader(io.BytesIO(r.content)).pages[:2])
        got = norm(text)
    except Exception as e:
        rows.append(f"- {p['id']}: could not check ({type(e).__name__})")
        continue
    if got and got != want:
        changed.append(p["id"])
        rows.append(f"- {p['id']}: NEW VERSION {got} (encoded: {want}) {lst['url']}")
    else:
        rows.append(f"- {p['id']}: {got or 'version line not found'} (encoded: {want})")

open(os.path.join(HERE, "list_versions.md"), "w", encoding="utf-8").write(
    "# Lists of participating countries\n\n" + "\n".join(rows) + "\n")
print("\n".join(rows))
sys.exit(3 if changed else 0)
