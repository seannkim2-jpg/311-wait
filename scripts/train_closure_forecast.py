"""Train, test and export the Boston closure forecast for the "Already waiting?" block.

Question: a request has been open N whole days. What is the historical chance it closes in
the next 7? Both methods answer the same quantity, P = 1 - S(N+7) / S(N):

  baseline  Kaplan-Meier per service, the figure the page shows for every request
  model     Cox proportional hazards, stratified by service, one-hot neighborhood

The model reaches the page only if it clears the release gate below on later, held-out
requests. The gate is fixed here, before any result is seen. Pass or fail, the result goes into
the artifact and into docs/ANALYSIS.md.

Writes (no case-level records in any of them):
  public/model/boston-closure-forecast.json   the artifact the page reads
  data/forecast_evaluation.json               every held-out metric and assumption check
  src/lib/__fixtures__/forecastExamples.json  lifelines predictions for the TypeScript test

Run: python3 -m pip install lifelines && python3 scripts/train_closure_forecast.py
     python3 scripts/train_closure_forecast.py --cached   # reuse the last pull in /tmp
"""
import argparse
import collections
import datetime as dt
import json
import os
import sys
import warnings

import numpy as np
import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from refresh_numbers import COHORT, COHORT_START, HEADLINE, MIN_SERVICE_N, RESOURCE, ROOT, sql  # noqa: E402
from reference_impl import parse_ts  # noqa: E402

try:
    import lifelines
    from lifelines import CoxPHFitter, KaplanMeierFitter, NelsonAalenFitter
    from lifelines.statistics import proportional_hazard_test
except ImportError:
    sys.exit("pip install lifelines")

# --- The question ---------------------------------------------------------------------------
HORIZON_DAYS = 7
CHECK_DAYS = (0, 14, 30)  # days already waited at which the held-out answer is checked

# --- Validation split (all UTC, the same clock as the cohort filter) -------------------------
COHORT_START_DT = dt.datetime.fromisoformat(COHORT_START)
TRAIN_END = dt.datetime(2026, 9, 1)  # fit on cases opened Jul 1 - Aug 31, censored here
TEST_START, TEST_END = dt.datetime(2026, 9, 1), dt.datetime(2026, 9, 18)  # opened Sep 1 - 17

# --- Model -----------------------------------------------------------------------------------
PENALIZER = 1e-3  # small ridge: identifies the one-hot coding, steadies thin neighborhoods
MIN_HOOD_CASES = 100  # below this in the fitting data, a neighborhood joins OTHER
OTHER = "Other or unknown"

# --- Page fallbacks (exported so the TypeScript reader applies the same rules) ---------------
MIN_CASES = 30  # same floor as the neighborhood table's suppression
MAX_AGE_DAYS = 30

# --- Release gate, fixed before results are seen --------------------------------------------
GATE_MIN_BRIER_GAIN = 0.05  # pooled held-out Brier at least 5% below Kaplan-Meier's
GATE_MAX_ECE = 0.05  # expected calibration error over 10 bands, absolute ceiling
GATE_MAX_ECE_EXCESS = 0.01  # ... and no more than this above Kaplan-Meier's
GATE_MAX_SERVICE_LOSS = 0.02  # no major service's Brier more than 2% above Kaplan-Meier's
MAJOR_MIN_TRAIN_CASES = 1000  # major = the four headline services + any this large in training

CACHE = "/tmp/wait_audit_forecast_pull.json"
ARTIFACT = os.path.join(ROOT, "public/model/boston-closure-forecast.json")
EVALUATION = os.path.join(ROOT, "data/forecast_evaluation.json")
FIXTURE = os.path.join(ROOT, "src/lib/__fixtures__/forecastExamples.json")
CASE_FIXTURE = os.path.join(ROOT, "src/lib/__fixtures__/cohortCases.json")
FIXTURE_QUERY_TIME = dt.datetime(2026, 10, 24, 16, 0, 0)  # as in goldenVerification.test.ts
DAY = dt.timedelta(days=1)


