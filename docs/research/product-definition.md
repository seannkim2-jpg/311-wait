# Product Definition: Boston 311 Wait-Time Audit

Written: 2026-10-24 ~13:00 ET  
Track: Civic Services  
Deadline: 20:00 ET tonight

---

## 1. Name

**Wait Audit**  
*Candidate A:* **Wait Audit** — "A statistically honest account of how long Bostonians actually wait for 311 service requests to close."  
*Candidate B:* **ClearTime** — "Boston 311 wait times, corrected for the cases still sitting open."  
*Candidate C:* **311 Reckoning** — "The wait times Boston reports, the wait times people actually experience, and the gap between them."

**Chosen: Wait Audit.**

Why: "Audit" names the action precisely — we are checking official numbers against a corrected estimate and finding they fall short. "Dashboard" implies live operational monitoring; this is a one-time statistical correction of a published metric. "Reckoning" is dramatic but vague. "ClearTime" is marketable but tells a judge nothing before they click. "Wait Audit" is literal, credible, and search-friendly.

---

## 2. One-sentence product definition

**Wait Audit** is a browser-only statistical audit for Boston residents and journalists that shows, service type by service type, how much the city's published 311 on-time rate and median closure time understate the true wait — because 7,840 cases are still open and the ones still open are disproportionately the slow ones.

---

## 3. Screen inventory

One screen. No routing. No modals. Scroll-based layout, ~2,400 px total height on a 1280-wide viewport.

### Above the fold (~800 px)

| Zone | Content |
|---|---|
| Header bar | App name "Wait Audit", sub-line "Boston 311 service requests · data.boston.gov · queried [timestamp]", GitHub link |
| Lede numbers strip | Three stat tiles in a row (exact values in §4) |
| Service type picker | Horizontal chip row: Street Light Outage · Sidewalk Repair · Pothole · Domestic Animal Issue · Pruning Request · Illegal Graffiti · (All services). Default: Street Light Outage. |
| KM chart | Survival curve panel: KM curve (solid) + naive ECDF (dashed) + shaded Greenwood CI. X-axis: days from open. Y-axis: proportion not yet closed. Vertical dashed line at KM median. |

### Below the fold

| Zone | Content |
|---|---|
| Bias callout block | One sentence: "The naive median for [service] is [X]. The KM-corrected median is [Y]. The city's number understates the wait by [Z]." Styled as a highlighted finding, not a chart. |
| Closure-reason panel | Horizontal stacked bar: Resolved / Noted / Transitioned / Resolved successfully / null. Per service type, matching the picker. Annotation: "~23% of closed cases were not resolved." |
| Neighborhood table | Service type filtered. Columns: Neighborhood · Closed cases (n) · KM median (days) · 95% CI · On-time rate · Wilson 95% CI. Rows sorted by KM median descending. Cells with n < 30 show "—" with tooltip "n < 30, suppressed". |
| Honesty furniture strip | See §7. |
| Cambridge note | One paragraph: Cambridge 311 has no exact close date; proxy is `ticket_last_updated_date_time`. KM for Cambridge shows upper-bound wait, labelled explicitly. Collapsible; collapsed by default. |
| Footer | Data source, license, Kiro attribution, build date. |

---

## 4. Exact numbers on screen

### Stat tiles (lede strip)

**Tile 1 — Open & overdue right now**
- Statistic: count of cases where `case_status='In progress'` AND `on_time='OVERDUE'`
- Query: `SELECT COUNT(*) FROM "254adca6-64ab-4c5c-9fc0-a6da622be185" WHERE case_status='In progress' AND on_time='OVERDUE'`
- Label: "Open & overdue right now"
- Value from verified facts: **7,840**
- Sub-label: "cases past the city's own deadline"
- Recomputed at build time: yes (live query)

