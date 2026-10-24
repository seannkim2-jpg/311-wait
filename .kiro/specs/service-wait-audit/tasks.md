# Tasks: service-wait-audit

Build order for a 13:00–20:00 ET deadline. Seven hours total.
Tasks are listed in the order they must be built. Mark each complete before starting the next.

Cohort: `open_date >= '2026-07-01'`, n = 56,797. All headline numbers use this cohort.
AJ (Aalen-Johansen CIF) is a first-class requirement, not optional.

---

## Phase 0 — Scaffolding check (13:00–13:30) ✓

- [x] **T-00** Confirm React + Vite + Tailwind + Recharts are installed and `npm run dev` starts without error
- [x] **T-01** Create `.kiro/specs/service-wait-audit/requirements.md` ✓
- [x] **T-02** Create `.kiro/specs/service-wait-audit/design.md` ✓
- [x] **T-03** Create `.kiro/specs/service-wait-audit/tasks.md` ✓
- [x] **T-04** Add Vitest and fast-check to dev dependencies: `npm install -D vitest fast-check`
- [x] **T-05** Add `"test": "vitest run"` and `"test:watch": "vitest"` to `package.json`
- [ ] **T-06** Create `.kiro/hooks/stats-pbt.json` (run PBT on save of `src/lib/stats.ts`)

---

## Phase 1 — Stats module + PBT (13:30–14:30)

All statistics live in a single file: `src/lib/stats.ts`. Pure TypeScript, no runtime
dependencies, no React, no fetch.

### T-10 `parsePgInterval(s: string): number` → hours

Parses Postgres interval strings:
- `"13 days, 12:33:42.319741"` — plural days + fractional seconds
- `"1 day, 00:00:01"` — singular day
- `"9:32:19.776794"` — bare HMS + fractional seconds
- `"HH:MM:SS"` — bare HMS

Returns total hours. Throws on unrecognized format.

### T-11 `naiveMedian(hours: number[]): number`

Median of the array. Handles even-length arrays with average of two middle values.

### T-12 Kaplan–Meier: `kaplanMeier(obs: {hours: number, event: boolean}[])`

Returns `{ curve: {t, s, atRisk, events, se}[], median: number | null }`.

Standard product-limit estimator. Greenwood SE: `S(t) × sqrt(Σ d/(n(n-d)))`.
Median = first t where S(t) ≤ 0.5, or null (Sidewalk Repair case).

### T-13 Aalen-Johansen: `aalenJohansen(obs: {hours: number, cause: 0|1|2}[])`

**This is first-class, not optional.** Cause codes: 0=censored, 1=resolved, 2=Noted/Transitioned.

Returns:
```ts
{
  curve1: {t: number, cif: number}[];   // genuine resolution CIF
  curve2: {t: number, cif: number}[];   // admin closure CIF
  final1: number;          // F₁(∞)
  final2: number;          // F₂(∞)
  stillUnresolved: number; // 1 - final1 - final2
}
```

Algorithm:
1. Combined event hazard → shared survival S(t)
2. Per-cause increment: ΔFₖ(tᵢ) = S(tᵢ₋) × dᵢₖ / nᵢ
3. Fₖ(t) = cumulative sum of ΔFₖ

Invariant: F₁(∞) + F₂(∞) + stillUnresolved = 1.0 within 1e-9.

### T-14 `wilson(successes: number, n: number, z?: number)`

Wilson score interval. Default z=1.96. Returns `{lower, upper}` in [0,1].
Handles p=0 and p=1 without collapsing.

### T-15 `logRank(a, b): {statistic: number, pValue: number}`

Log-rank test on 1 df. Chi-squared p-value. [DROP IF BEHIND]

### T-16 `benjaminiHochberg(p: number[]): number[]`

BH adjustment. Output is monotone and never below input. [DROP IF BEHIND]

### T-17 Create `src/lib/__fixtures__/golden.json`