# ============================================================================================
# Data
# ============================================================================================

def pull(use_cache):
    if use_cache and os.path.exists(CACHE):
        with open(CACHE) as fh:
            raw = json.load(fh)
        print(f"using cached pull from {raw['pulledAtUtc']} ({len(raw['rows']):,} rows)")
        return raw
    snap = sql(f'SELECT MAX(open_date::timestamp) mo, MAX(close_date::timestamp) mc FROM "{RESOURCE}"')[0]
    cutoff = max(parse_ts(snap["mo"]), parse_ts(snap["mc"]))
    rows, month = [], COHORT_START_DT.date()
    while month <= cutoff.date():
        nxt = (month.replace(day=28) + dt.timedelta(days=4)).replace(day=1)
        part = sql(f"""SELECT service_name, neighborhood, case_status, open_date, close_date
                       FROM "{RESOURCE}"
                       WHERE {COHORT} AND open_date::timestamp >= '{month}'
                         AND open_date::timestamp < '{nxt}'
                         AND case_status IN ('Closed','In progress')
                       LIMIT 32000""")
        if len(part) >= 32000:
            raise RuntimeError(f"{month}: hit the 32,000-row cap; split the query further")
        print(f"  pulled {month:%Y-%m}: {len(part):,} rows", flush=True)
        rows += part
        month = nxt
    raw = {
        "pulledAtUtc": dt.datetime.now(dt.timezone.utc).replace(microsecond=0, tzinfo=None).isoformat() + "Z",
        "cutoffUtc": cutoff.isoformat(),
        "rows": rows,
    }
    with open(CACHE, "w") as fh:
        json.dump(raw, fh)
    return raw


def clean(rows, cutoff):
    """Rows -> one frame of (service, hood, opened, closed). Closed is NaT for open cases."""
    excluded = collections.Counter()
    out = []
    for r in rows:
        try:
            opened = parse_ts(r["open_date"])
            closed = parse_ts(r["close_date"]) if r.get("close_date") else None
        except (ValueError, TypeError, AttributeError):
            excluded["unparseable date"] += 1
            continue
        if opened < COHORT_START_DT:
            excluded["opened before cohort start"] += 1
            continue
        if opened > cutoff:
            excluded["opened after extract cutoff"] += 1
            continue
        if r["case_status"] == "Closed":
            if closed is None:
                excluded["closed without a close date"] += 1
                continue
            if closed < opened:
                excluded["closed before opened"] += 1
                continue
            if closed > cutoff:
                excluded["closed after extract cutoff"] += 1
                continue
        else:
            closed = None  # In progress: a stray close_date is not a closure
        hood = (r.get("neighborhood") or "").strip() or None
        out.append((r["service_name"], hood, opened, closed))
    df = pd.DataFrame(out, columns=["service", "hood", "opened", "closed"])
    # The API returns rows in no fixed order; sort so fits and bootstrap draws are reproducible.
    df = df.sort_values(["opened", "service", "hood", "closed"], na_position="first",
                        kind="mergesort").reset_index(drop=True)
    return df, dict(excluded)


def observe(df, censor_at):
    """Cases opened before censor_at, with T in days and E = closed by censor_at."""
    d = df[df["opened"] < censor_at].copy()
    end = d["closed"].where(d["closed"].notna() & (d["closed"] <= censor_at), censor_at)
    d["T"] = (end - d["opened"]).dt.total_seconds() / 86400.0
    d["E"] = (d["closed"].notna() & (d["closed"] <= censor_at)).astype(int)
    return d


def hood_levels(obs):
    counts = obs["hood"].value_counts()
    return sorted(h for h, n in counts.items() if n >= MIN_HOOD_CASES)


