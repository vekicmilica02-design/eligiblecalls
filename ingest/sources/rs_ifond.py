"""Innovation Fund of the Republic of Serbia (Fond za inovacionu delatnost, inovacionifond.rs): programme pages.

Each programme page states the state of its public call ("Javni poziv: Zatvoren" or "Otvoren do <date>") and the
submission deadline. Only programmes whose page states a future deadline are published (see rs_common).
"""
from . import rs_common as R

KEY = "rs_ifond"
NAME = "Innovation Fund of the Republic of Serbia (Fond za inovacionu delatnost)"
SKIP = ("arhiva", "startap-centri")


def run(cache, fp_names):
    return R.run_source(cache, key=KEY, name=NAME, organiser="Fond za inovacionu delatnost", prog="RS-IFOND", prog_short="Innovation Fund (RS)",
                        list_urls=["https://www.inovacionifond.rs/cir/programi"],
                        href_rx=r"^https://www\.inovacionifond\.rs/cir/program/(?!" + "|".join(SKIP) + r")[a-z0-9-]+$", id_prefix="RS-IFOND", call_word=False)
