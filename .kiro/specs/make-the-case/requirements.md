# Requirements: make-the-case

Source plan: `docs/plans/MAKE-THE-CASE.md`. Every figure on screen comes from the live data and
must agree with `scripts/check_make_the_case.py` (`data/make-the-case.json`) and, for existing
figures, `data/numbers.json`.

## MC-01 Check script first

`scripts/check_make_the_case.py` SHALL exist and pass before any feature code is committed, and
SHALL be run again at the end against figures read off the rendered page (`--compare`). It SHALL
use its own Kaplan–Meier, not `src/lib/stats.ts`.

## MC-02 Case ID validation

`parseCaseId(input)` SHALL trim the input, upper-case it, and return it only if it matches
`^BCS-\d{8}$`; otherwise it SHALL return `null`. The page SHALL NOT send any request for input
that `parseCaseId` rejects, and SHALL say what format it expects.

## MC-03 Case lookup

For a valid ID, the page SHALL query that one case by exact `case_id` and SHALL request no
address, street, coordinate, photo or comment fields. If no row comes back it SHALL say the case
was not found in the cohort (cases opened since 2026-07-01). A case opened before the cohort SHALL
be reported as outside the period the data covers, with no statistics.

## MC-04 Case facts

For a found case the page SHALL show: service, status, date opened, days open to the extract
cutoff (open cases) or days to close (closed cases), the target date, days past target (open
cases past target), the closure reason when closed, and the council district when it is 1–9.
Closure reasons SHALL read "Noted (no action required)" and "Transitioned (reassigned to another
agency)".

## MC-05 Conditional chance

`conditionalClose(km, ageHours, windowHours, horizonHours)` SHALL return
`1 − S(age + window) / S(age)` from an existing `kaplanMeier()` result, and SHALL return `null`
when `age + window > horizon` or `S(age) = 0`. Properties (fast-check):
- the result is in [0, 1];
- it never falls as the window grows;
- it equals `1 − S(age + window)/S(age)` read off the same curve exactly;
- at age 0 it equals `1 − S(window)`.
No existing estimator in `src/lib/stats.ts` SHALL change.

## MC-06 Chance on screen

For an open case the page SHALL show "Historically, of similar {service} cases still open after
{N} days, {X} in 100 closed in the following 14 days" with the number of similar cases. It SHALL
NOT show the figure when fewer than 30 similar cases remain, or when the 14-day window passes the
longest observed wait (about 115 days); it SHALL say which. It SHALL NOT use "will", "likely to"
or any wording that predicts the resident's own case.

## MC-07 Copyable summary

The page SHALL offer a "Copy summary" button that copies plain text containing: the case ID and
facts, the service's median among closed cases and estimate including open cases, the historical
line (when shown), the data source and extract date, exactly one request chosen by the table in
the plan, and https://www.boston.gov/departments/city-council. It SHALL hardcode no names or
email addresses. Success or failure SHALL be announced through an `aria-live` region, and the
same text SHALL be visible on the page so it can be selected by hand.

## MC-08 Cambridge

The page SHALL show Cambridge Commonwealth Connect requests (dataset `2z9k-mv9g`) for tickets
created since 2026-07-01, with an issue-type picker limited to types with at least 200 tickets,
the median among closed tickets next to the estimate including open tickets, and the count still
open. Open and Acknowledged SHALL count as still open, censored at Cambridge's own extract cutoff.
Closed and Archived tickets without a close time SHALL be excluded and their count SHALL be shown.
Cambridge SHALL NOT be pooled with, ranked against or put on the same chart as Boston.

## MC-09 Wording

All new copy SHALL follow `.kiro/steering/claims.md`, and `python3 scripts/refresh_numbers.py
--lint-only` SHALL report 0 problems.

## MC-10 Accessibility and layout

The ID field SHALL have a visible label and an associated error message. The lookup button, copy
button and Cambridge picker SHALL be keyboard operable with visible focus. The page SHALL have no
horizontal scroll at 390 px wide. axe-core SHALL report no violations once the new sections have
rendered.

## MC-11 Existing page unchanged

Existing sections and figures SHALL stay as they are, and Street Light Outage SHALL still show
14.5 days including open cases (`data/numbers.json`).