def design(obs, levels):
    key = obs["hood"].where(obs["hood"].isin(levels), OTHER)
    cols = {f"neighborhood={h}": (key == h).astype(float) for h in [*levels, OTHER]}
    return pd.DataFrame(cols, index=obs.index)


# ============================================================================================
# Models: both return P(close in (n, n+7] | open at n) for each row
# ============================================================================================

def conditional(s_n, s_h):
    s_n, s_h = np.asarray(s_n, float), np.asarray(s_h, float)
    with np.errstate(divide="ignore", invalid="ignore"):
        p = np.where(s_n > 0, 1 - s_h / s_n, 1.0)
    return np.clip(p, 0.0, 1.0)


def fit_km(obs):
    return {s: KaplanMeierFitter().fit(g["T"], g["E"]) for s, g in obs.groupby("service")}


def km_chance(kms, rows, n):
    p = np.empty(len(rows))
    for s, idx in rows.groupby("service").indices.items():
        sf = kms[s].survival_function_at_times([n, n + HORIZON_DAYS]).to_numpy()
        p[idx] = conditional(sf[0], sf[1])
    return p


def fit_na(obs):
    """Service-only Nelson-Aalen: the Cox model's own baseline with neighborhood removed.

    Ablation only. It separates what neighborhood adds from what comes of estimating the curve
    as exp(-cumulative hazard) instead of as a product-limit, which matters where few remain at risk.
    """
    return {s: NelsonAalenFitter(nelson_aalen_smoothing=False).fit(g["T"], g["E"])
            for s, g in obs.groupby("service")}


def na_chance(nas, rows, n):
    p = np.empty(len(rows))
    for s, idx in rows.groupby("service").indices.items():
        h = nas[s].cumulative_hazard_at_times([n, n + HORIZON_DAYS]).to_numpy()
        p[idx] = conditional(np.exp(-h[0]), np.exp(-h[1]))
    return p


def fit_cox(obs, levels, entry=None):
    X = design(obs, levels)
    X = X.loc[:, X.sum() > 0]  # a level absent from this fit carries no information
    cols = ["T", "E", "service"] + ([entry] if entry else [])
    data = pd.concat([obs[cols], X], axis=1)
    cph = CoxPHFitter(penalizer=PENALIZER)
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        cph.fit(data, duration_col="T", event_col="E", strata=["service"], entry_col=entry)
    return cph, data


def partial_hazard(cph, rows, levels):
    """exp((x - mean) . beta): lifelines centers covariates, so the baseline sits at the means."""
    X = design(rows, levels).reindex(columns=cph.params_.index, fill_value=0.0).to_numpy()
    mean = cph._norm_mean.reindex(cph.params_.index).to_numpy()
    return np.exp((X - mean) @ cph.params_.to_numpy())


def baseline_cumhaz(cph, service, times):
    """Breslow baseline cumulative hazard as a right-continuous step, like the KM curve.

    Not predict_survival_function(times=...): that interpolates linearly between event times
    (so S(0) < 1) and, for a stratified model, returns columns grouped by stratum rather than in
    row order.
    """
    H = cph.baseline_cumulative_hazard_[service]
    t, v = H.index.to_numpy(), H.to_numpy()
    i = np.searchsorted(t, np.asarray(times, float), side="right") - 1
    return np.where(i >= 0, v[np.clip(i, 0, None)], 0.0)


def cox_chance(cph, rows, levels, n):
    rows = rows.reset_index(drop=True)
    ph = partial_hazard(cph, rows, levels)
    p = np.empty(len(rows))
    for s, idx in rows.groupby("service").indices.items():
        h_n, h_h = baseline_cumhaz(cph, s, [n, n + HORIZON_DAYS])
        p[idx] = conditional(np.exp(-h_n * ph[idx]), np.exp(-h_h * ph[idx]))
    return p


