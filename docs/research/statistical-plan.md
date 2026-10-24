# Plan: a statistically honest audit of Massachusetts municipal service data

## The statistical idea that carries the project

Boston publishes an on-time rate for 311 cases. That rate, and any median close time
computed from closed cases, is **biased downward by right-censoring**: 7,840 cases are still
open right now, and the ones still open are disproportionately the slow ones. Dropping them
is survival bias in its textbook form.

The fix is the textbook fix. **Kaplan–Meier** estimates the time-to-close distribution using
both the closed cases (events) and the still-open cases (censored observations). Report the
naive median beside the KM median and the gap is the bias, quantified.

That gives one defensible sentence no official dashboard says: *the city's own numbers
understate how long people wait, and here is by how much.*

## Why this is safe to claim

Everything here describes the case-closure process. Nothing claims a cause. We do not say a
neighborhood is underserved, that income predicts wait, or that any policy produced any
number. Verified earlier: the income-gradient story is **not** in this data — the slowest
street-light medians belong to South Boston Waterfront (54d), Bay Village (52d), North End
(31d) and Beacon Hill (28d). We report the gap and name the confounders.

## Statistical components, in build order

1. **Kaplan–Meier estimator** of time-to-close, stratified by service type and municipality.
   Events are closed cases, using `close_date - open_date`. Censored observations are cases
   still `In progress`, using `now() - open_date`. Report KM median plus a Greenwood-variance
   confidence interval.
2. **Naive vs KM median comparison.** The headline number. Compute the closed-only median,
   the KM median, and the difference.
3. **Wilson score intervals** on on-time proportions per neighborhood and service. Stops
   anyone over-reading a cell with n=40 (South Boston Waterfront) against one with n=410
   (South End). Suppress or warn below n=30.
4. **Log-rank test** comparing survival curves between groups, with **Benjamini–Hochberg**
   correction across the full comparison set. Reporting that most apparent differences do not
   survive correction is a stronger and more honest result than claiming a gap.
5. **Bootstrap percentile CIs** for medians where a distribution-free interval is wanted.
6. *Stretch, only with time left:* **Cox proportional hazards** on service type, neighborhood
   and report channel. Hazard ratios presented as associations, never as effects. Precompute
   rather than fitting in the browser.

## The "closed but not resolved" layer

Of 66,251 closed cases, `closure_reason` is `Noted` for 12,312 and `Transitioned` for 2,842 —
about 23% closed without resolution, all counted in the on-time rate. Illegal Dumping is
996/3,017 (33%). This is a second, independent critique of the same metric, and it needs no
inference at all: it is a count. Treating `Noted`/`Transitioned` as non-events in a secondary
KM fit gives a "time to actually resolved" curve that sits strictly below the official one.

## Making it Massachusetts, honestly

| Municipality | Rows | Time-to-close | Censoring | Verdict |
| --- | --- | --- | --- | --- |
| **Boston** | 75,851 | exact `close_date` and `target_close_date` | `In progress` cases | Rigorous core |
| **Cambridge** | 156,112 (since 2023) | **no close date** — only `ticket_last_updated_date_time` | `ticket_status='Open'` | Second city, proxy flagged |

Boston carries the real analysis because it has both an exact close timestamp and the city's
own target, so we can audit an official SLA. Cambridge adds a second municipality and more
history, but its closure time must be proxied by last-updated, which is an upper bound at
best. Label that proxy on screen; do not pool the two into one curve.

Commonwealth Connect / SeeClickFix is shared across many Massachusetts municipalities, so the
method generalizes — but only Cambridge's extract was verified today. Claim the method as
statewide; claim the measurement as two-city.

## Schedule to the 8:00 PM deadline

| Time | Work |
| --- | --- |
| now – 1:00 | Lock scope. Kiro CLI writes `.kiro/specs/service-wait-audit/{requirements,design,tasks}.md` |
| 1:00 – 2:30 | Kiro implements the stats module: interval parser, KM, Wilson, log-rank, BH. Property-based tests alongside |
| 2:30 – 4:30 | Kiro builds the UI: service picker, KM curve vs naive median, per-neighborhood table with CIs, closure-reason panel |
| 4:30 – 5:30 | Cambridge as second municipality, proxy clearly labelled |
| 5:30 – 6:30 | Deploy to Vercel. Write `docs/KIRO-USAGE.md`. Re-pull headline numbers |
| 6:30 – 7:30 | Record the video under three minutes |
| 7:30 – 8:00 | Buffer. Submit |

Cut order if time runs short: Cox, then log-rank, then Cambridge. The KM-vs-naive comparison
and the closure-reason count are the floor — ship those or ship nothing.

## Property-based testing targets

PBT is a graded Kiro feature and this code is unusually well suited to it. Solid properties:

- The Postgres interval parser round-trips: any generated `{days, h, m, s}` formats and parses
  back to the same total seconds. Covers `"13 days, 12:33:42.319741"`, bare `"9:32:19"`, and
  the plural/singular `day`/`days` split.
- `S(t)` is monotonically non-increasing in `t`, and every value lies in `[0, 1]`.
- With no censored observations, KM equals `1 - ECDF` exactly.
- Appending a censored observation later than the largest event time leaves `S(t)` unchanged.
- Wilson intervals contain the point estimate and stay inside `[0, 1]`, including at `p = 0`
  and `p = 1`, where the normal approximation fails and Wilson is the reason we chose it.
- BH-adjusted p-values are monotone in the raw p-values and never below them.

## Kiro usage, mapped to the Implementation score

- **Specs** — `.kiro/specs/service-wait-audit/`, written before any code, kept in sync.
- **Steering** — extend `.kiro/steering/` with a statistical-claims rule: no causal language,
  always show `n`, always show the censoring count, suppress below n=30.
- **Hooks** — `.kiro/hooks/` to run the property tests on save of the stats module, and to
  re-check the live endpoint shape.
- **PBT** — the properties above.
- **CLI vs IDE** — CLI drove brainstorming, fact-checking and the spec; note in the write-up
  where the IDE was better, since judges ask explicitly how the tools differed.
- **MCP** — only if it earns its place; a forced MCP server reads as box-ticking.

## Guardrails to keep on screen

Show `n` and the censored count on every figure. Suppress cells below n=30. Say "closed" and
"resolved" as different words everywhere. Timestamp every query. Never present a historical
distribution as a prediction. Name the confounders — density, lamp ownership, contractor
routing — next to any comparison.
