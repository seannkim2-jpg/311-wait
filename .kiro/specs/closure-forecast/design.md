# Design: closure-forecast

## Why Cox, and why not KNN

A KNN regressor averages known outcomes. Trained on closed cases it would rebuild the
closed-cases-only bias this site exists to expose. Cox partial likelihood uses open cases as
censored observations, like the KM estimate already on the page. Sources:
[lifelines CoxPHFitter](https://lifelines.readthedocs.io/en/latest/fitters/regression/CoxPHFitter.html),
[scikit-learn nearest neighbors](https://scikit-learn.org/stable/modules/neighbors.html),
[scikit-survival evaluation guide](https://scikit-survival.readthedocs.io/en/stable/user_guide/evaluating-survival-models.html).

## Model

`CoxPHFitter(penalizer=1e-3).fit(..., strata=["service"])`, with one-hot neighborhood columns.

- **Service is a stratum, not a covariate.** Each service gets its own baseline hazard. Litter
  closes in hours and street lights in weeks, so one baseline scaled per service cannot hold
  proportional hazards. A stratum also means the Cox baseline matches the per-service KM
  baseline in shape, so the held-out comparison isolates what neighborhood adds.
- **Neighborhood** has one column per neighborhood with at least 100 training cases, plus
  `Other or unknown` for the rest and for blanks. Every row has exactly one 1. The small ridge
  penalty makes that coding identifiable and shrinks thin neighborhoods toward the average.
  `Other or unknown` falls back to the service-wide figure on the page.
- **Prediction.** lifelines centers covariates, so for one-hot `x`:
  `lp = Σ β_j (x_j − mean_j)` and `S(t | x) = S0_service(t) ^ exp(lp)`. The forecast is
  `p = 1 − (S0(N+7) / S0(N)) ^ exp(lp)`.

## Pipeline: `scripts/train_closure_forecast.py`

1. **Pull** the cohort one month at a time (each month < 32,000 rows, the CKAN cap) and the
   extract cutoff. Cache to `/tmp` (never committed).
2. **Clean** per REQ-F01; record exclusion counts.
3. **Validate.** Fit KM per service and the stratified Cox on July–August, censored at
   September 1. Score September 1–17 at N ∈ {0, 14, 30} (REQ-F03). The evaluation population is
   the site's service list (services with at least 200 cohort cases).
4. **Check assumptions.** A Schoenfeld rank test on each neighborhood term, and an early-versus-
   late refit (t ≤ 7 days, then t > 7 days with left truncation at day 7) to see whether
   neighborhood effects hold their size over time.
5. **Gate** per REQ-F04, with thresholds as constants at the top of the script.
6. **Refit** on the full cohort, censored at the extract cutoff, and export.
7. **Parity fixture.** Write `src/lib/__fixtures__/forecastExamples.json` from lifelines'
   `predict_survival_function` on the refit model, plus KM conditional estimates for the cases
   in `cohortCases.json`, for the TypeScript test.

Outputs: `public/model/boston-closure-forecast.json` (the artifact) and
`data/forecast_evaluation.json` (every held-out metric). Neither contains case-level rows.

## Artifact shape

```ts
{
  version: 1, city: 'Boston', horizonDays: 7, minCases: 30, maxAgeDays: 30,
  trainedAtUtc, extractCutoffUtc, cohortStart, lifelinesVersion, penalizer,
  sampleCounts: { cases, closed, stillOpen, excluded: Record<string, number> },
  featureNames: string[],          // "neighborhood=Dorchester", …
  coefficients: number[],          // lifelines params_, same order
  featureMeans: number[],          // lifelines _norm_mean, same order
  neighborhoods: string[],         // modelled neighborhoods (not "Other or unknown")
  services: Record<string, {
    cases: number, closed: number,
    baselineSurvival: number[],    // S0 at day 0, 1, …, horizon
    atRisk: number[],              // training cases still open at each day
    neighborhoodCases: Record<string, number>,
  }>,
  release: { passed: boolean, summary: string, … },
}
```

## TypeScript

- `src/lib/closureForecast.ts` (pure): `kmChanceOfClosure(curve, sortedHours, n)`,
  `modelChanceOfClosure(model, service, neighborhood, n, now)` returning either
  `{ kind: 'model', p, … }` or `{ kind: 'fallback', reason }`, and `loadClosureModel()`.
- `src/data/audit.ts` keeps the KM step curve and sorted durations on `ServiceAudit`, so the
  live service-wide figure reuses the estimator already on the page.
- `src/components/AlreadyWaiting.tsx`, rendered by `Hero.tsx` under the answer block.

## UI

"Already waiting?" sits under the main answer. One number input (whole days, 0 to the longest
usable day) and, when the gate passed, a neighborhood `<select>` defaulting to "Any
neighborhood". Two figures sit side by side: **All of Boston** (live KM) and the neighborhood
figure from the model, each with its sample size; the model card also gives its training date.
A fallback replaces the second card with a one-line reason. Text uses `aria-live="polite"` so
changes are announced.
