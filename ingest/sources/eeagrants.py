"""EEA and Norway Grants calls (Financial Mechanism Office, eeagrants.org).

Source: the open-calls listing https://eeagrants.org/en/fmo/funding/calls?status=1 (Drupal HTML, 12 per
page). Each call has its own page on eeagrants.org. Calls are published by programme operators in the
beneficiary countries; donor-state (Iceland, Liechtenstein, Norway) entities usually take part as partners.
"""
import datetime, re, html
from . import common as C

KEY = "eeagrants"
NAME = "EEA and Norway Grants open calls (eeagrants.org, Financial Mechanism Office)"
BASE = "https://eeagrants.org"
LIST = BASE + "/en/fmo/funding/calls?status=1&page={}"
NAME2CODE = {"Bulgaria": "BG", "Croatia": "HR", "Cyprus": "CY", "Czechia": "CZ", "Czech Republic": "CZ", "Estonia": "EE", "Greece": "GR",
             "Hungary": "HU", "Latvia": "LV", "Lithuania": "LT", "Malta": "MT", "Poland": "PL", "Portugal": "PT", "Romania": "RO",
             "Slovakia": "SK", "Slovenia": "SI", "Spain": "ES", "Ireland": "IE", "Iceland": "IS", "Liechtenstein": "LI", "Norway": "NO"}
ART = re.compile(r'<article class="node node--type-call node--view-mode-teaser">(.*?)</article>', re.S)


def details(h):
    body = C.text_of(re.search(r'(?s)<main.*?</main>', h).group(0) if re.search(r'(?s)<main.*?</main>', h) else h)
    return {"desc": C.meta_description(h) or body[:1500], "body": body[:4000]}


def run(cache, fp_names):
    out, stats, seen = [], {"listed": 0, "noFutureDeadline": 0, "linkNotVerified": 0, "published": 0}, set()
    for p in range(0, 10):
        r = C.get(LIST.format(p))
        if r is None or r.status_code != 200:
            if p == 0:
                raise RuntimeError(f"listing unavailable: {getattr(r, 'status_code', 'no response')}")
            break
        arts = ART.findall(r.text)
        if not arts:
            break
        new = 0
        for a in arts:
            m = re.search(r'<h3>\s*<a href="([^"]+)"[^>]*>\s*(.*?)\s*</a>', a, re.S)
            if not m:
                continue
            href = BASE + m.group(1) if m.group(1).startswith("/") else m.group(1)
            if href in seen:
                continue
            seen.add(href); new += 1; stats["listed"] += 1
            title = C.text_of(m.group(2))
            countries = [C.text_of(x) for x in re.findall(r'item-field-countries">(.*?)</li>', a, re.S)]
            progs = [C.text_of(x) for x in re.findall(r'item-field-programmes">(.*?)</li>', a, re.S)]
            t = re.search(r'<time datetime="([^"]+)"', a)
            if not t:
                stats["noFutureDeadline"] += 1; continue
            dt = datetime.datetime.fromisoformat(t.group(1).replace("Z", "+00:00"))
            if dt <= C.NOW:
                stats["noFutureDeadline"] += 1; continue
            local = dt.astimezone(C.BRU)
            dl = local.strftime("%Y-%m-%dT%H:%M") + "|Europe/Brussels"
            ok, url, why = C.verify(href, title, cache, trusted="eeagrants.org")
            if not ok:
                stats["linkNotVerified"] += 1; continue
            d = C.cached_fields(href, cache, details) or {}
            codes = sorted({NAME2CODE[c] for c in countries if c in NAME2CODE})
            bilateral = "bilateral" in a.lower() and "Call for bilateral" in a
            ben = [c for c in codes if c not in ("IS", "LI", "NO")]
            cn = ", ".join(countries)
            out.append(C.record(
                id="EEA-" + re.sub(r"[^A-Za-z0-9]+", "-", m.group(1).strip("/").split("/", 1)[-1])[:90],
                title=title, callTitle=" · ".join(progs) or None, url=url, urlVerified=why, dl=[dl],
                description=d.get("desc", ""), conditions=d.get("body", "")[:3000],
                prog="EEANORWAY", progName="EEA and Norway Grants", progShort="EEA & Norway Grants",
                countries={"eligible": ben, "partners": ["IS", "LI", "NO"], "complete": True, "eea": True,
                           "quote": f"Call published under the EEA and Norway Grants in {cn}."},
                organiser=("Programme operator, " + cn) if cn else None, keywords=progs[:6],
                applicants=None, sectors=None, typeHint="bilateral" if bilateral else None,
                source=KEY, sourceName=NAME,
            ))
            stats["published"] += 1
        if new == 0:
            break
    return out, stats
