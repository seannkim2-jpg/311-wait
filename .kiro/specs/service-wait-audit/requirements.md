# Requirements: service-wait-audit

Boston 311 wait-time audit. Statistically honest comparison of the city's published
on-time rate and median closure time against Kaplan–Meier and Aalen-Johansen
estimates that account for the 7,876 cases still open and the 11,701 closed without
genuine resolution.

Source: `data.boston.gov` CKAN resource `254adca6-64ab-4c5c-9fc0-a6da622be185`.
No API key. CORS-open.

**Cohort restriction:** Every query restricts to `open_date >= '2026-07-01'`.
See design.md §"Cohort restriction rationale" for why earlier data is excluded.
All headline counts, medians, and survival curves in this document apply to this
cohort only (n = 56,797).

---

## REQ-01 Data access

The app SHALL fetch all 311 case data directly from `data.boston.gov` CKAN
`datastore_search_sql` at build time, requiring no API key and no backend server at
runtime. Every query SHALL include the clause `WHERE open_date >= '2026-07-01'`.
The fetch script SHALL store the normalized response as a static JSON asset bundled
with the build.

## REQ-02 Postgres interval parsing

The interval parser SHALL convert any Postgres interval string of the forms:
- `"D days, HH:MM:SS.ffffff"`
- `"HH:MM:SS"`
- `"D day, HH:MM:SS"` (singular "day")
- `"HH:MM:SS.ffffff"` (fractional seconds, no day component)

to a total number of **hours** as a JavaScript `number`. The parser SHALL round-trip:
for any generated `{days, hours, minutes, seconds}` tuple, `parse(format(tuple))`
SHALL equal the original total hours within floating-point tolerance. The parser SHALL
throw on a string that matches none of the above forms.

## REQ-03 Kaplan–Meier estimator

The KM estimator SHALL:
- Accept an array of `{ hours: number; event: boolean }` observations.
- Return a step-function `S(t)` as an array of `{ t, s, atRisk, events }` steps plus
  a Greenwood variance standard-error per step (so the UI can draw a CI band).
- Produce a `S(t)` that is monotonically non-increasing.
- Return only values in `[0, 1]` for all `S(t)`.
- With zero censored observations, equal `1 − ECDF(t)` exactly at all event times.
- Leave `S(t)` unchanged when a censored observation beyond the largest event time
  is appended.
- Return the median (first t where S ≤ 0.5) or `null` when S never reaches 0.5.

KM is the supporting evidence for the bias callout. It is NOT the primary framing;
see REQ-21 (Aalen-Johansen) for the primary framing.

## REQ-04 Greenwood confidence band

The KM module SHALL compute a Greenwood-variance pointwise standard error for `S(t)`
at every step. The UI uses this to draw a 95% CI band. The SE SHALL satisfy:
`SE(t) ≥ 0` for all t, and `S(t) ± 1.96 × SE(t)` SHALL contain `S(t)`.

## REQ-05 Naive median

The app SHALL compute the closed-only (naive) median from `close_date − open_date`
for all cases where `case_status = 'Closed'`, restricted to the selected service type
and the cohort (`open_date >= '2026-07-01'`). The naive median SHALL be displayed on
the same chart as the KM curve.

## REQ-06 Bias callout block

For every selected service type, the app SHALL render the following sentence in a
full-width visually distinct block between the KM chart and the closure-reason panel:

> "The naive median is [X days]. The KM-corrected median is [Y days / 'not reached'].
> The naive estimate understates the wait by [Z×] because it excludes [k] open cases."

For Sidewalk Repair (KM median never reached), the block SHALL read:
> "The naive median says 0.86 days. Fewer than half of Sidewalk Repair cases have
> ever closed: the survival curve ends at S = 0.683. There is no honest median."

All values SHALL be computed from live data and SHALL update when the service changes.

## REQ-07 Wilson score intervals

