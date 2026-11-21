"""python3 test/app_forms_test.py: reading Part B structure from an application form's text (no network)."""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "ingest"))
import app_forms as A

FORM = """
                                                       EU Grants: Application form (TEST): V3.0 – 15.01.2025
1. Human embryonic stem cells and human embryos                                     Page
2. Humans                                                                           Page
                                                 TECHNICAL DESCRIPTION (PART B)
TABLE OF CONTENTS
TECHNICAL DESCRIPTION (PART B) ............................................. 1
  1. RELEVANCE ................................................................ 2
     1.1 Background and general objectives .................................... 2
     1.2 Needs analysis and specific objectives ............................... 3
  2. QUALITY .................................................................. 4
     2.1 Concept and methodology .............................................. 4
  3. WORKPLAN, WORK PACKAGES, ACTIVITIES, RESOURCES AND TIMING ................ 5
     3.1 Work packages, activities, resources and timing ...................... 5
#@APP-FORM-TEST@#
Page limit: page limit normally 45 pages (unless otherwise provided in the Call document)
1. RELEVANCE
1.1 Background and general objectives
                                                                                       co
    Describe the background and rationale of the project.                            et
    How is the project relevant to the scope of the call?
    Insert text
1.2 Needs analysis and specific objectives
    Provide a needs assessment. A need is a gap between what is and what should be.
    Insert text
 am
2. QUALITY
2.1 Concept and methodology
    Outline the approach and methodology behind the project and explain why it is suitable.
    Insert text
3. WORKPLAN, WORK PACKAGES, ACTIVITIES, RESOURCES AND TIMING
3.1 Work packages, activities, resources and timing
    Fill in one table per work package, with its objectives, activities and deliverables.
    Insert text
ANNEXES
"""

def test():
    r = A.parse_form(FORM)
    assert (r["form"], r["version"], r["date"]) == ("TEST", "3.0", "2025-01-15"), r
    assert r["pageLimit"] == 45 and r["usable"]
    units = [(s["n"], s["title"]) for s in r["sections"] if not s["group"]]
    assert units == [("1.1", "Background and general objectives"), ("1.2", "Needs analysis and specific objectives"), ("2.1", "Concept and methodology"), ("3.1", "Work packages, activities, resources and timing")], units
    s11 = r["sections"][1]
    assert s11["ask"] == ["Describe the background and rationale of the project. How is the project relevant to the scope of the call?"], s11["ask"]
    assert all(not s["n"].startswith("1") or s["title"] != "Humans" for s in r["sections"]), "Part A ethics list is not read as Part B"
    assert A.page_limit("Proposal page limits and layout: - 70 pages as decribed in the section 5 of the Call document") == 70
    assert A.page_limit("no limit stated") is None
    bad = A.parse_form("EU Grants: Application form (X): V1.0 – 01.01.2024\nTECHNICAL DESCRIPTION (PART B)\nSome text only.\n")
    assert not bad["usable"] and bad["sections"] == []
    print("app forms: 1 passed")

test()
