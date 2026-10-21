"""Run the non-Portal importers and write ingest/extra.json for build.py.

Each source runs on its own. If a source fails, its records from the last successful run are kept
for up to 3 days (build.py still drops any call whose deadline has passed), and the failure is
recorded in extra.json and in the audit.
Link checks are cached in ingest/extra_state.json (24 hours for a passed check, 6 hours for a failed one).
"""
import datetime, importlib, json, os, sys, traceback

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from sources import common as C

SOURCES = ["cascade", "interreg", "eeagrants", "eralearn", "ukri", "eit", "esa"]
KEEP_HOURS = 72


def main(only=None):
    out_path = os.path.join(HERE, "extra.json")
    state_path = os.path.join(HERE, "extra_state.json")
    prev = json.load(open(out_path, encoding="utf-8")) if os.path.exists(out_path) else {"sources": {}}
    state = json.load(open(state_path, encoding="utf-8")) if os.path.exists(state_path) else {"verify": {}}
    cache = {k: v for k, v in state.get("verify", {}).items() if v.get("until", "") > C.NOW.isoformat()}
    result = {"fetchedAt": C.NOW.strftime("%Y-%m-%dT%H:%M:%S.000Z"), "sources": {}}
    for key in SOURCES:
        if only and key not in only:
            if key in prev.get("sources", {}):
                result["sources"][key] = prev["sources"][key]
            continue
        mod = importlib.import_module(f"sources.{key}")
        try:
            recs, stats = mod.run(cache, {})
            result["sources"][key] = {"name": mod.NAME, "ok": True, "fetchedAt": result["fetchedAt"], "stats": stats, "records": recs}
            print(f"{key}: {json.dumps(stats)}")
        except Exception as e:  # keep the last good data for this source
            traceback.print_exc()
            old = prev.get("sources", {}).get(key)
            keep = old and old.get("ok") and (C.NOW - datetime.datetime.fromisoformat(old["fetchedAt"].replace("Z", "+00:00"))).total_seconds() < KEEP_HOURS * 3600
            result["sources"][key] = {"name": mod.NAME, "ok": False, "error": f"{type(e).__name__}: {e}"[:300],
                                      "fetchedAt": old["fetchedAt"] if keep else None, "stats": old.get("stats") if keep else {},
                                      "records": old["records"] if keep else []}
            print(f"{key}: FAILED ({e}); kept {len(result['sources'][key]['records'])} records from the last run")
        state["verify"] = cache
        json.dump(state, open(state_path, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    json.dump(result, open(out_path, "w", encoding="utf-8"), ensure_ascii=False)
    total = sum(len(s["records"]) for s in result["sources"].values())
    print(f"extra records: {total}")


if __name__ == "__main__":
    main(set(sys.argv[1:]) or None)