def check_step_against_lifelines(cph, services, levels):
    """At event times interpolation and the step agree, so lifelines' own predictions must match."""
    worst = 0.0
    for s in services:
        H = cph.baseline_cumulative_hazard_[s]
        times = H.index[H.diff().fillna(H) > 0].to_numpy()
        times = times[np.linspace(0, len(times) - 1, 4).astype(int)]
        rows = pd.DataFrame({"service": s, "hood": [*levels, None]})
        X = pd.concat([rows[["service"]], design(rows, levels).reindex(
            columns=cph.params_.index, fill_value=0.0)], axis=1)
        sf = cph.predict_survival_function(X, times=times)[X.index]  # restore row order
        ours = np.exp(-np.outer(baseline_cumhaz(cph, s, times), partial_hazard(cph, rows, levels)))
        worst = max(worst, float(np.max(np.abs(sf.to_numpy() - ours))))
    if worst > 1e-9:
        raise RuntimeError(f"step evaluation disagrees with lifelines by {worst:.2e}")
    return worst


# ============================================================================================
# Held-out evaluation
# ============================================================================================

def brier(p, y):
    return float(np.mean((p - y) ** 2)) if len(y) else None


def calibration(p, y, bands=10):
    b = np.clip((p * bands).astype(int), 0, bands - 1)
    table, ece = [], 0.0
    for k in range(bands):
        m = b == k
        if not m.any():
            continue
        pred, obs_ = float(p[m].mean()), float(y[m].mean())
        ece += m.sum() / len(p) * abs(obs_ - pred)
        table.append({"band": f"{k * 10}-{k * 10 + 10}%", "n": int(m.sum()),
                      "meanPredicted": round(pred, 4), "observed": round(obs_, 4)})
    return table, float(ece)


def held_out(df, cutoff, services):
    """Cases opened Sep 1-17 at each check day, eligible by follow-up alone (never outcome)."""
    test = df[(df["opened"] >= TEST_START) & (df["opened"] < TEST_END) & df["service"].isin(services)]
    test = observe(test, cutoff)
    follow = (cutoff - test["opened"]).dt.total_seconds() / 86400.0
    frames = []
    for n in CHECK_DAYS:
        e = test[(follow >= n + HORIZON_DAYS) & (test["T"] > n)].copy()
        e["N"] = n
        e["y"] = ((e["E"] == 1) & (e["T"] <= n + HORIZON_DAYS)).astype(int)
        frames.append(e)
    return pd.concat(frames, ignore_index=True)


