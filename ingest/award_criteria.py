"""Evaluation criteria for the published calls, from the official documents.

Writes site/org/criteria.json, read by the "Evaluation guidelines" page and the detailed match report.

Sources, by call:
- Horizon Europe topics (RIA, IA, CSA, CoFund, PCP/PPI, FPA): General Annex D of the Horizon Europe Work
  Programme 2026-2027. The criteria below are copied from it; the script downloads the annex and refuses
  to write if any copied sentence is no longer in it. Topic-specific additions come from the topic's
  own conditions text ("Award criteria" item), which is shown next to the general criteria.
- Other EU Funding & Tenders Portal topics: section "Award criteria" of the topic's call document (PDF),
  copied as text with its scoring table and thresholds.
- UKRI opportunities: the section "How we will assess your application" of the opportunity page.
- Everything else (Horizon actions with their own work programme part, Interreg, EEA and Norway Grants,
  ESA, EIT, calls run by EU-funded projects): a pointer to where the call says its criteria are.

A call document or page is fetched again after 14 days, or when its address changes.

    python ingest/award_criteria.py
"""
import datetime, html, json, os, re, subprocess, sys, tempfile, time
import requests

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
CALLS = os.path.join(ROOT, "site", "data", "calls.json")
OUT = os.path.join(ROOT, "site", "org", "criteria.json")
TOPIC = "https://ec.europa.eu/info/funding-tenders/opportunities/data/topicDetails/{}.json"
UA = {"User-Agent": "eligiblecalls-ingest/1.0 (+https://eligiblecalls.pages.dev)"}
S = requests.Session(); S.headers.update(UA)
REFETCH_DAYS = 14
NOW = datetime.datetime.now(datetime.timezone.utc)

