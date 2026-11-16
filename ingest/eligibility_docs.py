"""Official eligibility conditions of the published calls, read from the documents of the bodies that run them.

Writes:
  site/org/eligibility.json     one entry per call: where the conditions come from (publisher, document title,
                                version, publication date, URL, date last verified) and the mandatory conditions
                                that can be read reliably from the text, each with the sentence it rests on
  site/org/elig/<call>.json     the text of the call's eligibility section, for the detailed report and for the
                                AI check of a profile against the official text (read on demand, not on page load)

Sources, by call:
- EU Funding & Tenders Portal topics with a call document (CERV, Creative Europe, Digital Europe, EDF, ...):
  section "Eligibility" of the call document (PDF) published by the Commission or its executive agency.
- Horizon Europe topics: Annex B "Eligibility" of the Work Programme General Annexes (consortium composition,
  unless the topic says otherwise) and the topic's own eligibility conditions on the Portal.
- UKRI opportunities: the section "Who can apply" of the opportunity page on ukri.org.
- Other sources (Interreg, EEA and Norway Grants, ERA-LEARN, EIT, ESA, calls by EU-funded projects): no document
  is read; the entry says the conditions were not verified and links to the call page.

robots.txt is respected; a document that cannot be fetched or has no eligibility section is recorded as such,
never guessed. A document is fetched again after 14 days, or when its address changes.

    python ingest/eligibility_docs.py
"""
import datetime, html, json, os, re, sys, urllib.robotparser
from urllib.parse import urlsplit

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import award_criteria as A   # shared fetching, PDF text and Portal link helpers

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
CALLS = os.path.join(ROOT, "site", "data", "calls.json")
OUT = os.path.join(ROOT, "site", "org", "eligibility.json")
TEXT_DIR = os.path.join(ROOT, "site", "org", "elig")
NOW = A.NOW
REFETCH_DAYS = 14
MAX_TEXT = 9000
UA = A.UA["User-Agent"]

PUBLISHER = {
    "HORIZON": "European Commission (Horizon Europe)", "CERV": "European Commission (CERV)", "CREA": "European Commission / EACEA (Creative Europe)",
    "DIGITAL": "European Commission (Digital Europe)", "ERASMUS": "European Commission / EACEA (Erasmus+)", "EDF": "European Commission (European Defence Fund)",
    "UKRI": "UK Research and Innovation",
}

_robots = {}
def allowed(url):
    """robots.txt of the host allows this user agent to fetch the URL (unreachable robots.txt: allowed, as browsers do)."""
    p = urlsplit(url)
    host = f"{p.scheme}://{p.netloc}"
    if host not in _robots:
        rp = urllib.robotparser.RobotFileParser()
        r = A.get(host + "/robots.txt", tries=1)
        rp.parse(r.text.splitlines() if r is not None and r.status_code == 200 else [])
        _robots[host] = rp
    return _robots[host].can_fetch(UA, url)

