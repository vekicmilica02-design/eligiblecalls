"""python test/erasmus_na_test.py  (no network)"""
import datetime, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "ingest"))
from sources import common as C, erasmus_na as E

class R:  # fake page
    status_code = 200
    def __init__(self, text): self.text = text
pages = {}
C.get = lambda url, **kw: R(pages.get(url, "Small-scale Partnerships Cooperation Partnerships"))

C.NOW = datetime.datetime(2026, 1, 15, 10, 0, tzinfo=datetime.timezone.utc)
recs, st = E.run({}, {})
assert st["published"] == 4 and st["noFutureDeadline"] == 0, st
ka220 = [r for r in recs if r["erasmusAction"] == "KA220"]
assert [r["dl"][0] for r in ka220] == ["2026-03-05T12:00|Europe/Brussels", "2026-10-01T12:00|Europe/Brussels"]
assert "RS" in ka220[0]["countries"]["eligible"] and "AL" in ka220[0]["countries"]["partners"]
assert not [r for r in recs if r["erasmusAction"] == "KA210"][0]["countries"]["partners"]
assert "possible additional round" in ka220[1]["title"]

C.NOW = datetime.datetime(2026, 6, 1, tzinfo=datetime.timezone.utc)
recs, st = E.run({}, {})
assert st["published"] == 2 and all("10-01" in r["dl"][0] for r in recs), st

C.get = lambda url, **kw: None  # guide page down: publish nothing
recs, st = E.run({}, {})
assert st["published"] == 0 and st["pageUnavailable"] == 2, st
print("ok   erasmus_na rounds")
