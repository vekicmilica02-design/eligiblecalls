"""Eligible Calls importer.

Input : ingest/raw.json   (EU Portal grant topics, written by ingest/fetch.py; override with RAW=path)
        ingest/extra.json (other sources, written by ingest/fetch_extra.py; optional, override with EXTRA=path)
Output: site/data/calls.json      full records for the website
        site/data/index.json      compact records for the chat assistant
        site/data/changes.json    new, changed and closed calls (rolling log)
        site/data/programmes.json, site/data/taxonomy.json
        site/data/audit.md        import audit
        ingest/review.md          calls whose text contains an unreviewed participation restriction

Eligibility is computed per call and per country in layers (first match wins):
  1. call-specific rules quoted from the official call text  (CALL_RULES)
  2. programme-strand rules from the official list of participating countries (strand_rule)
  3. programme participation list (PROGRAMMES[...]['countries'])
  4. anything not covered -> "check" (never "yes")
Statuses: Y = eligible, P = eligible with a condition, N = not eligible, C = check call document.
"""
import json, re, datetime, collections, html, os
from zoneinfo import ZoneInfo
BRU = ZoneInfo("Europe/Brussels")
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import deadlines as DL
def deadline_instant(d):
    """Plain dates are Portal grant deadlines (17:00:00 Brussels time); see ingest/deadlines.py for the other forms."""
    return DL.instant(d)

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.environ.get("OUT", os.path.join(ROOT, "site", "data"))
raw = json.load(open(os.environ.get("RAW", os.path.join(HERE, "raw.json")), encoding="utf-8"))
NOW = datetime.datetime.fromisoformat(raw["fetchedAt"].replace("Z", "+00:00"))
TODAY = NOW.astimezone(BRU).date()
RECS = raw["records"]
EXTRA_PATH = os.environ.get("EXTRA", os.path.join(HERE, "extra.json"))
EXTRA = json.load(open(EXTRA_PATH, encoding="utf-8")) if os.path.exists(EXTRA_PATH) else {"sources": {}}
for _k, _s in EXTRA.get("sources", {}).items():
    RECS = RECS + _s.get("records", [])

EU27 = ["AT","BE","BG","HR","CY","CZ","DK","EE","FI","FR","DE","GR","HU","IE","IT","LV","LT","LU","MT","NL","PL","PT","RO","SK","SI","ES","SE"]
COUNTRIES = [  # European countries offered in the UI
    *EU27, "IS","LI","NO","CH","GB","AL","BA","XK","ME","MK","RS","TR","UA","MD","GE","AM","FO"]
NAMES = {"AT":"Austria","BE":"Belgium","BG":"Bulgaria","HR":"Croatia","CY":"Cyprus","CZ":"Czechia","DK":"Denmark","EE":"Estonia","FI":"Finland","FR":"France","DE":"Germany","GR":"Greece","HU":"Hungary","IE":"Ireland","IT":"Italy","LV":"Latvia","LT":"Lithuania","LU":"Luxembourg","MT":"Malta","NL":"Netherlands","PL":"Poland","PT":"Portugal","RO":"Romania","SK":"Slovakia","SI":"Slovenia","ES":"Spain","SE":"Sweden",
 "IS":"Iceland","LI":"Liechtenstein","NO":"Norway","CH":"Switzerland","GB":"United Kingdom","AL":"Albania","BA":"Bosnia and Herzegovina","XK":"Kosovo","ME":"Montenegro","MK":"North Macedonia","RS":"Serbia","TR":"Türkiye","UA":"Ukraine","MD":"Moldova","GE":"Georgia","AM":"Armenia","FO":"Faroe Islands",
 "IL":"Israel","TN":"Tunisia","EG":"Egypt","CA":"Canada","JP":"Japan","KR":"Republic of Korea","NZ":"New Zealand"}
NAMES_SR = {"AT":"Austrija","BE":"Belgija","BG":"Bugarska","HR":"Hrvatska","CY":"Kipar","CZ":"Češka","DK":"Danska","EE":"Estonija","FI":"Finska","FR":"Francuska","DE":"Nemačka","GR":"Grčka","HU":"Mađarska","IE":"Irska","IT":"Italija","LV":"Letonija","LT":"Litvanija","LU":"Luksemburg","MT":"Malta","NL":"Holandija","PL":"Poljska","PT":"Portugalija","RO":"Rumunija","SK":"Slovačka","SI":"Slovenija","ES":"Španija","SE":"Švedska","IS":"Island","LI":"Lihtenštajn","NO":"Norveška","CH":"Švajcarska","GB":"Ujedinjeno Kraljevstvo","AL":"Albanija","BA":"Bosna i Hercegovina","XK":"Kosovo","ME":"Crna Gora","MK":"Severna Makedonija","RS":"Srbija","TR":"Turska","UA":"Ukrajina","MD":"Moldavija","GE":"Gruzija","AM":"Jermenija","FO":"Farska Ostrva"}
GROUP = {c:"EU27" for c in EU27} | {c:"EEA-EFTA" for c in ["IS","LI","NO","CH"]} | {"GB":"OTHER"} | {c:"WB6" for c in ["AL","BA","XK","ME","MK","RS"]} | {c:"EAST" for c in ["TR","UA","MD","GE","AM"]} | {"FO":"OTHER"}

HE_ASSOC = ["AL","AM","BA","FO","GE","IS","IL","XK","MD","ME","MK","NO","RS","TN","TR","UA","CH","EG","GB"]
EUROHPC_PS = ["AL","IS","IL","MD","ME","MK","NO","RS","CH","TR","GB"]  # non-EU Participating States quoted in the call text