NUM = {"one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10}
def num(w):
    w = w.lower()
    return int(w) if w.isdigit() else NUM.get(w)

def clean(text):
    t = A.drop_page_furniture(text) if hasattr(A, "drop_page_furniture") else text
    t = re.sub(r"[ \t]+", " ", t)
    t = re.sub(r"\n[ \t]*\d{1,3}\n", "\n", t)                       # page numbers
    t = re.sub(r"\n\s*\n+", "\n", t)
    return t.strip()

def sentences(text):
    flat = re.sub(r"\s+", " ", text)
    return [s.strip() for s in re.split(r"(?<=[.;:])\s+(?=[A-Z–−(-])", flat) if s.strip()]

TOPIC_ID = re.compile(r"\b[A-Z][A-Z0-9]+(?:-[A-Z0-9]+){3,}\b")
def find(sents, rx, cid=None):
    """First sentence matching rx. In a call document that covers several topics, a sentence that names another
    topic is about that topic, not this one; a sentence naming this topic is preferred."""
    hits = []
    for s in sents:
        m = re.search(rx, s, re.I)
        if not m:
            continue
        ids = set(TOPIC_ID.findall(s))
        if cid and ids and cid not in ids:
            continue
        hits.append((0 if cid and cid in ids else 1, s[:400], m))
    if not hits:
        return None, None
    hits.sort(key=lambda h: h[0])
    return hits[0][1], hits[0][2]

ENT = r"(?:independent\s+)?(?:applicants?|entities|legal entities|beneficiaries|partners|organisations|organizations|participants|members)"
# The countries the site covers (site/data/taxonomy.json), by the names call documents use.
COUNTRY_NAMES = {
    "AT": ["Austria"], "BE": ["Belgium"], "BG": ["Bulgaria"], "HR": ["Croatia"], "CY": ["Cyprus"], "CZ": ["Czechia", "Czech Republic"],
    "DK": ["Denmark"], "EE": ["Estonia"], "FI": ["Finland"], "FR": ["France"], "DE": ["Germany"], "GR": ["Greece"], "HU": ["Hungary"],
    "IE": ["Ireland"], "IT": ["Italy"], "LV": ["Latvia"], "LT": ["Lithuania"], "LU": ["Luxembourg"], "MT": ["Malta"], "NL": ["Netherlands"],
    "PL": ["Poland"], "PT": ["Portugal"], "RO": ["Romania"], "SK": ["Slovakia"], "SI": ["Slovenia"], "ES": ["Spain"], "SE": ["Sweden"],
    "IS": ["Iceland"], "LI": ["Liechtenstein"], "NO": ["Norway"], "CH": ["Switzerland"], "GB": ["United Kingdom", "UK"], "AL": ["Albania"],
    "BA": ["Bosnia and Herzegovina"], "XK": ["Kosovo"], "ME": ["Montenegro"], "MK": ["North Macedonia"], "RS": ["Serbia"],
    "TR": ["Türkiye", "Turkiye", "Turkey"], "UA": ["Ukraine"], "MD": ["Moldova"], "GE": ["Georgia"], "AM": ["Armenia"], "FO": ["Faroe Islands", "Faroes"],
}
# Where the bullet list "be established in one of the eligible countries, i.e.: ..." ends: the next requirement or paragraph.
LIST_END = re.compile(r"(?:[−–•-]\s*(?:be|have|not be|must|comply)\b|Beneficiaries (?:and affiliated entities )?must|All applicants|Other entities|"
                      r"Given the|Applicants are required|other eligibility conditions|For the validation|Please check|In order to|Specific cases|"
                      r"Legal entities established|Natural persons|International organisations|Consortium composition|NB:|\bb\)\s)", re.I)
# A category whose members the document does not list: associated, candidate or third countries, regions, and the like.
# Such a list is "open": the site cannot decide from it and the call stays "to verify".
OPEN_LIST = re.compile(r"associat|third countr|candidate|negotiation|pre-accession|\bIPA\b|enlargement|neighbourhood|Balkan|Eastern Partnership|"
                       r"Europol|operational agreement|any country|all countries|other countries|countries listed|list of (?:participating|eligible) countries|"
                       r"see (?:the )?(?:list|annex|section)|Annex|programme countries|partner countries|countries receiving|non-EU donor", re.I)

def countries_condition(text):
    """The closed list of eligible countries in the EU call document template ("be established in one of the eligible
    countries, i.e.: - EU Member States (including OCTs) - ..."). Returns None when the sentence is not there.
    open = True when the list has a category the document does not enumerate; the site then decides nothing from it."""
    t = re.sub(r"\s+", " ", text or "")
    m = re.search(r"established in (?:one of )?the eligible countries,? i\.\s?e\.:?\s*", t, re.I)
    if not m:
        return None
    rest = t[m.end():m.end() + 2500]
    end = LIST_END.search(rest)
    if not end or end.start() < 5:
        return None   # the list cannot be delimited: no condition rather than a guess
    seg = rest[:end.start()].strip(" .;:")
    eu = bool(re.search(r"\bEU Member States?\b", seg))
    excluded = [cc for cc, names in COUNTRY_NAMES.items() if re.search(r"(?:excluding|except(?: for)?|with the exception of)\s+(?:" + "|".join(map(re.escape, names)) + r")\b", seg, re.I)]
    named = []
    for cc, names in COUNTRY_NAMES.items():
        if cc in excluded:
            continue
        if any(re.search(r"\b" + re.escape(n) + r"\b", seg) for n in names):
            named.append(cc)
    if re.search(r"\bEEA countries\b", seg) and not re.search(r"listed EEA", seg, re.I):
        named += [cc for cc in ("IS", "LI", "NO") if cc not in named]
    if not eu and not named:
        return None
    return {"type": "countries", "eu": eu, "named": named, "excluded": excluded, "open": bool(OPEN_LIST.search(seg)),
            "quote": (t[m.start():m.end()] + seg)[:600]}

def conditions(text, cid=None):
    """Mandatory conditions that can be read reliably; each keeps the sentence it comes from."""
    s = sentences(text)
    out = []
    q, m = find(s, cid=cid, rx=r"(?:consortium|application|proposals?|partnership)[^.]{0,120}?(?:at least|minimum of|composed of)\s+(\d+|one|two|three|four|five|six)\s+" + ENT)
    if q:
        out.append({"type": "minApplicants", "value": num(m.group(1)), "quote": q})
    q, m = find(s, cid=cid, rx=r"(?:at least|minimum of)\s+(\d+|two|three|four|five|six)\s+(?:different\s+)?(?:eligible\s+|participating\s+|programme\s+)?countries")
    if not q:
        q, m = find(s, cid=cid, rx=r"(?:established|from)\s+in\s+(?:at least\s+)?(\d+|two|three|four|five|six)\s+different\s+(?:eligible\s+|participating\s+)?countries")
    if not q:
        q, m = find(s, cid=cid, rx=r"(\d+|two|three|four|five|six)\s+different\s+(?:eligible\s+|participating\s+)?countries")
    if q:
        out.append({"type": "minCountries", "value": num(m.group(1)), "quote": q})
    q, m = find(s, cid=cid, rx=r"natural persons (?:are|is) not eligible")
    if q:
        out.append({"type": "naturalPersons", "value": False, "quote": q})
    q, m = find(s, cid=cid, rx=r"(?:lead applicants?|coordinators?)[^.]{0,60}?(?:must\s+)?be non-profit")
    if q:
        out.append({"type": "coordinatorNonProfit", "value": True, "quote": q})
    q, m = find(s, cid=cid, rx=r"for[- ]profit[^.]{0,80}?only in (?:partnership|consortium|a consortium)")
    if q:
        out.append({"type": "forProfitPartnerOnly", "value": True, "quote": q})
    q, m = find(s, cid=cid, rx=r"(?:applicants?|beneficiaries)[^.]{0,80}must[^.]{0,40}be public (?:bodies|authorities|entities)")
    if q:
        out.append({"type": "publicOnly", "value": True, "quote": q})
    # "must:" and the bullet "− be legal entities" are separate sentences in the EU call document template
    q, m = find(s, cid=cid, rx=r"(?:(?:must|only)[^.]{0,60}\blegal entities\b|^[−–•-]?\s*be legal entities\b)")
    if q:
        out.append({"type": "legalEntity", "value": True, "quote": q})
    q, m = find(s, cid=cid, rx=r"entities which do not have legal personality[^.]{0,120}may exceptionally participate")
    if q:
        out.append({"type": "noLegalPersonality", "value": "exceptional", "quote": q})
    q, m = find(s, cid=cid, rx=r"(?:single|mono-?beneficiary|one applicant)[^.]{0,60}(?:eligible|allowed|may apply|can apply)")
    if q and not any(c["type"] == "minApplicants" for c in out):
        out.append({"type": "minApplicants", "value": 1, "quote": q})
    cc = countries_condition(text)
    if cc:
        out.append(cc)
    return out

def doc_section(text):
    """The call document's 'Eligibility' section (numbered heading, not the table of contents)."""
    for m in re.finditer(r"^\s*(\d{1,2})\.\s+Eligibility\s*$", text, re.M):
        n = int(m.group(1))
        end = re.search(r"^\s*%d\.\s+\S" % (n + 1), text[m.end():], re.M)
        body = text[m.end(): m.end() + end.start()] if end else text[m.end(): m.end() + 20000]
        if len(body) > 300:
            return f"{n}. Eligibility", clean(body)
    return None, None

def doc_meta(text):
    meta = {}
    v = re.search(r"Call document \(([^)]*)\)\s*:\s*(V[\d.]+)\s*[–-]\s*(\d{2})\.(\d{2})\.(\d{4})", text)
    if v:
        meta["title"] = f"Call document ({v.group(1)}) {v.group(2)}"
        meta["version"] = v.group(2)
        meta["published"] = f"{v.group(5)}-{v.group(4)}-{v.group(3)}"
    c = re.search(r"^\s*Call:\s*(\S.*?)\s*$", text, re.M)
    if c:
        meta["callName"] = A.norm(c.group(1))[:200]
    return meta

def fetch_pdf(url):
    if not allowed(url):
        return None, "robots"
    r = A.get(url)
    if r is not None and not r.content.startswith(b"%PDF"):
        m = re.search(r'href="(/document/download/[^"]+)"', r.text or "")
        nxt = A.requests.compat.urljoin(r.url, html.unescape(m.group(1))) if m else None
        if nxt and not allowed(nxt):
            return None, "robots"
        r = A.get(nxt) if nxt else None
    if r is None:
        return None, "unavailable"
    if not r.content.startswith(b"%PDF"):
        return None, "not_pdf"
    return A.pdf_text(r.content, layout=True), None

def portal_items(cond, names):
    """Items of the Portal's conditions text (e.g. '2. Eligible countries', '3. Other eligibility conditions')."""
    out = []
    for nm in names:
        m = re.search(r"(?:^|\n)\s*\d+[a-z]?\.\s*" + nm + r"[^\n]*\n(.*?)(?=\n\s*\d+[a-z]?\.\s|\n\s*Specific conditions|\n\s*Call document|\Z)", cond or "", re.I | re.S)
        if m:
            t = A.norm(re.sub(r"\[\[.*?\]\]", "", m.group(1)))
            if t:
                out.append(t[:1500])
    return out

def he_framework():
    """Annex B of the Horizon Europe General Annexes: consortium composition (the default for collaborative actions)."""
    if not allowed(A.HE_GA_URL):
        return None
    r = A.get(A.HE_GA_URL)
    if r is None or not r.content.startswith(b"%PDF"):
        return None
    text = A.pdf_text(r.content, layout=False)
    flat = re.sub(r"\s+", " ", text)
    m = re.search(r"Unless otherwise provided for in the specific call/topic conditions, only legal entities forming a consortium are eligible.*?Associated Countries\.", flat)
    if not m:
        return None
    return {"id": "HE-GA-B", "title": "Horizon Europe Work Programme 2026-2027, General Annexes, B - Eligibility", "url": A.HE_GA_URL,
            "publisher": "European Commission", "verified": NOW.date().isoformat(),
            "consortium": {"minApplicants": 3, "minCountries": 3, "quote": m.group(0)[:700]}}

def ukri_section(url):
    if not allowed(url):
        return None, "robots"
    r = A.get(url)
    if r is None:
        return None, "unavailable"
    m = re.search(r"<h2[^>]*>(?:\s|<[^>]+>)*Who can apply(?:\s|<[^>]+>)*</h2>(.*?)(?=<h2[^>]*>)", r.text, re.S)
    if not m:
        return None, "no_section"
    s = re.sub(r"<(script|style)[^>]*>.*?</\1>", "", m.group(1), flags=re.S)
    parts = [A.norm(html.unescape(re.sub(r"<[^>]+>", " ", x))) for _, x in re.findall(r"<(h[3-6]|p|li)[^>]*>(.*?)</\1>", s, re.S)]
    text = "\n".join(p for p in parts if p)
    return (text or None), (None if text else "no_section")

def fname(cid):
    return re.sub(r"[^A-Za-z0-9._-]+", "_", cid)[:120] + ".json"

def reparse(text, cid, prev):
    """Conditions of a cached text read again with the current rules, so a parser change applies without refetching.
    The stored text is clipped, so a condition found earlier in the full section and not in the clipped text is kept."""
    new = conditions(text or "", cid)
    have = {c["type"] for c in new}
    return new + [c for c in (prev.get("conditions") or []) if c.get("type") not in have]

def fresh(prev, url):
    if not prev or (prev.get("docUrl") or prev.get("url")) != url or not prev.get("checked"):
        return False
    try:
        return (NOW - datetime.datetime.fromisoformat(prev["checked"])).days < REFETCH_DAYS
    except ValueError:
        return False

def main():
    data = json.load(open(CALLS, encoding="utf-8"))
    prev = {}
    if os.path.exists(OUT):
        try:
            prev = json.load(open(OUT, encoding="utf-8")).get("calls", {})
        except (ValueError, OSError):
            prev = {}
    os.makedirs(TEXT_DIR, exist_ok=True)
    he = he_framework()
    calls, texts, counts = {}, {}, {}
    doc_cache = {}
    for c in data["calls"]:
        cid, prog, url = c["id"], c["programme"], c.get("url") or ""
        portal = "/topic-details/" in url
        topic = portal_items(c.get("conditions"), [r"Eligible countries", r"Other eligib\w* conditions"]) if portal else []
        p = prev.get(cid)
        e, text = None, None
        if portal and prog == "HORIZON":
            types = [str(t).split()[0] for t in (c.get("typesOfAction") or []) if t]
            own = any(re.search(r"MSCA|ERC|EIC|PRIZE|PCP|PPI|COFUND", t) for t in types) or bool(re.search(r"-(MSCA|ERC|EIC)-", cid))
            single = re.search(r"[^.]{0,200}(?:single (?:beneficiar|applicant|legal entit)|mono-beneficiar|may be submitted by (?:one|a single))[^.]{0,200}\.", (c.get("conditions") or "") + " " + (c.get("description") or ""), re.I)
            conds = conditions("\n".join(topic), cid)
            if single:
                own = True
                conds.append({"type": "minApplicants", "value": 1, "quote": A.norm(single.group(0))[:400]})
            e = {"kind": "horizon", "status": "verified" if he else "unavailable", "publisher": PUBLISHER["HORIZON"], "url": url,
                 "title": "Portal topic conditions" + (" and General Annex B" if he and not own else ""), "checked": NOW.isoformat(timespec="seconds"),
                 "verified": NOW.date().isoformat() if he else None, "conditions": conds, "topic": topic, "framework": "HE-GA-B" if he and not own else None,
                 "ownRules": own}
            if he and not own and not any(x["type"] in ("minApplicants", "minCountries") for x in conds):
                q = he["consortium"]["quote"]
                conds += [{"type": "minApplicants", "value": 3, "ref": "HE-GA-B"}, {"type": "minCountries", "value": 3, "ref": "HE-GA-B"}]
            text = "\n\n".join(topic + ([he["consortium"]["quote"]] if he and not own else []))
        elif portal:
            if p and p.get("kind") == "document" and fresh(p, p.get("docUrl")) and os.path.exists(os.path.join(TEXT_DIR, fname(cid))):
                e = dict(p, topic=topic)
                text = json.load(open(os.path.join(TEXT_DIR, fname(cid)), encoding="utf-8")).get("text")
                e["conditions"] = reparse(text, cid, p)
            else:
                links = A.portal_links(cid)
                doc = links and links.get("doc")
                if doc:
                    if doc not in doc_cache:
                        doc_cache[doc] = fetch_pdf(doc)
                    raw, why = doc_cache[doc]
                    head, body = doc_section(raw) if raw else (None, None)
                    meta = doc_meta(raw) if raw else {}
                    status = "verified" if body else (why or "no_section")
                    e = {"kind": "document", "status": status, "publisher": PUBLISHER.get(prog, "European Commission"), "url": url, "docUrl": doc,
                         "title": meta.get("title") or "Call document", "version": meta.get("version"), "published": meta.get("published"),
                         "heading": head, "checked": NOW.isoformat(timespec="seconds"), "verified": NOW.date().isoformat() if body else None,
                         "conditions": conditions(body, cid) if body else [], "topic": topic}
                    text = body
                else:
                    e = {"kind": "document", "status": "no_document", "publisher": PUBLISHER.get(prog, "European Commission"), "url": url, "docUrl": None,
                         "checked": NOW.isoformat(timespec="seconds"), "verified": None, "conditions": conditions("\n".join(topic)), "topic": topic}
                    text = "\n\n".join(topic) or None
        elif prog == "UKRI" or "ukri.org/opportunity/" in url:
            if p and p.get("kind") == "page" and fresh(p, url) and os.path.exists(os.path.join(TEXT_DIR, fname(cid))):
                e = dict(p)
                text = json.load(open(os.path.join(TEXT_DIR, fname(cid)), encoding="utf-8")).get("text")
                e["conditions"] = reparse(text, None, p)
            else:
                body, why = ukri_section(url)
                e = {"kind": "page", "status": "verified" if body else why, "publisher": PUBLISHER["UKRI"], "url": url, "docUrl": url, "title": "Who can apply (ukri.org)",
                     "checked": NOW.isoformat(timespec="seconds"), "verified": NOW.date().isoformat() if body else None, "conditions": conditions(body) if body else []}
                text = body
        else:
            e = {"kind": "none", "status": "not_researched", "url": url, "conditions": []}
        e["hasText"] = bool(text)
        for x in e.get("conditions") or []:
            if x.get("quote"):
                x["quote"] = x["quote"][:300]
        topic_text = e.pop("topic", None)
        if e.get("url") == url:
            e.pop("url")                          # the call's own address is in the call data
        calls[cid] = e
        if text:
            texts[cid] = {"id": cid, "title": e.get("title"), "url": e.get("docUrl") or url, "heading": e.get("heading"), "verified": e.get("verified"), "topic": topic_text or [], "text": text[:MAX_TEXT]}
        counts[(prog, e["kind"], e["status"])] = counts.get((prog, e["kind"], e["status"]), 0) + 1
    out = {"generated": NOW.isoformat(timespec="seconds"), "frameworks": {"HE-GA-B": he} if he else {}, "calls": calls}
    # text files: write changed ones, remove those of calls no longer published
    keep = set()
    for cid, t in texts.items():
        fn = os.path.join(TEXT_DIR, fname(cid)); keep.add(os.path.basename(fn))
        new = json.dumps(t, ensure_ascii=False, separators=(",", ":"))
        if not os.path.exists(fn) or open(fn, encoding="utf-8").read() != new:
            open(fn, "w", encoding="utf-8").write(new)
    for f in os.listdir(TEXT_DIR):
        if f.endswith(".json") and f not in keep:
            os.remove(os.path.join(TEXT_DIR, f))
    strip = lambda o: {k: ({ck: {kk: vv for kk, vv in cv.items() if kk not in ("checked", "verified")} for ck, cv in v.items()} if k == "calls" else v) for k, v in o.items() if k != "generated"}
    if os.path.exists(OUT):
        try:
            old = json.load(open(OUT, encoding="utf-8"))
            age = (NOW - datetime.datetime.fromisoformat(old.get("generated"))).days if old.get("generated") else 99
            if strip(old) == strip(out) and age < 7:
                print("Eligibility conditions unchanged (verification dates are rewritten weekly).")
                return
        except (ValueError, OSError):
            pass
    tmp = OUT + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    os.replace(tmp, OUT)
    for k in sorted(counts):
        print(f"{k[0]:10} {k[1]:9} {k[2]:15} {counts[k]}")


if __name__ == "__main__":
    main()
