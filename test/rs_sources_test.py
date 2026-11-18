"""python test/rs_sources_test.py  (no network): Serbian call deadlines and call selection, on sentences taken from the
institutions' own call pages (November 2026)."""
import os, sys, datetime
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "ingest"))
from translit import to_latin
from sources import rs_dates as D
from sources import rs_common as R

n = 0
def ok(cond, msg=""):
    global n
    assert cond, msg
    n += 1

# Transliteration: digraphs, capitals.
ok(to_latin("Љубав ЊЕГОШ Џеп Ђурђевак Ћирилица") == "Ljubav NJEGOŠ Džep Đurđevak Ćirilica", to_latin("Љубав ЊЕГОШ Џеп Ђурђевак Ћирилица"))

# Ministry of Tourism and Youth (Cyrillic): relative period, then the date; the date is split by stray spaces; the time
# is in a later sentence ("односно 24. новембра 2026. године до 15:30 часова").
mto = ("Рок и начин пријављивања на конкурс: Рок за достављање предлога програма и пројеката је 15 дана од дана објављивања "
       "конкурса, односно до 2 4 . новембра 2026. године. Конкурсна документација се предаје на писарницу министарства или "
       "шаље поштом, с тим да је неопходно да конкурсна документација послата поштом стигне на писарницу у року за конкурисање, "
       "односно 24. новембра 2026. године до 15:30 часова.")
r = D.find(mto)
ok(r and r["date"] == "2026-11-24" and r["time"] == "15:30", r)

# RAS (Latin): instrumental case of the month; a registration date in the conditions is not a deadline.
ras = ("TRAJANJE JAVNOG POZIVA – ROK ZA PODNOŠENJE PRIJAVA Javni poziv je objavljen 28. septembra 2026. godine, a prijave za "
       "učešće u Programu se mogu podneti najkasnije zaključno sa 26. novembrom 2026. godine. RASPOLOŽIVA SREDSTVA ... "
       "da je u trenutku podnošenja Prijave registrovan u APR, kao pravno lice ili preduzetnik, najkasnije do 1. januara 2023. godine;")
r = D.find(ras)
ok(r and r["date"] == "2026-11-26" and r["time"] is None, r)

# Science Fund (Cyrillic): numeric date and a time written with a dot.
fzn = "Пријаве Пројеката на овај Јавни позив подносе се искључиво у електронској форми, најкасније до 15.06.2026. године до 12.00 часова, по средњоевропском времену."
r = D.find(fzn)
ok(r and (r["date"], r["time"]) == ("2026-06-15", "12:00"), r)

# Ministry for Human and Minority Rights: a range "од 5. до 20. маја 2026".
mlj = "Конкурс је отворен за подношење предлога програма/пројеката организација цивилног друштва (удружења, фондације и задужбине) од 5. до 20. маја 2026. године."
r = D.find(mlj)
ok(r and r["date"] == "2026-05-20", r)

# Innovation Fund: the extension wins over the original date; "Затворен" marks a closed call.
ifa = "Јавни позив: Отворен до 16. новембра 2026. године у 12 часова. Рок за пријаву на програм Иновациона академија продужен је до 23. новембра 2026. године у 12 часова."
r = D.find(ifa)
ok(r and (r["date"], r["time"], r["closed"]) == ("2026-11-23", "12:00", False), r)
r = D.find("Пријаве се подносе путем Фондовог интернет портала и на енглеском језику. Јавни позив: Затворен Контакт: minigrants@inovacionifond.rs")
ok(r and r["closed"] and r["date"] is None, r)
r = D.find("Јавни позив је отворен до утрошка расположивих средстава у износу од 1,7 милиона евра. Пријаве се подносе континуирано до 31. марта 2027. године , односно до утрошка расположивих средстава.")
ok(r and r["date"] == "2027-03-31" and r["untilFunds"], r)

# "Rok ... je <date>" in a call document (Ministry of Tourism and Youth, .docx), numeric date with a space.
r = D.find("Рок за подношење захтева са пратећом документацијом је 24.3. 2026. године. Неблаговремени захтеви неће бити узети у разматрање.")
ok(r and r["date"] == "2026-03-24", r)

# A deadline only relative to publication, or an implementation date, is not a deadline.
ok(D.find("Рок за подношење пријава је 30 дана од дана објављивања јавног позива.") is None)
ok(D.find("Пројекти се реализују најкасније до 31. децембра 2027. године.") is None)

# Call selection: jobs, results, decisions, working groups, procurement and loans are not funding calls.
for t in ["ЈАВНИ КОНКУРС ЗА ПОПУЊАВАЊЕ ИЗВРШИЛАЧКИХ РАДНИХ МЕСТА У МИНИСТАРСТВУ ТУРИЗМА И ОМЛАДИНЕ",
          "Резултати Јавног конкурса за подршку јединицама локалне самоуправе",
          "Одлука о обустави Јавног конкурса за суфинансирање програма",
          "Јавни позив организацијама цивилног друштва за подношење кандидатуре за чланство у Радној групи за израду нацрта",
          "JAVNI POZIV - Program subvencionisanih kredita za nabavku opreme i obrtna sredstva „Kapital za razvoj“",
          "Јавни позив за избор туристичке агенције - организатора путовања за организацију полагања стручног испита",
          "Call for Program Board Members – From Lab to Market (Closed)"]:
    ok(not R.is_funding_call(t), t)
for t in ["Јавни конкурс за подршку јединицама локалне самоуправе у спровођењу омладинске политике на локалном нивоу",
          "JAVNI POZIV - Program podrške privrednim društvima za ulazak u lance dobavljača multinacionalnih kompanija",
          "Јавни конкурс „Спречавање дискриминације и насиља према Ромима”",
          "AI vaučeri"]:
    ok(R.is_funding_call(t), t)

# Applicant types from the call text.
ok(R.applicants("Право учешћа на конкурсу имају јединице локалне самоуправе које имају основану канцеларију за младе") == ["public"])
ok(R.applicants("Pravo učešća imaju udruženja, fondacije i zadužbine registrovane na teritoriji Republike Srbije") == ["ngo"])
ok(set(R.applicants("Pravo na podnošenje prijave imaju mikro, mala i srednja privredna društva i preduzetnici")) == {"sme"})
ok(set(R.applicants("Pravo učešća imaju naučnoistraživačke organizacije akreditovane u Republici Srbiji")) == {"university", "researcher"})

# Deadline strings in the site's format.
ok(R.deadline_string({"date": "2026-11-24", "time": "15:30"}) == "2026-11-24T15:30|Europe/Belgrade")
ok(R.deadline_string({"date": "2026-11-26", "time": None}) == "2026-11-26|~")
print(f"rs sources: {n} passed")