Golden values from independent Python implementation on real cohort (±0.005 tolerance):
```json
{
  "streetLightOutage": {
    "n": 1413, "censored": 536,
    "naiveMedianDays": 4.75, "kmMedianDays": 14.67, "ratio": 3.09,
    "aj": { "resolved": 0.704, "adminClosed": 0.070, "unresolved": 0.226 }
  },
  "sidewalkRepair": {
    "n": 2561, "censored": 1798,
    "naiveMedianDays": 0.86, "kmMedianDays": null, "sFinal": 0.683,
    "aj": { "resolved": 0.177, "adminClosed": 0.140, "unresolved": 0.683 }
  },
  "pothole": {
    "n": 2214, "censored": 485,
    "naiveMedianDays": 1.83, "kmMedianDays": 3.09, "ratio": 1.69,
    "aj": { "resolved": 0.644, "adminClosed": 0.160, "unresolved": 0.196 }
  },
  "litterDebris": {
    "n": 9839, "censored": 403,
    "naiveMedianDays": 0.40, "kmMedianDays": 0.45, "ratio": 1.13,
    "aj": { "resolved": 0.801, "adminClosed": 0.164, "unresolved": 0.036 }
  }
}
```

### T-18 `src/lib/stats.test.ts` — property-based and golden tests

PBT (fast-check 4.x: `fc.assert(fc.property(...))`):
1. `parsePgInterval` round-trip — generate `{days, h, m, s}`, format, parse, compare
2. KM monotonicity — S(t) non-increasing
3. KM range — every S(t) in [0, 1]
4. KM = 1−ECDF when no censoring
5. Late censored observation leaves curve unchanged
6. Wilson contains p
7. Wilson bounds in [0, 1]
8. Wilson positive width
9. AJ sum to 1 within 1e-9
10. BH output monotone and never below input

Golden tests (exact-value unit tests against golden.json, tolerance ±0.5% for AJ):
- AJ final incidences for a synthetic dataset matching cohort distributions
- KM median for a small hand-computable case
- Wilson interval for known values

### T-19 Run all tests — must be green before proceeding

`npm test`

---

## Phase 2 — Data layer (14:30–15:15)

### T-20 Build-time fetch script (`scripts/fetch-data.ts`)

Paginate CKAN `datastore_search_sql` with `WHERE open_date >= '2026-07-01'`.
Write:
- `public/data/boston-311.json` — normalized `Case[]`
- `public/data/summary.json` — cohort tile values + fetch timestamp

Expected: n ≈ 56,797, closed ≈ 48,903, open ≈ 7,876.

### T-21 Data loader (`src/data/loader.ts`)

```ts
export function getCases(): Case[]
export function getCasesByService(service: string): Case[]
export function getSummary(): Summary
export const SERVICES: string[]
```

`SERVICES` in display order:
```ts
['Street Light Outage', 'Sidewalk Repair', 'Pothole',
 'Litter & Debris', 'Domestic Animal Issue', 'Pruning Request', 'Illegal Graffiti']
```

---

## Phase 3 — Core UI above the fold (15:15–16:30)

> **Status 2026-10-24 (Kiro Web, branch `wait-audit-ui`):** Phases 3–5 and T-70/T-71 are built.
> Where the build differs from the task text below, the reasons are in
> `docs/UI-VISUAL-PLAN.md` §7.
> - T-30 → hero headline + `Hero.tsx` stat row (no separate tile component).
> - T-31 → `ServicePicker.tsx` as a `toolbar` of `aria-pressed` buttons, so that arrows move
>   focus and Space/Enter confirm, as REQ-11 asks.
> - T-32/T-33 → `charts/OutcomeChart.tsx` and `charts/SurvivalChart.tsx`; KM renders first
>   (REQ-09 amended).
> - T-40 → `BiasCallout.tsx`. T-41 → `NeighborhoodTable.tsx` with n, on-time % and Wilson
>   range. **Not yet built:** the per-neighborhood naive and KM median columns, which need
>   per-neighborhood case rows from the data layer.
> - T-50 → spread through the page where each note belongs, not one block.
> - Added: `map/CityMap.tsx` (open-and-overdue map, MapLibre + static Protomaps basemap).
> - T-70: axe-core run in a headless browser after every section had rendered: 0 violations.
> - T-71: arrow keys, Enter and `aria-live` were checked with scripted keyboard input.

### T-30 `StatTiles.tsx`

Tiles:
1. "Cases in cohort" — 56,797 (sub: "opened 2026-07-01 → 2026-10-24")
2. "Closed without resolution" — 23.9% (sub: "11,701 Noted or Transitioned")
3. "Wait understatement" — updates with service picker (SLO default: 3.09×)

Loading: grey skeleton `animate-pulse` bars.

### T-31 `ServicePicker.tsx`

`role="tablist"`. Each chip `role="tab"` with `aria-selected`. Arrow key navigation.
`aria-live` announcement. Disabled + indicator while loading.

