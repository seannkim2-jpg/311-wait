# Design: service-wait-audit

Boston 311 wait-time audit — technical design document.
Satisfies all 23 requirements in `requirements.md`.

---

## Cohort restriction rationale

**All analysis is restricted to `open_date >= '2026-07-01'`.** This is not optional.

The resource spans 2025-08-01 to 2026-10-24 but is **not a complete record**. Monthly
case counts reveal the problem immediately:

| Month    | Cases  |
|----------|--------|
| Aug-2025 |    539 |
| Sep-2025 |    418 |
| Oct-2025 |    775 |
| Mar-2026 |  1,787 |
| May-2026 |  3,212 |
| Jun-2026 |  6,067 |
| Jul-2026 | 13,317 |
| Aug-2026 | 15,411 |
| Sep-2026 | 15,573 |
| Oct-2026 | 12,496 |

A 37× gap between Sep-2025 (418) and Sep-2026 (15,573) is not real demand growth.
The early months retain only cases that remained open through the extract window or were
recently touched — they are **enriched for slow cases**. This is left truncation combined
with selection on survival. Any KM or AJ curve computed on pre-July data would have a
biased, long-duration tail as an artifact of the extract, not a reflection of Boston's
service times.

July through October 2026 are internally consistent at 13,000–15,600 cases/month, so
the window looks complete. The cohort has **n = 56,797** cases and a maximum observable
duration of approximately 115 days (July 1 → October 24). The "longest wait" figures
from earlier analyses came from the contaminated pre-July tail and
are artifacts. **Do not use them.**

---

## Cohort headline counts

| Measure | Value |
|---|---|
| Cases opened since 2026-07-01 | **56,797** |
| Closed | **48,903** |
| Still open | **7,876** |
| Still open AND past city target | **6,624** |
| Closed as `Noted` or `Transitioned` | **11,701 of 48,903 = 23.9%** |

The 23.9% non-resolution finding is the most robust number in the dataset. It requires
no statistical inference — it is a direct count from the `closure_reason` field — and it
survives the cohort restriction unchanged.

The 6,624 open-and-past-target count is a **prevalence count**, not a rate. It has no valid
denominator. Do not divide it by total cases to produce a percentage; that conflates
cases opened yesterday (not yet due) with cases opened three months ago (overdue).
Count it from `target_close_date` against the extract cutoff, not from `on_time`: the flag
lags for open cases (384 open cases past target still read ONTIME, 324 of them Street Light).

---

## Architecture overview

Static browser-only app. No backend, no API key, no server at runtime (REQ-18).

```
data.boston.gov CKAN
       │
       │  HTTP at build time (WHERE open_date >= '2026-07-01')
       ▼
scripts/fetch-data.ts        ← Node script, runs during `npm run build`
       │
       │  writes
       ▼
public/data/
  boston-311.json            ← normalized cases, cohort only
  summary.json               ← tile values + fetch timestamp
       │
       │  static import
       ▼
src/data/loader.ts           ← typed accessor, groups by service type
       │
src/lib/
  stats.ts                   ← all stats functions (single file, pure TS)
       │
src/components/
  App.tsx                    ← root, service picker state
  StatTiles.tsx              ← three lede tiles
  ServicePicker.tsx          ← keyboard-navigable chips
  ClosureReasonPanel.tsx     ← PRIMARY: AJ CIF + count breakdown
  KMChart.tsx                ← SUPPORTING: Recharts LineChart, two curves + CI band
  BiasCallout.tsx            ← full-width highlighted sentence block
  NeighborhoodTable.tsx      ← sortable table, Wilson CIs, suppression
  HonestyFurniture.tsx       ← suppression line, confounder note, timestamp
  CambridgePanel.tsx         ← collapsed by default, proxy label prominent
  Footer.tsx
```

Stack: React 18, Vite, Tailwind CSS, Recharts.
Testing: Vitest + fast-check for property-based tests.

---

## Data pipeline

### Build-time fetch (`scripts/fetch-data.ts`)

Uses `datastore_search_sql`. Every query includes `WHERE open_date >= '2026-07-01'`.