The Wilson interval function SHALL return a `{ lower: number; upper: number }` such that:
- The interval contains the point estimate `p`.
- Both bounds lie in `[0, 1]`.
- The interval has strictly positive width for all `0 ≤ p ≤ 1, n ≥ 1`.
- At `p = 0` and `p = 1`, the interval SHALL not collapse to a point.

## REQ-08 Suppression rule

The neighborhood table SHALL display `—` for any cell where the case count n < 30.
A tooltip (visible on hover and on keyboard focus) on each suppressed cell SHALL state
the actual n: "Suppressed: fewer than 30 cases (n=[k]). Results below this threshold
are unreliable."

One line of visible text directly above the table SHALL read:
"Neighborhoods with fewer than 30 cases show —".

## REQ-09 Closure-reason panel — PRIMARY framing

The closure-reason panel is the PRIMARY framing of the app. It SHALL appear before the
KM chart in visual order.

For the cohort (n = 56,797) and for the selected service type, the app SHALL display
the count and percentage of closed cases by `closure_reason` value. Key cohort figures:

- Total cases opened since 2026-07-01: **56,797**
- Closed: **48,903** (86.1%)
- Still open: **7,876** (13.9%)
- Still open AND past city target: **6,240** (10.99% of total)
- Closed as `Noted` or `Transitioned` (not resolved): **11,701 of 48,903 = 23.9%**

"Noted" and "Transitioned" segments SHALL use a visually distinct color from
"Resolved" and "Resolved successfully". An annotation SHALL read:
"23.9% of closed cases were Noted or Transitioned — not resolved."

This finding requires no statistical inference and SHALL be the first headline a user
sees.

## REQ-10 Default service type

On first load, before any user interaction, the app SHALL display data for
**Street Light Outage**.

Rationale: shows the starkest valid contrast between naive and KM median within the
cohort. Street Light Outage has 37.9% censoring rate, naive median 4.75 d, KM median
14.67 d — a 3.09× understatement. Sidewalk Repair (70.2% censoring, KM never reached)
SHALL be featured as the case where the metric breaks entirely, surfaced via the bias
callout copy when that service is selected.

## REQ-11 Service picker

The service picker SHALL:
- Render as a horizontal chip/tab row with one chip per service type.
- Highlight the selected chip visually.
- Be fully keyboard-navigable: left/right arrow keys move focus between chips;
  Space or Enter confirms selection.
- Announce the newly selected service via an `aria-live="polite"` region:
  "Now showing [service type]."
- Disable all chips while data is loading and show a visual loading indicator.

## REQ-12 Sample size always visible

Every chart and every table SHALL display:
- Total n (all cohort cases for the selected service/filter).
- Censored count k (for KM and AJ charts).

These SHALL appear in the chart legend or table caption, not exclusively in a tooltip.

## REQ-13 Query timestamp

The header SHALL display the timestamp of the most recent data fetch, formatted as:
"data.boston.gov · queried YYYY-MM-DD HH:MM ET"

The timestamp SHALL reflect the actual fetch time, not the Vite build time.

## REQ-14 Confounder note

Immediately below the neighborhood table, the app SHALL display plain-text copy naming
at least three confounders that the dataset cannot separate. Required text (exact wording
or equivalent):

> "Neighborhood differences in [service type] times may reflect lamp ownership (city
> vs utility vs private), contractor routing, and case volume — this dataset cannot
> separate those factors."

The note SHALL update the service-type name when the picker changes.

## REQ-15 No causal language

No copy, label, tooltip, or annotation in the app SHALL use causal language. The words
"causes", "results in", "leads to", "due to", and "because of" SHALL not appear in any
user-facing string that describes a relationship between two data dimensions.
"Associated with" and "correlates with" are acceptable.

## REQ-16 Cambridge proxy label

If the Cambridge panel is rendered, it SHALL display the following label in an amber/
warning callout BEFORE the Cambridge KM chart:

