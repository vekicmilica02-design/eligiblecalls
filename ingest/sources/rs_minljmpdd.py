"""Ministry for Human and Minority Rights and Social Dialogue of the Republic of Serbia (minljmpdd.gov.rs):
"Konkursi i javni pozivi". Calls for civil society organisations (associations, foundations, endowments) on
anti-discrimination, gender equality, Roma inclusion and civil society development. Calls for working-group
membership and job vacancies on the same page are left out (rs_common.is_funding_call).
The ministry's "Kalendar konkursa" site disallows automated access (robots.txt) and is not read.
"""
from . import rs_common as R

KEY = "rs_minljmpdd"
NAME = "Ministry for Human and Minority Rights and Social Dialogue of the Republic of Serbia"


def run(cache, fp_names):
    return R.run_source(cache, key=KEY, name=NAME, organiser="Ministarstvo za ljudska i manjinska prava i društveni dijalog", prog="RS-MLJMPDD",
                        prog_short="Min. Human Rights (RS)", list_urls=["https://minljmpdd.gov.rs/javni-konkursi/"],
                        href_rx=r"^https://minljmpdd\.gov\.rs/(javni-konkurs|javni-poziv|konkurs)[a-z0-9-]*/?$", id_prefix="RS-MLJMPDD")
