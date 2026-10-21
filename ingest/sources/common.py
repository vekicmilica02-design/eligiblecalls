"""Shared helpers for the non-Portal importers.

Every importer returns records in the same shape as the Portal records in raw.json, with these
differences: "type" is "8" (call run by an EU-funded project, listed on the Portal) or "x" (call from
another official source), "prog"/"progName"/"progShort" name the funder, "countries" describes who can
apply, and "urlVerified" records the check of the call page.

A record is published only if its call page was fetched and shows this call (see verify()).
"""
import datetime, html, json, os, re, time, unicodedata
from urllib.parse import urlparse
import requests
from zoneinfo import ZoneInfo

UA = {"User-Agent": "eligiblecalls-ingest/1.0 (+https://eligiblecalls.com; open EU funding calls directory)",
      "Accept-Language": "en;q=0.9,*;q=0.5"}
S = requests.Session()
S.headers.update(UA)
NOW = datetime.datetime.now(datetime.timezone.utc)
BRU = ZoneInfo("Europe/Brussels")
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def get(url, **kw):
    """GET with retries. Returns a Response or None."""
    for i in range(3):
        try:
            r = S.get(url, timeout=kw.pop("timeout", 30), allow_redirects=True, **kw)
            if r.status_code in (429, 500, 502, 503, 504):
                time.sleep(3 * (i + 1)); continue
            return r
        except requests.RequestException:
            time.sleep(2 * (i + 1))
    return None


def text_of(h):
    s = str(h or "")
    s = re.sub(r"(?is)<(script|style|noscript|svg)[^>]*>.*?</\1>", " ", s)
    s = re.sub(r"<br\s*/?>", "\n", s, flags=re.I)
    s = re.sub(r"</(p|li|h\d|div|tr|section|article)>", "\n", s, flags=re.I)
    s = re.sub(r"<li[^>]*>", "- ", s, flags=re.I)
    s = re.sub(r"<[^>]+>", " ", s)
    s = html.unescape(s)
    s = re.sub(r"[ \t\r\f\v]+", " ", s)
    s = re.sub(r"\n\s*\n+", "\n", s)
    return s.strip()


def norm(t):
    t = unicodedata.normalize("NFD", (t or "").lower())
    t = "".join(ch for ch in t if not 0x300 <= ord(ch) <= 0x36f)
    return re.sub(r"[^a-z0-9]+", " ", t).strip()


STOP = set("the and for with from call calls open proposals proposal grant grants programme program project projects "
           "support funding fund 2024 2025 2026 2027 2028 new into this that are our your their its of to in on at by an a "
           "cut off first second third round edition".split())


def key_terms(title):
    return [w for w in norm(title).split() if len(w) > 3 and w not in STOP]


SIDE_PAGE = re.compile(r"/(events?|event-calendar|calendar|news|blog|webinars?|meetings?|consultations?|faqs?|about|internship-offers)(/|-|$)", re.I)
LOGIN = re.compile(r"/(login|signin|sign-in|auth|sso)\b|startURL=|/account/", re.I)


