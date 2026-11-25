"""python test/call_content_test.py  (no network)"""
import os, sys
HERE = os.path.dirname(__file__)
sys.path.insert(0, os.path.join(HERE, "..", "ingest"))
import call_content as C

# A call document with two topics, as pdftotext -layout prints it: contents (one entry wraps), running header,
# a footnote, a numbered list of topics inside section 2.
DOC = """Call: CERV-2027-TEST — Test call
                         EU Grants : Call document (CERV) : V1.0 – 27.10.2026
Table of contents
0. Introduction ........................................ 4
1. Background .......................................... 5
2. Objectives — Themes and priorities — Activities that can be funded —
   Expected impact ..................................... 7
3. Available budget .................................... 9
4. Timetable and deadlines ............................. 9
5. Eligibility ......................................... 10
6. Award criteria ...................................... 12
7. Legal and financial set-up of the Grant Agreements ....... 13

0. Introduction
This is the call.

1. Background
Civil society has a key role in upholding the values of the Union.

2. Objectives — Themes and priorities — Activities that can be funded —
Expected impact

Objectives
The call supports civil society organisations.
1. CERV-2027-TEST-ALPHA - Remembering democratic transitions
Projects should collect testimonies of the transition period.
The activities can include exhibitions and debates.
2. CERV-2027-TEST-BETA - Fighting hate speech
Projects should train moderators of online communities.
3. Something that is not a section
Text of the third item.
\f
Call: CERV-2027-TEST — Test call
                         EU Grants : Call document (CERV) : V1.0 – 27.10.2026
More about the second topic: peer learning for moderators.

17
   A footnote that must not be kept.
                                                                                       8
\f
3. Available budget
The estimated available call budget is EUR 5 000 000.

4. Timetable and deadlines
Deadline for submission: 24 February 2027

5. Eligibility
Must be legal entities.

6. Award criteria
Relevance.

7. Legal and financial set-up of the Grant Agreements
The grant will be a lump sum grant. The funding rate is 90% of the eligible costs.

Reporting obligations are described in the Grant Agreement.
"""

SIB = ["CERV-2027-TEST-ALPHA", "CERV-2027-TEST-BETA"]
a = {s["kind"]: s for s in C.document_sections(DOC, SIB[0], SIB)}
b = {s["kind"]: s for s in C.document_sections(DOC, SIB[1], SIB)}
assert set(a) == {"background", "objectives", "budget", "timetable", "legal"}, a.keys()
assert "Expected impact" in a["objectives"]["h"], a["objectives"]["h"]               # wrapped heading joined
assert "testimonies" in a["objectives"]["t"] and "moderators" not in a["objectives"]["t"], a["objectives"]["t"]
assert "moderators" in b["objectives"]["t"] and "testimonies" not in b["objectives"]["t"], b["objectives"]["t"]
assert "peer learning" in b["objectives"]["t"], "the topic's part goes on after a page break"
assert "supports civil society" in a["objectives"]["t"] and "supports civil society" in b["objectives"]["t"], "the part for all topics"
assert "footnote" not in b["objectives"]["t"] and "EU Grants" not in b["objectives"]["t"]
assert "EUR 5 000 000" in a["budget"]["t"]
assert "90%" in a["legal"]["t"] and "Reporting" not in a["legal"]["t"], a["legal"]["t"]
assert "Relevance" not in str(a) and "legal entities" not in str(a), "eligibility and award criteria are read elsewhere"

td = {"description": "<p><strong>Expected Outcome:</strong></p><p>Projects are expected to contribute to:</p><ul><li>better models;</li><li>open data.</li></ul><p><strong>Scope:</strong></p><p>" + "Proposals should develop new methods for forecasting floods. " * 6 + "</p>"}
t = C.topic_sections(td)
assert [s["h"] for s in t] == ["Expected Outcome", "Scope"], t
assert "- open data." in t[0]["t"]
print("call content: 1 passed")