LISTS = "https://ec.europa.eu/info/funding-tenders/opportunities/docs/2021-2027/{}/guidance/list-3rd-country-participation_{}_en.pdf"
PROGRAMMES = {
 "HORIZON": {"fp":"43108390","name":"Horizon Europe","short":"Horizon Europe",
   "summary":"EU framework programme for research and innovation.",
   "list":{"url":LISTS.format("common","horizon-euratom"),"version":"V4.1 – 16.09.2026"},
   "countries":{**{c:["Y",""] for c in EU27}, **{c:["Y","Associated to Horizon Europe."] for c in HE_ASSOC if c!="GB"},
                "GB":["Y","Associated to the entire programme except the EIC Fund (equity); transitional arrangements for the EIC Fund from 2026."],
                "LI":["N","Liechtenstein does not intend to associate to Horizon Europe."]},
   "complete":True},
 "EURATOM": {"fp":"43298916","name":"Euratom Research and Training Programme","short":"Euratom",
   "summary":"EU research and training programme for nuclear research.",
   "list":{"url":LISTS.format("common","horizon-euratom"),"version":"V4.1 – 16.09.2026"},
   "countries":{**{c:["Y",""] for c in EU27}, "CH":["Y","Associated to Euratom from 2025."], "UA":["Y","Associated to Euratom."]},
   "complete":True},
 "DIGITAL": {"fp":"43152860","name":"Digital Europe Programme","short":"Digital Europe",
   "summary":"Deployment of digital capacity: high-performance computing (SO1), AI (SO2), cybersecurity (SO3), advanced digital skills (SO4), deployment and best use (SO5).",
   "list":{"url":LISTS.format("digital","digital"),"version":"V7.0 – 01.12.2025"},
   "countries":{**{c:["Y",""] for c in EU27}, **{c:["Y","Full participation (EEA)."] for c in ["IS","LI","NO"]},
                **{c:["P","Participates only in Specific Objectives 1, 2, 4 and 5."] for c in ["AL","BA","XK","MD","ME","MK","RS","TR","UA","CH"]}},
   "complete":True},
 "CREA": {"fp":"43251814","name":"Creative Europe","short":"Creative Europe",
   "summary":"EU programme for the cultural, creative and audiovisual sectors: Culture, MEDIA and Cross-sectoral strands.",
   "list":{"url":LISTS.format("crea","crea"),"version":"V10.0 – 15.01.2026"},
   "countries":{**{c:["Y",""] for c in EU27}, **{c:["Y","Full participation."] for c in ["IS","NO","LI","AL","BA","MK","RS","ME","UA"]},
                "GE":["P","Culture and Cross-sectoral strands plus specified MEDIA actions."],
                "XK":["P","Culture strand and Creative Europe Desks only."],
                "AM":["P","Culture strand and Creative Europe Desks only."],
                "MD":["P","Culture strand and Creative Europe Desks only (from 01.01.2026)."]},
   "complete":True},
 "CERV": {"fp":"43251589","name":"Citizens, Equality, Rights and Values (CERV)","short":"CERV",
   "summary":"Funds civil society and public bodies working on equality, rights, gender-based violence (Daphne), citizens' participation and Union values.",
   "list":{"url":LISTS.format("cerv","cerv"),"version":"V10.0 – 01.08.2025"},
   "countries":{**{c:["Y",""] for c in EU27}, **{c:["P","All strands except the Union Values strand."] for c in ["AL","BA","XK","MD","ME","MK","RS","UA"]}},
   "complete":True},
 "SMP": {"fp":"43252476","name":"Single Market Programme","short":"Single Market Programme",
   "summary":"Internal market, SME competitiveness, consumers, standardisation, statistics and the food chain.",
   "list":{"url":LISTS.format("smp","smp"),"version":"V13.0 – 15.07.2024"},
   "countries":{**{c:["Y",""] for c in EU27}, **{c:["P","Participates in listed strands only (not the Food strand)."] for c in ["IS","NO","LI","AL","BA","XK","ME","MK","RS","TR","MD","UA"]}},
   "complete":True},
 "CEF": {"fp":"43251567","name":"Connecting Europe Facility","short":"CEF",
   "summary":"Trans-European networks in transport, energy and digital infrastructure.",
   "list":{"url":LISTS.format("cef","cef"),"version":"V3.0 – 15.06.2023"},
   "countries":{**{c:["Y",""] for c in EU27}, "MD":["Y","All sub-programmes."], "UA":["Y","All sub-programmes."]},
   "complete":True, "completeNote":"No EEA country has expressed interest in CEF. The call document can still allow third-country entities in specific cases (section on eligible countries)."},
 "EDF": {"fp":"44181033","name":"European Defence Fund / EDIP","short":"European Defence Fund",
   "summary":"Defence research and capability development; also hosts EDIP and the Ukraine Support Instrument (USI) calls.",
   "list":{"url":LISTS.format("edf","edf"),"version":"V5.0 – 01.04.2026"},
   "countries":{**{c:["Y",""] for c in EU27}, "NO":["Y","Participates in the EDF."]},
   "complete":True},
 "I3": {"fp":"44416173","name":"Interregional Innovation Investments (I3)","short":"I3",
   "summary":"Interregional innovation investments under the ERDF.",
   "list":{"url":LISTS.format("i3","i3"),"version":"V1.0 – 15.11.2021"},
   "countries":{c:["Y",""] for c in EU27}, "complete":True},
 "JUST": {"fp":"43252386","name":"Justice Programme","short":"Justice",
   "summary":"Judicial cooperation, training of justice professionals and access to justice.",
   "list":{"url":LISTS.format("just","just"),"version":"V11.0 – 15.09.2025"},
   "countries":{**{c:["Y",""] for c in EU27 if c!="DK"}, "DK":["N","Denmark does not take part in the Justice Programme."],
                **{c:["Y","Participates in the Justice Programme."] for c in ["AL","BA","XK","MD","UA"]},
                "RS":["N","Has confirmed interest but has no participation agreement yet."], "MK":["N","Has confirmed interest but has no participation agreement yet."]},
   "complete":True},
}
NO_LIST = {  # programmes without a published list of participating countries (checked 30.09.2026)
 "ESF":("43254019","European Social Fund Plus (ESF+ / EaSI)","ESF+"),
 "JTM":("44773066","Just Transition Mechanism","Just Transition Mechanism"),
 "ISF":("43252368","Internal Security Fund","Internal Security Fund"),
 "SOCPL":("43252517","Social Prerogative and Specific Competencies Lines","SOCPL"),
 "PPPA":("43637601","Pilot Projects & Preparatory Actions","Pilot Projects"),
 "EUBA":("45532249","EU Bodies and Agencies","EU agencies"),
 
}
FP2PROG = {v["fp"]:k for k,v in PROGRAMMES.items()} | {v[0]:k for k,v in NO_LIST.items()}
LIST_CHECKED = "2026-09-30"

# ---------- call-specific rules quoted from official call texts ----------
def allow(codes, quote):
    s = set(codes)
    return lambda c: ("Y", quote) if c in s else ("N", quote)
CALL_RULES = {
 "HORIZON-EIC-2026-DEFENCE-01": allow(EU27+["UA","IS","NO"], "Participation is limited to SMEs, including start-ups, and small mid-caps established in the Union, in Ukraine, or in an EEA member associated to Horizon Europe (Article 48(2) Horizon Europe Regulation)."),
 "HORIZON-JU-EUROHPC-2026-TIPT-09-01": allow(EU27+EUROHPC_PS, "Participation is limited to legal entities established in Member States or Participating States of the EuroHPC JU."),
 "HORIZON-JU-EUROHPC-2026-NAPT-11-01": allow(EU27+EUROHPC_PS, "Participation is limited to legal entities established in Member States or Participating States of the EuroHPC JU."),
 "HORIZON-JU-EUROHPC-2026-NQKD-12-01": allow(EU27+EUROHPC_PS, "Participation is limited to legal entities established in Member States or Participating States of the EuroHPC JU."),
 "HORIZON-JU-EUROHPC-2026-QML-07-01": allow(EU27+HE_ASSOC+EUROHPC_PS, "Participation is limited to legal entities established in Member States, associated countries to Horizon Europe and EuroHPC JU Participating States."),
 "HORIZON-JU-EUROHPC-2026-PQC-06-01": allow(EU27+["NO","IS","CA","IL","KR","NZ","CH","GB"], "Participation is limited to legal entities established in Member States, Norway and Iceland and the following associated countries: Canada, Israel, Republic of Korea, New Zealand, Switzerland, and the United Kingdom."),
 "HORIZON-JU-EUROHPC-2026-NGC-04-01": allow(EU27+["NO","IS"], "Participation is limited to legal entities established in Member States, Norway and Iceland."),
 "HORIZON-JU-EUROHPC-2026-STAND-05-01": allow(EU27+["NO","IS"]+HE_ASSOC, "Participation is limited to legal entities established in Member States, Norway and Iceland and countries associated to Horizon Europe."),
 "HORIZON-EURATOM-2027-01-01": allow(EU27+["UA","CH"], "Participation is limited to legal entities established in Member States and in countries associated to the Euratom Research and Training Programme (Ukraine and Switzerland)."),
}
# Calls whose conditions text on the Portal states the eligible countries in words (not a country list).
EEA3 = ["IS", "LI", "NO"]
def _socpl(c):
    q = "Eligible countries (call conditions): EU Member States and in some cases from the European Economic Area (EEA) countries, in accordance with the EEA Agreement."
    if c in EU27: return ("Y", q)
    if c in EEA3: return ("P", "EEA countries are eligible only in some cases. " + q)
    return ("N", q)
