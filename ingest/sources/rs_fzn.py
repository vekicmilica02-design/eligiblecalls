"""Science Fund of the Republic of Serbia (Fond za nauku, fondzanauku.gov.rs): public calls of its research
programmes. Calls for programme-board members and business advisers are left out (rs_common.is_funding_call).
"""
from . import rs_common as R

KEY = "rs_fzn"
NAME = "Science Fund of the Republic of Serbia (Fond za nauku)"


def run(cache, fp_names):
    return R.run_source(cache, key=KEY, name=NAME, organiser="Fond za nauku Republike Srbije", prog="RS-FZN", prog_short="Science Fund (RS)",
                        list_urls=["https://fondzanauku.gov.rs/pozivi/"], href_rx=r"^https?://fondzanauku\.gov\.rs/poziv/\d{4}/\d{2}/[a-z0-9-]+/?$", id_prefix="RS-FZN", call_word=False)
