"""Application forms of the published calls, read from the official templates.

Writes site/org/forms.json (and the short site/org/forms-index.json for the browser), used by the full-application writer (src/org/proposal.js, site/org/templates.js):
- calls: for every EU Funding & Tenders Portal topic, the application form files its topic page links
  ("temp-form/af/af_<form>_en.pdf") and the page limit stated in its conditions;
- forms: for every linked form, the structure of its Part B (technical description): numbered headings and the
  guidance text under each, copied from the template, with the form's name, version and date from its own header.

Horizon Europe RIA/IA and CSA, and the Erasmus+ KA210/KA220 national-agency forms, are written by hand in
site/org/templates.js and are not parsed here. A form whose Part B cannot be read (no numbered headings found)
is recorded with "sections": [] and the writer falls back to the call's award criteria.

Topic pages are read once per call, form PDFs again after 14 days.

    python ingest/app_forms.py
"""
import datetime, json, os, re, subprocess, sys, tempfile
import requests

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
CALLS = os.path.join(ROOT, "site", "data", "calls.json")
OUT = os.path.join(ROOT, "site", "org", "forms.json")
LITE = os.path.join(ROOT, "site", "org", "forms-index.json")
TOPIC = "https://ec.europa.eu/info/funding-tenders/opportunities/data/topicDetails/{}.json"
UA = {"User-Agent": "eligiblecalls-ingest/1.0 (+https://eligiblecalls.pages.dev)"}
S = requests.Session(); S.headers.update(UA)
REFETCH_DAYS = 14
NOW = datetime.datetime.now(datetime.timezone.utc)
FORM_RE = re.compile(r"(https?://[^\"\\\s]*?/temp-form/af/(af_[a-z0-9\-]+_en\.pdf))")
# Hand-written templates (site/org/templates.js): not parsed.
HANDMADE = {"af_he-ria-ia_en.pdf", "af_he-csa_en.pdf", "af_he-ria-ia-stage-1_en.pdf"}


def old_enough(iso, days=REFETCH_DAYS):
    try:
        return (NOW - datetime.datetime.fromisoformat(iso)).days >= days
    except (TypeError, ValueError):
        return True


def links_in(text):
    """{form file: address} of the application forms a topic page links to."""
    return {f: u for u, f in FORM_RE.findall(text)}


def topic_forms(cid):
    """Application forms linked from the topic page ({file: address}), or None when the page cannot be read."""
    try:
        r = S.get(TOPIC.format(cid.lower()), timeout=30)
    except requests.RequestException:
        return None
    if r.status_code != 200:
        return None
    return links_in(r.text)


def page_limit(conditions):
    """The proposal page limit stated in the topic conditions ("70 pages as described in ..."), or None."""
    t = re.sub(r"\s+", " ", conditions or "")
    m = re.search(r"page limits?[^.]{0,160}?\b(\d{1,3})\s*pages", t, re.I) or re.search(r"\b(\d{1,3})\s*pages\b[^.]{0,80}(?:call document|part b|limit)", t, re.I)
    n = int(m.group(1)) if m else None
    return n if n and 3 <= n <= 200 else None


# ---------- reading a template ----------
NOISE_LINE = re.compile(r"^(?:Call: \[insert|EU Grants: Application form|Part B\s*-?\s*Page|Page \d+ of|Version of template|#[@§])", re.I)


def clean_lines(text):
    """Text lines of a template without page headers, processing tags and the diagonal 'Example, not to be
    completed' watermark (single letters and syllables at the end of a line or alone on a line)."""
    out = []
    for raw in text.split("\n"):
        line = re.sub(r"#[@§][A-Z\-]+[@§]#", " ", raw)
        line = re.sub(r"\s{4,}\S{1,4}\s*$", "", line.rstrip())                     # watermark at the end of a line
        line = re.sub(r"^\s*(?![\d(])\S{1,3}\s{8,}(?=\S)", "    ", line)               # watermark at the start of a line
        s = line.strip()
        if not s or NOISE_LINE.search(s):
            out.append("")
            continue
        toks = s.split()
        if all(len(t) <= 3 for t in toks) and len(s) < 24 and not re.match(r"^\d", s):
            out.append("")                                                         # a line of watermark syllables
            continue
        out.append(line)
    return out


HEAD = re.compile(r"^\s{0,8}(\d{1,2}(?:\.\d{1,2}){0,2})\.?\s{1,12}([A-Z][^\n]{2,150}?)\s*$")
TOC = re.compile(r"^\s*(?:(\d{1,2}(?:\.\d{1,2}){0,2})\.?\s+)?([A-Z][^.]{2,150}?)\s*\.{6,}\s*\d*\s*$")
STOP = re.compile(r"^(?:ANNEX|ANNEXES|DECLARATIONS|LIST OF PARTICIPANTS|END OF|STRUCTURE OF THE PROPOSAL|HISTORY OF CHANGES|Tables for section|Structure of the [Pp]roposal)\b")
ETHICS = re.compile(r"^(?:Human (?:Embryonic|embryonic|Cells|cells)|Humans$|Personal [Dd]ata|Animals$|Non-EU [Cc]ountries|Environment, [Hh]ealth|Artificial [Ii]ntelligence$|Other [Ee]thics|EU Classified|Misuse$|Other Security|Affiliated entit)")
SKIP_TITLES = re.compile(r"^(?:declarations?|annexes|cover page|table of contents|administrative forms|ethics(?: and security)?$|security$|other$)", re.I)