def _efsa(c):
    q = "Call conditions: applicants must be on the list of competent organisations designated by the Member States (Article 36 of Regulation (EC) 178/2002)."
    if c in EU27: return ("P", q)
    if c in EEA3: return ("C", "The call conditions refer to organisations designated by the Member States; whether EEA organisations on the list can apply is not stated in the source data.")
    return ("N", q)
CALL_RULES["SOCPL-2026-INFO-REPR"] = _socpl
CALL_RULES["EUBA-EFSA-2026-PLANTS-01"] = _efsa

CALL_NOTES = {
 "HORIZON-WIDERA-2027-04-WIDENING-01": "Coordinators must be legal entities established in Widening countries as defined in the Horizon Europe Regulation.",
 "DIGITAL-ECCC-2027-DEPLOY-CYBER-11-NCC": "Subject to Article 12(5) of the Digital Europe Regulation for security reasons (see Appendix 3 of the Work Programme).",
 "DIGITAL-ECCC-2027-DEPLOY-CYBER-11-REGCABH": "Subject to the restrictions of Article 12(5) of the Digital Europe Regulation, as specified in Appendix 3 of the Work Programme.",
 "HORIZON-EIC-2026-ACCELERATOR-01": "Applicants from a non-associated third country can apply only if they intend to establish or relocate an SME to a Member State or Associated Country.",
}

# Calls whose restriction text has been read and encoded above, plus ids added by hand
# to ingest/reviewed.json after checking the call document.
REVIEWED = set(CALL_RULES) | set(CALL_NOTES)
_rv = os.path.join(HERE, "reviewed.json")
if os.path.exists(_rv):
    REVIEWED |= set(json.load(open(_rv, encoding="utf-8")).get("ids", []))

def strand_rule(prog, cid, c, base):
    """Strand-level rules from the official participation lists. base = (status, note) from the programme list."""
    st, note = base
    if prog == "DIGITAL":
        so3 = "-ECCC-" in cid or "CYBER" in cid
        if st == "P":
            if so3: return ("N", "SO3 Cybersecurity is not covered by this country's Digital Europe agreement.")
            return ("P", "Participates only in SO1, 2, 4 and 5. Some Digital Europe calls also restrict participation for security reasons: check section 6 of the call document.")
        if c in ("IS","LI","NO"):
            return ("P", "Full programme participant. Some Digital Europe calls restrict participation for security reasons: check section 6 of the call document.")
    if prog == "CREA" and st == "P":
        if cid.startswith("CREA-MEDIA"):
            if c in ("XK","AM","MD"): return ("N", "Takes part in the Culture strand only; this is a MEDIA call.")
            if c == "GE": return ("P", "Takes part in specified MEDIA actions only: check whether this action is one of them.")
    if prog == "CERV" and st == "P":
        if "VALUES" in cid: return ("N", "The Union Values strand is not covered by this country's CERV agreement.")
        return ("Y", "Participates in all CERV strands except Union Values; this call is not in that strand.")
    if prog == "SMP" and st == "P" and cid.startswith("SMP-FOOD"):
        return ("N", "Does not take part in the Single Market Programme Food strand.")
    return base

def is_ju(cid): return cid.startswith("HORIZON-JU-") or cid.startswith("DIGITAL-JU-")

ANNEX_B = re.compile(r"Eligible countries\s*:?\s*described in Annex B of the (?:Horizon Europe )?Work Programme General Annexes", re.I)
SAYS = re.compile(r"Eligible [Cc]ountries\s*:?\s*((?:as )?[Dd]escribed[^.]{0,220})")

def not_in_source(rec, extra=""):
    """Reason text for C: the Portal data does not state the countries; quote what it does say."""
    m = SAYS.search(re.sub(r"\s+", " ", rec.get("conditions") or ""))
    said = (' The Portal data says: "Eligible countries ' + m.group(1).strip(" .") + '."') if m else ""
    return ("C", "The eligible countries are not stated in the Portal data for this call." + said + extra +
            " Eligible Calls does not read the call document, so eligibility is not available from the source.")

def eligibility(rec, prog):
    cid = rec["id"]; t = rec["type"]
    out = {}
    annex_b = bool(ANNEX_B.search(re.sub(r"\s+", " ", rec.get("conditions") or "")))
    if t in ("8", "x"):
        return extra_eligibility(rec)
    for c in COUNTRIES:
        if t != "1":
            out[c] = ("C", "Eligibility is set by the call's own guidelines; it is not published in structured form.")
            continue
        if cid in CALL_RULES:
            out[c] = CALL_RULES[cid](c); continue
        if prog not in PROGRAMMES:
            out[c] = not_in_source(rec, " This programme has no published list of participating countries.")
            continue
        P = PROGRAMMES[prog]
        base = tuple(P["countries"].get(c, ("N","Not listed as a participating country." ) if P["complete"] else ("C","")))
        res = strand_rule(prog, cid, c, base)
        if is_ju(cid) and c not in EU27 and res[0] in ("Y","P"):
            if annex_b and prog == "HORIZON":
                # The call's own conditions point to Annex B of the Horizon Europe General Annexes,
                # which makes Horizon Europe associated countries eligible.
                res = (res[0], (res[1] + " " if res[1] else "") + "The call conditions apply Annex B of the Horizon Europe General Annexes for eligible countries.")
            else:
                res = not_in_source(rec, " Joint Undertaking calls set their own eligibility rules.")
        if prog == "CEF" and res[0] == "N": res = ("N", "Not a CEF participating country. " + P["completeNote"])
        out[c] = res
    return out

def extra_eligibility(rec):
    """Calls from other sources: only what the source states. Unknown -> C, never Y."""
    spec = rec.get("countries") or {}
    el, src = spec.get("eligible"), rec.get("sourceName") or "the source"
    q = (spec.get("quote") or "").strip()
    qs = (' The source says: "' + (q if len(q) <= 400 else q[:397] + "...") + '"') if q else ""
    out = {}
    for c in COUNTRIES:
        if el is None:
            out[c] = ("C", ("This call is run by its organiser, who sets the eligibility rules." if rec["type"] == "8" else
                            "The eligible countries are not stated in structured form by " + src + ".") + " Check the call page.")
        elif spec.get("regional"):
            out[c] = (("P", "Part of the programme area: only organisations located in the eligible regions of this country can apply (interreg.eu lists the regions). Check the call page.")
                      if c in el else ("N", "Not in the programme area listed on interreg.eu. A programme can accept a partner from outside its area only in specific cases set in the call."))
        elif spec.get("eea"):
            if c in el: out[c] = ("Y", "Call of the EEA and Norway Grants programme in this country: open to applicants established here (see the call for applicant types).")
            elif c in (spec.get("partners") or []): out[c] = ("C", "Entities from Iceland, Liechtenstein and Norway usually take part as project partners, not as applicants. Check the call.")
            else: out[c] = ("N", "EEA and Norway Grants calls are for applicants in the beneficiary country that publishes them; some calls also accept partners from other countries. Check the call.")
        elif spec.get("jointCall"):
            out[c] = (("P", "A funding organisation from this country takes part in the call (ERA-LEARN). Applicants are funded by their national funder under its own rules: check the national annex.")
                      if c in el else ("C", "No funding organisation from this country is listed for the call on ERA-LEARN. Partners from such countries can often join with their own funding. Check the call."))
        elif spec.get("ukri"):
            if c == "GB": out[c] = ("Y", "UK organisations that meet UKRI's eligibility rules can apply." + qs)
            elif spec.get("norway") and c == "NO": out[c] = ("P", "Under the UKRI and Research Council of Norway Money Follows Cooperation agreement, a project co-lead can be based in a Norwegian institution." + qs)
            elif spec.get("complete"): out[c] = ("N", "UKRI funds UK organisations; organisations elsewhere can usually join only as project partners funding their own involvement." + qs)
            else: out[c] = ("C", "Check the call page." + qs)
        else:
            if c in el: out[c] = ("Y", "Listed as eligible by " + src + "." + qs)
            elif spec.get("complete"): out[c] = ("N", "Not listed as eligible by " + src + "." + qs)
            else: out[c] = ("C", "Not listed by " + src + "; check the call page." + qs)
    return out

