"""Check every number behind "Make the case" before it goes on screen, and again after.

Written before the feature, so the page has something independent to be tested against.
Standard library only, so anyone can run it; its Kaplan-Meier is written separately from
src/lib/stats.ts on purpose.

  python3 scripts/check_make_the_case.py            # live: recheck figures, write data/make-the-case.json
  python3 scripts/check_make_the_case.py --golden   # offline: write the TypeScript cross-check fixture
  python3 scripts/check_make_the_case.py --compare page.json   # compare figures read off the page

Exits non-zero if a check fails.
"""
import bisect
import datetime as dt
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BOSTON = "254adca6-64ab-4c5c-9fc0-a6da622be185"
BOSTON_SQL = "https://data.boston.gov/api/3/action/datastore_search_sql"
CAMBRIDGE = "https://data.cambridgema.gov/resource/2z9k-mv9g.json"
COHORT_START = "2026-07-01"
CASE_ID = re.compile(r"^BCS-\d{8}$")  # the same rule the page applies before any query
WINDOW_DAYS = 14
MIN_AT_RISK = 30  # same suppression floor as the neighborhood table
MIN_TYPE_N = 200  # same floor as the Boston service picker
CAMBRIDGE_OPEN = ("Open", "Acknowledged")
CAMBRIDGE_CLOSED = ("Closed", "Archived")

# The figures quoted in the "Make the case" proposal came from a quick separate run.
# They are rechecked here before any of them is allowed on screen.
PROPOSAL = [
    ("Sidewalk Repair", 7, 4),
    ("Sidewalk Repair", 30, 1),
    ("Street Light Outage", 14, 25),
    ("Street Light Outage", 60, 8),
    ("Pothole", 14, 16),
    ("Pothole", 30, 2),
]

# Grid for the offline TypeScript cross-check (ages and windows in days).
GOLDEN_AGES = [0, 1, 7, 14, 30, 60, 100]
GOLDEN_WINDOWS = [7, 14, 30]
FIXTURE_CENSOR = dt.datetime(2026, 10, 24, 16, 0, 0)  # same as goldenVerification.test.ts


# ---------- independent estimator ----------

def km_curve(obs):
    """Product-limit estimate. obs: (hours, closed?). Returns (event times, survival after each).

    Ties: events at t are counted against everyone still under observation at t, including
    cases censored at t (the usual convention, and the one stats.ts uses).
    """
    obs = sorted(obs)
    times, surv = [], []
    s, remaining, i, n = 1.0, len(obs), 0, len(obs)
    while i < n:
        t = obs[i][0]
        d = c = 0
        while i < n and obs[i][0] == t:
            d += obs[i][1]
            c += not obs[i][1]
            i += 1
        if d:
            s *= 1 - d / remaining
            times.append(t)
            surv.append(s)
        remaining -= d + c
    return times, surv


def s_at(curve, t):
    times, surv = curve
    k = bisect.bisect_right(times, t) - 1
    return 1.0 if k < 0 else surv[k]


def km_median(curve):
    for t, s in zip(*curve):
        if s <= 0.5:
            return t
    return None


