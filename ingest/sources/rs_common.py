"""Shared code for the Serbian national sources (scope "rs").

Each source names its listing pages and how to recognise a call page. A call is published only when its own page:
  - answers with HTTP 200 and is a funding call (not a job vacancy, a result, a decision, a working-group membership,
    a procurement or a loan scheme: see is_funding_call),
  - is not marked closed ("Javni poziv: Zatvoren"), and
  - states a submission deadline in the future (rs_dates.find). A deadline given only as "N days from publication"
    is not used, so such a call is skipped and counted.
Titles are shown in Latin script. Who can apply is read from the call text (udruženja, jedinice lokalne samouprave,
privredna društva, naučnoistraživačke organizacije); if the text names none, the record says so.
Call pages are read at most once a day (cache), so the 2-hour refresh does not load the institutions' sites.
"""
import html, re, sys, os
from urllib.parse import urljoin, urlparse
from . import common as C
from . import rs_dates as D

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from translit import to_latin  # noqa: E402

TZ = "Europe/Belgrade"
MAX_PAGES = 30   # call pages read per source and run (most listings show the year's calls)

_NOT_CALL = re.compile(
    r"popunjavanj\w* .*radn\w* mest|radn\w* mest|interni konkurs|zapošljavanj|rezultat|odluk\w*|obustav|izmen\w* |obaveštenj|"
    r"članstv|kandidat|radn\w* grup|komisij|ekspert|nabavk|tender|kredit|zajam|turističk\w* agencij|stručn\w* ispit|"
    r"program board|board members|members of|savetnik|poslovn\w* savetnik|studentsk\w* rad|nagrad\w* za najbolj|\(closed\)|zatvoren", re.I)
_CALL = re.compile(r"konkurs|poziv|program|vaučer|grant|call", re.I)


def is_funding_call(title, call_word=True):
    t = to_latin(title or "").lower()
    return not _NOT_CALL.search(t) and (not call_word or bool(_CALL.search(t)))


APPLICANTS = [
    ("ngo", r"udružen\w*|organizacij\w* civilnog društva|fondacij\w*|zadužbin\w*"),
    ("public", r"jedinic\w* lokaln\w* samouprav\w*|lokaln\w* samouprav\w*|ustanov\w*|opštin\w* i grad\w*"),
    ("sme", r"mikro,? mal\w*|mal\w* i srednj\w*|msp\b|privredn\w* društ\w*|preduzetni\w*|preduzeć\w*"),
    ("startup", r"start-?ap\w*|startup\w*"),
    ("university", r"naučnoistraživačk\w*|fakultet\w*|univerzitet\w*|institut\w*"),
]


def applicants(text):
    """Applicant types named in the call text, in the site's codes; [] when none is named."""
    s = D.latin_text(text)
    m = re.search(r"(pravo (na )?(učešć\w*|podnošenj\w*|prijav\w*)|mogu (da )?(se )?(prijav|konkuri|učestvuj)\w*|podnosi\w* prijav\w*|korisnic\w* (programa|sredstava)|ciljn\w* grup\w*|ko može)[^.]{0,400}", s)
    part = m.group(0) if m else s[:1500]
    out = [k for k, rx in APPLICANTS if re.search(rx, part)]
    if "university" in out:
        out.append("researcher")
    return out


SECTORS = [("youth", r"mlad|omladin"), ("culture", r"kultur|umetn"), ("innovation", r"inovac"), ("research", r"nauk|naučn|istraž"),
           ("human-rights", r"ljudsk\w* prav|diskrimin|manjin|rodn\w* ravnopravn|nasilj"), ("social-inclusion", r"rom[ia]\b|socijaln|inkluz|invalid"),
           ("civil-society", r"civiln\w* društv|udružen"), ("smes", r"privred|preduz|msp\b|dobavljač|izvoz"),
           ("ai", r"veštačk\w* inteligenc|\bai\b"), ("digital", r"digital"), ("environment", r"životn\w* sredin|ekolo"),
           ("regional-dev", r"rural|lokaln\w* razvoj|turiz"), ("education", r"obrazov|akademij|obuk")]


def sectors(text):
    s = D.latin_text(text)
    return [k for k, rx in SECTORS if re.search(rx, s)][:5] or ["other"]


def deadline_string(d):
    return f"{d['date']}T{d['time']}|{TZ}" if d.get("time") else f"{d['date']}|~"