# ---------- classification (derived, labelled as such in the UI) ----------
SECTOR_RULES = [  # (regex on id, sectors)
 (r"^HORIZON-CL2", ["culture","social-inclusion","democracy","research"]), (r"^HORIZON-CL3", ["security","research"]),
 (r"^HORIZON-CL4", ["digital","innovation","research"]), (r"^HORIZON-CL5", ["climate","energy","transport","research"]),
 (r"^HORIZON-CL6", ["environment","food","research"]), (r"^HORIZON-NEB", ["architecture","design","sustainability","culture"]),
 (r"^HORIZON-MISS", ["climate","cities","research"]), (r"^HORIZON-EIC", ["innovation","startups","smes"]), (r"^HORIZON-EIT", ["innovation","entrepreneurship"]),
 (r"^ERC-", ["research"]), (r"^HORIZON-MSCA", ["research","education"]), (r"^HORIZON-RAISE", ["ai","research"]), (r"^HORIZON-WIDERA", ["research","regional-dev"]),
 (r"^HORIZON-EURATOM", ["energy","research"]), (r"^HORIZON-JU-EUROHPC", ["digital","it","research"]), (r"^HORIZON-JU-IHI", ["health","innovation"]),
 (r"^HORIZON-JU", ["research","innovation"]),
 (r"^DIGITAL-ECCC", ["cybersecurity","digital"]), (r"^DIGITAL-JU-CHIPS", ["digital","innovation"]), (r"^DIGITAL-.*-AI", ["ai","digital"]),
 (r"^DIGITAL-.*SKILLS", ["digital","education"]), (r"^DIGITAL", ["digital"]),
 (r"^CEF-T", ["transport","regional-dev"]), (r"^CEF-E", ["energy"]), (r"^CEF-DIG", ["digital"]),
 (r"^EDF", ["defence","innovation"]), (r"^CERV", ["human-rights","social-inclusion","civil-society"]),
 (r"^CREA-MEDIA", ["film","tv","media","creative-industries"]), (r"^JUST", ["justice","human-rights"]), (r"^ISF", ["security"]),
 (r"^ESF", ["social-inclusion","employment"]), (r"^SMP-FOOD", ["food"]), (r"^I3", ["innovation","regional-dev"]), (r"^JTM", ["regional-dev","climate"]),
 (r"^EUBA-EFSA", ["food","research"]), (r"^EUBA-EUAA", ["justice","research"]), (r"^PPPA-.*YOUTH", ["youth","media","digital"]), (r"^PPPA", ["digital","security"]),
 (r"^SOCPL", ["social-inclusion"]),
]
KW_SECTORS = [(r"\bhealth", "health"), (r"artificial intelligence|\bAI\b", "ai"), (r"\bfilm|audiovisual|video game", "film"), (r"cultur", "culture"), (r"\byouth|young people", "youth"), (r"climate", "climate"), (r"education|training|skills", "education")]

def sectors_for(rec, prog):
    cid = rec["id"]; s = []
    if rec["type"] == "x":
        s = list(rec.get("sectors") or [])
        text = " ".join([rec["title"], rec.get("description") or "", " ".join(rec.get("keywords") or [])])
        for rx, sec in KW_SECTORS + [(r"energy|photovolta|batter", "energy"), (r"biodivers|ecosystem|forest|water", "environment"), (r"\bcit(y|ies)\b|urban", "cities"), (r"start-?up", "startups"), (r"\bSMEs?\b", "smes"), (r"research|scien", "research"), (r"innovat", "innovation"), (r"civil society|\bCSOs?\b|NGO", "civil-society"), (r"\bRoma\b|inclusion", "social-inclusion"), (r"democra|rule of law|human rights", "democracy"), (r"digital|\bdata\b", "digital"), (r"heritage|\barts?\b", "culture"), (r"transport|mobility", "transport")]:
            if re.search(rx, text, re.I) and sec not in s: s.append(sec)
        return list(dict.fromkeys(s)) or ["other"]
    for rx, secs in SECTOR_RULES:
        if re.search(rx, cid, re.I): s += secs; break
    if rec["type"] == "2": s += ["intl-cooperation"]
    text = rec["title"] + " " + (rec.get("cascade") or {}).get("org","") if rec.get("cascade") else rec["title"]
    for rx, sec in KW_SECTORS:
        if re.search(rx, text, re.I) and sec not in s: s.append(sec)
    if rec["type"] == "8" and not s:
        base = {"HORIZON":["research","innovation"],"DIGITAL":["digital"],"CERV":["human-rights","civil-society"],"CREA":["culture"],"LIFE":["environment"],"SMP":["smes"]}.get(prog, [])
        s += base
    return list(dict.fromkeys(s)) or ["other"]

def applicants_for(rec, fulltext):
    cid = rec["id"]; tl = rec["title"]
    if rec["type"] == "x" and rec.get("applicants"):
        return list(rec["applicants"]), "From the source's target groups; check the call page."
    if rec["type"] in ("8", "x"):
        a = []
        if re.search(r"\bSMEs?\b|start-?ups?", fulltext, re.I): a += ["sme","startup"]
        if re.search(r"\bresearchers?\b|\buniversit", fulltext, re.I): a += ["researcher"]
        if re.search(r"\bstudents?\b", fulltext, re.I): a += ["student"]
        if re.search(r"\bCSOs?\b|civil society|NGOs?\b|non-profit", fulltext, re.I): a += ["ngo"]
        return list(dict.fromkeys(a)) or ["organisation"], "Derived from keywords in the call text."
    if "PRIZE" in cid: return ["individual"], "Prize: see rules of contest."
    if cid.startswith("ERC-"): return ["researcher"], "ERC grants: a Principal Investigator applies with a host institution."
    if "EIC-2026-ACCELERATOR" in cid: return ["sme","startup"], "EIC Accelerator: single SMEs and start-ups."
    if "EIC-2026-DEFENCE" in cid: return ["sme","startup"], "Limited to SMEs, start-ups and small mid-caps (call text)."
    if rec["type"] == "2": return ["organisation","ngo"], "External action grants: see the guidelines for applicants."
    a = ["organisation"]
    if cid.startswith(("CERV","JUST")): a += ["ngo","public"]
    if cid.startswith(("CEF","I3","JTM")): a += ["public"]
    if cid.startswith("HORIZON-MSCA"): a += ["university"]
    return a, "Any eligible legal entity, unless the call conditions say otherwise."

