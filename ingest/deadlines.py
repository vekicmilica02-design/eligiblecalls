"""Deadline strings shared by the importers, build.py, the site and the assistant.

Three forms:
  2026-11-30                       EU Funding & Tenders Portal grant topic: 17:00 Brussels time on that date.
  2026-11-30T12:00|Europe/Belgrade the organiser states a time and a time zone.
  2026-11-30|~                     the organiser states only a date. The call is treated as open until
                                   23:59 Brussels time on that date and the page says the time is not stated.
Strings sort by date. site/index.html (dlParse) and src/core.js (deadlineMs) read the same forms.
"""
import datetime, re
from zoneinfo import ZoneInfo

BRU = ZoneInfo("Europe/Brussels")
_FULL = re.compile(r"^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d)\|([A-Za-z_]+/[A-Za-z_]+)$")
_DATE = re.compile(r"^(\d{4})-(\d\d)-(\d\d)(\|~)?$")


def parse(s):
    """Return (aware datetime, kind) where kind is 'portal', 'time' or 'date'."""
    m = _FULL.match(s)
    if m:
        y, mo, d, h, mi, tz = m.groups()
        return datetime.datetime(int(y), int(mo), int(d), int(h), int(mi), tzinfo=ZoneInfo(tz)), "time"
    m = _DATE.match(s)
    if not m:
        raise ValueError(f"bad deadline string: {s!r}")
    y, mo, d, dateonly = m.groups()
    if dateonly:
        return datetime.datetime(int(y), int(mo), int(d), 23, 59, tzinfo=BRU), "date"
    return datetime.datetime(int(y), int(mo), int(d), 17, 0, tzinfo=BRU), "portal"


def instant(s):
    return parse(s)[0]


def date_of(s):
    return s[:10]


def label(s):
    dt, kind = parse(s)
    if kind == "portal":
        return "17:00 Brussels time"
    if kind == "time":
        return dt.strftime("%H:%M") + " " + str(dt.tzinfo).split("/")[-1].replace("_", " ") + " time"
    return "time not stated by the source"


def make(date, time=None, tz=None):
    """Build a non-Portal deadline string from a YYYY-MM-DD date and an optional HH:MM time and IANA zone."""
    if not re.match(r"^\d{4}-\d\d-\d\d$", date or ""):
        raise ValueError(f"bad date: {date!r}")
    if time and tz:
        ZoneInfo(tz)
        return f"{date}T{time}|{tz}"
    return f"{date}|~"