def verify(url, title, cache=None, extra_terms=(), trusted=None):
    """Fetch url and check that it is a live page about this call.

    Passes when: HTTP 200, not a login page, and the page text contains the call title, or at least
    60% (minimum 2) of the title's distinctive words (80%, minimum 3, for a site's home page).
    trusted="<source>": the link comes from a structured official dataset that names it as this call's page
    (e.g. interreg.eu), often in another language than the title, so only liveness is checked.
    Returns (ok, final_url, reason)."""
    if not url or not url.startswith(("http://", "https://")):
        return False, url, "no URL"
    ck = url + "|" + title + "|" + (trusted or "")
    if cache is not None and ck in cache and cache[ck]["until"] > NOW.isoformat():
        c = cache[ck]; return c["ok"], c["final"], c["reason"]
    res = (False, url, "")
    r = get(url)
    if r is None:
        res = (False, url, "unreachable")
    elif r.status_code != 200:
        res = (False, r.url, f"HTTP {r.status_code}")
    elif LOGIN.search(r.url):
        res = (False, r.url, "login page")
    else:
        ctype = r.headers.get("content-type", "")
        if trusted and ("html" in ctype or "pdf" in ctype):
            res = (True, r.url, f"live page, linked as this call's page by {trusted}")
        elif "pdf" in ctype:
            res = (True, r.url, "PDF call document")
        else:
            page = norm(text_of(r.text[:600000]))
            hd = r.text[:600000]
            heads = " ".join(x for grp in re.findall(r"(?is)<title[^>]*>(.*?)</title>|<h1[^>]*>(.*?)</h1>", hd) for x in grp)
            heads += " " + " ".join(re.findall(r'(?i)<meta[^>]+property="og:title"[^>]+content="([^"]*)"', hd))
            heads = norm(text_of(heads))
            t = norm(title)
            terms = key_terms(title) + [norm(x) for x in extra_terms if x]
            hit = sum(1 for w in terms if f" {w} " in f" {page} ")
            home = path_depth(r.url) == 0
            need = max(3, -(-8 * len(terms) // 10)) if home else max(2, round(0.6 * len(terms)))
            hh = sum(1 for w in terms if f" {w} " in f" {heads} ")
            if t and t in page:
                res = (True, r.url, "title found on page")
            elif SIDE_PAGE.search(urlparse(r.url).path):
                res = (False, r.url, "events, news or info page, not the call page")
            elif len(terms) >= (3 if home else 2) and hit >= need and hh >= max(1, -(-len(terms) // 2)):
                res = (True, r.url, f"{hit}/{len(terms)} title words on the page, {hh} in its title or main heading")
            else:
                res = (False, r.url, f"page does not show this call ({hit}/{len(terms)} title words)")
    if cache is not None:
        hours = 24 if res[0] else 6
        cache[ck] = {"ok": res[0], "final": res[1], "reason": res[2],
                     "until": (NOW + datetime.timedelta(hours=hours)).isoformat()}
    return res


LANG_SEG = re.compile(r"^[a-z]{2}(-[a-z]{2})?$|^index\.(html?|php)$", re.I)


def path_depth(u):
    """Number of path segments, not counting language prefixes such as /en/ or index.html."""
    return len([p for p in urlparse(u).path.split("/") if p and not LANG_SEG.match(p)])


def record(**kw):
    """Fill the fields build.py expects for a non-Portal record."""
    base = {"type": "x", "callId": None, "callTitle": None, "fp": None, "fpName": None, "divNames": [],
            "model": None, "actionTypes": [], "budget": None, "budgetPlain": None, "currency": None,
            "keywords": [], "tags": [], "geo": None, "geoNames": [], "cascade": None, "conditions": "",
            "description": "", "restrictionHits": [], "callStatus": "open", "opens": None,
            "countries": {"eligible": None, "complete": False, "quote": ""}, "applicants": None, "sectors": None}
    base.update(kw)
    return base


# Country codes used by the site (ISO 3166-1 alpha-2, Kosovo XK) from the forms sources use.
ISO3 = {"AUT": "AT", "BEL": "BE", "BGR": "BG", "HRV": "HR", "CYP": "CY", "CZE": "CZ", "DNK": "DK", "EST": "EE", "FIN": "FI",
        "FRA": "FR", "DEU": "DE", "GRC": "GR", "HUN": "HU", "IRL": "IE", "ITA": "IT", "LVA": "LV", "LTU": "LT", "LUX": "LU",
        "MLT": "MT", "NLD": "NL", "POL": "PL", "PRT": "PT", "ROU": "RO", "SVK": "SK", "SVN": "SI", "ESP": "ES", "SWE": "SE",
        "ISL": "IS", "LIE": "LI", "NOR": "NO", "CHE": "CH", "GBR": "GB", "ALB": "AL", "BIH": "BA", "XKX": "XK", "KOS": "XK",
        "MNE": "ME", "MKD": "MK", "SRB": "RS", "TUR": "TR", "UKR": "UA", "MDA": "MD", "GEO": "GE", "ARM": "AM", "FRO": "FO"}
SITE_COUNTRIES = set(ISO3.values())


def country_code(x):
    """Map NUTS / ISO2 / ISO3 codes to the site's codes. Unknown or non-European codes return None."""
    x = (x or "").strip().upper()
    if x in ("EL",): return "GR"
    if x in ("UK",): return "GB"
    if len(x) == 3: return ISO3.get(x)
    return x if x in SITE_COUNTRIES else None


def page(url, cache, hours=24):
    """Fetch a page and return (status, final_url, html), cached for `hours` (html is not cached, only the
    extracted fields the caller stores under cache['page:'+url])."""
    r = get(url)
    if r is None:
        return None, url, ""
    return r.status_code, r.url, r.text


def meta_description(h):
    m = re.search(r'<meta[^>]+(?:name|property)="(?:og:)?description"[^>]+content="([^"]*)"', h or "", re.I)
    return html.unescape(m.group(1)).strip() if m else ""


def cached_fields(url, cache, fn, hours=24):
    """Return fn(html) for url, cached in cache['page:'+url] for `hours`. fn returns a JSON-serialisable dict."""
    ck = "page:" + url
    c = cache.get(ck)
    if c and c.get("until", "") > NOW.isoformat():
        return c["data"]
    st, final, h = page(url, cache)
    data = fn(h) if st == 200 else None
    cache[ck] = {"data": data, "until": (NOW + datetime.timedelta(hours=hours if data else 6)).isoformat(), "ok": bool(data), "final": final, "reason": ""}
    return data
