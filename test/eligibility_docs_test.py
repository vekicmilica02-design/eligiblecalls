"""python test/eligibility_docs_test.py  (no network)"""
import os, sys
HERE = os.path.dirname(__file__)
sys.path.insert(0, os.path.join(HERE, "..", "ingest"))
import eligibility_docs as E

# A call document in the standard EU template, as pdftotext -layout prints it (table of contents first)
DOC = """Call: CREA-TEST-2027 — Test call
                         EU Grants: Call document (CREA): V1.1 – 30.09.2026
Table of contents
6. Eligibility ........................................ 9
7. Financial and operational capacity ................. 12

6. Eligibility

Eligible participants (eligible countries)
In order to be eligible, the applicants (beneficiaries and affiliated entities) must:
- be legal entities (public or private bodies)
- be established in one of the eligible countries.
Natural persons are NOT eligible (with the exception of self-employed persons).
Entities which do not have legal personality under their national law may exceptionally participate, provided that their representatives have the capacity to undertake legal obligations.
Consortium composition
Proposals must be submitted by a consortium of at least 3 applicants (beneficiaries; not affiliated entities), from 3 different eligible countries.
For CREA-OTHER-2027-TOPIC: proposals may be submitted by a single applicant only.
The coordinator must be non-profit.

7. Financial and operational capacity
Applicants must have stable and sufficient resources.
"""


def test_section_and_meta():
    head, body = E.doc_section(DOC)
    assert head == "6. Eligibility", head
    assert "Consortium composition" in body and "stable and sufficient" not in body
    m = E.doc_meta(DOC)
    assert m["version"] == "V1.1" and m["published"] == "2026-09-30", m


def test_conditions_keep_their_sentence():
    _, body = E.doc_section(DOC)
    by = {c["type"]: c for c in E.conditions(body, "CREA-TEST-2027")}
    assert by["minApplicants"]["value"] == 3 and "at least 3 applicants" in by["minApplicants"]["quote"], by.get("minApplicants")
    assert by["minCountries"]["value"] == 3
    assert by["naturalPersons"]["value"] is False
    assert by["legalEntity"]["value"] is True
    assert by["noLegalPersonality"]["value"] == "exceptional"
    assert by["coordinatorNonProfit"]["value"] is True
    for c in by.values():
        assert c["quote"] in E.sentences(body) or c["quote"][:60] in " ".join(E.sentences(body)), c


def test_other_topic_sentence_is_ignored():
    # the single-applicant sentence names another topic, so it must not give this topic a single-applicant rule
    text = "For CREA-OTHER-2027-TOPIC: proposals may be submitted by a single applicant only, which is eligible."
    assert not any(c["type"] == "minApplicants" for c in E.conditions(text, "CREA-TEST-2027"))
    assert any(c["type"] == "minApplicants" and c["value"] == 1 for c in E.conditions(text, "CREA-OTHER-2027-TOPIC"))


def test_number_words_and_file_names():
    assert E.num("three") == 3 and E.num("4") == 4
    assert E.fname("A/B C:1") == "A_B_C_1.json"


if __name__ == "__main__":
    n = 0
    for name, fn in list(globals().items()):
        if name.startswith("test_") and callable(fn):
            fn(); n += 1; print("ok  ", name)
    print(f"{n} passed")
