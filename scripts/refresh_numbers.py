"""Re-pull every Wait Audit figure from the live Boston 311 endpoint, check it, and save it.

Writes data/numbers.json (for any agent or the UI) and docs/research/NUMBERS.md (for people),
then lints the live docs for claims we can't source and for figures already shown to be wrong.
Exits non-zero if a self-check or the claim lint fails, so run it before filming or submitting.

Run: python3 -m pip install lifelines && python3 scripts/refresh_numbers.py
     python3 scripts/refresh_numbers.py --lint-only   # no network, just lint the docs
"""
import datetime as dt
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from reference_impl import parse_ts, kaplan_meier, aalen_johansen, median  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RESOURCE = "254adca6-64ab-4c5c-9fc0-a6da622be185"
SQL_URL = "https://data.boston.gov/api/3/action/datastore_search_sql"
META_URL = f"https://data.boston.gov/api/3/action/resource_show?id={RESOURCE}"
COHORT_START = "2026-07-01"
COHORT = f"open_date::timestamp >= '{COHORT_START}'"
NOT_RESOLVED = ("Noted", "Transitioned")  # dictionary: no action required / reassigned to another agency
HEADLINE = ("Litter & Debris", "Pothole", "Street Light Outage", "Sidewalk Repair")
MIN_SERVICE_N = 200  # same floor as fetchServices() in src/lib/boston311.ts

# Docs a judge or agent reads as current. docs/research/ is the dated history and is exempt.
LIVE_DOCS = ["README.md", "docs/ANALYSIS.md", "docs/PLAN.md", "docs/ROADMAP.md",
             "docs/UI-DESIGN.md", "docs/UI-PLAN.md", "docs/KIRO-USAGE.md", "docs/DEMO.md",
             ".kiro/steering", ".kiro/specs", "src"]
BANNED = {
    r"computed \W*only over|excludes open cases|only (over|counts) closed": "no source says how Boston computes its on-time rate",
    r"city'?s own (measure|method|way of measuring|figure|number|metric)|city'?s method": "say 'median among closed cases'",
    r"city-style": "say 'median among closed cases'",
    r"city'?s published (figure|median|number)|publish(es|ed)? (an? )?\W*(on-time rate|median)": "Boston publishes no 311 median; CityScore's on-time rules are undocumented",
    r"published (311 )?on-time rate": "CityScore has per-service on-time measures only; calculation unsourced",
    r"not (actually )?fixed|never (actually )?(resolved|fixed)|without being (fixed|resolved)|genuine(ly)? \W*resol":
        "Noted = no action required, Transitioned = reassigned to another agency; say 'closed as Noted or Transitioned'",
    r"(?<![\d,])7,840(?![\d,])": "stale all-time overdue count; use data/numbers.json",
    r"\b(122|361|449)[ -]?d(ay)?\b": "came from the contaminated pre-cohort tail",
}


def sql(query):
    url = f"{SQL_URL}?{urllib.parse.urlencode({'sql': query})}"
    for attempt in range(3):
        try:
            with urllib.request.urlopen(url, timeout=120) as res:
                body = json.load(res)
            if not body.get("success"):
                raise RuntimeError(body.get("error"))
            return body["result"]["records"]
        except OSError:
            if attempt == 2:
                raise
            time.sleep(5)


def q(s):
    return "'" + s.replace("'", "''") + "'"


def days(hours):
    return None if hours is None else round(hours / 24, 2)


def pct(a, b):
    return None if not b else round(100 * a / b, 1)


def aj(obs):
    """Aalen-Johansen via lifelines; reference_impl's version is O(n^2) and too slow for 40 services."""
    from lifelines import AalenJohansenFitter
    d, e = [h for h, _ in obs], [c for _, c in obs]
    cif = {}
    for cause in (1, 2):
        cif[cause] = 0.0 if cause not in e else float(
            AalenJohansenFitter(calculate_variance=False).fit(d, e, event_of_interest=cause)
            .cumulative_density_.iloc[-1, 0])
    return cif, 1 - cif[1] - cif[2]