def median(xs):
    xs = sorted(xs)
    n = len(xs)
    if not n:
        return None
    return xs[n // 2] if n % 2 else (xs[n // 2 - 1] + xs[n // 2]) / 2


def conditional(obs, curve, age_h, window_h):
    """Chance a case still open at age_h closes within the next window_h, from the KM curve.

    None when the data cannot say: the window runs past the longest observed wait, or no case
    is still open at that age.
    """
    horizon = max(h for h, _ in obs)
    s_age = s_at(curve, age_h)
    if age_h + window_h > horizon or s_age <= 0:
        return None
    return 1 - s_at(curve, age_h + window_h) / s_age


def at_risk(obs, age_h):
    return sum(1 for h, _ in obs if h > age_h)


# ---------- data access ----------

def get_json(url, tries=3):
    for attempt in range(tries):
        try:
            with urllib.request.urlopen(url, timeout=120) as res:
                return json.load(res)
        except OSError:
            if attempt == tries - 1:
                raise
            time.sleep(4)


def boston_sql(query):
    body = get_json(f"{BOSTON_SQL}?{urllib.parse.urlencode({'sql': query})}")
    if not body.get("success"):
        raise RuntimeError(body.get("error"))
    return body["result"]["records"]


def cambridge(query):
    return get_json(f"{CAMBRIDGE}?{urllib.parse.urlencode({'$query': query})}")


def parse_boston(ts):
    s = ts.strip().replace(" ", "T")
    s = re.sub(r"\+00(:00)?$", "", s)
    # Python 3.9 rejects five-digit fractions from CKAN; strptime accepts them.
    try:
        return dt.datetime.strptime(s[:26], "%Y-%m-%dT%H:%M:%S.%f")
    except ValueError:
        return dt.datetime.strptime(s[:19], "%Y-%m-%dT%H:%M:%S")


def boston_obs(rows, cutoff):
    """Mirror of toObservations() in src/lib/boston311.ts: any closure is an event."""
    out = []
    for r in rows:
        opened = parse_boston(r["open_date"])
        if r["case_status"] == "Closed" and r.get("close_date"):
            h = (parse_boston(r["close_date"]) - opened).total_seconds() / 3600
            if h >= 0:
                out.append((h, True))
        elif r["case_status"] == "In progress":
            h = (cutoff - opened).total_seconds() / 3600
            if h >= 0:
                out.append((h, False))
    return out


def cambridge_obs(rows, cutoff):
    """Open/Acknowledged = still open (censored at the cutoff); Closed/Archived with a close
    time = closed. Closed/Archived with no close time is left out and counted, never guessed."""
    out, no_close, conflict = [], 0, 0
    for r in rows:
        opened = dt.datetime.fromisoformat(r["ticket_created_date_time"][:19])
        status = r.get("ticket_status")
        closed_at = r.get("ticket_closed_date_time")
        if status in CAMBRIDGE_OPEN:
            conflict += bool(closed_at)
            h = (cutoff - opened).total_seconds() / 3600
            if h >= 0:
                out.append((h, False))
        elif status in CAMBRIDGE_CLOSED:
            if not closed_at:
                no_close += 1
                continue
            h = (dt.datetime.fromisoformat(closed_at[:19]) - opened).total_seconds() / 3600
            if h >= 0:
                out.append((h, True))
    return out, no_close, conflict


def summarize(obs):
    curve = km_curve(obs)
    closed = [h for h, e in obs if e]
    km = km_median(curve)
    naive = median(closed)
    return {
        "n": len(obs),
        "open": len(obs) - len(closed),
        "medianClosedOnlyDays": None if naive is None else round(naive / 24, 2),
        "kmMedianDays": None if km is None else round(km / 24, 2),
        "kmFinalSurvival": round(curve[1][-1], 4) if curve[1] else 1.0,
    }


# ---------- modes ----------

def live():
    failures, notes = [], []
    pulled = dt.datetime.now(dt.timezone.utc).replace(microsecond=0, tzinfo=None)

    # Boston extract cutoff: the latest timestamp in the data (same rule as fetchExtractCutoff).
    snap = boston_sql(f'SELECT MAX(open_date::timestamp) mo, MAX(close_date::timestamp) mc FROM "{BOSTON}"')[0]
    cutoff = max(parse_boston(snap["mo"]), parse_boston(snap["mc"]))

    # 1. Conditional chance of closing in the next 14 days, rechecking the proposal's figures.
    chances, by_service = [], {}
    for service in sorted({p[0] for p in PROPOSAL}):
        rows = boston_sql(f"""SELECT case_status, open_date, close_date FROM "{BOSTON}"
            WHERE open_date::timestamp >= '{COHORT_START}' AND service_name = '{service.replace("'", "''")}'
              AND case_status IN ('Closed','In progress') LIMIT 32000""")
        if len(rows) >= 32000:
            failures.append(f"{service}: hit the row cap")
        obs = boston_obs(rows, cutoff)
        by_service[service] = (obs, km_curve(obs))
    for service, age_days, quoted in PROPOSAL:
        obs, curve = by_service[service]
        c = conditional(obs, curve, age_days * 24, WINDOW_DAYS * 24)
        risk = at_risk(obs, age_days * 24)
        in100 = None if c is None else round(100 * c)
        chances.append({
            "service": service, "ageDays": age_days, "windowDays": WINDOW_DAYS,
            "chance": None if c is None else round(c, 4), "in100": in100,
            "atRisk": risk, "proposalIn100": quoted,
        })
        if c is None:
            failures.append(f"{service} at {age_days} d: no estimate (outside the data)")
        elif risk < MIN_AT_RISK:
            failures.append(f"{service} at {age_days} d: only {risk} cases at risk")
        elif abs(in100 - quoted) >= 2:
            notes.append(f"{service} at {age_days} d: proposal said {quoted} in 100, checked value is {in100} in 100")

    # 2. Case IDs: strict format, unique, and a real single-case lookup round trip.
    bad = int(boston_sql(f"""SELECT COUNT(*) n FROM "{BOSTON}" WHERE case_id !~ '^BCS-[0-9]{{8}}$'""")[0]["n"])
    ids = boston_sql(f"""SELECT COUNT(*) n, COUNT(DISTINCT case_id) u FROM "{BOSTON}"
                         WHERE open_date::timestamp >= '{COHORT_START}'""")[0]
    districts = boston_sql(f"""SELECT city_council_district d, COUNT(*) n FROM "{BOSTON}"
                               WHERE open_date::timestamp >= '{COHORT_START}' GROUP BY 1""")
    in_district = sum(int(r["n"]) for r in districts if r["d"] in [str(i) for i in range(1, 10)])
    sample = boston_sql(f"""SELECT case_id FROM "{BOSTON}" WHERE open_date::timestamp >= '{COHORT_START}'
                            AND case_status = 'In progress' AND service_name = 'Street Light Outage'
                            AND target_close_date::timestamp < '{cutoff.isoformat(sep=' ')}'
                            ORDER BY open_date LIMIT 1""")[0]["case_id"]
    lookup = boston_sql(f"""SELECT case_id, service_name, case_status, closure_reason, open_date,
                                   close_date, target_close_date, city_council_district
                            FROM "{BOSTON}" WHERE case_id = '{sample}' LIMIT 2""")
    rejected = [s for s in ("bcs-00253943 ", "BCS-0025394", "BCS-002539430", "BCS-00253943'--",
                            "BCS-0025394X", "") if CASE_ID.match(s)]
    if bad:
        failures.append(f"{bad} case IDs do not match ^BCS-\\d{{8}}$")
    if int(ids["n"]) != int(ids["u"]):
        failures.append(f"case IDs are not unique in the cohort ({ids['n']} rows, {ids['u']} IDs)")
    if len(lookup) != 1:
        failures.append(f"lookup of {sample} returned {len(lookup)} rows")
    if rejected:
        failures.append(f"format check accepted bad input: {rejected}")

    # 3. Cambridge, same cohort window, same estimators.
    cam_cut = cambridge("SELECT max(ticket_created_date_time) AS a, max(ticket_closed_date_time) AS b, "
                        "max(ticket_last_updated_date_time) AS c")[0]
    cam_cutoff = max(dt.datetime.fromisoformat(v[:19]) for v in cam_cut.values() if v)
    cam_rows = cambridge(f"SELECT ticket_status, issue_type, ticket_created_date_time, ticket_closed_date_time "
                         f"WHERE ticket_created_date_time >= '{COHORT_START}T00:00:00' LIMIT 50000")
    if len(cam_rows) >= 50000:
        failures.append("Cambridge: hit the row cap")
    cam_all, no_close, conflict = cambridge_obs(cam_rows, cam_cutoff)
    types = {}
    for r in cam_rows:
        types.setdefault(r.get("issue_type") or "(blank)", []).append(r)
    cam_types = {}
    for name, rows in sorted(types.items(), key=lambda kv: -len(kv[1])):
        obs, _, _ = cambridge_obs(rows, cam_cutoff)
        if len(obs) >= MIN_TYPE_N:
            cam_types[name] = summarize(obs)

    out = {
        "_about": "Generated by scripts/check_make_the_case.py; rerun it rather than editing.",
        "pulledAtUtc": pulled.isoformat() + "Z",
        "boston": {
            "extractCutoffUtc": cutoff.isoformat(timespec="seconds") + "Z",
            "conditionalChance": chances,
            "caseIds": {
                "badFormatInWholeResource": bad,
                "cohortRows": int(ids["n"]),
                "cohortUniqueIds": int(ids["u"]),
                "lookupSample": lookup[0] if lookup else None,
                "councilDistrict1to9Pct": round(100 * in_district / int(ids["n"]), 2),
            },
        },
        "cambridge": {
            "dataset": "2z9k-mv9g (Commonwealth Connect Service Requests)",
            "extractCutoffLocal": cam_cutoff.isoformat(timespec="seconds"),
            "cohortRows": len(cam_rows),
            "closedWithoutCloseTimeExcluded": no_close,
            "openStatusButCloseTimeSet": conflict,
            "all": summarize(cam_all),
            "issueTypes": cam_types,
        },
        "failures": failures,
        "notes": notes,
    }
    with open(os.path.join(ROOT, "data/make-the-case.json"), "w") as fh:
        json.dump(out, fh, indent=2, ensure_ascii=False)
        fh.write("\n")

    print(f"Boston extract cutoff {out['boston']['extractCutoffUtc']}")
    print("\nChance a case still open closes in the next 14 days (historically):")
    for c in chances:
        print(f"  {c['service']:20} open {c['ageDays']:>3} d: {c['in100']} in 100 "
              f"(proposal {c['proposalIn100']}), {c['atRisk']} cases at risk")
    print(f"\nCase IDs: {bad} malformed, {ids['n']} rows / {ids['u']} unique; lookup {sample} -> {len(lookup)} row; "
          f"{out['boston']['caseIds']['councilDistrict1to9Pct']}% in districts 1-9")
    a = out["cambridge"]["all"]
    print(f"\nCambridge (cutoff {out['cambridge']['extractCutoffLocal']}): n={a['n']}, open={a['open']}, "
          f"closed-only median {a['medianClosedOnlyDays']} d, incl. open {a['kmMedianDays']} d; "
          f"{no_close} closed without a close time left out, {conflict} open with a close time")
    for name, v in cam_types.items():
        print(f"  {name[:44]:44} n={v['n']:>5} open={v['open']:>4} closed-only {v['medianClosedOnlyDays']} d, "
              f"incl. open {v['kmMedianDays']} d")
    return failures, notes


def golden():
    """Conditional chances on the committed fixture, for the TypeScript cross-check test."""
    path = os.path.join(ROOT, "src/lib/__fixtures__/cohortCases.json")
    fixture = json.load(open(path))
    start = dt.datetime.fromisoformat(COHORT_START)
    out = {"censorAtUtc": FIXTURE_CENSOR.isoformat() + "Z", "windowsDays": GOLDEN_WINDOWS,
           "agesDays": GOLDEN_AGES, "services": {}}
    for service, rows in fixture.items():
        rows = [r for r in rows if parse_boston(r["open_date"]) >= start]
        obs = boston_obs(rows, FIXTURE_CENSOR)
        curve = km_curve(obs)
        grid = []
        for age in GOLDEN_AGES:
            for w in GOLDEN_WINDOWS:
                c = conditional(obs, curve, age * 24, w * 24)
                grid.append({"ageDays": age, "windowDays": w, "chance": c, "atRisk": at_risk(obs, age * 24)})
        out["services"][service] = {"n": len(obs), "maxHours": max(h for h, _ in obs), "grid": grid}
    target = os.path.join(ROOT, "src/lib/__fixtures__/conditional-golden.json")
    with open(target, "w") as fh:
        json.dump(out, fh, indent=1)
        fh.write("\n")
    print(f"wrote {os.path.relpath(target, ROOT)}")
    return [], []


def compare(page_path):
    """Compare figures read off the rendered page against independent recomputation.

    page.json holds what the browser showed:
      cases:        [{caseId, service, ageHours, in100 | null, similar | null, kind}]
      cambridge:    {"all" | issue type: {n, open, medianClosedOnlyDays, kmMedianDays}}
      bostonHeroes: {service: {kmMedianDays, medianClosedOnlyDays}}
    """
    want = json.load(open(os.path.join(ROOT, "data/make-the-case.json")))
    numbers = json.load(open(os.path.join(ROOT, "data/numbers.json")))
    got = json.load(open(page_path))
    failures = []

    # Each looked-up case: fetch it here, work out its age here, recompute the chance here.
    snap = boston_sql(f'SELECT MAX(open_date::timestamp) mo, MAX(close_date::timestamp) mc FROM "{BOSTON}"')[0]
    cutoff = max(parse_boston(snap["mo"]), parse_boston(snap["mc"]))
    cache = {}
    for c in got.get("cases", []):
        if not CASE_ID.match(c["caseId"]):
            failures.append(f"page reported a malformed ID {c['caseId']!r}")
            continue
        row = boston_sql(f"""SELECT service_name, case_status, open_date FROM "{BOSTON}"
                             WHERE case_id = '{c['caseId']}' LIMIT 1""")[0]
        service = row["service_name"]
        # Whole days, as the page's sentence states them ("still open after 33 days").
        age_days = int((cutoff - parse_boston(row["open_date"])).total_seconds() // 86400)
        c["ageHours"] = age_days * 24
        if row["case_status"] != "In progress":
            failures.append(f"{c['caseId']} is not open; the page should show no chance")
            continue
        if service not in cache:
            rows = boston_sql(f"""SELECT case_status, open_date, close_date FROM "{BOSTON}"
                WHERE open_date::timestamp >= '{COHORT_START}' AND service_name = '{service.replace("'", "''")}'
                  AND case_status IN ('Closed','In progress') LIMIT 32000""")
            obs = boston_obs(rows, cutoff)
            cache[service] = (obs, km_curve(obs))
        obs, curve = cache[service]
        ch = conditional(obs, curve, c["ageHours"], WINDOW_DAYS * 24)
        risk = at_risk(obs, c["ageHours"])
        if ch is None:
            expect = "beyond-data"
        elif risk < MIN_AT_RISK:
            expect = "too-few"
        else:
            expect = "shown"
        if c["kind"] != expect:
            failures.append(f"{c['caseId']}: page {c['kind']}, check {expect}")
        elif expect == "shown":
            if c["in100"] != round(100 * ch) or c["similar"] != risk:
                failures.append(f"{c['caseId']}: page {c['in100']} in 100 of {c['similar']}, "
                                f"check {round(100 * ch)} in 100 of {risk}")
        print(f"  {c['caseId']} {service}, open {c['ageHours'] / 24:.1f} d: page {c['kind']} {c.get('in100')}"
              f" / check {expect} {None if ch is None else round(100 * ch)} ({risk} similar)")

    # Existing hero figures must still match data/numbers.json (MC-11).
    for service, v in got.get("bostonHeroes", {}).items():
        ref = numbers["services"][service]
        for field in ("kmMedianDays", "medianClosedOnlyDays"):
            if (v[field] is None) != (ref[field] is None) or (v[field] is not None and abs(v[field] - ref[field]) > 0.06):
                failures.append(f"{service} {field}: page {v[field]}, numbers.json {ref[field]}")
        print(f"  hero {service}: page {v}, numbers.json km {ref['kmMedianDays']} closed-only {ref['medianClosedOnlyDays']}")
    for key, value in got.get("cambridge", {}).items():
        ref = want["cambridge"]["all"] if key == "all" else want["cambridge"]["issueTypes"].get(key)
        if ref is None:
            failures.append(f"page shows Cambridge type {key!r} that the check did not produce")
            continue
        for field in ("n", "open", "medianClosedOnlyDays", "kmMedianDays"):
            a, b = value.get(field), ref.get(field)
            if (a is None) != (b is None) or (a is not None and abs(a - b) > (0.06 if "Days" in field else 0)):
                failures.append(f"Cambridge {key} {field}: page {a}, check {b}")
    for c in got.get("conditionalChance", []):
        ref = next((r for r in want["boston"]["conditionalChance"]
                    if r["service"] == c["service"] and r["ageDays"] == c["ageDays"]), None)
        if ref and c["in100"] != ref["in100"]:
            failures.append(f"{c['service']} at {c['ageDays']} d: page {c['in100']} in 100, check {ref['in100']}")
    print(f"compared {len(got.get('cases', []))} looked-up cases, {len(got.get('cambridge', {}))} Cambridge "
          f"views and {len(got.get('bostonHeroes', {}))} hero figures")
    return failures, []


def main():
    if "--golden" in sys.argv:
        failures, notes = golden()
    elif "--compare" in sys.argv:
        failures, notes = compare(sys.argv[sys.argv.index("--compare") + 1])
    else:
        failures, notes = live()
    for n in notes:
        print("NOTE:", n)
    for f in failures:
        print("FAIL:", f)
    print(f"\n{len(failures)} failure(s), {len(notes)} note(s)")
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main()
