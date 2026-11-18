"""Serbian Cyrillic to Latin script (Serbian standard: Љ -> Lj, Њ -> Nj, Џ -> Dž, Ђ -> Đ, Ћ -> Ć, Ж -> Ž, Ч -> Č, Ш -> Š).

Used by the Serbian sources: titles are shown in Latin script (the site's Serbian is Latin), and the deadline reader
works on Latin text so one set of patterns covers pages written in either script.
"""

_MAP = {
    "А": "A", "Б": "B", "В": "V", "Г": "G", "Д": "D", "Ђ": "Đ", "Е": "E", "Ж": "Ž", "З": "Z", "И": "I", "Ј": "J", "К": "K",
    "Л": "L", "Љ": "Lj", "М": "M", "Н": "N", "Њ": "Nj", "О": "O", "П": "P", "Р": "R", "С": "S", "Т": "T", "Ћ": "Ć", "У": "U",
    "Ф": "F", "Х": "H", "Ц": "C", "Ч": "Č", "Џ": "Dž", "Ш": "Š",
}
_MAP.update({k.lower(): v.lower() for k, v in _MAP.items()})


def to_latin(s):
    """Transliterate Serbian Cyrillic; other characters are kept. A capital digraph is written in full capitals when
    the next letter is also a capital (ЉУБАВ -> LJUBAV), otherwise as Lj / Nj / Dž (Љубав -> Ljubav)."""
    s = str(s or "")
    out = []
    for i, ch in enumerate(s):
        v = _MAP.get(ch)
        if v is None:
            out.append(ch)
            continue
        if len(v) == 2 and ch.isupper():
            nxt = s[i + 1] if i + 1 < len(s) else ""
            if nxt.isupper():
                v = v.upper()
        out.append(v)
    return "".join(out)