def validate(df, cutoff, site_services):
    train = observe(df[df["service"].isin(site_services)], TRAIN_END)
    # A service new since September has no training baseline; neither method can score it.
    n_train = train["service"].value_counts()
    services = sorted(s for s in site_services if n_train.get(s, 0) >= MIN_CASES)
    train = train[train["service"].isin(services)]
    levels = hood_levels(train)
    kms = fit_km(train)
    nas = fit_na(train)
    cph, data = fit_cox(train, levels)
    ev = held_out(df, cutoff, services)
    ev["pKM"], ev["pNA"], ev["pCox"] = np.nan, np.nan, np.nan
    for n in CHECK_DAYS:
        m = (ev["N"] == n).to_numpy()
        rows = ev[m].reset_index(drop=True)
        ev.loc[m, "pKM"] = km_chance(kms, rows, n)
        ev.loc[m, "pNA"] = na_chance(nas, rows, n)
        ev.loc[m, "pCox"] = cox_chance(cph, rows, levels, n)

    def score(e, interval=False):
        y, km, cx = e["y"].to_numpy(), e["pKM"].to_numpy(), e["pCox"].to_numpy()
        bk, bc, bn = brier(km, y), brier(cx, y), brier(e["pNA"].to_numpy(), y)
        out = {"n": int(len(e)), "closedWithin7": int(y.sum()),
               "brierKM": round(bk, 5), "brierCox": round(bc, 5),
               "brierChange": round(bc / bk - 1, 4) if bk else None,
               # Ablation: the same comparison against the service-only Nelson-Aalen curve
               # isolates what neighborhood itself contributes.
               "brierServiceOnlyNA": round(bn, 5),
               "neighborhoodOnlyChange": round(bc / bn - 1, 4) if bn else None}
        if interval and bk:
            # Paired bootstrap of the relative change. Informational only; not part of the gate.
            rng = np.random.default_rng(20261024)
            sk, sc = (km - y) ** 2, (cx - y) ** 2
            idx = rng.integers(0, len(y), (2000, len(y)))
            r = sc[idx].mean(1) / sk[idx].mean(1) - 1
            out["brierChange95"] = [round(float(q), 4) for q in np.percentile(r, [2.5, 97.5])]
        return out

    km_cal, km_ece = calibration(ev["pKM"].to_numpy(), ev["y"].to_numpy())
    cx_cal, cx_ece = calibration(ev["pCox"].to_numpy(), ev["y"].to_numpy())
    train_counts = train["service"].value_counts()
    major = sorted(set(h for h in HEADLINE if h in services)
                   | set(train_counts[train_counts >= MAJOR_MIN_TRAIN_CASES].index))
    by_service = {s: score(ev[ev["service"] == s]) for s in major if (ev["service"] == s).any()}
    overall = score(ev)
    worst = max(by_service.items(), key=lambda kv: kv[1]["brierChange"])
    gain = -overall["brierChange"]
    checks = {
        "brierGain": {"value": round(gain, 4), "threshold": GATE_MIN_BRIER_GAIN,
                      "required": f">= {GATE_MIN_BRIER_GAIN}", "passed": gain >= GATE_MIN_BRIER_GAIN},
        "calibration": {"eceCox": round(cx_ece, 4), "eceKM": round(km_ece, 4),
                        "required": f"<= {GATE_MAX_ECE} and <= KM + {GATE_MAX_ECE_EXCESS}",
                        "passed": cx_ece <= GATE_MAX_ECE and cx_ece <= km_ece + GATE_MAX_ECE_EXCESS},
        "majorServices": {"worst": worst[0], "brierChange": worst[1]["brierChange"],
                          "required": f"<= +{GATE_MAX_SERVICE_LOSS}",
                          "passed": worst[1]["brierChange"] <= GATE_MAX_SERVICE_LOSS},
    }
    return {
        "trainWindow": f"opened {COHORT_START} to 2026-08-31, censored {TRAIN_END:%Y-%m-%d} 00:00 UTC",
        "testWindow": f"opened {TEST_START:%Y-%m-%d} to {TEST_END - DAY:%Y-%m-%d}, "
                      f"followed to the extract cutoff {cutoff:%Y-%m-%d %H:%M} UTC",
        "eligibility": "at each N, held-out cases still open at N whose potential follow-up "
                       "(cutoff - open) is at least N + 7 days",
        "servicesScored": len(services),
        "servicesSkipped": {s: int(n_train.get(s, 0)) for s in site_services if s not in services},
        "trainCases": int(len(train)), "trainClosed": int(train["E"].sum()),
        "trainNeighborhoodLevels": len(levels),
        "overall": overall,
        "byDaysWaited": {str(n): score(ev[ev["N"] == n], interval=True) for n in CHECK_DAYS},
        "majorServices": by_service,
        "calibrationKM": km_cal, "calibrationCox": cx_cal,
        "gate": checks,
        "passed": all(c["passed"] for c in checks.values()),
        "assumptions": check_assumptions(cph, data, train, levels),
    }