def service_stats(name, cutoff):
    from lifelines import KaplanMeierFitter
    from lifelines.utils import median_survival_times

    rows = sql(f"""SELECT case_status, closure_reason, on_time, open_date, close_date,
                          target_close_date FROM "{RESOURCE}"
                   WHERE {COHORT} AND service_name = {q(name)}
                     AND case_status IN ('Closed','In progress') LIMIT 32000""")
    assert len(rows) < 32000, f"{name}: hit the row cap, results would be truncated"
    obs, targets, closed_ontime, open_overdue, oldest_open = [], [], 0, 0, 0.0
    for r in rows:
        opened = parse_ts(r["open_date"])
        if r["target_close_date"]:
            targets.append((parse_ts(r["target_close_date"]) - opened).total_seconds() / 3600)
        if r["case_status"] == "Closed" and r["close_date"]:
            h = (parse_ts(r["close_date"]) - opened).total_seconds() / 3600
            if h < 0:
                continue  # same rule as toObservations(): drop clock-skew rows
            obs.append((h, 2 if r["closure_reason"] in NOT_RESOLVED else 1))
            closed_ontime += r["on_time"] == "ONTIME"
        elif r["case_status"] == "In progress":
            h = (cutoff - opened).total_seconds() / 3600
            if h >= 0:
                obs.append((h, 0))
                open_overdue += r["on_time"] == "OVERDUE"
                oldest_open = max(oldest_open, h)

    closed = [h for h, c in obs if c]
    n_open = len(obs) - len(closed)
    kmf = KaplanMeierFitter().fit([h for h, _ in obs], [c != 0 for _, c in obs])
    km = None if kmf.median_survival_time_ == float("inf") else float(kmf.median_survival_time_)
    lo, hi = (float(x) for x in median_survival_times(kmf.confidence_interval_).iloc[0])
    cif, still = aj(obs)
    naive = median(closed) if closed else None
    return {
        "n": len(obs),
        "closed": len(closed),
        "open": n_open,
        "openPct": pct(n_open, len(obs)),
        "openPastTarget": open_overdue,
        "oldestOpenDays": days(oldest_open),
        "medianTargetDays": days(median(targets)) if targets else None,
        "medianClosedOnlyDays": days(naive),
        "kmMedianDays": days(km),
        "kmMedian95CI": [None if lo == float("inf") else days(lo),
                         None if hi == float("inf") else days(hi)],
        "kmToClosedOnlyRatio": round(km / naive, 2) if km and naive else None,
        "kmFinalSurvival": round(float(kmf.survival_function_.iloc[-1, 0]), 4),
        "resolvedPct": round(100 * cif[1], 1),
        "notedOrTransitionedPct": round(100 * cif[2], 1),
        "stillOpenPct": round(100 * still, 1),
        "onTimeAmongClosedPct": pct(closed_ontime, len(closed)),
        # Open cases already past target are late whatever happens next; open cases not yet
        # due are undecided, so they stay out of both numerator and denominator.
        "onTimeCountingOverdueOpenPct": pct(closed_ontime, len(closed) + open_overdue),
        "_obs": obs,
    }


def lint_docs():
    hits = []
    for entry in LIVE_DOCS:
        path = os.path.join(ROOT, entry)
        if not os.path.exists(path):
            continue
        files = [path] if os.path.isfile(path) else [
            os.path.join(d, f) for d, _, fs in os.walk(path) for f in fs
            if f.endswith((".md", ".ts", ".tsx")) and "__fixtures__" not in d]
        for f in files:
            for i, line in enumerate(open(f, encoding="utf-8"), 1):
                if re.search(r"\b(never|do not|don't) (call|say|use)\b", line, re.I):
                    continue  # a guardrail naming the bad figure is fine
                for pat, why in BANNED.items():
                    if re.search(pat, line, re.I):
                        hits.append(f"{os.path.relpath(f, ROOT)}:{i}: {why}")
    return hits