def header_of(text):
    m = re.search(r"Application form \(([^)]{2,60})\)\s*:\s*V\s?([\d.]+)\s*[–-]\s*(\d{2}\.\d{2}\.\d{4})", text)
    if not m:
        return None, None, None
    d, mo, y = m.group(3).split(".")
    return m.group(1).strip(), m.group(2), f"{y}-{mo}-{d}"


def part_b_start(lines):
    """Index of the line where the Part B template body starts (after Part A, the ethics and security tables and
    the table of contents)."""
    toc = [i for i, l in enumerate(lines) if TOC.match(l)]
    pb = [i for i, l in enumerate(lines) if re.match(r"^\s*(?:TECHNICAL DESCRIPTION \(PART B\)|Proposal template Part B)", l, re.I) and not TOC.match(l)]
    tocb = [i for i in toc if re.match(r"^\s*TECHNICAL DESCRIPTION \(PART B\)", lines[i], re.I)]
    if tocb:
        return tocb[-1]                     # EU Grants forms: the table of contents of Part B, then the body
    return pb[0] if pb else 0


def parse_form(text):
    """Part B structure: [{"n": "1.1", "title": "...", "level": 2, "ask": [paragraphs]}]."""
    form, version, date = header_of(text)
    lines = clean_lines(text)
    start = part_b_start(lines)
    toc = []
    for l in lines[start:]:
        m = TOC.match(l)
        if m and m.group(1):
            toc.append((m.group(1), re.sub(r"\s+", " ", m.group(2)).strip()))
    heads = []
    seen_top = 0
    for i in range(start, len(lines)):
        s = lines[i].strip()
        if not s or TOC.match(lines[i]):
            continue
        if STOP.match(s) and heads:
            heads.append((i, None, None)); break
        m = HEAD.match(lines[i])
        if not m:
            continue
        n, title = m.group(1), re.sub(r"\s+", " ", m.group(2)).strip()
        top = int(n.split(".")[0])
        if toc and not any(t[0] == n for t in toc):
            continue
        key = re.sub(r"\W+", " ", title.lower())[:30]
        if any(h[1] == n and re.sub(r"\W+", " ", (h[2] or "").lower())[:30] == key for h in heads):
            heads.append((i, None, None)); break                                 # a heading seen before: the closing summary
        if re.search(r"\b(?:Yes|No)\s*$", title) or re.match(r"^\d+\s", title):
            continue
        seen_top = max(seen_top, top)
        heads.append((i, n, title))
    if heads and heads[-1][1] is not None:
        heads.append((len(lines), None, None))
    sections = []
    for k in range(len(heads) - 1):
        i, n, title = heads[k]
        if n is None:
            continue
        j = heads[k + 1][0]
        # a heading wrapped over two lines: the next line continues it when the title ends without punctuation
        body = lines[i + 1:j]
        if body and body[0].strip() and title and not re.search(r"[.:?)\]]$", title) and len(body[0].strip()) < 90 and body[0].strip()[0].islower():
            title = title + " " + body[0].strip(); body = body[1:]
        title = re.sub(r"\s*\[e\.g\.[^\]]*\]?", "", title).strip()
        paras, cur = [], []
        for l in body:
            s = re.sub(r"\s+", " ", l).strip()
            if not s or s in ("Insert text", "[Insert text]") or re.match(r"^\[?(?:insert|text)\b", s, re.I):
                if cur: paras.append(" ".join(cur)); cur = []
                continue
            cur.append(s)
        if cur: paras.append(" ".join(cur))
        paras = [p for p in paras if len(p) > 25 and not re.match(r"^(?:Table|Work Package|Participant|No\.|Name|Description|Deliverable|Milestone)\b", p) and p.lower() != title.lower()]
        ask, total = [], 0
        for p in paras:
            if total > 2200: break
            ask.append(p[:900]); total += len(p[:900])
        level = n.count(".") + 1
        sections.append({"n": n, "title": title[:160], "level": level, "ask": ask})
    # keep the deepest headings that carry text; a top-level heading with sub-headings is a group title only
    ns = {s["n"] for s in sections}
    for s in sections:
        s["group"] = any(o.startswith(s["n"] + ".") for o in ns)
    sections = [s for s in sections if not SKIP_TITLES.match(s["title"]) and not ETHICS.match(s["title"])]
    # the same number twice means the reader picked up a list from Part A or the instructions: keep the last run
    seen, keep = set(), []
    for s in reversed(sections):
        if s["n"] in seen: break
        seen.add(s["n"]); keep.append(s)
    sections = [s for s in reversed(keep) if not ("?" in s["title"] or re.match(r"^(?:The|This|Please|Did|See|For|Some|No need|Are|Commission|In case|Hence)\b", s["title"]))]
    units = [s for s in sections if not s["group"]]
    usable = (len(units) >= 3 and sum(1 for s in units if s["ask"]) >= len(units) / 2 and units[0]["n"].split(".")[0] in ("0", "1"))
    return {"form": form, "version": version, "date": date, "pageLimit": form_page_limit(text), "usable": usable, "sections": sections if usable else []}