def check_assumptions(cph, data, train, levels):
    """Proportional hazards for the neighborhood terms, before any coefficient is described."""
    out = {}
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            ph = proportional_hazard_test(cph, data, time_transform="rank").summary
        out["schoenfeldRank"] = {
            "terms": int(len(ph)),
            "termsWithPBelow0.01": int((ph["p"] < 0.01).sum()),
            "largestStatistic": round(float(ph["test_statistic"].max()), 1),
            "note": "rank-time Schoenfeld test, one per neighborhood term; it detects trends, "
                    "so the early-versus-late refit below checks the size of any change",
        }
    except Exception as exc:  # report, don't hide, a failed diagnostic
        out["schoenfeldRank"] = {"error": repr(exc)}

    # Early (first 7 days) vs late (after day 7, left-truncated at 7) neighborhood effects.
    early = train.copy()
    early["E"] = ((early["E"] == 1) & (early["T"] <= HORIZON_DAYS)).astype(int)
    early["T"] = early["T"].clip(upper=HORIZON_DAYS)
    late = train[train["T"] > HORIZON_DAYS].copy()
    late["entry"] = float(HORIZON_DAYS)
    ce, _ = fit_cox(early, levels)
    cl, _ = fit_cox(late, levels, entry="entry")
    shared = [c for c in ce.params_.index if c in cl.params_.index and not c.endswith(OTHER)]
    a = ce.params_[shared] - ce.params_[shared].mean()
    b = cl.params_[shared] - cl.params_[shared].mean()
    out["earlyVersusLate"] = {
        "terms": len(shared),
        "correlation": round(float(np.corrcoef(a, b)[0, 1]), 3),
        "sameSign": int((np.sign(a) == np.sign(b)).sum()),
        "largestShiftInLogHazardRatio": round(float((a - b).abs().max()), 3),
        "lateCases": int(len(late)),
        "lateClosed": int(late["E"].sum()),
    }
    full = cph.params_[[c for c in cph.params_.index if not c.endswith(OTHER)]]
    out["hazardRatioRange"] = [round(float(np.exp(full.min() - full.mean())), 3),
                               round(float(np.exp(full.max() - full.mean())), 3)]
    return out


# ============================================================================================
# Export
# ============================================================================================

def export(df, cutoff, services, release, pulled_at):
    obs = observe(df[df["service"].isin(services)], cutoff + dt.timedelta(microseconds=1))
    levels = hood_levels(obs)
    cph, _ = fit_cox(obs, levels)
    names = list(cph.params_.index)
    beta = cph.params_.to_numpy()
    means = np.asarray(cph._norm_mean.reindex(names), float)
    last_day = int((cutoff - COHORT_START_DT) / DAY)
    grid = list(range(last_day + 1))

    svc = {}
    for s in services:
        g = obs[obs["service"] == s]
        t = np.sort(g["T"].to_numpy())
        s0 = np.exp(-baseline_cumhaz(cph, s, grid))  # covariates at their means: lp = 0
        svc[s] = {
            "cases": int(len(g)),
            "closed": int(g["E"].sum()),
            "baselineSurvival": [float(f"{v:.12g}") for v in s0],
            "atRisk": [int(len(t) - np.searchsorted(t, d, side="right")) for d in grid],
            "neighborhoodCases": {h: int(n) for h, n in g["hood"].value_counts().items() if h in levels},
        }

    artifact = {
        "_about": "Generated by scripts/train_closure_forecast.py; rerun it rather than editing. "
                  "Cox proportional hazards, stratified by service, one-hot neighborhood. "
                  "Historical chance of closure (any closure, including Noted or Transitioned) "
                  "within horizonDays, given a request still open after N whole days. "
                  "No case-level records.",
        "version": 1,
        "city": "Boston",
        "horizonDays": HORIZON_DAYS,
        "minCases": MIN_CASES,
        "maxAgeDays": MAX_AGE_DAYS,
        "trainedAtUtc": pulled_at,
        "extractCutoffUtc": cutoff.isoformat(timespec="seconds") + "Z",
        "cohortStart": COHORT_START,
        "lifelinesVersion": lifelines.__version__,
        "penalizer": PENALIZER,
        "sampleCounts": {"cases": int(len(obs)), "closed": int(obs["E"].sum()),
                         "stillOpen": int(len(obs) - obs["E"].sum())},
        "featureNames": names,
        "coefficients": [float(f"{b:.12g}") for b in beta],
        "featureMeans": [float(f"{m:.12g}") for m in means],
        "neighborhoods": levels,
        "services": svc,
        "release": release,
    }
    self_check(cph, artifact, services, levels)
    return cph, levels, artifact