def refresh():
    failures = []
    meta = json.load(urllib.request.urlopen(META_URL, timeout=60))["result"]
    snap = sql(f'SELECT MAX(open_date::timestamp) mo, MAX(close_date::timestamp) mc FROM "{RESOURCE}"')[0]
    # Open cases are censored when the extract was cut, not when we run: using "now" pads
    # every open case's wait by however stale the extract is, which inflates the KM median.
    cutoff = max(parse_ts(snap["mo"]), parse_ts(snap["mc"]))
    pulled = dt.datetime.now(dt.timezone.utc).replace(microsecond=0, tzinfo=None)

    monthly = sql(f"""SELECT to_char(date_trunc('month', open_date::timestamp), 'YYYY-MM') m,
                             COUNT(*) n FROM "{RESOURCE}" GROUP BY 1 ORDER BY 1""")
    status = sql(f"""SELECT case_status, on_time, COUNT(*) n FROM "{RESOURCE}"
                     WHERE {COHORT} GROUP BY 1, 2 ORDER BY 1, 2""")
    reasons = sql(f"""SELECT closure_reason, COUNT(*) n FROM "{RESOURCE}"
                      WHERE {COHORT} AND case_status='Closed' GROUP BY 1 ORDER BY 2 DESC""")
    hoods = sql(f"""SELECT neighborhood, COUNT(*) n,
                           SUM(CASE WHEN latitude IS NOT NULL THEN 1 ELSE 0 END) mappable
                    FROM "{RESOURCE}" WHERE {COHORT} AND case_status='In progress'
                      AND on_time='OVERDUE' GROUP BY 1 ORDER BY 2 DESC""")
    svc_list = sql(f"""SELECT service_name, COUNT(*) n FROM "{RESOURCE}"
                       WHERE {COHORT} AND case_status IN ('Closed','In progress')
                       GROUP BY 1 HAVING COUNT(*) >= {MIN_SERVICE_N} ORDER BY 2 DESC""")

    by = {(r["case_status"], r["on_time"]): int(r["n"]) for r in status}
    n = sum(by.values())
    closed = sum(v for (s, _), v in by.items() if s == "Closed")
    open_now = sum(v for (s, _), v in by.items() if s == "In progress")
    reason_n = {r["closure_reason"] or "(blank)": int(r["n"]) for r in reasons}
    not_resolved = sum(reason_n.get(r, 0) for r in NOT_RESOLVED)
    cohort = {
        "cases": n,
        "closed": closed,
        "open": open_now,
        "otherStatus": n - closed - open_now,
        "openPastTarget": by.get(("In progress", "OVERDUE"), 0),
        "openNotYetDue": by.get(("In progress", "ONTIME"), 0),
        "closedNotedOrTransitioned": not_resolved,
        "closedNotedOrTransitionedPct": pct(not_resolved, closed),
        "closureReasons": reason_n,
        "onTimeAmongClosedPct": pct(by.get(("Closed", "ONTIME"), 0), closed),
        "onTimeCountingOverdueOpenPct": pct(by.get(("Closed", "ONTIME"), 0),
                                            closed + by.get(("In progress", "OVERDUE"), 0)),
    }

    services = {}
    for s in svc_list:
        print(f"  {s['service_name']} ...", flush=True)
        services[s["service_name"]] = service_stats(s["service_name"], cutoff)

    # --- self-checks ---
    def check(cond, msg):
        if not cond:
            failures.append(msg)

    check(cohort["otherStatus"] < 0.01 * n, f"{cohort['otherStatus']} cohort cases in other statuses")
    check(sum(reason_n.values()) == closed, "closure reasons don't sum to closed cases")
    age_h = (pulled - cutoff).total_seconds() / 3600
    check(age_h < 48, f"extract cutoff is {age_h:.0f} h old; the city may have stopped refreshing it")
    full = [int(r["n"]) for r in monthly if r["m"] >= COHORT_START[:7]][:-1]  # last month is partial
    check(not full or min(full) > 0.7 * max(full),
          f"cohort months are uneven {full}; the cohort window may no longer be complete")
    for name, v in services.items():
        total = v["resolvedPct"] + v["notedOrTransitionedPct"] + v["stillOpenPct"]
        check(abs(total - 100) < 0.2, f"{name}: CIF parts sum to {total}")
    for name in HEADLINE:
        if name not in services:
            failures.append(f"headline service {name!r} missing from the cohort")
            continue
        # Second, independently written implementation for the four services we quote.
        obs = services[name]["_obs"]
        ref_km, _ = kaplan_meier([(h, c != 0) for h, c in obs])
        ours = services[name]["kmMedianDays"]
        check((ref_km is None and ours is None) or (
            ref_km is not None and ours is not None and abs(ref_km / 24 - ours) < 0.01),
            f"{name}: lifelines KM {ours} d vs reference_impl {days(ref_km)} d")
        ref_cif, _ = aalen_johansen(obs)
        check(abs(100 * ref_cif[1] - services[name]["resolvedPct"]) < 0.1,
              f"{name}: lifelines resolved CIF vs reference_impl {100 * ref_cif[1]:.1f}%")
    for v in services.values():
        del v["_obs"]

    out = {
        "_about": "Generated by scripts/refresh_numbers.py; rerun it rather than editing. "
                  "Durations in days. Open cases are censored at extractCutoffUtc.",
        "pulledAtUtc": pulled.isoformat() + "Z",
        "extractCutoffUtc": cutoff.isoformat(timespec="seconds") + "Z",
        "datasetLastModified": meta.get("last_modified"),
        "resourceId": RESOURCE,
        "cohortStart": COHORT_START,
        "maxObservableDays": round((cutoff - parse_ts(COHORT_START + " 00:00:00")).total_seconds() / 86400, 1),
        "monthlyCases": {r["m"]: int(r["n"]) for r in monthly},
        "cohort": cohort,
        "openPastTargetByNeighborhood": {
            r["neighborhood"] or "(blank)": {"n": int(r["n"]), "mappable": int(r["mappable"])}
            for r in hoods},
        "services": services,
        "selfCheckFailures": failures,
    }
    os.makedirs(os.path.join(ROOT, "data"), exist_ok=True)
    with open(os.path.join(ROOT, "data/numbers.json"), "w") as fh:
        json.dump(out, fh, indent=2, ensure_ascii=False)
        fh.write("\n")
    with open(os.path.join(ROOT, "docs/research/NUMBERS.md"), "w") as fh:
        fh.write(render_md(out))
    print("wrote data/numbers.json and docs/research/NUMBERS.md")
    return failures