### T-32 `ClosureReasonPanel.tsx` (PRIMARY — render BEFORE KMChart)

- Stacked horizontal `BarChart`: Resolved=green, Noted=amber, Transitioned=red, other=slate
- AJ CIF line chart: F₁(t) genuine resolution, F₂(t) admin closure
- Annotation: "23.9% of closed cases (Noted + Transitioned) were not resolved."
- Cohort scope note (REQ-23) above this panel

### T-33 `KMChart.tsx` (SUPPORTING — render AFTER ClosureReasonPanel)

Two curves: KM (solid blue) + naive ECDF (dashed slate). CI band from Greenwood SE.
Two ReferenceLine medians. Legend with n and censored count. `aria-label`.
X-axis: days (hours / 24). Ticks: 0, 15, 30, 60, 90, 115.
Independent-censoring caveat (REQ-22) below chart.

### T-34 `App.tsx` root

State: `selectedService` (default "Street Light Outage"), `isLoading`, `fetchTimestamp`.
Loads `boston-311.json` on mount. Header with timestamp (REQ-13).

---

## Phase 4 — Below the fold (16:30–17:15)

### T-40 `BiasCallout.tsx`

Full-width `<section>`, `bg-blue-50 border-l-4 border-blue-600`.
Standard: "naive [X d] vs KM [Y d] — [Z×] understatement."
Sidewalk Repair: "no honest median — fewer than half of cases have ever closed."

### T-41 `NeighborhoodTable.tsx`

Columns: Neighborhood, n, Naive median (days), KM median (days), On-time % [Wilson CI].
Default sort: KM median descending. Suppressed cells: `—` with tooltip.

---

## Phase 5 — Honesty furniture (17:15–17:45)

### T-50 `HonestyFurniture.tsx`

`<section aria-label="Data quality notes">`:
1. Suppression line
2. Confounder note (service-type templated)
3. Query timestamp
4. "6,240 cases currently past their deadline" — labeled as prevalence count, no denominator

---

## Phase 6 — Cambridge panel (17:45–18:15) [DROP FIRST IF BEHIND]

### T-60 Cambridge fetch + `CambridgePanel.tsx`

Proxy: `ticket_last_updated_date_time − ticket_created_date_time`.
Amber proxy label. Collapsed by default. `aria-expanded`.

---

## Phase 7 — Accessibility pass (18:15–18:30)

### T-70 axe-core check

```bash
npx axe-cli http://localhost:5173 --tags wcag2a,wcag2aa
```

Fix all critical violations.

### T-71 Keyboard navigation walkthrough

Service picker arrows, Space/Enter, `aria-live`. Suppressed cell tooltips on focus.
All Recharts SVGs have `aria-label`.

---

## Phase 8 — Deploy + docs (18:30–19:00)

### T-80 Vercel deploy

```bash
npx vercel --prod
```

### T-81 Update README

Live URL. Track: Civic Services. Submission checklist.

### T-82 `docs/KIRO-USAGE.md`

Log Kiro usage at each phase. Note: spec generation, stats PBT, AJ red-team response.

---

## Phase 9 — Video (19:00–19:45)

Shot list:
1. 0:00–0:20 City portal showing on-time rate
2. 0:20–0:40 Closure-reason panel: 23.9% not resolved (the no-inference finding)
3. 0:40–1:15 KM chart — gap number on screen, Street Light Outage 3.09×
4. 1:15–1:35 Sidewalk Repair — "no honest median"
5. 1:35–1:55 Neighborhood table
6. 1:55–2:15 Honesty furniture + caveat
7. 2:15–2:35 Service picker switching
8. 2:35–2:45 Full page + credits

---

## Phase 10 — Submit (19:45–20:00)

- [ ] Repo is public
- [ ] `/.kiro` committed at root
- [ ] Track: Civic Services
- [ ] README has live URL and description
- [ ] Demo video public, under 3 minutes
- [ ] `docs/KIRO-USAGE.md` complete
- [ ] All team members added on hackathon site
- [ ] Submit before 20:00 ET

---

## Cut order

1. T-60 Cambridge panel
2. T-15/T-16 Log-rank + BH
3. T-41 Neighborhood table sort
4. Bootstrap CIs — never implement

**Floor (cannot cut):** T-30 (tiles), T-32 (ClosureReasonPanel with AJ),
T-33 (KMChart), T-40 (BiasCallout) for Street Light Outage default.