**Query 1 — all cohort cases, core columns**
```sql
SELECT
  case_status,
  service_name,
  neighborhood,
  on_time,
  closure_reason,
  open_date,
  close_date,
  target_close_date,
  close_date::timestamp - open_date::timestamp AS duration
FROM "254adca6-64ab-4c5c-9fc0-a6da622be185"
WHERE open_date >= '2026-07-01'
LIMIT 100000
```
Paginate with `OFFSET` until exhausted. Expected ~56,797 rows.

**Query 2 — server-side aggregates for tile values**
```sql
SELECT
  COUNT(*) AS total,
  -- Overdue = target before the extract cutoff, not on_time. (CKAN rejects FILTER; the
  -- shipped query in src/lib/boston311.ts uses SUM(CASE ...).)
  COUNT(*) FILTER (WHERE case_status = 'In progress' AND target_close_date < :extract_cutoff) AS open_overdue,
  COUNT(*) FILTER (WHERE case_status = 'Closed') AS total_closed,
  COUNT(*) FILTER (WHERE case_status = 'Closed'
    AND closure_reason IN ('Noted', 'Transitioned')) AS closed_unresolved
FROM "254adca6-64ab-4c5c-9fc0-a6da622be185"
WHERE open_date >= '2026-07-01'
```

### Normalization

Each row becomes a `Case` object:
```ts
interface Case {
  status: 'Closed' | 'InProgress';
  service: string;
  neighborhood: string;
  onTime: 'OVERDUE' | 'ON TIME' | null;
  closureReason: string | null;
  openDate: Date;
  closeDate: Date | null;
  targetCloseDate: Date | null;
  durationHours: number | null;   // null if still open
  waitHours: number;              // durationHours OR (extractCutoff - openDate); see fetchExtractCutoff()
  // Cause encoding for AJ:
  // 0 = still open (censored), 1 = closed as resolved, 2 = Noted/Transitioned
  cause: 0 | 1 | 2;
}
```

Duration comes from the Postgres interval string. Parsed by `parsePgInterval` in
`src/lib/stats.ts` (REQ-02). Open cases are censored at the **extract cutoff** from
`fetchExtractCutoff()` (latest timestamp in the data), not at load time: the city refreshes
the extract about daily, so load time would pad every open case's wait.

---

## Statistics module: `src/lib/stats.ts`

Single file, pure TypeScript, no runtime dependencies. All functions exported.

### `parsePgInterval(s: string): number` → hours

Parses forms:
- `"13 days, 12:33:42.319741"` (plural days + fractional seconds)
- `"1 day, 00:00:01"` (singular day)
- `"9:32:19.776794"` (bare HMS + fractional seconds)
- `"HH:MM:SS"` (bare HMS)

Returns total hours. Throws `Error` on unrecognized format.

### `naiveMedian(hours: number[]): number`

Median of the closed-case-only durations. Used for the bias callout.

### `kaplanMeier(obs: {hours: number, event: boolean}[])`

Returns:
```ts
{
  curve: { t: number; s: number; atRisk: number; events: number; se: number }[];
  median: number | null;
}
```

Algorithm: standard product-limit estimator. Sort by hours. At each event time tᵢ:
- dᵢ = events (non-censored) at tᵢ
- nᵢ = at-risk count (those with hours ≥ tᵢ)
- S(tᵢ) = S(tᵢ₋₁) × (1 − dᵢ / nᵢ)

Greenwood SE: `SE[S(t)] = S(t) × sqrt(Σ dᵢ / (nᵢ × (nᵢ − dᵢ)))`

Median: first t where S(t) ≤ 0.5, or null if S never reaches 0.5.

The median is null for Sidewalk Repair (S ends at 0.683), which is itself the finding.

### `aalenJohansen(obs: {hours: number, cause: 0|1|2}[])`

Cause encoding: `0` = censored/still open, `1` = closed as resolved,
`2` = closed as Noted (no action required) or Transitioned (reassigned to another agency).