def partnership_for(rec):
    types = " ".join(rec.get("actionTypes") or [])
    cid = rec["id"]
    if rec["type"] != "1": return "unspecified", ""
    if "PRIZE" in cid: return "individual", ""
    if cid.startswith("ERC-") or "ACCELERATOR" in cid or "EIC-2026-DEFENCE" in cid: return "alone", ""
    if "Equity Only" in types: return "alone", ""
    if cid.startswith("HORIZON") and not cid.startswith("HORIZON-JU") and re.search(r"HORIZON-(RIA|IA)\b|Research and Innovation Actions|Innovation Actions", types):
        return "consortium", "Standard Horizon Europe rule for this type of action: at least three independent legal entities from three different eligible countries, one of them in an EU Member State (General Annexes, Annex B), unless the topic says otherwise."
    return "unspecified", ""

def type_for(rec):
    toa = " ".join(rec.get("actionTypes") or [])
    if rec["type"] == "8": return "cascade"
    if rec["type"] == "x": return rec.get("typeHint") or "grant"
    if "Equity Only" in toa: return "equity"
    if "Prize" in toa: return "prize"
    if "Pre-commercial Procurement" in toa or "Public Procurement of Innovative" in toa: return "procurement"
    if rec["type"] == "2": return "external"
    if "PRIZE" in rec["id"]: return "prize"
    if rec["id"].startswith(("ERC-","HORIZON-MSCA","HORIZON-")) : return "research-funding" if not rec["id"].startswith("HORIZON-EIC") else "grant"
    return "grant"

# ---------- normalise ----------
def d10(s): return str(s)[:10] if s else None
def clean(t): return re.sub(r'^"?>\s*', "", re.sub(r"[ \t]+"," ", html.unescape(t or "")).strip())

calls, audit_rows, dropped, unreviewed = [], [], [], []
for r in RECS:
    fp = r["fp"]; prog = r.get("prog") or FP2PROG.get(fp)
    if not prog:
        prog = "OTHER"
    t = r["type"]
    dl = sorted(set(r["dl"]))
    upcoming = [d for d in dl if deadline_instant(d) > NOW]
    url = r["url"]
    problems = []
    if t in ("8", "x") and not r.get("urlVerified"): problems.append("call page not verified")
    if t == "2": problems.append("EU external action (PROSPECT) call: the Portal topic page shows 'There is no data yet to be displayed' and the PROSPECT page requires EU Login, so the call page could not be verified")
    if not upcoming: problems.append("no upcoming deadline")
    if t == "1" and not (r.get("audit") or {}).get("exists"): problems.append("topic page JSON missing")
    status = r.get("callStatus") or "open"
    acts = (r.get("audit") or {}).get("actionStatus") or []
    if t == "1" and not ((status == "open" and "Open" in acts) or (status == "forthcoming" and "Forthcoming" in acts)): problems.append("topic status is neither Open nor Forthcoming")
    if t in ("1", "2") and not re.match(r"^https://(webgate\.)?ec\.europa\.eu/", url or ""): problems.append("unexpected URL")
    if t in ("8", "x") and not re.match(r"^https?://", url or ""): problems.append("unexpected URL")
    if url.rstrip("/").endswith(("calls-for-proposals","home")): problems.append("URL is not call-specific")
    if problems:
        dropped.append((r["id"], problems)); continue

    cas = r.get("cascade")
    title = clean(cas["org"]) if cas and cas.get("org") else clean(r["title"])
    fulltext = " ".join([r.get("conditions") or "", r.get("description") or "", (cas or {}).get("howTo","")])
    b = r.get("budget") or {}
    funding = {"topicBudget": b.get("total") or None, "expectedGrants": b.get("grants") or None,
               "minPerGrant": (b.get("min") or None), "maxPerGrant": (b.get("max") or None),
               "callBudget": r.get("budgetPlain"), "currency": r.get("currency") or ("EUR" if b else None)}
    if funding["currency"] not in (None, "EUR"):  # funding bands are in euros; no conversion is made
        pass
    per = funding["maxPerGrant"] or funding["minPerGrant"]
    approx = None
    if not per and funding["topicBudget"] and funding["expectedGrants"]:
        approx = round(funding["topicBudget"] / funding["expectedGrants"])
    funding["approxPerGrant"] = approx
    band_val = per or approx or (funding["callBudget"] if t != "1" else None)
    if funding["currency"] not in (None, "EUR"): band_val = None

    el = eligibility(r, prog)
    hits = r.get("restrictionHits") or []
    if hits and r["id"] not in REVIEWED:
        q = hits[0] if len(hits[0]) <= 300 else hits[0][:297] + "..."
        note = "The call text contains a participation restriction that has not been reviewed yet: \"" + q + "\" Check the call document."
        for c in COUNTRIES:
            if c not in EU27 and el[c][0] in ("Y", "P"):
                el[c] = ("C", note)
        unreviewed.append((r["id"], hits))
    reasons, emap = [], {}
    for c,(st,note) in el.items():
        if note not in reasons: reasons.append(note)
        emap[c] = [st, reasons.index(note)]
    apps, app_note = applicants_for(r, fulltext)
    part, part_note = partnership_for(r)
    notes = []
    if cid_note := CALL_NOTES.get(r["id"]): notes.append(cid_note)
    if re.search(r"controlled by China", fulltext): notes.append("Entities established in an eligible country but controlled by China or by a legal entity established in China are not eligible (restriction on control in critical technology areas, General Annex B).")
    if re.search(r"communication networks", fulltext): notes.append("Subject to restrictions for the protection of European communication networks.")
    if prog == "EDF": notes.append("Defence calls also apply rules on control by non-associated third countries. Check the call document.")
    if r["id"].startswith("EDF-EDIP"): notes.append("EDIP / Ukraine Support Instrument call: the call document sets its own eligibility rules, including for Ukrainian entities.")
    if t == "2": notes.append("Place of action: " + ", ".join(r.get("geoNames") or ["not stated"]) + ". Who can apply is defined in the guidelines for applicants.")
    if t == "8": notes.append("This is a call run by an EU-funded project (financial support to third parties), not by the Commission. The organiser sets the rules.")
    if t == "x": notes.append(f"Run by {r.get('organiser') or (r.get('progName') or 'the organiser')}. The organiser sets the rules; Eligible Calls reads this call from {r.get('sourceName')}.")
    notes += r.get("extraNotes") or []

    calls.append({
        "id": r["id"], "kind": t, "title": title, "callId": r.get("callId"), "callTitle": clean(r.get("callTitle")),
        "programme": prog, "programmeName": r.get("progName") or (PROGRAMMES.get(prog) or {}).get("name") or (NO_LIST.get(prog) or (None,r["fpName"]))[1],
        "division": [d for d in (r.get("divNames") or []) if not re.match(r"^\d+$", d)],
        "url": url, "urlKind": {"1":"topic","2":"prospect","8":"organiser","x":"organiser"}[t], "urlCheck": r.get("urlVerified"),
        "status": status, "opens": d10(r.get("opens") or r.get("start")), "deadlines": dl, "nextDeadline": upcoming[0], "deadlineModel": r.get("model"),
        "deadlineTime": "17:00" if t == "1" else None, "deadlineTz": "Europe/Brussels" if t == "1" else None,
        "deadlineTimeSource": "Portal topic page renders every grant deadline as <date> 17:00:00 Brussels time" if t == "1" else "as stated by the source (see ingest/deadlines.py)",
        "typesOfAction": r.get("actionTypes") or [],
        "funding": funding, "bandValue": band_val,
        "keywords": [k for k in (r.get("keywords") or []) if not re.match(r"^[A-Z0-9-]+$", k)][:12],
        "tags": (r.get("tags") or [])[:12],
        "conditions": clean(r.get("conditions")), "conditionsTruncated": (r["condLen"] > len(r.get("conditions") or "")) if "condLen" in r else len(r.get("conditions") or "") >= 2490,
        "description": clean(r.get("description") or (cas or {}).get("howTo","")), "descriptionTruncated": (r["descLen"] > len(r.get("description") or "")) if "descLen" in r else len(r.get("description") or "") >= 1590,
        "cascade": ({"project": cas.get("project"), "projectName": clean(cas.get("projectName")), "topic": clean(r["title"]), "info": clean(cas.get("furtherInfo")), "howTo": clean(cas.get("howTo"))} if cas else None),
        "place": r.get("geoNames") if t == "2" else None,
        "sectors": sectors_for(r, prog), "applicants": apps, "applicantNote": app_note,
        "partnership": part, "partnershipNote": part_note, "type": type_for(r),
        "eligibility": emap, "reasons": reasons, "notes": notes,
        "ruleSource": ("call" if r["id"] in CALL_RULES else ("programme-list" if prog in PROGRAMMES and t == "1" else ("source" if t in ("8", "x") and (r.get("countries") or {}).get("eligible") is not None else "none"))),
        "source": r.get("sourceName") or "EU Funding & Tenders Portal (search API + topic details)", "sourceKey": r.get("source") or "portal",
        "lastVerified": raw["fetchedAt"][:10],
    })

