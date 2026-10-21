"""European partnership joint calls (ERA-LEARN call calendar).

Source: https://www.era-learn.eu/network-information/call-calendar and each call's ERA-LEARN page
(labelled fields: Website, Launch date, Deadline Pre-Proposal, Deadline Full-Proposal, participating
funding organisations by country). ERA-LEARN is the EU-funded support platform for European partnerships.
Calls that are Horizon Europe topics (already imported from the Portal) are skipped.
In a two-stage call, new applicants can only enter through the pre-proposal, so a call whose pre-proposal
deadline has passed is not published.
"""
import re
from . import common as C

KEY = "eralearn"
NAME = "ERA-LEARN call calendar (European partnerships' joint calls)"
CAL = "https://www.era-learn.eu/network-information/call-calendar"
NAME2CODE = {"Austria": "AT", "Belgium": "BE", "Bulgaria": "BG", "Croatia": "HR", "Cyprus": "CY", "Czech Republic": "CZ", "Czechia": "CZ",
             "Denmark": "DK", "Estonia": "EE", "Finland": "FI", "France": "FR", "Germany": "DE", "Greece": "GR", "Hungary": "HU",
             "Ireland": "IE", "Italy": "IT", "Latvia": "LV", "Lithuania": "LT", "Luxembourg": "LU", "Malta": "MT", "Netherlands": "NL",
             "Poland": "PL", "Portugal": "PT", "Romania": "RO", "Slovakia": "SK", "Slovenia": "SI", "Spain": "ES", "Sweden": "SE",
             "Iceland": "IS", "Liechtenstein": "LI", "Norway": "NO", "Switzerland": "CH", "United Kingdom": "GB", "Albania": "AL",
             "Bosnia and Herzegovina": "BA", "Kosovo": "XK", "Montenegro": "ME", "North Macedonia": "MK", "Serbia": "RS",
             "Turkey": "TR", "Türkiye": "TR", "Ukraine": "UA", "Moldova": "MD", "Republic of Moldova": "MD", "Georgia": "GE",
             "Armenia": "AM", "Faroe Islands": "FO"}


def field(t, label):
    m = re.search(r"\n\s*" + re.escape(label) + r"\s*\n\s*([^\n]+)", t)
    return m.group(1).strip() if m else None


def dmy(s):
    m = re.search(r"(\d\d)/(\d\d)/(\d{4})", s or "")
    return f"{m.group(3)}-{m.group(2)}-{m.group(1)}" if m else None


def parse(h):
    m = re.search(r"(?s)<main.*?</main>", h)
    t = "\n" + C.text_of(m.group(0) if m else h)
    title = re.search(r"<h1[^>]*>(.*?)</h1>", h, re.S)
    orgs = re.split(r"\n\s*Organisations Participating\s*\n", t)
    countries = []
    if len(orgs) > 1:
        tail = orgs[-1]
        countries = sorted({NAME2CODE[x.strip()] for x in re.findall(r"\n\s*([A-Z][A-Za-z ü]+?)\s*\n", "\n" + tail) if x.strip() in NAME2CODE})
    basic = re.search(r"Basic Information\s*\n(.*?)\n\s*Network\s*\n", t, re.S)
    return {"title": C.text_of(title.group(1)) if title else None, "website": field(t, "Website"), "network": field(t, "Network"),
            "launch": dmy(field(t, "Launch date")), "pre": dmy(field(t, "Deadline Pre-Proposal")), "full": dmy(field(t, "Deadline Full-Proposal")),
            "type": field(t, "Type of joint call"), "aim": (field(t, "Aim of the joint call") or "")[:1500],
            "summary": C.text_of(basic.group(1))[:1500] if basic else "", "fields": re.findall(r"\n\s*-\s*([A-Z][^\n]{2,40})", (re.search(r"Research fields\s*\n(.*?)\n\s*Type of research", t, re.S) or [None, ""])[1] if re.search(r"Research fields\s*\n(.*?)\n\s*Type of research", t, re.S) else ""),
            "countries": countries}


def run(cache, fp_names):
    r = C.get(CAL)
    if r is None or r.status_code != 200:
        raise RuntimeError("call calendar unavailable")
    rows = re.findall(r'<strong>([^<]+)</strong><br />\s*<a href="(https://www\.era-learn\.eu/network-information/networks/[^"]+)">', r.text)
    today = C.NOW.astimezone(C.BRU).strftime("%Y-%m-%d")
    out, stats, seen = [], {"listed": len(rows), "horizonTopic": 0, "noFutureDeadline": 0, "linkNotVerified": 0, "published": 0}, set()
    for net, url in rows:
        if url in seen:
            continue
        seen.add(url)
        if re.search(r"/horizon-[a-z0-9-]+$", url):
            stats["horizonTopic"] += 1; continue
        d = C.cached_fields(url, cache, parse, hours=24)
        if not d or not d.get("title"):
            stats["linkNotVerified"] += 1; continue
        if re.match(r"^HORIZON-", d["title"] or ""):
            stats["horizonTopic"] += 1; continue
        if "funding-tenders" in (d.get("website") or ""):  # a Portal topic, already imported from the Portal
            stats["horizonTopic"] += 1; continue
        two = bool(d["type"] and "two" in d["type"].lower()) or bool(d["pre"] and d["full"])
        if two:
            dl = d["pre"] if d["pre"] and d["pre"] >= today else None
        else:
            dl = d["full"] if d["full"] and d["full"] >= today else (d["pre"] if d["pre"] and d["pre"] >= today else None)
        if not dl:
            stats["noFutureDeadline"] += 1; continue
        link, why = url, "ERA-LEARN call page"
        if d.get("website", "").startswith("http"):
            ok, final, w = C.verify(d["website"], d["title"], cache, trusted="ERA-LEARN")
            if ok:
                link, why = final, w
        status = "forthcoming" if d["launch"] and d["launch"] > today else "open"
        notes = []
        if two and d["full"]:
            notes.append(f"Two-stage call: pre-proposal deadline {dl}, full-proposal deadline {d['full']} (only for invited pre-proposals).")
        out.append(C.record(
            id="ERALEARN-" + "-".join(url.rstrip("/").split("/")[-2:])[:100], title=d["title"], callTitle=(d.get("network") or net).strip(),
            url=link, urlVerified=why, dl=[dl + "|~"], callStatus=status, opens=d["launch"],
            model="two-stage" if two else "single-stage",
            description=(d["summary"] or d["aim"])[:2500], conditions=" ".join(notes),
            keywords=d["fields"][:8],
            prog="PARTNERSHIPS", progName="European partnerships: joint transnational calls", progShort="European partnerships",
            countries={"eligible": d["countries"] or None, "complete": False, "jointCall": True,
                       "quote": "Funding organisations taking part in the call (ERA-LEARN): " + ", ".join(d["countries"])},
            sectors=["research", "innovation"], applicants=["university", "organisation", "sme"],
            organiser=(d.get("network") or net).strip(), extraNotes=notes, source=KEY, sourceName=NAME,
        ))
        stats["published"] += 1
    return out, stats