# ---------------------------------------------------------------------------------------------------
# Horizon Europe, General Annex D (Work Programme 2026-2027). Every string below is copied from the annex.
HE_GA_URL = "https://ec.europa.eu/info/funding-tenders/opportunities/docs/2021-2027/horizon/wp-call/2026-2027/wp-15-general-annexes_horizon-2026-2027_en.pdf"
EXCELLENCE, IMPACT, IMPLEMENTATION = "Excellence", "Impact", "Quality and efficiency of the implementation"
IMPL = [
    "Quality and effectiveness of the work plan, assessment of risks, and appropriateness of the effort assigned to work packages, and the resources overall.",
    "Capacity and role of each participant, and the extent to which the consortium as a whole brings together the necessary expertise.",
]
IMPACT_ASPECTS = [
    "Credibility of the pathways to achieve the expected outcomes and impacts specified in the work programme.",
    "Suitability and quality of the measures to maximise expected outcomes and impacts, as set out in the dissemination and exploitation plan, including communication activities.",
]
# "stage1": the aspect is printed in bold in the annex, so it is also assessed in the first stage of a two-stage call.
HE_ROWS = {
    "RIA_IA": {
        "name": "Research and innovation actions (RIA), Innovation actions (IA)",
        "criteria": [
            {"name": EXCELLENCE, "aspects": [
                {"text": "Clarity and pertinence of the project’s objectives, and the extent to which the proposed work is ambitious and goes beyond the state of the art.", "stage1": True},
                {"text": "Soundness of the proposed [for the first stage: overall (*)] methodology, including the underlying concepts, models, assumptions, inter-disciplinary approaches, appropriate consideration of the gender dimension in research and innovation content, and the quality of open science practices, including sharing and management of research outputs and engagement of citizens, civil society and end-users where appropriate.", "stage1": True},
            ]},
            {"name": IMPACT, "aspects": [{"text": IMPACT_ASPECTS[0], "stage1": True}, {"text": IMPACT_ASPECTS[1]}]},
            {"name": IMPLEMENTATION, "aspects": [{"text": IMPL[0]}, {"text": IMPL[1]}]},
        ],
        "note": "(*) Including all aspects mentioned in the first stage proposal template, which also include the integration of the gender dimension in research and innovation content as well as open science practices.",
    },
    "CSA": {
        "name": "Coordination and support actions (CSA)",
        "criteria": [
            {"name": EXCELLENCE, "aspects": [
                {"text": "Clarity and pertinence of the project’s objectives.", "stage1": True},
                {"text": "Quality of the proposed coordination and/or support measures, including soundness of methodology.", "stage1": True},
            ]},
            {"name": IMPACT, "aspects": [{"text": IMPACT_ASPECTS[0], "stage1": True}, {"text": IMPACT_ASPECTS[1]}]},
            {"name": IMPLEMENTATION, "aspects": [{"text": IMPL[0]}, {"text": IMPL[1]}]},
        ],
    },
    "COFUND": {
        "name": "Programme co-fund actions (CoFund)",
        "criteria": [
            {"name": EXCELLENCE, "aspects": [
                {"text": "Clarity and pertinence of the project’s objectives, and the extent to which the proposed work is ambitious, and goes beyond the state of the art."},
                {"text": "Soundness of the proposed methodology, including the underlying concepts, models, assumptions, inter-disciplinary approaches, appropriate consideration of the gender dimension in research and innovation content, and the quality of open science practices, including sharing and management of research outputs and engagement of citizens, civil society and end-users where appropriate."},
            ]},
            {"name": IMPACT, "aspects": [{"text": IMPACT_ASPECTS[0]}, {"text": IMPACT_ASPECTS[1]}]},
            {"name": IMPLEMENTATION, "aspects": [{"text": IMPL[0]}, {"text": IMPL[1]}]},
        ],
    },
    "PCP_PPI": {
        "name": "Pre-commercial procurement actions (PCP), Public procurement of innovative solutions actions (PPI)",
        "criteria": [
            {"name": EXCELLENCE, "aspects": [
                {"text": "Clarity and pertinence of the objectives and the extent to which they are ambitious and go beyond the state of the art in terms of the degree of innovation that is needed to satisfy the procurement need."},
                {"text": "Soundness of the proposed methodology, taking into account the underlying concepts and assumptions."},
            ]},
            {"name": IMPACT, "aspects": [
                {"text": IMPACT_ASPECTS[0]},
                {"text": "Suitability and quality of the measures to maximise expected outcomes and impacts, as set out in the dissemination and exploitation* plan, including communication activities."},
            ]},
            {"name": IMPLEMENTATION, "aspects": [{"text": IMPL[0]}, {"text": IMPL[1]}]},
        ],
        "note": "* For PCP actions and PPI actions, the exploitation of results by the beneficiaries means primarily the use that is made of the innovative solutions by the procurers/end-users. The manufacturing and sale of the innovative solutions are performed by the suppliers of the solutions, which are not beneficiaries but subcontractors.",
    },
    "FPA": {
        "name": "Framework Partnership Agreements (FPA)",
        "criteria": [
            {"name": EXCELLENCE, "aspects": [{"text": "Clarity and pertinence of the project’s objectives."}]},
            {"name": IMPACT, "aspects": [{"text": "Credibility of the action plan of the FPA to achieve the expected outcomes and impacts specified in the work programme."}]},
            {"name": IMPLEMENTATION, "aspects": [
                {"text": "Capacity and role of each participant, and the extent to which the consortium as a whole brings together the necessary expertise."},
                {"text": "Potential for long-term cooperation among participants."},
            ]},
        ],
    },
}
HE_INTRO = "If admissible and eligible, the proposals will be evaluated and ranked against the following award criteria, depending on the type of action:"
HE_SCORING = [
    "Evaluation scores will be awarded for the criteria, and not for the different aspects listed in the table.",
    "For full applications, each criterion will be scored out of 5. The threshold for individual criteria will be 3. The overall threshold, applying to the sum of the three individual scores, will be 10.",
    "To determine the ranking for ‘Innovation actions’, the score for ‘Impact’ will be given a weight of 1.5.",
    "Proposals that pass the individual threshold AND the overall threshold will be considered for funding, within the limits of the available call budget. Other proposals will be rejected.",
]
HE_TWO_STAGE = [
    "For the evaluation of first-stage applications under a two-stage submission procedure, only the ‘Excellence’ and ‘Impact’ criteria will be evaluated. Within these criteria, only the aspects in bold will be considered.",
    "The threshold for both individual criteria will be 4.",
    "The threshold is expected normally to be set at 8 or 8.5.",
]
HE_EXCELLENCE_NOTE = "(The following aspects will be taken into account, to the extent that the proposed work corresponds to the description in the work programme)"

