"""python test/award_criteria_test.py  (no network)"""
import json, os, sys
HERE = os.path.dirname(__file__)
sys.path.insert(0, os.path.join(HERE, "..", "ingest"))
import award_criteria as A

# A call document page in the standard EU template, as pdftotext -layout prints it
DOC = """Call: CREA-TEST-2027 — Test call
                         EU Grants: Call document (CREA): V1.0 – 30.09.2026

9. Award criteria

The award criteria for this call are as follows18:

Relevance: Relevance of the project (35 points)

-   Relevance and added value of the proposed slate (15 points)
       •    co-production approach,
       •    partnership with players from different countries, including from countries
            with different production capacity,
\f                                                                                        17
Call: CREA-TEST-2027 — Test call
                         EU Grants: Call document (CREA): V1.0 – 30.09.2026

Quality: Quality of the works (65 points)

    Award criteria                                    Minimum       Maximum
                                                     pass score       score
    Relevance                                           N/A            35
    Quality of content and
    activities                                          N/A            65
    Overall (pass) scores                                70            100

Maximum points: 100 points.
Individual thresholds per criterion: N/A.
Overall threshold: 70
points.

18 See the Part B template.

10. Legal and financial set-up of the Grant Agreements
Not part of the criteria.
"""
sec = A.award_section(DOC)
assert sec["heading"] == "9. Award criteria"
texts = [b["text"] for b in sec["blocks"]]
assert texts[0] == "The award criteria for this call are as follows:", texts[0]          # footnote marker removed
assert not any("EU Grants" in t or t.startswith("Call:") or t == "17" for t in texts), texts   # page furniture removed
assert not any(t.startswith("18 ") for t in texts), "footnote kept"
assert "Not part of the criteria." not in texts                                            # stops at the next section
assert "partnership with players from different countries, including from countries with different production capacity," in texts
lv = {b["text"][:12]: b["level"] for b in sec["blocks"]}
assert lv["Relevance: R"] == 0 and lv["Relevance an"] == 1 and lv["co-productio"] == 2, lv
assert sec["summary"] == ["Maximum points: 100 points.", "Individual thresholds per criterion: N/A.", "Overall threshold: 70 points."], sec["summary"]
assert not any(t.startswith(("Award criteria", "Relevance  ", "Overall")) for t in texts)   # table rows are not text blocks
# a criterion name wrapped over two lines in the table is joined
assert [r["name"] for r in sec["table"]["rows"]] == ["Relevance", "Quality of content and activities"], sec["table"]

# a table whose rows do not add up to the stated total is dropped
assert A.award_section(DOC.replace("Overall (pass) scores                                70            100", "Overall (pass) scores                                70            90"))["table"] is None
t = sec["table"]
assert [(r["name"], r["min"], r["max"]) for r in t["rows"]] == [("Relevance", "N/A", 35.0), ("Quality of content and activities", "N/A", 65.0)], t
assert t["total"]["min"] == "70" and t["total"]["max"] == 100.0

# a document without the standard section gives nothing (the call then points to its own documents)
assert A.award_section("2.5 AWARD CRITERIA\nSomething else") is None

# the topic's own words on award criteria
cond = "Conditions\n 5a. Evaluation and award: Award criteria, scoring and thresholds\n are described in Annex D of the Work Programme General Annexes.\n The thresholds for each criterion will be 4[[note]].\n 5b. Evaluation and award: Submission and evaluation processes\n described in Annex F."
assert A.award_note(cond) == "are described in Annex D of the Work Programme General Annexes. The thresholds for each criterion will be 4.", A.award_note(cond)

# the published file (written by the data refresh): one entry per call, consistent with the annex and its own tables
path = os.path.join(HERE, "..", "site", "org", "criteria.json")
if not os.path.exists(path):
    print("ok   award criteria parser (site/org/criteria.json not written yet)"); sys.exit(0)
crit = json.load(open(path, encoding="utf-8"))
calls = json.load(open(os.path.join(HERE, "..", "site", "data", "calls.json"), encoding="utf-8"))["calls"]
missing = [c["id"] for c in calls if c["id"] not in crit["calls"]]
assert len(missing) <= len(calls) * 0.05, f"{len(missing)} calls without an entry (data refreshed after the criteria?)"
fw = crit["frameworks"]["HE-GA-D"]
assert set(fw["rows"]) == {"RIA_IA", "CSA", "COFUND", "PCP_PPI", "FPA"}
for cid, e in crit["calls"].items():
    assert e["kind"] in ("framework", "document", "page", "pointer"), cid
    if e["kind"] == "framework":
        assert e["row"] in fw["rows"] and e["programme"] == "HORIZON", cid
    if e["kind"] == "document":
        assert e["url"].startswith("http") and e["blocks"], cid
        if e["table"]:
            assert abs(sum(r["max"] for r in e["table"]["rows"]) - e["table"]["total"]["max"]) < 0.01, cid
print("ok   award criteria parser and criteria.json")