# The same call can reach several sources (e.g. an EIT call also listed as an EU project call).
# Keep the first by source priority. Duplicate = same title and next deadline date, or same call page with
# largely the same title (word overlap >= 50%) or the same deadline, listed by a different source.
# Calls listed separately by one source are kept even when they share a page (e.g. scholarships of different universities).
def _nk(s): return re.sub(r"[^a-z0-9]+", " ", (s or "").lower()).strip()
def _jac(a, b):
    a, b = set(_nk(a).split()), set(_nk(b).split())
    return len(a & b) / max(1, len(a | b))
_kept_x, _deduped, duplicates = [], [], []
for c in sorted(calls, key=lambda x: {"portal": 0, "eit": 1, "interreg": 2, "eeagrants": 3, "eralearn": 4, "esa": 5, "ukri": 6, "cascade": 9}.get(x["sourceKey"], 7)):
    if c["kind"] == "1":
        _deduped.append(c); continue
    u, d = c["url"].split("#")[0].rstrip("/").lower(), c["nextDeadline"][:10]
    dup = None
    for k in _kept_x:
        same_t = _nk(k["title"]) == _nk(c["title"]) and k["nextDeadline"][:10] == d
        same_u = k["url"].split("#")[0].rstrip("/").lower() == u
        other = k["sourceKey"] != c["sourceKey"]  # a source's own list is taken as distinct calls
        if same_t or (other and same_u and (_jac(k["title"], c["title"]) >= 0.5 or k["nextDeadline"][:10] == d)):
            dup = k; break
    if dup:
        duplicates.append((c["id"], dup["id"])); continue
    _kept_x.append(c); _deduped.append(c)
calls = _deduped
calls.sort(key=lambda x: x["nextDeadline"])
os.makedirs(OUT, exist_ok=True)
CALLS_PATH = os.path.join(OUT, "calls.json")
prev = json.load(open(CALLS_PATH, encoding="utf-8")) if os.path.exists(CALLS_PATH) else None
# firstSeen: when Eligible Calls first imported the call (None for calls present in the first import)
_prev_calls = {c["id"]: c for c in (prev or {}).get("calls", [])}
for c in calls:
    if c["id"] in _prev_calls:
        c["firstSeen"] = _prev_calls[c["id"]].get("firstSeen")
    else:
        c["firstSeen"] = raw["fetchedAt"] if prev else None
json.dump({"generated": raw["fetchedAt"], "source": raw["source"], "query": raw["query"], "counts": raw["counts"] | {"published": len(calls), "droppedAtBuild": len(dropped), "bySource": dict(collections.Counter(c["sourceKey"] for c in calls))},
           "sources": [{"key": "portal", "name": "EU Funding & Tenders Portal (grant topics)", "ok": True, "fetchedAt": raw["fetchedAt"]}] + [{"key": k, "name": s.get("name"), "ok": s.get("ok"), "fetchedAt": s.get("fetchedAt")} for k, s in EXTRA.get("sources", {}).items()],
           "statusLegend": {"Y":"Eligible","P":"Eligible with a condition","N":"Not eligible","C":"Not available from the source"},
           "countries": COUNTRIES,
           "calls": calls}, open(CALLS_PATH,"w",encoding="utf-8"), ensure_ascii=False, separators=(",",":"))

# ---------- change log: new, changed, closed ----------
def fsum(c): return (c.get("funding") or {}).get("topicBudget")
CH_PATH = os.path.join(OUT, "changes.json")
log = json.load(open(CH_PATH, encoding="utf-8")) if os.path.exists(CH_PATH) else {"events": []}
events = []
if prev and prev.get("generated") != raw["fetchedAt"]:
    old = {c["id"]: c for c in prev.get("calls", [])}
    new_ = {c["id"]: c for c in calls}
    for i, c in new_.items():
        if i not in old:
            events.append({"kind": "new", "id": i, "title": c["title"], "programme": c["programme"], "nextDeadline": c["nextDeadline"]})
            continue
        o = old[i]; diffs = {}
        for k, f in (("status", lambda x: x.get("status", "open")), ("deadlines", lambda x: x["deadlines"]), ("topicBudget", fsum), ("title", lambda x: x["title"]),
                     ("eligibility", lambda x: {cc: v[0] for cc, v in x["eligibility"].items()})):
            a, b = f(o), f(c)
            if k == "deadlines":  # ignore deadlines that simply passed
                a = [d for d in a if deadline_instant(d) > NOW]; b = [d for d in b if deadline_instant(d) > NOW]
            if a != b:
                if k == "eligibility":
                    diffs[k] = {cc: [a.get(cc), b.get(cc)] for cc in b if a.get(cc) != b.get(cc)}
                else:
                    diffs[k] = [a, b]
        if diffs:
            events.append({"kind": "changed", "id": i, "title": c["title"], "programme": c["programme"], "changes": diffs})
    for i, o in old.items():
        if i not in new_:
            passed = not any(deadline_instant(d) > NOW for d in o.get("deadlines", []))
            events.append({"kind": "closed", "id": i, "title": o["title"], "programme": o["programme"],
                           "reason": "deadline passed" if passed else "no longer listed as open by the source"})
for e in events: e["at"] = raw["fetchedAt"]
log = {"updated": raw["fetchedAt"], "events": (events + log.get("events", []))[:600]}
json.dump(log, open(CH_PATH, "w", encoding="utf-8"), ensure_ascii=False, separators=(",",":"))

# ---------- compact index for the chat assistant ----------
def excerpt(t, n):
    t = re.sub(r"\s+", " ", t or "").strip()
    return t if len(t) <= n else t[:n].rsplit(" ", 1)[0] + "..."