# typesOfAction code (first word of the Portal label) -> row of General Annex D
HE_TYPE_ROW = {
    "HORIZON-RIA": "RIA_IA", "HORIZON-IA": "RIA_IA", "HORIZON-JU-RIA": "RIA_IA", "HORIZON-JU-IA": "RIA_IA",
    "HORIZON-RIA-LS": "RIA_IA", "HORIZON-IA-LS": "RIA_IA", "EURATOM-RIA": None, "EURATOM-IA": None,
    "HORIZON-CSA": "CSA", "HORIZON-JU-CSA": "CSA", "HORIZON-CSA-LS": "CSA",
    "HORIZON-COFUND": "COFUND", "HORIZON-PCP": "PCP_PPI", "HORIZON-PPI": "PCP_PPI", "HORIZON-FPA": "FPA",
}


def norm(s):
    s = s.replace("\u00ad", "").replace("\u2010", "-")
    s = re.sub(r"-\s*\n\s*", "-", s)
    return re.sub(r"\s+", " ", s).strip()


def loose(s):
    """Letters and digits only: the annex is a multi-column table, so word order is checked, not layout."""
    return re.sub(r"[^a-z0-9]", "", s.lower().replace("’", "'"))


def pdf_text(data, layout=True):
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f:
        f.write(data); path = f.name
    try:
        args = ["pdftotext", "-enc", "UTF-8"] + (["-layout"] if layout else []) + [path, "-"]
        return subprocess.run(args, capture_output=True, check=True, timeout=120).stdout.decode("utf-8", "replace")
    except (FileNotFoundError, subprocess.CalledProcessError, subprocess.TimeoutExpired):
        import io, pypdf
        return "\n".join((p.extract_text() or "") for p in pypdf.PdfReader(io.BytesIO(data)).pages)
    finally:
        os.unlink(path)


def get(url, tries=3, **kw):
    for i in range(tries):
        try:
            r = S.get(url, timeout=60, **kw)
            if r.status_code == 200:
                return r
            if r.status_code in (403, 404, 410):
                return None
        except requests.RequestException:
            pass
        time.sleep(2 * (i + 1))
    return None


def horizon_framework():
    r = get(HE_GA_URL)
    if not r or not r.content.startswith(b"%PDF"):
        raise SystemExit("General Annexes could not be downloaded")
    plain = pdf_text(r.content, layout=False)
    flat, ok = loose(plain), True
    texts = [HE_INTRO, HE_EXCELLENCE_NOTE] + HE_SCORING + HE_TWO_STAGE
    for row in HE_ROWS.values():
        texts += [a["text"] for c in row["criteria"] for a in c["aspects"]] + ([row["note"]] if row.get("note") else [])
    for t in texts:
        # the annex is a table: an aspect can be split across columns and pages, so it is checked in pieces of 4 words
        words = t.split()
        parts = [" ".join(words[i:i + 4]) for i in range(0, len(words), 4)]
        for p in parts:
            if loose(p) not in flat:
                print("Not found in General Annex D:", p, file=sys.stderr); ok = False
    if not ok:
        raise SystemExit("General Annex D changed: update HE_ROWS in ingest/award_criteria.py")
    m = re.search(r"Horizon Europe\s*-\s*Work programme (\d{4}-\d{4})", plain)
    return {
        "id": "HE-GA-D", "programme": "Horizon Europe", "title": "Horizon Europe Work Programme 2026-2027, 15. General Annexes, D — Award criteria",
        "url": HE_GA_URL, "workProgramme": m.group(1) if m else "2026-2027", "retrieved": NOW.date().isoformat(),
        "intro": HE_INTRO, "excellenceNote": HE_EXCELLENCE_NOTE, "rows": HE_ROWS, "scoring": HE_SCORING, "twoStage": HE_TWO_STAGE,
        "scale": {"max": 5, "threshold": 3, "overall": 10, "of": 15},
    }


# ---------------------------------------------------------------------------------------------------
NEXT_ITEM = re.compile(r"\n\s*(\d+[a-z]?\.|[a-z]\.)\s+[A-Z]|\n\s*Specific conditions|\n\s*Call document|\n\s*Documents\b")