def _main_html(h):
    for rx in (r"(?is)<article\b.*?</article>", r'(?is)<div[^>]+class="[^"]*(?:entry-content|post-content|content-text|tekst|text-content|single-content)[^"]*".*?</div>\s*</div>', r"(?is)<main\b.*?</main>"):
        m = re.search(rx, h or "")
        if m and len(C.text_of(m.group(0))) > 200:
            return m.group(0)
    return h or ""


def _clean(t):
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", t or ""))).strip(" -|–")


def _words(t):
    return set(w for w in re.sub(r"[^a-z0-9]+", " ", D.latin_text(t).replace("đ", "dj")).translate(str.maketrans("čćšž", "ccsz")).split() if len(w) > 3)


def _title(h, url="", label=""):
    """The page's own name for the call: of its headings, og:title, <title> and the listing label, the one sharing the
    most words with the page address (these sites write the call name into the address); the site name in an <h1>
    or a footer heading ("Budimo u kontaktu") shares none."""
    cands = [_clean(x) for x in re.findall(r"(?is)<h[1-3][^>]*>(.*?)</h[1-3]>", h or "")[:12]]
    cands += [_clean(x) for x in re.findall(r'(?i)<meta[^>]+property="og:title"[^>]+content="([^"]*)"', h or "")]
    cands += [_clean(re.split(r"\s[|–-]\s", x)[0]) for x in re.findall(r"(?is)<title[^>]*>(.*?)</title>", h or "")]
    cands = [c for c in cands if 6 <= len(c) <= 300] + ([label] if label and len(label) >= 6 else [])
    slug = _words(urlparse(url).path.replace("-", " ").replace("/", " "))
    best, score = "", 0
    for c in cands:
        hit = len(_words(c) & slug)
        sc = hit + hit / max(1, len(_words(c))) if hit / max(1, len(_words(c))) >= 0.4 else 0
        if sc > score:
            best, score = c, sc
    return best or (cands[0] if cands else label or "")


_DOC_NAME = re.compile(r"javni[\s_%20-]*poziv|konkurs|tekst|poziv|uputstv", re.I)
_NOT_DOC = re.compile(r"obrazac|izjav|prilog|formular|budžet|budzet|rešenj|resenj|odluk|rezultat", re.I)


def _doc_text(u):
    """Text of an attached call document: .docx (stdlib zip) or PDF (pypdf); '' when it cannot be read."""
    r = C.get(u)
    if r is None or r.status_code != 200 or len(r.content) > 8_000_000:
        return ""
    if u.lower().endswith(".docx") or r.content[:2] == b"PK":
        import io, zipfile
        try:
            xml = zipfile.ZipFile(io.BytesIO(r.content)).read("word/document.xml").decode("utf-8", "ignore")
        except Exception:
            return ""
        # Runs of one paragraph are joined without spaces (Word splits "2026" into "202" + "6").
        return html.unescape(re.sub(r"<[^>]+>", "", xml.replace("</w:p>", "\n").replace("<w:tab/>", " ")))
    if r.content[:4] == b"%PDF":
        try:
            import io
            from pypdf import PdfReader
            return "\n".join((p.extract_text() or "") for p in PdfReader(io.BytesIO(r.content)).pages[:15])
        except Exception:
            return ""
    return ""


def attachments(h, base):
    """Attached call documents on a page (not forms, declarations or decisions), at most two."""
    from urllib.parse import unquote
    out = []
    for m in re.finditer(r'(?is)<a[^>]+href="([^"]+\.(?:docx|pdf))"[^>]*>(.*?)</a>', h or ""):
        u = urljoin(base, m.group(1)); name = unquote(u.rsplit("/", 1)[-1]) + " " + _clean(m.group(2))
        if _DOC_NAME.search(to_latin(name)) and not _NOT_DOC.search(to_latin(name)) and u not in out:
            out.append(u)
    return out[:2]


def read_call(h, url="", label=""):
    """Fields of one call page (cached per URL by the caller). When the page states no deadline, the attached call
    document is read (some ministries publish the call text only as a .docx or PDF)."""
    main = _main_html(h)
    text = C.text_of(main)
    dl = D.find(text)
    if not dl or not dl.get("date"):
        for au in attachments(h, url):
            t = _doc_text(au)
            d2 = D.find(t) if t else None
            if d2 and d2.get("date"):
                dl, text = {**d2, "document": au}, text + "\n" + t
                break
    title = _title(h, url, label)
    eligible = re.search(r"[^.]{0,200}(registrovan\w*|sedište\w*|osnovan\w*)[^.]{0,80}(republik\w* srbij|srbij)[^.]{0,120}", D.latin_text(text))
    return {"title": title, "text": text[:6000], "deadline": dl, "applicants": applicants(text), "sectors": sectors(title + " " + text[:3000]),
            "eligibleQuote": eligible.group(0).strip() if eligible else ""}