def reader_chance(artifact, service, hood, n):
    """The same arithmetic as src/lib/closureForecast.ts, on the exported numbers only."""
    names, beta, means = artifact["featureNames"], artifact["coefficients"], artifact["featureMeans"]
    lp = sum(b * ((1.0 if name == f"neighborhood={hood}" else 0.0) - m)
             for name, b, m in zip(names, beta, means))
    s0 = artifact["services"][service]["baselineSurvival"]
    return 1 - (s0[n + HORIZON_DAYS] / s0[n]) ** np.exp(lp)


def self_check(cph, artifact, services, levels):
    """The exported numbers must reproduce the fitted model, which must match lifelines."""
    step = check_step_against_lifelines(cph, services, levels)
    print(f"self-check: step evaluation matches lifelines predict_survival_function to {step:.1e}")
    worst = 0.0
    for s in services:
        rows = pd.DataFrame({"service": s, "hood": levels})
        for n in (0, 14, 30):
            want = cox_chance(cph, rows, levels, n)
            got = np.array([reader_chance(artifact, s, h, n) for h in levels])
            worst = max(worst, float(np.max(np.abs(want - got))))
    if worst > 1e-8:
        raise RuntimeError(f"exported parameters drift from lifelines by {worst:.2e}")
    print(f"self-check: exported parameters reproduce lifelines to {worst:.1e}")


def write_fixture(cph, levels, artifact):
    examples = []
    hoods = [h for h in ("Dorchester", "South End", "Roxbury", "Back Bay") if h in levels]
    for s in [h for h in HEADLINE if h in artifact["services"]]:
        rows = pd.DataFrame({"service": s, "hood": hoods})
        for n in (0, 3, 14, 30, 60):
            for h, p in zip(hoods, cox_chance(cph, rows, levels, n)):
                examples.append({"service": s, "neighborhood": h, "daysWaited": n, "p": float(p)})

    # Kaplan-Meier conditional estimates on the committed case fixture, for the service-wide figure.
    km_examples = []
    with open(CASE_FIXTURE) as fh:
        cases = json.load(fh)
    for key, rows in sorted(cases.items()):
        t, e = [], []
        for r in rows:
            opened = parse_ts(r["open_date"])
            if r["case_status"] == "Closed" and r["close_date"]:
                h = (parse_ts(r["close_date"]) - opened).total_seconds() / 3600
                if h >= 0:
                    t.append(h), e.append(1)
            elif r["case_status"] == "In progress":
                h = (FIXTURE_QUERY_TIME - opened).total_seconds() / 3600
                if h >= 0:
                    t.append(h), e.append(0)
        kmf = KaplanMeierFitter().fit(t, e)
        for n in (0, 7, 14, 30, 60):
            sf = kmf.survival_function_at_times([24 * n, 24 * (n + HORIZON_DAYS)]).to_numpy()
            at_risk = int(sum(1 for x in t if x > 24 * n))
            km_examples.append({"fixture": key, "daysWaited": n,
                                "p": float(conditional(sf[0], sf[1])), "atRisk": at_risk})

    with open(FIXTURE, "w") as fh:
        json.dump({
            "_comment": "Written by scripts/train_closure_forecast.py. 'cox' rows come from the "
                        "fitted lifelines model (its Breslow baseline and partial hazards, checked "
                        "against predict_survival_function), not from the exported arrays; 'km' "
                        "rows from lifelines KaplanMeierFitter on cohortCases.json, censored at "
                        "queryTime. closureForecast.test.ts must reproduce both.",
            "artifactTrainedAtUtc": artifact["trainedAtUtc"],
            "queryTime": FIXTURE_QUERY_TIME.isoformat() + "Z",
            "cox": examples,
            "km": km_examples,
        }, fh, indent=1)
        fh.write("\n")