Returns:
```ts
{
  curve1: { t: number; cif: number }[];  // cause 1: resolved closure
  curve2: { t: number; cif: number }[];  // cause 2: admin closure
  final1: number;          // F₁(∞) — probability of resolved closure
  final2: number;          // F₂(∞) — probability of admin closure
  stillUnresolved: number; // 1 - final1 - final2, must be within 1e-9 of (open cases / n)
}
```

Algorithm (Aalen-Johansen):
1. Sort observations by hours. Compute the overall survival S(t) using the combined
   event indicator (event = cause 1 OR cause 2).
2. At each unique event time tᵢ, for each cause k:
   - dᵢₖ = number of events of cause k at tᵢ
   - ΔFₖ(tᵢ) = S(tᵢ₋) × dᵢₖ / nᵢ  (S just before tᵢ, times cause-specific hazard)
3. Fₖ(t) = Σᵢ:tᵢ≤t ΔFₖ(tᵢ)
4. Invariant: F₁(∞) + F₂(∞) + P(still open) = 1.

This is correct. KM treating Noted/Transitioned as censored assumes those cases would
eventually resolve, which is false. AJ decomposes the probability mass correctly.

### `wilson(successes: number, n: number, z?: number)`

Standard Wilson score interval. Default z = 1.96 (95% CI). Returns `{lower, upper}`
clipped to `[0, 1]`. Handles p = 0 and p = 1 without collapsing.

Formula:
```
center = (successes + z²/2) / (n + z²)
margin = z * sqrt(successes*(n-successes)/n + z²/4) / (n + z²)
lower  = max(0, center - margin)
upper  = min(1, center + margin)
```

### `logRank(a, b)`

Log-rank test for two independent KM curves. Returns chi-square statistic on 1 df and
a p-value. Uses the chi-squared CDF approximation.

### `benjaminiHochberg(p: number[]): number[]`

BH procedure for multiple testing correction. Returns adjusted p-values that are:
- Monotone: if pᵢ ≤ pⱼ then BH(pᵢ) ≤ BH(pⱼ)
- Never below the original: BH(pᵢ) ≥ pᵢ for all i

---

## Independent-censoring caveat

KM and AJ both assume that the censoring mechanism (case still open) is independent of
the eventual event time. If the city systematically defers difficult cases, the open
cases remaining in our cohort are enriched for long eventual waits, and both KM and AJ
estimates are **optimistic** — they understate the true wait distribution.

There is no way to test this from the dataset. The caveat is real and must appear on
screen (REQ-22):

> "Kaplan–Meier assumes cases still open are a random sample of open cases with respect
> to eventual close time. If the city defers difficult cases, our estimate is
> **optimistic** — the true wait is longer."

This is placed directly below the KM chart, before the confounder note.

---

## UI visual order (PRIMARY → SUPPORTING)

```
Header: "311 Wait" + query timestamp
StatTiles: [56,797 in cohort] [23.9% Noted or Transitioned] [3.06× gap for SLO]
Cohort scope note (REQ-23)
ServicePicker
ClosureReasonPanel   ← PRIMARY: AJ CIF + stacked bar of closure reasons
KMChart              ← SUPPORTING: two curves (KM vs naive)
BiasCallout          ← full-width, between KM and table
Independent-censoring caveat (REQ-22)
NeighborhoodTable
HonestyFurniture
CambridgePanel (collapsed)
Footer
```

---

## Component specifications

### `StatTiles.tsx`

Three tiles:
1. "Cases in cohort" — 56,797, with sub-text "opened 2026-07-01 → 2026-10-24"
2. "Closed as Noted or Transitioned" — 23.9% (11,701 / 48,903), with sub-text "no action required, or reassigned to another agency"
3. "Gap vs closed-only median" — "3.06×" for Street Light Outage (updates with service picker)

### `ClosureReasonPanel.tsx` (PRIMARY)

Recharts horizontal stacked `BarChart`. One bar = all cohort cases for selected service.
Segments: Resolved (green), Resolved successfully (green), Noted (amber), Transitioned (red), null/Other (slate).

Below chart: AJ CIF line chart — two curves, F₁(t) resolved closure, F₂(t) admin closure.

Annotation: "23.9% of closed cases were closed as Noted or Transitioned rather than Resolved."
This panel appears BEFORE the KM chart.

