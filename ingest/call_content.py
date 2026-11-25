"""What each call asks for, read from its official documents.

Writes site/org/doc/<call id>.json for every EU Funding & Tenders Portal topic:
  {"kind": "document" | "topic", "title", "version", "published", "url", "checked", "sections": [{"h": heading, "t": text}]}

- Topics with a call document (CERV, Creative Europe, Digital Europe, CEF, EDF, Erasmus+ centralised, LIFE, ...):
  the content sections of the call document (PDF): background, objectives, themes and priorities, activities that
  can be funded, expected impact, available budget, timetable, and the funding rate, duration and grant size from the
  legal and financial set-up. When one document covers several topics, the part about this topic is kept.
- Other Portal topics (Horizon Europe and the rest): the topic's full description from the Portal (expected outcome,
  scope), which the call list keeps only in part.

Eligibility and award criteria are read by eligibility_docs.py and award_criteria.py; this script reads the rest.
The files are copied into the per-call files (call_files.py) and used by the project generator, the application
writer and the evaluation (src/org/calldoc.js).

robots.txt is respected. A document is fetched again after 14 days, or when its address changes. A run stops fetching
after RUN_MINUTES (default 20) and goes on in the next refresh.

    python ingest/call_content.py
"""
import datetime
import html
import json
import os
import re
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import award_criteria as A        # fetching, PDF text, Portal links, page furniture
import eligibility_docs as E      # robots.txt check and PDF download

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
CALLS = os.path.join(ROOT, "site", "data", "calls.json")
OUT = os.path.join(ROOT, "site", "org", "doc")
NOW = A.NOW
REFETCH_DAYS = 14
RUN_MINUTES = float(os.environ.get("RUN_MINUTES", "20"))
MAX_TOTAL = 16000          # characters kept per call
SAFE = re.compile(r"[^A-Za-z0-9._-]")

# Content sections of a standard EU call document, by heading, with the characters kept from each.
KEEP = [
    (re.compile(r"^Background\b", re.I), "background", 2500),
    (re.compile(r"^(Objectives?|Themes?|Priorities|Scope)\b", re.I), "objectives", 12000),
    (re.compile(r"^Available budget\b", re.I), "budget", 1500),
    (re.compile(r"^Timetable\b", re.I), "timetable", 1200),
    (re.compile(r"^Legal and financial set-?up\b", re.I), "legal", 2500),
]
# From the legal and financial set-up only the paragraphs about the grant itself.
LEGAL_KEEP = re.compile(r"funding rate|reimburse|lump sum|unit cost|maximum (?:grant|amount|EU contribution)|grant (?:amount|size)|duration|"
                        r"starting date|co-?financ|budget categor|financial support to third parties|EUR\s?[\d ]{4,}|% of", re.I)


def file_name(cid):
    return SAFE.sub("_", cid) + ".json"


def old_enough(iso):
    try:
        return (NOW - datetime.datetime.fromisoformat(iso)).days >= REFETCH_DAYS
    except (TypeError, ValueError):
        return True


