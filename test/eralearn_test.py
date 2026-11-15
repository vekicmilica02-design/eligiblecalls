"""python test/eralearn_test.py  (no network): countries read from a joint call's own page."""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "ingest"))
from sources import eralearn as E

# A sentence listing the countries (DUT style): only that line counts, not a country named in the next paragraph.
dut = """<main><h2>Participating countries</h2><p>For a country list, scroll down to the paragraph "participating countries".</p>
<p>Available budget and funding scheme</p><h3>Participating Countries</h3>
<p>The following countries have confirmed their participation: Austria, Belgium, Kingdom of the Netherlands, Norway, Türkiye and Philippines</p>
<p>Malta-based researchers can join as cooperation partners.</p></main>"""
r = E.site_countries(dut)
assert r["countries"] == ["AT", "BE", "NL", "NO", "TR"], r
assert "confirmed their participation" in r["quote"], r

# A list, one country per line followed by its funders (SBEP style).
sbep = "<div>Participating countries</div>" + "".join(f"<div>{c}</div><div>Funder of {c} [X]</div>" for c in ["Belgium", "Croatia", "Montenegro", "Norway"]) + \
       "<div>Contact</div><div>Send email</div>" * 6 + "<div>Serbia appears in an unrelated news item</div>"
r = E.site_countries(sbep)
assert r["countries"] == ["BE", "HR", "ME", "NO"], r

# No list: nothing is guessed.
assert E.site_countries("<p>Participating countries will be announced soon.</p>")["countries"] == []
print("eralearn: 3 passed")
