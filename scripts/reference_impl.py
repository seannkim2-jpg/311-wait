"""Independent Python reference for the survival statistics.

Exists so the TypeScript in src/lib/stats.ts can be checked against a second,
separately written implementation rather than only against itself.
Run: python3 -I scripts/reference_impl.py
"""
import json, glob, datetime, os, math

QUERY_TIME = datetime.datetime(2026, 10, 24, 16, 0, 0)
COHORT_START = datetime.datetime(2026, 7, 1)
UNRESOLVED = {"Noted", "Transitioned"}


def parse_ts(ts):
    ts = ts.replace("+00", "").strip()
    for f in ("%Y-%m-%d %H:%M:%S.%f", "%Y-%m-%d %H:%M:%S",
              "%Y-%m-%dT%H:%M:%S.%f", "%Y-%m-%dT%H:%M:%S"):
        try:
            return datetime.datetime.strptime(ts, f)
        except ValueError:
            pass
    raise ValueError(ts)


def load(path):
    """-> list of (hours, cause). cause 0=censored, 1=resolved, 2=admin-closed."""
    obs = []
    for r in json.load(open(path))["result"]["records"]:
        opened = parse_ts(r["open_date"])
        if opened < COHORT_START:
            continue
        if r["case_status"] == "Closed" and r.get("close_date"):
            h = (parse_ts(r["close_date"]) - opened).total_seconds() / 3600
            if h < 0:
                continue
            obs.append((h, 2 if r.get("closure_reason") in UNRESOLVED else 1))
        elif r["case_status"] == "In progress":
            h = (QUERY_TIME - opened).total_seconds() / 3600
            if h >= 0:
                obs.append((h, 0))
    return obs


def kaplan_meier(obs):
    """obs: (hours, event_bool). Returns (median_or_None, final_S)."""
    event_times = sorted({t for t, e in obs if e})
    S = 1.0
    median = None
    for t in event_times:
        at_risk = sum(1 for tt, _ in obs if tt >= t)
        if at_risk == 0:
            continue
        d = sum(1 for tt, e in obs if tt == t and e)
        S *= 1 - d / at_risk
        if median is None and S <= 0.5:
            median = t
    return median, S


def aalen_johansen(obs):
    """obs: (hours, cause). Returns {cause: cumulative_incidence}, still_unresolved."""
    times = sorted({t for t, c in obs if c in (1, 2)})
    S = 1.0
    cif = {1: 0.0, 2: 0.0}
    for t in times:
        at_risk = sum(1 for tt, _ in obs if tt >= t)
        if at_risk == 0:
            continue
        d1 = sum(1 for tt, c in obs if tt == t and c == 1)
        d2 = sum(1 for tt, c in obs if tt == t and c == 2)
        cif[1] += S * d1 / at_risk
        cif[2] += S * d2 / at_risk
        S *= 1 - (d1 + d2) / at_risk
    return cif, S


def main():
    out = {
        "_comment": "Golden values from scripts/reference_impl.py, an independent Python "
                    "implementation run on the real 2026-07-01 cohort. src/lib/stats.ts "
                    "must reproduce these within tolerance.",
        "queryTime": QUERY_TIME.isoformat(),
        "cohortStart": COHORT_START.isoformat(),
        "services": {},
    }
    for path in sorted(glob.glob("/tmp/km_*.json")):
        obs = load(path)
        if not obs:
            continue
        name = os.path.basename(path)[3:-5]
        events = [h for h, c in obs if c in (1, 2)]
        censored = [h for h, c in obs if c == 0]
        naive = sorted(events)[len(events) // 2]
        km_median, km_final = kaplan_meier([(h, c in (1, 2)) for h, c in obs])
        cif, still = aalen_johansen(obs)
        out["services"][name] = {
            "n": len(obs),
            "events": len(events),
            "censored": len(censored),
            "censoredPct": round(100 * len(censored) / len(obs), 1),
            "naiveMedianHours": round(naive, 4),
            "kmMedianHours": None if km_median is None else round(km_median, 4),
            "kmFinalSurvival": round(km_final, 6),
            "cifResolved": round(cif[1], 6),
            "cifAdminClosed": round(cif[2], 6),
            "stillUnresolved": round(still, 6),
        }
    dest = "src/lib/__fixtures__/golden.json"
    with open(dest, "w") as fh:
        json.dump(out, fh, indent=2)
        fh.write("\n")
    print(f"wrote {dest}")
    for k, v in out["services"].items():
        km = "never reached" if v["kmMedianHours"] is None else f"{v['kmMedianHours']/24:.2f} d"
        print(f"  {k:20s} naive={v['naiveMedianHours']/24:6.2f} d  km={km:>14s}  "
              f"resolved={100*v['cifResolved']:.1f}%")


if __name__ == "__main__":
    main()