**Tile 2 — Closed without resolution**
- Statistic: count of closed cases where `closure_reason` IN ('Noted', 'Transitioned') divided by total closed cases, as a percentage
- Query: `SELECT closure_reason, COUNT(*) FROM "254adca6-64ab-4c5c-9fc0-a6da622be185" WHERE case_status='Closed' GROUP BY closure_reason`
- Label: "Closed without resolution"
- Value from verified facts: **~23%** (15,154 of 66,251 closed cases)
- Sub-label: "of 'closed' cases were Noted or Transitioned, not fixed"
- Recomputed at build time: yes

**Tile 3 — KM vs naive gap (Street Light Outage)**
- Statistic: KM median minus closed-only median for the default service type
- Query: full case pull for Street Light Outage (closed + in-progress), then client-side KM
- Label: "Underreported wait"
- Value: computed at build time from KM estimator; placeholder until first run — from verified facts the closed-only median is 13d 12h and mean is 47d 2h, so the KM median will be materially higher (exact value recomputed)
- Sub-label: "days the city's median understates the Street Light Outage wait"
- Recomputed at build time: yes

### KM chart labels

- Chart title: "[Service type] — time to close" (e.g., "Street Light Outage — time to close")
- X-axis: "Days from case open" (ticks: 0, 30, 60, 90, 180, 365)
- Y-axis: "Proportion not yet closed" (0.0 – 1.0)
- Legend entries: "Kaplan–Meier estimate (n=[total], [censored] censored)" · "Naive (closed cases only, n=[closed])"
- Greenwood CI band: labelled "95% CI" in legend
- KM median vertical line: labelled "[X] days (KM median)"
- Naive median vertical line: labelled "[Y] days (naive median)"

### Closure-reason bar labels

- Title: "How cases are closed — [service type]"
- Segment labels: "Resolved" · "Noted" · "Transitioned" · "Resolved successfully" · "Other/null"
- Annotation: "23% closed without resolution (Noted + Transitioned)"

### Neighborhood table

Per-service values recomputed at build time. Hard numbers from verified facts for Street Light Outage (closed, median days):

| Neighborhood | n (closed) | Naive median (days) |
|---|---|---|
| South Boston Waterfront | 40 | 54 |
| Bay Village | 61 | 52 |
| East Boston | 167 | 34 |
| North End | 149 | 31 |
| Beacon Hill | 132 | 28 |
| Downtown | 100 | 23 |
| Charlestown | 224 | 23 |
| South End | 410 | 18 |

KM medians and Wilson CIs are computed at build time. Note: South Boston Waterfront (n=40) is above suppression threshold; Bay Village (n=61) likewise.

---

## 5. Default state

A judge lands on the page and sees, within three seconds without scrolling or clicking:

1. Header: "Wait Audit — Boston 311 service requests · data.boston.gov · queried [timestamp]"
2. Three stat tiles: 7,840 open & overdue · ~23% closed without resolution · [X] days underreported wait
3. Service picker with "Street Light Outage" highlighted
4. The KM curve chart, loaded, showing two curves that visibly diverge

**Why Street Light Outage as default:**  
- It has the largest median/mean gap in the verified data (13d 12h median vs 47d 2h mean), making it the most visually dramatic illustration of the tail
- It has 475 currently open & overdue cases and a longest current wait of 367 days — concrete human stakes
- n=3,485 closed cases — large enough to produce a credible KM estimate and a smooth curve
- It is infrastructure that directly affects safety and is visible to everyone, including judges who live in Boston

If the query is still loading on arrival, the tiles show a loading skeleton (grey bars) and the chart shows a spinner. The service picker chips are disabled during load.

---

## 6. Interactions

### Service type picker
- Control: horizontal chip row, single-select, keyboard-navigable (arrow keys move focus, Space/Enter selects)
- What changes: the KM chart, bias callout block, closure-reason bar, neighborhood table — all update to the selected service
- Loading state: chips disabled, chart and table show skeleton/spinner, "Loading data for [service]…" aria-live announcement
- Empty state: if a service returns < 30 closed cases and 0 open cases, show "Not enough data to estimate (n < 30)"