def award_note(cond):
    """The topic's own words on award criteria (item 5a/5b of the Portal conditions)."""
    m = re.search(r"Award criteria[^\n]*\n", cond or "")
    if not m:
        return None
    rest = cond[m.end():]
    e = NEXT_ITEM.search("\n" + rest)
    txt = rest[: e.start() - 1 if e else 1200].strip()
    txt = re.sub(r"\[\[.*?\]\]", "", txt)          # footnotes
    txt = norm(txt)
    return txt[:1500] or None


def portal_links(tid):
    r = get(TOPIC.format(tid.lower()))
    if not r:
        return None
    try:
        td = r.json().get("TopicDetails") or {}
    except ValueError:
        return None
    h = td.get("conditions") or ""
    links = [(html.unescape(u), norm(html.unescape(re.sub("<[^>]+>", "", t))))
             for u, t in re.findall(r'<a[^>]*href="([^"]+)"[^>]*>(.*?)</a>', h, re.S)]
    # the call document: by its link text, or by the Portal's file name; it is checked to be a PDF when downloaded
    doc = next((u for u, t in links if re.search(r"call[- ]?(document|fiche)|call for proposals?$", t, re.I) and u.startswith("http")), None) \
        or next((u for u, t in links if re.search(r"/call-fiche_|/call-document", u)), None)
    form = next((u for u, t in links if re.search(r"evaluation form", t, re.I)), None)
    return {"doc": doc, "evalForm": form}


TABLE_ROW = re.compile(r"^\s*(?P<name>\S.*?\S)\s{3,}(?P<min>N/A|n/a|-|\d+(?:[.,]\d+)?(?:\s*/\s*\d+)?)\s{3,}(?P<max>\d+(?:[.,]\d+)?)(?:\s{3,}(?P<w>N/A|n/a|\d+(?:[.,]\d+)?%?))?\s*$")
TABLE_HEAD = re.compile(r"\bMinimum\b.*\bMaximum\b|pass\s+score\s+score|^\s*Award criteria\s{3,}\S")
TABLE_END = re.compile(r"^\s*Overall\b.*\bscores?\b.*\d")
BULLET = re.compile(r"^(\s*)([-•−–▪◦●o]|\d{1,2}[.)]|[a-z][.)]|\([a-z0-9]+\))\s+(.*)$")
SUMMARY = re.compile(r"^(Maximum points|Individual thresholds? per criterion|Overall threshold)\s*[:(]", re.I)


def drop_page_furniture(text):
    """Removes the running header ("Call: <id> — <title>" and "EU Grants: Call document ...", either may wrap)
    and the page number from every page of a call document."""
    pages = []
    for pg in text.split("\f"):
        ls = pg.split("\n")
        top = next((i for i, l in enumerate(ls[:8]) if re.search(r"EU Grants\s*:\s*Call document", l)), None)
        if top is not None:
            ls = ls[top + 1:]
        while ls and (not ls[-1].strip() or re.match(r"^\s*\d{1,3}\s*$", ls[-1])):
            ls.pop()
        pages.append("\n".join(ls))
    return "\n".join(pages)


