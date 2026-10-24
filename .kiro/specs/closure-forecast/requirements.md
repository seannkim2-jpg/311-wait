# Requirements: closure-forecast

For a Boston 311 request that has already been open *N* whole days, estimate the historical
chance it **closes in the next 7 days**, from its service and, optionally, its neighborhood.

The service-only answer is Kaplan–Meier (KM) on the live cohort. A neighborhood-aware Cox model
earns a place on the page only if it beats that answer on later, held-out requests. Wording
rules in `.kiro/steering/data-facts.md` apply: no causal or income claims, and "closed"
includes cases closed as Noted or Transitioned.

## REQ-F01 Training data

The training script SHALL pull `service_name`, `neighborhood`, `case_status`, `open_date` and
`close_date` for cases opened on or after 2026-07-01 with status `Closed` or `In progress`. Any
closure SHALL be the event; open cases SHALL be right-censored at the extract cutoff. Rows with
unparseable dates, a close before the open, a `Closed` status without a close date, or an open
after the cutoff SHALL be excluded and counted. Closure reason and `on_time` SHALL NOT be
predictors, because neither is known when a request is filed.

## REQ-F02 One quantity for both methods

Both the KM baseline and the Cox model SHALL output
`P(close in (N, N+7] | still open at N) = 1 − S(N+7) / S(N)`, with *N* a whole number of days.

## REQ-F03 Held-out test

Models SHALL be fit on cases opened 2026-07-01 to 2026-08-31, censored at 2026-09-01 00:00 UTC,
and tested on cases opened 2026-09-01 to 2026-09-17 at N = 0, 14 and 30. At each N a held-out
case SHALL count only if its potential follow-up (cutoff − open) is at least N + 7 days, so
eligibility never depends on the outcome. The script SHALL report Brier score overall, per N
and per major service, and calibration in 10 probability bands, for both methods.

## REQ-F04 Release gate

The gate SHALL be fixed in the script before results are seen. The forecast SHALL be released
only if, against KM on the held-out set:
1. pooled Brier score is at least **5% lower**;
2. expected calibration error is at most **0.05** and no more than **0.01** above KM's;
3. no major service's Brier score is more than **2% higher**.

Major services are the four headline services plus any with at least 1,000 training cases. The
result SHALL be written to the artifact and recorded in `docs/ANALYSIS.md`, pass or fail.
Proportional hazards SHALL be checked before any coefficient is described.

## REQ-F05 Static artifact

After validation the script SHALL refit on the full cohort, censored at the latest extract
cutoff, and write one JSON file with only: coefficients, feature names and means, per-service
baseline survival on a daily grid, at-risk and case counts, training date, and the gate result.
It SHALL NOT contain case-level records.

## REQ-F06 TypeScript reader

A dependency-free TypeScript reader SHALL reproduce the Python model's predictions. A test
SHALL compare it with lifelines' own `predict_survival_function` on fixed examples to 1e-6.

## REQ-F07 "Already waiting?" control

The Hero SHALL include an **Already waiting?** block with a labelled whole-day input. It SHALL
show the service-wide KM estimate for the selected service. It SHALL offer an optional
neighborhood select only when the artifact's gate passed. Model estimates SHALL be labelled
**"Historical chance of closure"**, shown beside the service-wide estimate with the training
date and sample size, and SHALL NOT be phrased as a promise of resolution.

## REQ-F08 Fallbacks

The page SHALL show only the service-wide estimate, with the reason, when: the neighborhood is
missing from the model; the service has fewer than 30 training cases in that neighborhood, or
fewer than 30 still open at day N; N + 7 is past the model's horizon; the model is more than 30
days old; or the artifact did not load. The service-wide estimate SHALL itself say so when
fewer than 30 cases were still open at day N or N + 7 is past the longest observed wait.

## REQ-F09 Scope

Boston only. A Cambridge view, if added, keeps its own method: its data has different fields
and closure timing. The existing Kaplan–Meier and competing-risks displays stay unchanged.