### Neighborhood table sort
- Control: clicking any column header re-sorts that column ascending/descending; arrow indicator on sorted column
- ARIA: `aria-sort="ascending"` / `"descending"` on the `<th>`

### Cambridge panel expand/collapse
- Control: single "Show Cambridge comparison ▸" toggle button; collapses by default
- What changes: reveals the Cambridge KM chart with proxy label prominent
- ARIA: `aria-expanded` on the button

### Tooltip on suppressed cells
- Hover or focus on a "—" cell in the neighborhood table shows: "Suppressed: fewer than 30 cases (n=[actual n]). Results below this threshold are unreliable."

### Timestamp
- The query timestamp in the header updates to reflect the actual fetch time, not build time. Displayed as "queried YYYY-MM-DD HH:MM ET"

### No other interactive controls.
There is no date range picker, no neighborhood filter, no comparison selector. Scope is deliberately minimal.

---

## 7. Honesty furniture

These are not footnotes. They live in primary visual flow.

| Element | Content | Location |
|---|---|---|
| **n and censored count** | "n=[total], [k] censored" appears in the KM chart legend on every render, not in a tooltip | KM chart legend, always visible |
| **Suppression rule** | "Neighborhoods with fewer than 30 cases show '—'" | One line directly above the neighborhood table, not in a footnote |
| **Bias callout block** | "The naive median (closed cases only) is X. The KM-corrected median is Y. The naive estimate understates the wait by Z days because it drops [k] open cases." | Full-width highlighted block between KM chart and closure-reason panel |
| **Closure definition** | "'Closed' means the city changed the status to Closed. 'Resolved' means the city additionally recorded a Resolved closure reason. ~23% of closed cases carry a Noted or Transitioned closure reason." | Immediately above the closure-reason bar, in body text, not a tooltip |
| **Confounder note** | "Neighborhood differences in Street Light Outage times may reflect lamp ownership (city vs utility vs private), contractor routing, and case volume — this dataset cannot separate those factors." | One sentence directly below the neighborhood table |
| **Query timestamp** | "data.boston.gov · queried [timestamp]" | Header bar, always visible |
| **Wilson CI note** | "On-time rates shown with Wilson 95% confidence intervals. Cells with n < 30 suppressed." | Column header tooltip on the Wilson CI column, and the suppression line above the table |
| **Cambridge proxy label** | "Cambridge has no exact close date. Times shown are a proxy: last-updated minus open date, which is an upper bound." | Prominent callout at the top of the Cambridge panel, styled in amber/warning color |

Rationale: accessibility and equity are judged criteria. A judge who cannot find the n or the censoring count in five seconds should not have to look harder. Every uncertainty lives next to the number it qualifies.

---

## 8. Video beats (under 3 minutes)

**Total target: 2:45**

| Time | Shot | What to show |
|---|---|---|
| 0:00–0:20 | Screen: city's own 311 portal showing on-time rate | "Boston publishes an on-time rate for 311 requests. That number has a problem." |
| 0:20–0:45 | Screen: Wait Audit landing, tile 1 highlighted | "Seven thousand eight hundred and forty cases are currently open and already past the city's own deadline. They aren't in the on-time rate." |
| 0:45–1:15 | Screen: KM chart for Street Light Outage, cursor traces the gap between the two curves | "**The city's median for Street Light Outage is 13 days. The Kaplan–Meier corrected median is [X] days.** That gap is what right-censoring looks like — dropping the slow cases because they haven't finished yet." — **this is the emotional peak** |
| 1:15–1:35 | Screen: closure-reason panel, Illegal Dumping row highlighted | "Even among cases the city marks Closed, 23% were Noted or Transitioned — not fixed. The on-time rate counts them." |
| 1:35–1:55 | Screen: neighborhood table, South Boston Waterfront and Bay Village at top | "The slowest street-light neighborhoods are Bay Village and South Boston Waterfront — not where a simple story would put them. We show confidence intervals and suppress cells below n=30 so you can see what the data actually supports." |
| 1:55–2:15 | Screen: honesty furniture strip, suppression row, confounder note | "Every number ships with its sample size, censoring count, and the confounders we cannot rule out." |
| 2:15–2:35 | Screen: service picker switching from Street Light Outage to Pothole, charts update | "Every service type has its own curve. Pick the one you care about." |
| 2:35–2:45 | Screen: full page scroll | "Wait Audit. Built with Kiro on Boston open data." |