# ============================================================================================

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--cached", action="store_true", help=f"reuse {CACHE} if present")
    args = ap.parse_args()

    raw = pull(args.cached)
    cutoff = parse_ts(raw["cutoffUtc"])
    df, excluded = clean(raw["rows"], cutoff)
    counts = df["service"].value_counts()
    services = sorted(counts[counts >= MIN_SERVICE_N].index)  # the site's service list
    print(f"{len(df):,} cases after cleaning, {sum(excluded.values())} excluded {excluded}; "
          f"{len(services)} services with >= {MIN_SERVICE_N} cases")

    result = validate(df, cutoff, services)
    o = result["overall"]
    print(f"\nheld out: n={o['n']:,}  Brier KM={o['brierKM']}  Cox={o['brierCox']}  "
          f"change={o['brierChange']:+.2%}")
    for name, c in result["gate"].items():
        print(f"  gate {name:14s} {'PASS' if c['passed'] else 'FAIL'}  {c}")
    print(f"  release: {'PASSED' if result['passed'] else 'NOT RELEASED'}")

    gate = result["gate"]
    release = {
        "passed": result["passed"],
        "summary": (
            f"Held-out Brier score {o['brierCox']} vs {o['brierKM']} for Kaplan–Meier, "
            f"{-o['brierChange']:.1%} lower where {GATE_MIN_BRIER_GAIN:.0%} lower was required; "
            f"calibration error {gate['calibration']['eceCox']} vs {gate['calibration']['eceKM']}; "
            f"worst major service {gate['majorServices']['worst']} "
            f"{gate['majorServices']['brierChange']:+.1%}."),
        "trainWindow": result["trainWindow"],
        "testWindow": result["testWindow"],
        "heldOutCases": o["n"],
        "gate": gate,
    }
    cph, levels, artifact = export(df, cutoff, services, release, raw["pulledAtUtc"])
    artifact["sampleCounts"]["excluded"] = excluded

    os.makedirs(os.path.dirname(ARTIFACT), exist_ok=True)
    with open(ARTIFACT, "w") as fh:
        json.dump(artifact, fh, separators=(",", ":"), ensure_ascii=False)
        fh.write("\n")
    named = cph.params_[[c for c in cph.params_.index if not c.endswith(OTHER)]]
    result["final"] = {
        "cases": artifact["sampleCounts"]["cases"], "neighborhoodLevels": len(levels),
        "extractCutoffUtc": artifact["extractCutoffUtc"],
        "hazardRatiosVersusAverageNeighborhood": {
            k[len("neighborhood="):]: round(float(np.exp(b - named.mean())), 3) for k, b in named.items()},
        "hazardRatioNote": "descriptive only; see assumptions.earlyVersusLate before reading any one",
    }
    with open(EVALUATION, "w") as fh:
        json.dump({"_about": "Generated by scripts/train_closure_forecast.py; rerun it rather "
                             "than editing. Probabilities are of any closure within 7 days.",
                   "pulledAtUtc": raw["pulledAtUtc"], "extractCutoffUtc": artifact["extractCutoffUtc"],
                   "lifelinesVersion": lifelines.__version__, **result}, fh, indent=2, ensure_ascii=False)
        fh.write("\n")
    write_fixture(cph, levels, artifact)
    size = os.path.getsize(ARTIFACT) / 1024
    print(f"wrote {os.path.relpath(ARTIFACT, ROOT)} ({size:.0f} KB), "
          f"{os.path.relpath(EVALUATION, ROOT)}, {os.path.relpath(FIXTURE, ROOT)}")


if __name__ == "__main__":
    main()