def award_section(text):
    lines = drop_page_furniture(text).split("\n")
    # the standard EU call document: a numbered section headed exactly "<n>. Award criteria"
    heads = [i for i, l in enumerate(lines) if re.match(r"^\s*(\d{1,2})\.\s+Award criteria\s*$", l)]
    if not heads:
        return None
    i0 = heads[-1]
    num = int(re.match(r"^\s*(\d+)", lines[i0]).group(1))
    end = next((j for j in range(i0 + 1, len(lines)) if re.match(rf"^\s*{num + 1}\.\s+[A-Z]", lines[j])), min(len(lines), i0 + 400))
    body = [l.rstrip() for l in lines[i0 + 1:end] if not re.search(r"EU Grants\s*:\s*Call document|^\s*Call:\s", l)]
    # scoring table: from its header row to the "Overall (pass) scores" row; wrapped cell text inside it is not kept as text
    table, skip = [], set()
    for h, l in enumerate(body):
        if not TABLE_HEAD.search(l):
            continue
        e = next((k for k in range(h + 1, min(len(body), h + 60)) if TABLE_END.match(body[k])), None)
        if e is None:
            continue
        pending = ""      # a criterion name wrapped over two lines: the first line has no numbers
        for k in range(h, e + 1):
            skip.add(k)
            l = body[k]
            m = TABLE_ROW.match(l)
            if m and not re.match(r"award criteria|minimum|criterion", m.group("name"), re.I):
                table.append({"name": norm(pending + " " + m.group("name")), "min": m.group("min").replace(" ", ""), "max": float(m.group("max").replace(",", ".")),
                              **({"weight": m.group("w")} if m.group("w") else {})})
                pending = ""
            elif l.strip() and k > h and not re.search(r"\bscore\b|\bMinimum\b|\bMaximum\b", l):
                pending = norm(pending + " " + l)
            elif not l.strip():
                pending = ""
        break
    summary, k = [], 0
    while k < len(body):
        if SUMMARY.match(body[k].strip()):
            parts = [body[k]]
            while k + 1 < len(body) and body[k + 1].strip() and not SUMMARY.match(body[k + 1].strip()):
                k += 1; parts.append(body[k])
            summary.append(norm(" ".join(parts)))
            for j in range(k - len(parts) + 1, k + 1):
                skip.add(j)
        k += 1
    # blocks of text: paragraphs and bullet items, wrapped lines joined
    blocks, cur = [], None
    for k, l in enumerate(body):
        if k in skip or not l.strip():
            cur = None; continue
        b = BULLET.match(l)
        indent = len(l) - len(l.lstrip())
        if b:
            cur = {"t": norm(b.group(3)), "ind": len(b.group(1)), "li": True}; blocks.append(cur)
        elif cur is not None and (indent >= cur["ind"] or not cur.get("li")):
            cur["t"] = norm(cur["t"] + " " + l)
        else:
            cur = {"t": norm(l), "ind": indent, "li": False}; blocks.append(cur)
    # nesting level of bullets from their indentation
    inds = sorted({b["ind"] for b in blocks if b["li"]})
    out, prev = [], 0
    for b in blocks:
        b["t"] = re.sub(r"(?<=[a-z])\d{1,3}(?=[:;,.])", "", b["t"])     # footnote markers ("as follows18:")
        if not b["t"] or (not b["li"] and re.match(r"^\d{1,3} [A-Z]", b["t"])):   # footnotes at the foot of a page
            continue
        lvl = (inds.index(b["ind"]) + 1) if b["li"] else 0
        lvl = min(lvl, prev + 1)        # a page break can shift the indentation of a list
        out.append({"text": b["t"], "level": lvl}); prev = lvl
    # the table is kept only when its rows add up to the stated total
    crit = [r for r in table if not re.match(r"overall|total", r["name"], re.I)]
    total = next((r for r in table if re.match(r"overall|total", r["name"], re.I)), None)
    tab = {"rows": crit, "total": total} if crit and total and abs(sum(r["max"] for r in crit) - total["max"]) < 0.01 else None
    return {"heading": norm(lines[i0]), "blocks": out[:160], "table": tab, "summary": summary[:6]}


def call_document(url):
    r = get(url)
    if r and not r.content.startswith(b"%PDF"):
        # europa.eu document pages ("/document/<id>_en") link to the file as "/document/download/<id>_en?filename=..."
        m = re.search(r'href="(/document/download/[^"]+)"', r.text or "")
        r = get(requests.compat.urljoin(r.url, html.unescape(m.group(1)))) if m else None
    if not r or not r.content.startswith(b"%PDF"):
        return None
    text = pdf_text(r.content, layout=True)
    sec = award_section(text)
    if not sec or len(sec["blocks"]) < 2:
        return None
    if not re.search(r"\b(points?|score|threshold|weight)", " ".join(b["text"] for b in sec["blocks"]) + " ".join(sec["summary"]), re.I):
        return None
    ver = re.search(r"(Call document \([^)]*\)\s*:\s*V[\d.]+\s*[–-]\s*[\d.]+)", text)
    sec["version"] = norm(ver.group(1)) if ver else None
    return sec


def ukri_assessment(url):
    r = get(url)
    if not r:
        return None
    t = r.text
    # accordion sections: <h2><span>How we will assess your application</span></h2> ... next <h2>
    m = re.search(r"<h2[^>]*>(?:\s|<[^>]+>)*How we will assess your application(?:\s|<[^>]+>)*</h2>(.*?)(?=<h2[^>]*>)", t, re.S)
    if not m:
        return None
    s = m.group(1)
    s = re.sub(r"<(script|style)[^>]*>.*?</\1>", "", s, flags=re.S)
    blocks = []
    for tag, inner in re.findall(r"<(h[3-6]|p|li)[^>]*>(.*?)</\1>", s, re.S):
        txt = norm(html.unescape(re.sub(r"<[^>]+>", " ", inner)))
        if txt:
            blocks.append({"text": txt, "level": 1 if tag == "li" else 0, **({"head": True} if tag.startswith("h") else {})})
    return {"heading": "How we will assess your application", "blocks": blocks[:160]} if blocks else None