**Emotional peak:** the KM vs naive gap number at 1:05, when the corrected median lands on screen and the viewer can see the two curves diverge. The single number to flash on screen is the gap in days — e.g., "**+[X] days**" — large, centered, held for three seconds.

---

## 9. Build order with time boxes

Start: 13:00 ET. Deadline: 20:00 ET. Seven hours.

| Window | Task | Time box | Deliverable |
|---|---|---|---|
| 13:00–13:30 | Lock this product definition; Kiro writes `.kiro/specs/service-wait-audit/{requirements,design,tasks}.md` | 30 min | Spec files committed |
| 13:30–14:30 | Stats module: Postgres interval parser, KM estimator, Wilson intervals, log-rank, BH. Property-based tests written alongside. | 60 min | `src/stats/` passing PBT |
| 14:30–15:15 | Data layer: CKAN SQL queries, response normalizer, build-time data fetch script | 45 min | `src/data/` with cached JSON at build time |
| 15:15–16:30 | Core UI: stat tiles, service picker, KM chart (Recharts), bias callout block | 75 min | Above-the-fold renders correctly |
| 16:30–17:15 | Closure-reason panel, neighborhood table with Wilson CIs and suppression | 45 min | Below-the-fold complete |
| 17:15–17:45 | Honesty furniture: inline labels, suppression row, confounder note, timestamp | 30 min | All §7 elements on page |
| 17:45–18:15 | Cambridge panel (collapsed, proxy labelled) | 30 min | Cambridge KM renders with warning |
| 18:15–18:30 | Accessibility pass: keyboard nav, ARIA labels, contrast check | 15 min | No axe-core errors |
| 18:30–19:00 | Deploy to Vercel. Update README with live URL. Write `docs/KIRO-USAGE.md`. | 30 min | Public URL reachable |
| 19:00–19:45 | Record demo video (2:45 target) | 45 min | Uploaded to YouTube/Vimeo, unlisted → public |
| 19:45–20:00 | Final submission: checklist, team members, links | 15 min | Submitted |

### Cut list (in drop order, if time compresses)

1. **Cambridge panel** — drop if 17:45 arrives and the core is not solid. Costs one municipality; keeps the honest analysis.
2. **Log-rank test + BH correction** — drop if stats module is running long. The KM + Wilson floor is sufficient.
3. **Bootstrap CIs** — never implemented; already stretch. Drop immediately.
4. **Cox proportional hazards** — already stretch. Drop.
5. **Neighborhood table sort** — drop interactive sort, show static descending-by-KM-median. Saves ~20 min.
6. **Per-neighborhood KM curves** — do not implement. The table with Wilson CIs is enough.

**Floor that cannot be cut:** KM vs naive comparison for Street Light Outage, the three stat tiles, the closure-reason count. If only these three things work, ship them.

---

## 10. Spec skeleton — testable requirement headings

These become the headings in `.kiro/specs/service-wait-audit/requirements.md`.

**REQ-01 Data access**  
The app SHALL fetch all 311 case data directly from `data.boston.gov` CKAN `datastore_search_sql` at build time, requiring no API key and no backend server.