# Search terms for the assistant, precomputed so the Cloudflare function stays within its CPU limit.
# Must match terms() in src/core.js (test/chat.test.js checks this).
import unicodedata
STOP = set(("the and for with that this from are our we you your have has was were will can not but all any its into about what which who how when where why their they them also more most than then there these those such only other some very just over under onto via per our ours i me my am is be been being do does did a an of to in on at by or as it if so no yes "
            "i u na za sa se je su da od do po iz kao koji koja koje ili ali smo ste sam bi biti mi vi oni ona ono to taj ta te tu ovo ovaj ova kako sta šta gde kada zašto zasto koliko").split())
def _norm(t):
    t = unicodedata.normalize("NFD", (t or "").lower())
    return "".join(ch for ch in t if not 0x300 <= ord(ch) <= 0x36f).replace("đ", "dj")
def terms(t):
    return [w[:-2] if len(w) > 5 else w for w in re.split(r"[^a-z0-9]+", _norm(t)) if len(w) > 2 and w not in STOP]
def tf_of(e):
    tf = {}
    for text, w in ((e["t"], 3), (" ".join(e["k"]), 2), (" ".join(e["s"]), 2), (e["x"], 1), (e["p"], 1)):
        for term in terms(text):
            tf[term] = tf.get(term, 0) + w
    return tf

idx = [{"id": c["id"], "t": c["title"], "p": c["programme"], "dl": [d for d in c["deadlines"] if deadline_instant(d) > NOW],
        "ty": c["type"], "st": c["status"], "op": c["opens"], "s": c["sectors"], "a": c["applicants"], "pt": c["partnership"],
        "f": c["funding"]["maxPerGrant"] or c["funding"]["approxPerGrant"], "fb": c["funding"]["topicBudget"],
        "e": "".join(c["eligibility"][cc][0] for cc in COUNTRIES), "r": [c["eligibility"][cc][1] for cc in COUNTRIES], "rs": c["reasons"],
        "k": c["keywords"][:8], "x": excerpt(c["description"], 700), "n": c["notes"], "u": c["url"]} for c in calls]
inv = {}  # term -> [call position, weight, call position, weight, ...]
for i, e in enumerate(idx):
    e["dm"] = [int(deadline_instant(d).timestamp() * 1000) for d in e["dl"]]
    for term, w in tf_of(e).items():
        inv.setdefault(term, []).extend([i, w])