def render_md(o):
    c = o["cohort"]
    mappable = sum(v["mappable"] for v in o["openPastTargetByNeighborhood"].values())
    lines = [
        "# Wait Audit numbers",
        "",
        f"Generated by `scripts/refresh_numbers.py` at {o['pulledAtUtc']}. **Do not edit by hand;** "
        "rerun the script. Machine-readable copy: [`data/numbers.json`](../../data/numbers.json).",
        "",
        f"- Source: Analyze Boston, *311 Service Requests – NEW SYSTEM* (`{o['resourceId']}`), "
        f"last loaded {o['datasetLastModified']} UTC.",
        f"- Extract cutoff (latest timestamp in the data): **{o['extractCutoffUtc']}**. Open cases "
        "are timed to this cutoff, not to when the page is viewed.",
        f"- Cohort: cases opened on or after {o['cohortStart']}. Longest possible observed wait: "
        f"{o['maxObservableDays']} days.",
        "",
        "## Wording rules (see `claim-check.md` for sources)",
        "",
        "- Compare the **median among closed cases** with the **estimate including open cases** "
        "(Kaplan–Meier). Do not call the first one the city's method or the city's figure.",
        "- Do not say Boston's on-time rate is computed only over closed cases; nothing we found "
        "documents how it is computed.",
        "- `Noted` means no action is required and `Transitioned` means reassigned to another agency "
        "(311 data dictionary). Say *closed as Noted or Transitioned*, not *never fixed*.",
        "- The `on_time` column is filled for open cases too. For an open case, OVERDUE means it is "
        "already past its target close date.",
        "",
        "## Cohort",
        "",
        "| Measure | Value |",
        "| --- | --- |",
        f"| Cases opened since {o['cohortStart']} | {c['cases']:,} |",
        f"| Closed | {c['closed']:,} |",
        f"| Still open | {c['open']:,} |",
        f"| Still open and past the city's target date | **{c['openPastTarget']:,}** |",
        f"| Still open, not yet due | {c['openNotYetDue']:,} |",
        f"| Other statuses (Create, Needs Reallocation) | {c['otherStatus']:,} |",
        f"| Closed as Noted or Transitioned | **{c['closedNotedOrTransitioned']:,} of {c['closed']:,} "
        f"= {c['closedNotedOrTransitionedPct']}%** |",
        f"| Closure reasons | {', '.join(f'{k} {v:,}' for k, v in c['closureReasons'].items())} |",
        f"| On time, among closed cases | {c['onTimeAmongClosedPct']}% |",
        f"| On time, counting open cases already past target as late | {c['onTimeCountingOverdueOpenPct']}% |",
        "",
        f"Open and past target: {mappable:,} of {c['openPastTarget']:,} have coordinates for the map.",
        "",
        "## By service",
        "",
        f"Every service with at least {MIN_SERVICE_N} cases in the cohort, largest first. Days. "
        "Headline services in bold.",
        "",
        "| Service | n | Open | Target | Median, closed only | Estimate incl. open (95% CI) | Ratio "
        "| Resolved | Noted or Transitioned | Still open | Open past target |",
        "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ]
    for name, v in o["services"].items():
        km = "not reached" if v["kmMedianDays"] is None else f"{v['kmMedianDays']}"
        lo, hi = v["kmMedian95CI"]
        ci = "" if lo is None else f" ({lo}–{'∞' if hi is None else hi})"
        ratio = f"{v['kmToClosedOnlyRatio']}×" if v["kmToClosedOnlyRatio"] else "—"
        b = "**" if name in HEADLINE else ""
        lines.append(
            f"| {b}{name}{b} | {v['n']:,} | {v['openPct']}% | {v['medianTargetDays']} | "
            f"{v['medianClosedOnlyDays']} | {km}{ci} | {ratio} | {v['resolvedPct']}% | "
            f"{v['notedOrTransitionedPct']}% | {v['stillOpenPct']}% | {v['openPastTarget']:,} |")
    lines += [
        "",
        "Resolved, Noted-or-Transitioned and still-open are Aalen–Johansen cumulative incidence at "
        "the longest observed wait. Target is the median of `target_close_date − open_date`. "
        "Ratio is the estimate including open cases divided by the median among closed cases.",
        "",
        "## Open and past target, by neighborhood",
        "",
        "| Neighborhood | Cases | With coordinates |",
        "| --- | ---: | ---: |",
    ] + [f"| {k} | {v['n']:,} | {v['mappable']:,} |"
         for k, v in o["openPastTargetByNeighborhood"].items()] + [
        "",
        "## Cases per month in the resource (why the cohort starts in July 2026)",
        "",
        "| Month | Cases |",
        "| --- | ---: |",
    ] + [f"| {m} | {n:,} |" for m, n in o["monthlyCases"].items()]
    if o["selfCheckFailures"]:
        lines += ["", "## ⚠️ Self-check failures", ""] + [f"- {f}" for f in o["selfCheckFailures"]]
    return "\n".join(lines) + "\n"


def main():
    failures = [] if "--lint-only" in sys.argv else refresh()
    hits = lint_docs()
    print(f"\nClaim lint: {len(hits)} problem(s)")
    for h in hits:
        print("  ", h)
    if failures:
        print("\nSELF-CHECK FAILURES:")
        for f in failures:
            print("  -", f)
    sys.exit(1 if failures or hits else 0)


if __name__ == "__main__":
    main()
