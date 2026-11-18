"""Ministry of Tourism and Youth of the Republic of Serbia (mto.gov.rs): "Konkursi" and "Javni pozivi" of the current
and the next year. Calls for youth associations, local governments and tourism. Job vacancies, results, decisions,
loans and procurement listed on the same pages are left out (rs_common.is_funding_call).
"""
import re
from . import common as C, rs_common as R

KEY = "rs_mto"
NAME = "Ministry of Tourism and Youth of the Republic of Serbia (Ministarstvo turizma i omladine)"


def list_urls():
    r = C.get("https://www.mto.gov.rs/")
    if r is None or r.status_code != 200:
        raise RuntimeError("mto.gov.rs home page unavailable")
    years = {str(C.NOW.year), str(C.NOW.year + 1)}
    out = []
    for u, _ in R.links(r.text, r.url, r"/tekst/\d+/(konkursi|javni-pozivi)-(\d{4})-godina\.php$"):
        y = re.search(r"-(\d{4})-godina", u).group(1)
        if y in years and u.replace("://mto.", "://www.mto.") not in out:
            out.append(u.replace("://mto.", "://www.mto."))
    if not out:
        raise RuntimeError("no Konkursi / Javni pozivi page for the current year on mto.gov.rs")
    return out


def run(cache, fp_names):
    return R.run_source(cache, key=KEY, name=NAME, organiser="Ministarstvo turizma i omladine", prog="RS-MTO", prog_short="Min. Tourism and Youth (RS)",
                        list_urls=list_urls(), href_rx=r"^https://(www\.)?mto\.gov\.rs/tekst/\d+/(?!(konkursi|javni-pozivi)-\d{4})[^/]+\.php$", id_prefix="RS-MTO")
