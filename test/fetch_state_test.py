"""python test/fetch_state_test.py  (no network)
A topic page that could not be reached is not remembered as a missing page."""
import os, sys, json, tempfile, datetime
HERE = os.path.dirname(__file__)
sys.path.insert(0, os.path.join(HERE, "..", "ingest"))
import fetch as F

FUT = int((datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=60)).timestamp() * 1000)

def row(i):
    return {"reference": f"T{i}", "metadata": {"identifier": [f"TOPIC-{i}"], "type": ["1"], "title": [f"Topic {i}"], "esST_checksum": [f"sum{i}"], "deadlineDate": ["2027-01-01"]}}

def run(details):
    tmp = tempfile.mkdtemp()
    F.HERE = tmp
    F.search_all = lambda types=("1", "2", "8"), status=F.STATUS_OPEN, tag="open": [dict(row(i), _status=tag) for i in range(25)] if tag == "open" else []
    F.facet_names = lambda: {}
    F.topic_details = details
    F.main()
    return json.load(open(os.path.join(tmp, "state.json"))), json.load(open(os.path.join(tmp, "raw.json")))

def ok(tid):
    return {"exists": True, "actionStatus": ["Open"], "deadlinesMs": [FUT], "plannedOpeningMs": None}

state, raw = run(lambda tid: {"exists": False, "error": "unreachable"} if tid == "TOPIC-3" else ok(tid))
assert state["topics"]["TOPIC-3"]["checksum"] is None, "unreachable page must not be remembered with its checksum"
assert state["topics"]["TOPIC-4"]["checksum"] == "sum4"
assert raw["counts"]["kept"] == 24 and raw["counts"]["topicPageMissing"] == 1, raw["counts"]
print("ok   unreachable topic page is asked again, not stored as missing")