### `KMChart.tsx` (SUPPORTING)

Recharts `LineChart`. Two data series:
- KM curve: solid blue `#2563eb`
- Naive ECDF: dashed slate `#64748b`

CI band: `Area` component, fill `#2563eb22`, using ±1.96 × SE.
Two `ReferenceLine` for medians (KM and naive).
Legend with n and censored count always visible (REQ-12).
`aria-label` on chart container.
X-axis in days (hours / 24). Ticks: 0, 15, 30, 60, 90, 115.

### `BiasCallout.tsx`

Full-width `<section>`, `bg-blue-50 border-l-4 border-blue-600`.
For most services: naive vs KM median with Zx understatement.
For Sidewalk Repair: "fewer than half of cases have ever closed; no honest median."

### `NeighborhoodTable.tsx`

Columns: Neighborhood, n, Naive median (days), KM median (days), On-time rate [Wilson CI].
Default sort: KM median descending. Suppressed cells (n < 30): `—` with tooltip.
`aria-sort` on active sort column.

### `HonestyFurniture.tsx`

`<section aria-label="Data quality notes">`:
1. Suppression line
2. Confounder note (service-type templated, REQ-14)
3. Query timestamp
4. Wilson CI note

Independent-censoring caveat (REQ-22) appears here too.

---

## Golden values for testing

These figures come from an independent Python implementation on the real cohort and
are stored in `src/lib/__fixtures__/golden.json`:

```json
{
  "streetLightOutage": {
    "n": 1413,
    "censored": 536,
    "naiveMedianDays": 4.74,
    "kmMedianDays": 14.50,
    "ratio": 3.06,
    "aj": { "resolved": 0.706, "adminClosed": 0.070, "unresolved": 0.224 }
  },
  "sidewalkRepair": {
    "n": 2561,
    "censored": 1798,
    "naiveMedianDays": 0.86,
    "kmMedianDays": null,
    "sFinal": 0.683,
    "aj": { "resolved": 0.178, "adminClosed": 0.140, "unresolved": 0.682 }
  },
  "pothole": {
    "n": 2214,
    "censored": 485,
    "naiveMedianDays": 1.83,
    "kmMedianDays": 3.08,
    "ratio": 1.69,
    "aj": { "resolved": 0.644, "adminClosed": 0.160, "unresolved": 0.195 }
  },
  "litterDebris": {
    "n": 9839,
    "censored": 403,
    "naiveMedianDays": 0.40,
    "kmMedianDays": 0.45,
    "ratio": 1.13,
    "aj": { "resolved": 0.801, "adminClosed": 0.164, "unresolved": 0.036 }
  }
}
```

Tests in `stats.test.ts` SHALL reproduce the AJ final incidences within ±0.005 using
a synthetic dataset sized to match the cohort distributions.

---

## Property-based tests

Test file: `src/lib/stats.test.ts`, run by Vitest.
Uses `fc.assert(fc.property(...))` directly (fast-check 4.x API).

Properties:
1. `parsePgInterval` round-trip (REQ-02)
2. KM monotonicity (REQ-03)
3. KM range [0, 1] (REQ-03)
4. KM = 1−ECDF when no censoring (REQ-03)
5. KM invariant to late censored observation (REQ-03)
6. Wilson contains p (REQ-07)
7. Wilson bounds in [0, 1] (REQ-07)
8. Wilson positive width (REQ-07)
9. AJ sum to 1 within 1e-9 (REQ-21)
10. BH output is monotone and never below input

---

## Build & deploy

```json
{
  "prebuild": "tsx scripts/fetch-data.ts",
  "build": "vite build",
  "dev": "tsx scripts/fetch-data.ts && vite",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

Vercel: zero-config. Framework preset: Vite. Output directory: `dist`.
No environment variables required.

---

## Cut decisions

If time is short, drop in this order:
1. Cambridge panel
2. Log-rank + BH (keep AJ and KM)
3. Neighborhood table sort
4. Bootstrap CIs — never implement

**Floor that cannot be cut:** `StatTiles`, `ClosureReasonPanel` (AJ CIF),
`KMChart`, `BiasCallout` for Street Light Outage default.