def fresh(prev, key, url):
    if not prev or prev.get(key) != url or not prev.get("fetched"):
        return False
    try:
        return (NOW - datetime.datetime.fromisoformat(prev["fetched"])).days < REFETCH_DAYS
    except ValueError:
        return False


def main():
    data = json.load(open(CALLS, encoding="utf-8"))
    prev = {}
    if os.path.exists(OUT):
        try:
            prev = json.load(open(OUT, encoding="utf-8"))
        except (ValueError, OSError):
            prev = {}
    old = prev.get("calls", {})
    he = horizon_framework()
    pfw = (prev.get("frameworks") or {}).get("HE-GA-D")
    if pfw and pfw.get("rows") == he["rows"] and pfw.get("scoring") == he["scoring"]:
        he["retrieved"] = pfw.get("retrieved", he["retrieved"])     # unchanged annex: keep the date it was first read
    frameworks = {"HE-GA-D": he}
    calls, counts = {}, {}
    for c in data["calls"]:
        cid, prog, url = c["id"], c["programme"], c.get("url") or ""
        types = [str(t).split()[0] for t in (c.get("typesOfAction") or []) if t]
        note = award_note(c.get("conditions"))
        portal = "/topic-details/" in url
        e = None
        if portal and prog == "HORIZON":
            row = next((HE_TYPE_ROW.get(t) for t in types if HE_TYPE_ROW.get(t)), None)
            # MSCA, ERC, EIC and prizes have their own criteria; so do topics whose conditions name another source
            own = re.search(r"MSCA part|EIC Work Programme|ERC Work Programme|Rules of Contest|rules of contest", note or "")
            if row and not own:
                e = {"kind": "framework", "framework": "HE-GA-D", "row": row, "ia": any(t.endswith("-IA") or t.endswith("IA-LS") for t in types),
                     "twoStage": c.get("deadlineModel") == "two-stage", "note": note}
        elif portal:
            p = old.get(cid)
            if p and p.get("kind") in ("document", "pointer") and p.get("fetched") and fresh(p, "url", p.get("url")):
                e = dict(p, note=note)
            else:
                links = portal_links(cid)
                if links and links["doc"]:
                    sec = call_document(links["doc"])
                    if sec:
                        e = {"kind": "document", "url": links["doc"], "evalForm": links["evalForm"], "fetched": NOW.isoformat(timespec="seconds"), "note": note, **sec}
                if not e and links:
                    e = {"kind": "pointer", "note": note, "url": links["doc"] or url, "evalForm": links["evalForm"], "fetched": NOW.isoformat(timespec="seconds")}
        elif prog == "UKRI" or "ukri.org/opportunity/" in url:
            p = old.get(cid)
            if p and p.get("kind") in ("page", "pointer") and p.get("fetched") and fresh(p, "url", url):
                e = p
            else:
                sec = ukri_assessment(url)
                e = {"kind": "page", "url": url, "source": "UKRI", "fetched": NOW.isoformat(timespec="seconds"), **sec} if sec \
                    else {"kind": "pointer", "note": None, "url": url, "fetched": NOW.isoformat(timespec="seconds")}
        if not e:
            e = {"kind": "pointer", "note": note, "url": url}
        e["programme"] = prog
        calls[cid] = e
        counts[(prog, e["kind"])] = counts.get((prog, e["kind"]), 0) + 1
    out = {"generated": NOW.isoformat(timespec="seconds"), "frameworks": frameworks, "calls": calls}
    if prev and {k: v for k, v in prev.items() if k != "generated"} == {k: v for k, v in out.items() if k != "generated"}:
        print("Evaluation criteria unchanged.")      # no new commit (and no new Pages build) for an unchanged file
        return
    tmp = OUT + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    os.replace(tmp, OUT)
    for k in sorted(counts):
        print(f"{k[0]:12} {k[1]:10} {counts[k]}")


if __name__ == "__main__":
    main()