def form_page_limit(text):
    t = re.sub(r"\s+", " ", text)
    m = re.search(r"should not be longer than (\d{1,3}) pages", t) or re.search(r"page limit (?:normally |is )?(\d{1,3}) pages", t, re.I)
    return int(m.group(1)) if m else None


def pdf_text(content):
    with tempfile.NamedTemporaryFile(suffix=".pdf") as f:
        f.write(content); f.flush()
        r = subprocess.run(["pdftotext", "-layout", f.name, "-"], capture_output=True, timeout=120)
        return r.stdout.decode("utf-8", "replace") if r.returncode == 0 else ""


def main(offline_dir=None):
    data = json.load(open(CALLS, encoding="utf-8"))
    prev = {}
    if os.path.exists(OUT):
        try:
            prev = json.load(open(OUT, encoding="utf-8"))
        except (ValueError, OSError):
            prev = {}
    old_calls, old_forms = prev.get("calls", {}), prev.get("forms", {})
    calls, used, urls = {}, set(), {}
    for c in data["calls"]:
        cid, url = c["id"], c.get("url") or ""
        if "/topic-details/" not in url:
            continue
        p = old_calls.get(cid)
        if p is not None and "forms" in p:
            files = p["forms"]
        else:
            if offline_dir and os.path.exists(os.path.join(offline_dir, "topics", cid + ".json")):
                links = links_in(open(os.path.join(offline_dir, "topics", cid + ".json"), encoding="utf-8").read())
            else:
                links = topic_forms(cid)
            if links is None:
                continue
            urls.update(links)
            files = sorted(links)
        e = {"forms": files}
        lim = page_limit(c.get("conditions"))
        if lim: e["pageLimit"] = lim
        calls[cid] = e
        used.update(f for f in files if f not in HANDMADE)
    forms = {}
    for f in sorted(used):
        p = old_forms.get(f)
        if p and not old_enough(p.get("fetched")):
            forms[f] = p; continue
        url = urls.get(f) or (p and p.get("url")) or "https://ec.europa.eu/info/funding-tenders/opportunities/docs/2021-2027/" + ("horizon" if f.startswith("af_he-") else f[3:].split("-")[0].split("_")[0]) + "/temp-form/af/" + f
        text = None
        if offline_dir and os.path.exists(os.path.join(offline_dir, "forms", f[:-4] + ".txt")):
            text = open(os.path.join(offline_dir, "forms", f[:-4] + ".txt"), encoding="utf-8").read()
        else:
            for u in [url] + [x for x in [p and p.get("url")] if x]:
                try:
                    r = S.get(u, timeout=60)
                    if r.status_code == 200 and r.content[:4] == b"%PDF":
                        text = pdf_text(r.content); url = u; break
                except requests.RequestException:
                    pass
        if not text:
            if p: forms[f] = p
            continue
        forms[f] = {"url": url, "fetched": NOW.isoformat(timespec="seconds"), **parse_form(text)}
    out = {"generated": NOW.isoformat(timespec="seconds"), "calls": calls, "forms": forms}
    strip = lambda o: {k: ({kk: {x: y for x, y in vv.items() if x != "fetched"} for kk, vv in v.items()} if k == "forms" else v) for k, v in o.items() if k != "generated"}
    if prev and strip(prev) == strip(out):
        print("Application forms unchanged.")
        return
    tmp = OUT + ".tmp"
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(out, fh, ensure_ascii=False, separators=(",", ":"))
    os.replace(tmp, OUT)
    # The browser needs only which form a call uses and its name (the structure travels inside each draft).
    lite = {"generated": out["generated"], "calls": calls,
            "forms": {k: {x: v.get(x) for x in ("form", "version", "date", "url", "pageLimit", "usable")} for k, v in forms.items()}}
    with open(LITE + ".tmp", "w", encoding="utf-8") as fh:
        json.dump(lite, fh, ensure_ascii=False, separators=(",", ":"))
    os.replace(LITE + ".tmp", LITE)
    print(f"{len(calls)} portal calls, {len(forms)} parsed forms, {sum(1 for f in forms.values() if not f.get('sections'))} without readable sections")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else None)
