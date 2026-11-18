"""Development Agency of Serbia (Razvojna agencija Srbije, ras.gov.rs): "Javni pozivi" for companies and
entrepreneurs. Subsidised-loan schemes are left out (grants only, rs_common.is_funding_call).
"""
from . import rs_common as R

KEY = "rs_ras"
NAME = "Development Agency of Serbia (Razvojna agencija Srbije)"


def run(cache, fp_names):
    return R.run_source(cache, key=KEY, name=NAME, organiser="Razvojna agencija Srbije", prog="RS-RAS", prog_short="Development Agency (RS)",
                        list_urls=["https://ras.gov.rs/javni-pozivi"], href_rx=r"^https://(www\.)?ras\.gov\.rs/javni-poziv[a-z0-9-]+$", id_prefix="RS-RAS", call_word=False)