json.dump({"generated": raw["fetchedAt"], "inv": inv, "countries": COUNTRIES, "countryNames": {c: [NAMES[c], NAMES_SR[c]] for c in COUNTRIES}, "deadlineTime": "17:00", "deadlineTz": "Europe/Brussels", "calls": idx},
          open(os.path.join(OUT, "index.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",",":"))

# ---------- calls with unreviewed restrictions ----------
rv = ["# Calls with an unreviewed participation restriction", "",
      "Non-EU countries on these calls are shown as 'Not available from the source' until the call is reviewed.",
      "After checking the call document, either add a rule to CALL_RULES in build.py or add the id to ingest/reviewed.json.", ""]
for i, h in unreviewed:
    rv += [f"## {i}", *[f"- {x}" for x in h], ""]
if not unreviewed: rv.append("None.")
open(os.path.join(HERE, "review.md"), "w", encoding="utf-8").write("\n".join(rv))

progs_out = []
used = collections.Counter(c["programme"] for c in calls)
for k,v in PROGRAMMES.items():
    progs_out.append({"id":k,"name":v["name"],"short":v["short"],"summary":v["summary"],"list":v["list"]|{"checked":LIST_CHECKED},
                      "countries":{c:v["countries"].get(c, ["N","Not listed."] if v["complete"] else ["C",""]) for c in COUNTRIES},
                      "note":v.get("completeNote",""),"openCalls":used.get(k,0)})
for k,(fp,name,short) in NO_LIST.items():
    progs_out.append({"id":k,"name":name,"short":short,"summary":"","list":None,"countries":None,"note":"No list of participating countries was available on the Funding & Tenders Portal on 30.09.2026. Eligible countries are set in each call document.","openCalls":used.get(k,0)})
EXTRA_PROGS = {}
for r in RECS:
    if r.get("prog") and r["prog"] not in PROGRAMMES and r["prog"] not in NO_LIST and r["prog"] not in EXTRA_PROGS:
        EXTRA_PROGS[r["prog"]] = (r.get("progName") or r["prog"], r.get("progShort") or r.get("progName") or r["prog"], r.get("sourceName") or "")
for k,(name,short,src) in EXTRA_PROGS.items():
    progs_out.append({"id":k,"name":name,"short":short,"summary":"","list":None,"countries":None,"source":src,
                      "note":"Calls from " + src + ". Eligible countries are taken from the source where it states them; otherwise check each call.","openCalls":used.get(k,0)})
json.dump({"programmes":progs_out}, open(os.path.join(OUT,"programmes.json"),"w",encoding="utf-8"), ensure_ascii=False, indent=1)

# ---------- audit report ----------
st = collections.Counter(); byprog = collections.defaultdict(collections.Counter)
for c in calls:
    for cc,(s,_) in c["eligibility"].items(): st[s]+=1; byprog[c["programme"]][s]+=1
lines = [f"# Import audit — {raw['fetchedAt']}", "",
 f"- Search results (types grant/cfp/cascade, status Open): {raw['counts']['searchResults']} rows, {raw['counts']['unique']} unique",
 f"- Kept after topic check (topic page exists, status Open or Forthcoming, a deadline after {NOW.astimezone(BRU):%Y-%m-%d %H:%M} Brussels, deadlines counted at 17:00 Brussels): {raw['counts']['kept']}" + (f", of which forthcoming: {raw['counts']['keptForthcoming']}" if 'keptForthcoming' in raw['counts'] else ""),
 f"- Not published by design: EU external action calls {raw['counts'].get('uniqueByType', {}).get('2', 'n/a')} (the call page needs EU Login and could not be verified)",
 "", "## Other sources", *[f"- {s.get('name')}: {'OK' if s.get('ok') else 'FAILED (' + str(s.get('error')) + '), kept last good data from ' + str(s.get('fetchedAt'))} · " + ", ".join(f"{k} {v}" for k,v in (s.get('stats') or {}).items()) for s in EXTRA.get('sources', {}).values()], "",
 f"- Dropped at build: {len(dropped)}", f"- Duplicates across sources removed: {len(duplicates)}" + (" (" + "; ".join(i for i, _ in duplicates[:20]) + ")" if duplicates else ""), f"- Published: {len(calls)}",
 f"- Calls with an unreviewed participation restriction (non-EU set to 'check'): {len(unreviewed)}",
 f"- Changes since the previous import: {sum(e['kind']=='new' for e in events)} new, {sum(e['kind']=='changed' for e in events)} changed, {sum(e['kind']=='closed' for e in events)} closed", "",
 "## Calls by programme", *[f"- {k}: {v}" for k,v in used.most_common()], "",
 "## Eligibility answers (calls × countries)", *[f"- {k}: {v}" for k,v in st.items()], "",
 "## Calls with call-specific country rules", *[f"- {k}" for k in CALL_RULES], "",
 "## Dropped", *[f"- {i}: {p}" for i,p in dropped]]
open(os.path.join(OUT, "audit.md"),"w",encoding="utf-8").write("\n".join(lines))
print("\n".join(lines[:40]))

# ---------- taxonomy ----------
S = lambda i,en,sr: {"id":i,"en":en,"sr":sr}
tax = {
 "countryGroups": {"EU27": EU27},
 "countries": [{"id":c,"en":NAMES[c],"sr":NAMES_SR.get(c,NAMES[c]),"group":GROUP[c]} for c in COUNTRIES],
 "countryGroupLabels": {"EU27":["EU Member States","Države članice EU"],"EEA-EFTA":["EEA / EFTA","EEA / EFTA"],"WB6":["Western Balkans","Zapadni Balkan"],"EAST":["Eastern partnership and Türkiye","Istočno partnerstvo i Turska"],"OTHER":["Other","Ostalo"]},
 "sectors": [S("culture","Culture","Kultura"),S("film","Film","Film"),S("tv","Television","Televizija"),S("media","Media","Mediji"),S("creative-industries","Creative industries","Kreativne industrije"),
   S("architecture","Architecture","Arhitektura"),S("design","Design","Dizajn"),S("digital","Digital technology","Digitalne tehnologije"),S("it","IT and computing","IT i računarstvo"),S("ai","AI","Veštačka inteligencija"),
   S("cybersecurity","Cybersecurity","Sajber bezbednost"),S("innovation","Innovation","Inovacije"),S("research","Research","Istraživanje"),S("education","Education and skills","Obrazovanje i veštine"),S("youth","Youth","Mladi"),
   S("social-inclusion","Social inclusion","Socijalna inkluzija"),S("employment","Employment","Zapošljavanje"),S("human-rights","Human rights and equality","Ljudska prava i ravnopravnost"),S("democracy","Democracy","Demokratija"),
   S("civil-society","Civil society","Civilno društvo"),S("justice","Justice","Pravosuđe"),S("security","Security","Bezbednost"),S("defence","Defence","Odbrana"),S("health","Health","Zdravlje"),
   S("environment","Environment","Životna sredina"),S("climate","Climate","Klima"),S("energy","Energy","Energetika"),S("sustainability","Sustainability","Održivost"),S("food","Food and agriculture","Hrana i poljoprivreda"),
   S("transport","Transport","Saobraćaj"),S("cities","Cities","Gradovi"),S("regional-dev","Regional development","Regionalni razvoj"),S("intl-cooperation","International cooperation","Međunarodna saradnja"),
   S("entrepreneurship","Entrepreneurship","Preduzetništvo"),S("startups","Startups","Startapi"),S("smes","SMEs","MSP"),S("other","Other","Ostalo")],
 "sectorGroups": [
   {"id":"g-culture","en":"Culture and creative sectors","sr":"Kultura i kreativni sektori","sectors":["culture","film","tv","media","creative-industries","architecture","design"]},
   {"id":"g-film","en":"Film and audiovisual","sr":"Film i audiovizuelno","sectors":["film","tv"]},
   {"id":"g-tech","en":"Digital, AI and cybersecurity","sr":"Digitalno, AI i sajber bezbednost","sectors":["digital","it","ai","cybersecurity"]},
   {"id":"g-research","en":"Research and innovation","sr":"Istraživanje i inovacije","sectors":["research","innovation"]},
   {"id":"g-biz","en":"Startups and SMEs","sr":"Startapi i MSP","sectors":["startups","smes","entrepreneurship"]},
   {"id":"g-social","en":"Rights, inclusion and civil society","sr":"Prava, inkluzija i civilno društvo","sectors":["human-rights","social-inclusion","democracy","civil-society","justice","employment"]},
   {"id":"g-edu","en":"Education, skills and youth","sr":"Obrazovanje, veštine i mladi","sectors":["education","youth"]},
   {"id":"g-green","en":"Climate, energy and environment","sr":"Klima, energetika i životna sredina","sectors":["climate","energy","environment","sustainability"]},
   {"id":"g-mobility","en":"Transport and cities","sr":"Saobraćaj i gradovi","sectors":["transport","cities","regional-dev"]},
   {"id":"g-health","en":"Health and food","sr":"Zdravlje i hrana","sectors":["health","food"]},
   {"id":"g-security","en":"Security and defence","sr":"Bezbednost i odbrana","sectors":["security","defence"]},
   {"id":"g-intl","en":"International cooperation","sr":"Međunarodna saradnja","sectors":["intl-cooperation"]}],
 "applicants": [S("organisation","Organisation (any legal entity)","Organizacija (bilo koje pravno lice)"),S("sme","SME","MSP"),S("startup","Startup","Startap"),
   S("university","University or research organisation","Univerzitet ili istraživačka organizacija"),S("researcher","Researcher","Istraživač"),S("ngo","NGO / civil society","Udruženje / civilno društvo"),
   S("public","Public authority","Javni organ"),S("individual","Individual","Pojedinac"),S("student","Student","Student")],
 "applicantGroups": [
   {"id":"a-org","en":"organisation","sr":"organizacija","applicants":["organisation","university","ngo","public","sme","startup"]},
   {"id":"a-biz","en":"company, SME or startup","sr":"preduzeće, MSP ili startap","applicants":["sme","startup","organisation"]},
   {"id":"a-ngo","en":"NGO or civil society organisation","sr":"udruženje","applicants":["ngo","organisation"]},
   {"id":"a-public","en":"public authority","sr":"javni organ","applicants":["public","organisation"]},
   {"id":"a-uni","en":"university or research organisation","sr":"univerzitet ili istraživačka organizacija","applicants":["university","organisation"]},
   {"id":"a-res","en":"individual researcher","sr":"istraživač","applicants":["researcher"]},
   {"id":"a-ind","en":"individual","sr":"pojedinac","applicants":["individual","student","researcher"]}],
 "types": [S("grant","Grant","Grant"),S("research-funding","Research and innovation grant","Grant za istraživanje i inovacije"),S("prize","Prize","Nagrada"),S("equity","Equity investment (EIC Fund)","Vlasničko ulaganje (EIC fond)"),
   S("procurement","Innovation procurement grant (PCP/PPI)","Grant za inovativne nabavke (PCP/PPI)")],
 "partnership": [S("individual","Individual application","Pojedinačna prijava"),S("alone","Single applicant possible","Moguć jedan podnosilac"),
   S("consortium","Consortium required","Potreban konzorcijum"),S("unspecified","See call conditions","Vidi uslove poziva")],
 "fundingBands": [{"id":"b1","en":"Under €60,000","sr":"Do 60.000 €","min":0,"max":59999},{"id":"b2","en":"€60,000–€500,000","sr":"60.000–500.000 €","min":60000,"max":500000},
   {"id":"b3","en":"€500,000–€3 million","sr":"500.000 € – 3 miliona €","min":500001,"max":3000000},{"id":"b4","en":"€3 million–€10 million","sr":"3–10 miliona €","min":3000001,"max":10000000},
   {"id":"b5","en":"Over €10 million","sr":"Preko 10 miliona €","min":10000001,"max":None},{"id":"b0","en":"Not stated","sr":"Nije navedeno","min":None,"max":None}],
 "deadlineBuckets": [{"id":"week","en":"Closing within 7 days","sr":"Ističe u roku od 7 dana","days":7},{"id":"month","en":"Within 30 days","sr":"U roku od 30 dana","days":30},
   {"id":"quarter","en":"Within 3 months","sr":"U roku od 3 meseca","days":92},{"id":"later","en":"Later","sr":"Kasnije","days":None}],
}
json.dump(tax, open(os.path.join(OUT,"taxonomy.json"),"w",encoding="utf-8"), ensure_ascii=False, indent=1)