def drop_footnotes(page):
    """Footnotes at the foot of a page: from the first line that is only a footnote number followed by text."""
    ls = page.split("\n")
    for i in range(len(ls) // 3, len(ls) - 1):
        if re.match(r"^\s{0,6}\d{1,3}\s*$", ls[i]) and ls[i + 1].strip() and not re.match(r"^\s*\d", ls[i + 1]):
            return "\n".join(ls[:i])
    return page


def clean_text(raw):
    pages = [drop_footnotes(A.drop_page_furniture(pg)) for pg in raw.split("\f")]
    t = "\n".join(pages)
    t = re.sub(r"^\s*Call:\s.*$\n?(^\s{0,4}\S.*\(financial support to third parties\)\s*$\n?)?", "", t, flags=re.M)
    t = re.sub(r"^\s*EU Grants\s*:\s*Call document.*$", "", t, flags=re.M)
    t = re.sub(r"(?<=[a-z,;)])(\d{1,3})(?=[\s.,;:])", "", t)           # footnote markers after words
    return t


def paragraphs(text):
    """Text as paragraphs: lines joined, hyphenated breaks mended, bullets kept on their own lines."""
    out, cur = [], []
    for line in text.split("\n"):
        s = line.strip()
        if not s:
            if cur:
                out.append(" ".join(cur)); cur = []
            continue
        if re.match(r"^([−\-•▪◦●o–]|\d{1,2}[.)]|[a-z][.)]|\([a-z0-9]+\))\s+", s) and cur:
            out.append(" ".join(cur)); cur = []
        if cur and cur[-1].endswith("-") and s[:1].islower():
            cur[-1] = cur[-1][:-1] + s
        else:
            cur.append(s)
    if cur:
        out.append(" ".join(cur))
    return [re.sub(r"\s+", " ", re.sub(r"^[−•▪◦●–]\s+", "- ", p)).strip() for p in out if len(p.strip()) > 2]


def numbered_sections(text):
    """Top-level numbered sections ("2. Objectives — ..."). The table of contents names them; each is then found as a
    heading after it, so numbered lists inside a section (topics, priorities) are not taken for sections."""
    toc = []
    for m in re.finditer(r"^\s*(\d{1,2})\.\s+(\S[^\n]*?)\s*\.{5,}\s*\d+\s*$", text, re.M):
        toc.append((int(m.group(1)), A.norm(m.group(2)), m.end()))
    if toc:   # an entry that wraps keeps its dot leader on a later line: find its first line in the contents
        have, end = {n for n, _, _ in toc}, toc[-1][2]
        for n in range(min(have), max(have)):
            if n not in have:
                m = re.search(r"^\s*%d\.\s+(\S[^\n]*)$" % n, text[:end], re.M)
                if m:
                    toc.append((n, A.norm(re.sub(r"\s*\.{5,}\s*\d+\s*$", "", m.group(1))), m.end()))
        toc.sort(key=lambda x: x[0])
        toc = [(n, t, end) if i == len(toc) - 1 else (n, t, p) for i, (n, t, p) in enumerate(toc)]
    heads = []
    if len(toc) >= 4:
        pos = toc[-1][2]
        for n, title, _ in toc:
            key = re.escape(title[:18]).replace("\\ ", "\\s+")
            m = re.compile(r"^\s{0,3}%d\.\s+%s[^\n]*$" % (n, key), re.M).search(text, pos)
            if m:
                heads.append((n, A.norm(m.group(0)).split(". ", 1)[1], m.start(), m.end()))
                pos = m.end()
    else:
        want = None
        for m in re.finditer(r"^\s{0,3}(\d{1,2})\.\s+([A-Z][^\n]{2,120})$", text, re.M):
            n, title = int(m.group(1)), m.group(2).strip()
            if re.match(r"^[A-Z0-9]+-\d{4}-", title):
                continue
            if want is None or n == want:
                heads.append((n, title, m.start(), m.end())); want = n + 1
    sections = []
    for i, (n, title, a, b) in enumerate(heads):
        end = heads[i + 1][2] if i + 1 < len(heads) else len(text)
        body = text[b:end]
        for _ in range(3):                                   # a heading that wraps onto the next lines
            m = re.match(r"\s*\n\s*([^\n]{2,120})\n", body)
            if not (m and (re.search(r"[—–-]\s*$", title) or re.match(r"\S.*\s[—–]\s", m.group(1)))):
                break
            title, body = title + " " + m.group(1).strip(), body[m.end():]
        sections.append((title, body))
    return sections


def topic_part(paras, cid, siblings):
    """When the section speaks of several topics, the general part and the part about this topic."""
    def has(p, x):   # a topic code may be broken after a hyphen ("...-CYBER-11- REGCABH")
        return re.search(r"(?<![A-Z0-9-])" + re.escape(x) + r"(?![A-Z0-9-])", re.sub(r"(?<=[A-Z0-9])-\s+(?=[A-Z0-9])", "-", p)) is not None
    others = [s for s in siblings if s != cid]
    if not others or not any(has(p, cid) for p in paras):
        return paras
    first = next((i for i, p in enumerate(paras) if any(has(p, x) for x in siblings)), None)
    # the part for all topics comes first, shortened so that this topic's own part fits
    keep = clip_paras(paras[:first], 3500) if first else []
    on = False
    for p in paras[first or 0:]:
        mine, theirs = has(p, cid), any(has(p, x) for x in others)
        if mine and not theirs:
            on = True
        elif theirs and not mine:
            on = False
        if on or (mine and theirs):
            keep.append(p)
    return keep


def clip_paras(paras, n):
    out, size = [], 0
    for p in paras:
        if size + len(p) > n:
            if not out:
                out.append(p[:n].rsplit(" ", 1)[0] + "…")
            break
        out.append(p); size += len(p) + 1
    return out


def document_sections(raw, cid, siblings):
    text = clean_text(raw)
    found = []
    for title, body in numbered_sections(text):
        name = re.split(r"\s+[—–-]\s+", title)[0].strip()
        for rx, kind, n in KEEP:
            # the objectives section can start with another item ("Type of action and funding rate — Objectives — ...")
            if rx.search(name) or (kind == "objectives" and re.search(r"[—–-]\s*(Objectives?|Scope|Themes?)\b", title)):
                paras = paragraphs(body)
                if kind == "objectives":
                    paras = topic_part(paras, cid, siblings)
                if kind == "legal":
                    paras = [p for p in paras if LEGAL_KEEP.search(p)]
                paras = clip_paras(paras, n)
                if paras:
                    found.append({"h": A.norm(title)[:160], "t": "\n".join(paras), "kind": kind})
                break
    total, out = 0, []
    for s in found:                                         # the whole call within MAX_TOTAL, objectives first in priority
        room = MAX_TOTAL - total
        if room < 300:
            break
        if len(s["t"]) > room:
            s["t"] = s["t"][:room].rsplit("\n", 1)[0]
        out.append(s); total += len(s["t"])
    return out


def strip_html(h):
    h = re.sub(r"<(br|/p|/li|/h\d|/div)[^>]*>", "\n", h or "", flags=re.I)
    h = re.sub(r"<li[^>]*>", "\n- ", h, flags=re.I)
    t = html.unescape(re.sub(r"<[^>]+>", " ", h))
    return "\n".join(re.sub(r"[ \t\xa0]+", " ", l).strip() for l in t.split("\n") if l.strip())


def topic_sections(td):
    """The topic's own description on the Portal, split at its headings (Expected Outcome, Scope, ...)."""
    text = strip_html(td.get("description") or "")
    if len(text) < 200:
        return []
    out, cur = [], {"h": "Topic description", "t": []}
    for line in text.split("\n"):
        if re.match(r"^(Expected Outcomes?|Scope|Objective|Expected Impact|Specific conditions|Background|Activities)\s*:?\s*$", line, re.I):
            if cur["t"]:
                out.append(cur)
            cur = {"h": line.rstrip(":"), "t": []}
        else:
            cur["t"].append(line)
    if cur["t"]:
        out.append(cur)
    res, total = [], 0
    for s in out:
        t = "\n".join(s["t"])[: max(0, MAX_TOTAL - total)]
        if t:
            res.append({"h": s["h"], "t": t, "kind": "topic"}); total += len(t)
    return res


def topic_details(cid):
    r = A.get(A.TOPIC.format(cid.lower()))
    if not r:
        return None
    try:
        return r.json().get("TopicDetails") or {}
    except ValueError:
        return None


def main():
    data = json.load(open(CALLS, encoding="utf-8"))
    os.makedirs(OUT, exist_ok=True)
    start = time.time()
    by_call = {}
    for c in data["calls"]:
        by_call.setdefault(c.get("callId") or "", []).append(c["id"])
    keep, counts, docs = set(), {}, {}
    stopped = False
    for c in data["calls"]:
        cid, url = c["id"], c.get("url") or ""
        if "/topic-details/" not in url:
            continue
        name = file_name(cid)
        keep.add(name)
        path = os.path.join(OUT, name)
        prev = None
        if os.path.exists(path):
            try:
                prev = json.load(open(path, encoding="utf-8"))
            except (ValueError, OSError):
                prev = None
        if prev and not old_enough(prev.get("checked")):
            counts["kept"] = counts.get("kept", 0) + 1
            continue
        if time.time() - start > RUN_MINUTES * 60:
            stopped = True
            continue
        links = A.portal_links(cid)
        doc = links and links.get("doc")
        entry = None
        if doc and c.get("programme") != "HORIZON":
            if doc not in docs:
                docs[doc] = E.fetch_pdf(doc)
            raw, why = docs[doc]
            secs = document_sections(raw, cid, by_call.get(c.get("callId") or "", [cid])) if raw else []
            if secs:
                meta = E.doc_meta(raw)
                entry = {"kind": "document", "title": meta.get("title") or "Call document", "version": meta.get("version"),
                         "published": meta.get("published"), "url": doc, "sections": secs}
        if entry is None:
            td = topic_details(cid)
            secs = topic_sections(td) if td else []
            if secs:
                entry = {"kind": "topic", "title": "Topic description (EU Funding & Tenders Portal)", "url": url, "sections": secs}
        if entry is None:
            entry = {"kind": "none", "url": doc or url, "sections": []}
        entry["checked"] = NOW.isoformat(timespec="seconds")
        counts[entry["kind"]] = counts.get(entry["kind"], 0) + 1
        body = json.dumps(entry, ensure_ascii=False, separators=(",", ":"))
        with open(path, "w", encoding="utf-8") as f:
            f.write(body)
    removed = 0
    for name in os.listdir(OUT):
        if name.endswith(".json") and name not in keep:
            os.remove(os.path.join(OUT, name)); removed += 1
    print(f"call_content: {counts}, {len(docs)} call documents read, {removed} removed" + (", stopped at the time limit" if stopped else ""))
    return 0


if __name__ == "__main__":
    sys.exit(main())