**REQ-02 Postgres interval parsing**  
The interval parser SHALL convert any Postgres interval string of the forms `"D days, HH:MM:SS.ffffff"`, `"HH:MM:SS"`, `"D day, HH:MM:SS"` to a total number of seconds, and SHALL round-trip: `format(parse(s)) == s` for all generated inputs.

**REQ-03 Kaplan–Meier estimator**  
The KM estimator SHALL accept a list of (duration, censored: bool) observations and return a step-function `S(t)`. `S(t)` SHALL be monotonically non-increasing. All `S(t)` values SHALL lie in [0, 1]. With zero censored observations, `S(t)` SHALL equal `1 − ECDF(t)` exactly. Appending a censored observation with duration greater than all event durations SHALL leave `S(t)` unchanged.

**REQ-04 Greenwood confidence interval**  
The KM module SHALL compute a Greenwood-variance 95% CI for `S(t)` at every step. The CI SHALL contain the point estimate at all `t`.

**REQ-05 Naive median**  
The app SHALL compute the closed-only (naive) median from `close_date − open_date` for cases where `case_status = 'Closed'`, and SHALL display it alongside the KM median.

**REQ-06 Bias callout**  
The app SHALL display, for every selected service type, the sentence: "The naive median is [X]. The KM-corrected median is [Y]. The naive estimate understates the wait by [Z] because it excludes [k] open cases." All four values SHALL be computed from live data.

**REQ-07 Wilson score intervals**  
The Wilson interval function SHALL return an interval that (a) contains the point estimate, (b) lies entirely in [0, 1], and (c) is strictly positive-width for all 0 ≤ p ≤ 1, n ≥ 1.

**REQ-08 Suppression rule**  
The neighborhood table SHALL display "—" for any cell where n < 30. A tooltip on each suppressed cell SHALL state the actual n.

**REQ-09 Closure-reason panel**  
The app SHALL display, for the selected service type, the count and percentage of closed cases by `closure_reason` value. "Noted" and "Transitioned" SHALL be visually distinguished from "Resolved" and "Resolved successfully".

**REQ-10 Default service type**  
The app SHALL default to Street Light Outage on first load, before any user interaction.

**REQ-11 Service picker**  
The service picker SHALL be keyboard-navigable. Arrow keys SHALL move selection. Space or Enter SHALL confirm. The selected service SHALL be announced via an `aria-live` region.

**REQ-12 Sample size always visible**  
Every chart and every table SHALL display the total n and the censored count (for KM) at all times, not in a tooltip.

**REQ-13 Query timestamp**  
The header SHALL display the UTC timestamp of the most recent data fetch, formatted as "queried YYYY-MM-DD HH:MM ET".

**REQ-14 Confounder note**  
The app SHALL display, immediately below the neighborhood table, a plain-text note naming at least three confounders that the dataset cannot separate (lamp ownership, contractor routing, case volume).

**REQ-15 No causal language**  
No copy in the app SHALL assert that any variable causes another. "Associated with" and "correlates with" are acceptable; "causes", "results in", "leads to", "due to" are not.

**REQ-16 Cambridge proxy label**  
If the Cambridge panel is present, it SHALL carry a prominent label: "Cambridge has no exact close date. Times shown proxy last-updated minus open date — an upper bound." The label SHALL appear before the Cambridge chart, not after it.

**REQ-17 Accessibility**  
All interactive controls SHALL be reachable by keyboard. All images and charts SHALL have text alternatives. Color SHALL not be the only visual indicator of meaning. The app SHALL pass axe-core with zero critical violations.

**REQ-18 No backend**  
The deployed app SHALL be a static site. No server process, no database, no API proxy SHALL be required at runtime.

**REQ-19 Property-based tests**  
The stats module SHALL have property-based tests covering REQ-02, REQ-03, REQ-04, and REQ-07. Tests SHALL run on every save of any file in `src/stats/`.

**REQ-20 Build reproducibility**  
A clean `git clone` followed by `npm install && npm run build` SHALL produce a deployable artifact without manual steps or credentials.