> "Cambridge has no exact close date. Times shown are a proxy: last-updated minus
> open date. This is an upper bound on the actual wait time."

The Cambridge panel SHALL be collapsed by default. The toggle button SHALL carry
`aria-expanded` and update correctly on expand/collapse.

## REQ-17 Accessibility

- All interactive controls SHALL be reachable and operable by keyboard alone.
- All charts SHALL have a text alternative (`aria-label` or `<figcaption>`) describing
  the finding in words.
- Color SHALL NOT be the only visual indicator of meaning (pattern or label also required).
- The app SHALL pass `axe-core` automated audit with zero critical violations on the
  default-state render.
- All form controls and interactive elements SHALL have a programmatic label.

## REQ-18 No backend

The deployed artifact SHALL be a static site (HTML + JS + CSS + static JSON assets).
No server process, no database, no API proxy SHALL be required at runtime. The site
SHALL be deployable to Vercel with a zero-config `npm run build`.

## REQ-19 Property-based tests

The stats module (`src/lib/stats.ts`) SHALL have property-based tests (using fast-check)
covering:
- REQ-02: interval parser round-trip
- REQ-03: KM monotonicity, range, ECDF equality, censored-observation invariant
- REQ-04: Greenwood SE non-negative and point estimate contained
- REQ-07: Wilson CI containment, bounds, positive width
- REQ-21: AJ cause incidences sum to 1 within 1e-9

Tests SHALL run via `npm test` and SHALL be defined in `src/lib/stats.test.ts`.

## REQ-20 Build reproducibility

A clean `git clone` followed by `npm install && npm run build` SHALL produce a
deployable artifact without any manual steps, credentials, or environment variables.
The build SHALL complete in under five minutes on a standard developer laptop.

## REQ-21 Aalen-Johansen competing-risks CIF — PRIMARY statistical framing

`Noted` and `Transitioned` are **competing events**, not censoring. A case closed as
`Noted` will not eventually be resolved; treating it as censored falsely assumes it
would. The correct estimator is the Aalen-Johansen cumulative incidence function (CIF).

The AJ estimator SHALL:
- Accept observations with `cause: 0 | 1 | 2` (0 = censored/still open,
  1 = genuinely resolved, 2 = administratively closed / Noted+Transitioned).
- Compute per-cause CIF curves: F₁(t) for genuine resolution, F₂(t) for admin closure.
- Return the final incidence for each cause plus the share still unresolved
  (1 − F₁(∞) − F₂(∞)).
- Guarantee: F₁(∞) + F₂(∞) + still_unresolved = 1.0 within 1e-9.

Cohort-wide AJ final incidences (at 115 d, used for golden-value tests):

| Service           | Resolved | Admin-closed | Still unresolved |
|-------------------|----------|--------------|-----------------|
| Litter & Debris   | 80.1%    | 16.4%        | 3.6%            |
| Street Light Out. | 70.4%    |  7.0%        | 22.6%           |
| Pothole           | 64.4%    | 16.0%        | 19.6%           |
| Sidewalk Repair   | 17.7%    | 14.0%        | 68.3%           |

The closure-reason panel SHALL use the AJ CIF curves as its primary visual, not a
simple count breakdown.

## REQ-22 Independent-censoring caveat (on-screen copy)

The following text SHALL appear on screen in the stats methodology section, not only
in a README:

> "Kaplan–Meier assumes cases still open are a random sample of open cases with respect
> to eventual close time. If the city defers difficult cases, our estimate is
> **optimistic** — the true wait is longer."

This text SHALL be visible without scrolling past the KM chart.

## REQ-23 Cohort scope note (on-screen copy)

The following text SHALL appear on screen near the headline counts:

> "Cohort: cases opened 2026-07-01 through 2026-10-24 (n = 56,797).
> Max observable duration ≈ 115 days."

The 6,240 overdue count SHALL be labeled "cases currently past their deadline" and
SHALL NOT be given a denominator or presented as a rate.
