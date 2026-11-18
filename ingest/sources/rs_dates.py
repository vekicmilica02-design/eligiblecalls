"""Deadlines of Serbian public calls, read from the call text (Latin or Cyrillic script).

Serbian institutions state the deadline in a sentence, not in a field: "najkasnije do 15.06.2026. godine do 12.00
časova", "zaključno sa 26. novembrom 2026. godine", "od 5. do 20. maja 2026. godine", "Rok ... produžen je do
23. novembra 2026. godine u 12 časova". A date counts as a deadline only when the words just before it are about
submitting applications (rok, prijave, podnošenje, dostavljanje, otvoren, produžen) and not about other conditions
("registrovan ... najkasnije do 1. januara 2023", "projekti se realizuju do ..."). When several such dates are found,
the latest is taken: an extension is announced after the original date. A deadline stated only relative to the
publication ("15 dana od dana objavljivanja") without a date is not used.
"""
import datetime, re, sys, os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from translit import to_latin  # noqa: E402

MONTHS = [("januar", 1), ("februar", 2), ("mart", 3), ("april", 4), ("maj", 5), ("jun", 6), ("jul", 7), ("avgust", 8),
          ("septemb", 9), ("oktob", 10), ("novemb", 11), ("decemb", 12)]
_MON = r"(januar\w*|februar\w*|mart\w*|april\w*|maj\w*|jun\w*|jul\w*|avgust\w*|septemb\w*|oktob\w*|novemb\w*|decemb\w*)"
DATE = re.compile(r"(?<!\d)(\d{1,2})\.\s*(?:" + _MON + r"|(\d{1,2})\.)\s*(\d{4})")
TIME = re.compile(r"^\.?\s*(?:godine)?\.?\s*,?\s*(?:u|do|najkasnije do)\s+(\d{1,2})(?:[:.](\d{2}))?\s*(?:časova|čas\w*|sati|h\b|č\b)")
SUBMIT = re.compile(r"rok\w*|prijav\w*|podno\w*|podnet\w*|dostav\w*|otvoren\w*|produž\w*|konkurisanj\w*|apliciranj\w*|predaj\w*")
BEFORE = re.compile(r"(?:\bdo|zaključno sa|zaključno do|najkasnije|zaključno|odnosno)\s*$")
NOT_DEADLINE = re.compile(r"registrov\w*|osnovan\w*|upisan\w*|realiz\w*|implement\w*|sprovo\w*|traj\w*|zaposl\w*|izveštaj\w*|završ\w*|objavljen\w*")
CLOSED = re.compile(r"javni poziv\s*:?\s*(je\s+)?zatvoren|konkurs\s*:?\s*(je\s+)?zatvoren|poziv za učešće [^.]{0,60}je zatvoren")
UNTIL_FUNDS = re.compile(r"do utroška")


def latin_text(t):
    """Lower-case Latin text with the spacing glitches of these pages repaired ("2 4 . novembra" -> "24. novembra")."""
    s = to_latin(t or "").lower()
    s = re.sub(r"\s+", " ", s)
    s = re.sub(r"(?<!\d)(\d) (\d) ?\.", r"\1\2.", s)
    return s


def _month(word):
    for stem, n in MONTHS:
        if word.startswith(stem):
            return n
    return None


def find(text, today=None):
    """Return {"date": "YYYY-MM-DD", "time": "HH:MM" or None, "closed": bool, "untilFunds": bool, "quote": str}
    or None when no deadline sentence is found. `today` (a date) only drops impossible years."""
    s = latin_text(text)
    closed = bool(CLOSED.search(s))
    found = []
    for m in DATE.finditer(s):
        d, mon_word, mon_num, y = m.group(1), m.group(2), m.group(3), m.group(4)
        mon = _month(mon_word) if mon_word else int(mon_num)
        try:
            dt = datetime.date(int(y), mon, int(d))
        except (TypeError, ValueError):
            continue
        before = s[max(0, m.start() - 220):m.start()]
        if not BEFORE.search(before.rstrip(" ,")) and not re.search(r"\bod \d{1,2}\.\s*do\s*$", before) \
                and not re.search(r"\brok\w*[^.]{0,100}\b(je|ističe)\s*$", before):
            continue
        near = before[-70:]
        if not SUBMIT.search(before) or NOT_DEADLINE.search(near):
            continue
        tm = TIME.match(s[m.end():m.end() + 45])
        hhmm = f"{int(tm.group(1)):02d}:{(tm.group(2) or '00')}" if tm and int(tm.group(1)) < 24 else None
        q0 = max(0, m.start() - 120)
        found.append((dt, hhmm, s[q0:m.end() + 40].strip()))
    if not found:
        return {"date": None, "time": None, "closed": closed, "untilFunds": bool(UNTIL_FUNDS.search(s)), "quote": ""} if closed else None
    dt, hhmm, quote = max(found, key=lambda x: (x[0], x[1] or ""))
    return {"date": dt.isoformat(), "time": hhmm, "closed": closed, "untilFunds": bool(UNTIL_FUNDS.search(s)), "quote": quote}