def links(list_html, base, href_rx):
    """(absolute URL, link text) of the links on a listing page whose href matches href_rx, in page order, once each."""
    out = {}
    for m in re.finditer(r'(?is)<a[^>]+href="([^"#]+)"[^>]*>(.*?)</a>', list_html or ""):
        href, label = m.group(1), re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", m.group(2)))).strip()
        u = urljoin(base, href)
        if not re.search(href_rx, u) or u.rstrip("/") == base.rstrip("/"):
            continue
        if len(label) > len(out.get(u, "")) or u not in out:   # an image link first, the text link later: keep the text
            out[u] = label
    return list(out.items())


def run_source(cache, *, key, name, organiser, prog, prog_short, list_urls, href_rx, id_prefix, extra_notes=(), call_word=True):
    """call_word: the title must also name a call (konkurs, poziv, program, ...). Off for listings that link only to
    programmes or calls (Innovation Fund, Science Fund, RAS), where a programme is called e.g. "Katapult"."""
    """Read the listing pages, then each call page; return (records, stats)."""
    stats = {"listed": 0, "notFundingCall": 0, "read": 0, "pageUnavailable": 0, "closed": 0, "noDeadline": 0, "pastDeadline": 0, "published": 0}
    cands, seen = [], set()
    for lu in list_urls:
        r = C.get(lu)
        if r is None or r.status_code != 200:
            raise RuntimeError(f"listing page {lu} answered {None if r is None else r.status_code}")
        for u, label in links(r.text, r.url, href_rx):
            key_u = u.split("?")[0].rstrip("/")
            if key_u in seen:
                continue
            seen.add(key_u)
            stats["listed"] += 1
            if u.rstrip("/") in {x.rstrip("/") for x in list_urls}:
                continue
            if label and not is_funding_call(label, call_word):
                stats["notFundingCall"] += 1
                continue
            cands.append((u, label))
    out = []
    today = C.NOW.astimezone(C.BRU).date().isoformat()
    for u, label in cands[:MAX_PAGES]:
        f = C.cached_fields(u, cache, lambda h, u=u, label=label: read_call(h, u, label))
        stats["read"] += 1
        if not f:
            stats["pageUnavailable"] += 1; continue
        title = to_latin(f["title"] or label)
        if not is_funding_call(title, call_word):
            stats["notFundingCall"] += 1; continue
        d = f["deadline"]
        if d and d.get("closed") and not d.get("date"):
            stats["closed"] += 1; continue
        if not d or not d.get("date"):
            stats["noDeadline"] += 1; continue
        if d["date"] < today or (d.get("closed") and d["date"] < today):
            stats["pastDeadline"] += 1; continue
        seg = [x for x in urlparse(u).path.lower().split("/") if x and x not in ("cir", "lat", "tekst", "poziv")]
        slug = re.sub(r"[^a-z0-9]+", "-", re.sub(r"\.php$", "", "-".join(seg[-2:] if seg and seg[-1].isdigit() is False and len(seg) > 1 and seg[-2].isdigit() else seg[-1:]))).strip("-")[:60].strip("-")
        notes = list(extra_notes)
        if d.get("untilFunds"):
            notes.append("The call closes on the deadline or earlier, when the available funds are used up (call text).")
        text_lat = to_latin(f["text"])
        out.append(C.record(
            id=f"{id_prefix}-{slug}", type="x", title=title, callTitle=None, url=u,
            urlVerified="call page read by Eligible Calls: title and deadline taken from it",
            dl=[deadline_string(d)], callStatus="open",
            description=re.sub(r"\s+", " ", text_lat)[:1500],
            conditions=to_latin(d.get("quote") or "") + (f" (call document: {d['document']})" if d.get("document") else ""),
            prog=prog, progName=name, progShort=prog_short, organiser=organiser,
            countries={"eligible": ["RS"], "complete": bool(f.get("eligibleQuote")), "quote": to_latin(f.get("eligibleQuote") or "")},
            applicants=f["applicants"] or None, sectors=f["sectors"], scope="rs", extraNotes=notes,
            language="sr", source=key, sourceName=name,
        ))
        stats["published"] += 1
    return out, stats
