"""Third-opinion check: compare our estimators against lifelines.

src/lib/stats.ts (Kiro) and scripts/reference_impl.py (Claude) already cross-check each
other. lifelines is the established Python survival-analysis library, so agreeing with it
means all three independent implementations land on the same numbers.

Dev-only. Not a runtime dependency of the app.
Run: python3 scripts/validate_against_lifelines.py
"""
import json, sys, os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from reference_impl import load, kaplan_meier, aalen_johansen  # noqa: E402

try:
    from lifelines import KaplanMeierFitter, AalenJohansenFitter
except ImportError:
    sys.exit("pip install lifelines")

import glob

TOL_MEDIAN_H = 0.01
TOL_CIF = 1e-6
failures = []

for path in sorted(glob.glob("/tmp/km_*.json")):
    name = os.path.basename(path)[3:-5]
    obs = load(path)
    if not obs:
        continue
    durations = [h for h, _ in obs]
    observed = [1 if c != 0 else 0 for _, c in obs]

    # --- Kaplan-Meier median ---
    kmf = KaplanMeierFitter().fit(durations, event_observed=observed)
    ll_median = kmf.median_survival_time_  # inf when never reached
    ours_median, _ = kaplan_meier([(h, c != 0) for h, c in obs])

    if ours_median is None:
        ok = ll_median == float("inf")
        detail = f"ours=undefined lifelines={ll_median}"
    else:
        ok = abs(ll_median - ours_median) <= TOL_MEDIAN_H
        detail = f"ours={ours_median:.4f}h lifelines={ll_median:.4f}h"
    print(f"{name:20s} KM median  {'OK ' if ok else 'FAIL'}  {detail}")
    if not ok:
        failures.append(f"{name} KM median: {detail}")

    # --- Aalen-Johansen cumulative incidence, cause 1 = genuinely resolved ---
    events = [c for _, c in obs]  # 0 censored, 1 resolved, 2 admin-closed
    ajf = AalenJohansenFitter(calculate_variance=False)
    ajf.fit(durations, events, event_of_interest=1)
    ll_cif1 = float(ajf.cumulative_density_.iloc[-1, 0])
    ours_cif, _ = aalen_johansen(obs)
    ok = abs(ll_cif1 - ours_cif[1]) <= TOL_CIF
    detail = f"ours={ours_cif[1]:.6f} lifelines={ll_cif1:.6f}"
    print(f"{name:20s} AJ cause 1 {'OK ' if ok else 'FAIL'}  {detail}")
    if not ok:
        failures.append(f"{name} AJ cause 1: {detail}")

print()
if failures:
    print("DISAGREEMENTS:")
    for f in failures:
        print(" -", f)
    sys.exit(1)
print("All estimates agree with lifelines.")
