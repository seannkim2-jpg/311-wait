# Tasks: service-wait-audit

Build order for a 13:00–20:00 ET deadline. Seven hours total.  
Tasks are listed in the order they must be built. Mark each complete before starting the next.

---

## Phase 0 — Scaffolding check (13:00–13:30)

- [ ] **T-00** Confirm React + Vite + Tailwind + Recharts are installed and `npm run dev` starts without error
- [ ] **T-01** Create `.kiro/specs/service-wait-audit/requirements.md` ✓ (this file's siblings)
- [ ] **T-02** Create `.kiro/specs/service-wait-audit/design.md` ✓
- [ ] **T-03** Create `.kiro/specs/service-wait-audit/tasks.md` ✓ (this file)
- [ ] **T-04** Add Vitest and fast-check to dev dependencies: `npm install -D vitest @vitest/ui fast-check tsx`
- [ ] **T-05** Add `scripts/` directory; add `"prebuild": "tsx scripts/fetch-data.ts"` and `"test": "vitest run"` to `package.json`
- [ ] **T-06** Create `.kiro/hooks/stats-pbt.json` (run PBT on save of `src/stats/**/*.ts`)
- [ ] **T-07** Create `.kiro/hooks/endpoint-shape.json` (verify CKAN endpoint on save of `scripts/fetch-data.ts`)

---

## Phase 1 — Stats module + PBT (13:30–14:30)

### T-10 Postgres interval parser (`src/stats/interval.ts`)

Implement `parseInterval(s: string): number` and `formatInterval(n: number): string`.

Acceptance: handles all four forms from REQ-02. Fractional seconds preserved within floating-point tolerance.

### T-11 PBT for interval parser

Write `src/stats/__tests__/interval.pbt.test.ts`. One `it.prop` test: round-trip property. Must pass with 1,000 generated samples.

### T-12 Kaplan–Meier estimator (`src/stats/km.ts`)

Implement `kaplanMeier(obs: Observation[]): KMStep[]` and `kmMedian(steps: KMStep[]): number | null`.

Include Greenwood variance and log–log CI per design doc.

Acceptance:
- Empty input returns `[]`
- All-event (no censoring) result equals `1 − ECDF`
- `S(t)` monotonically non-increasing

### T-13 PBT for KM

Write `src/stats/__tests__/km.pbt.test.ts`. Five `it.prop` tests:
1. Monotonicity
2. Range [0, 1]
3. Equals 1−ECDF when no censoring
4. Late censored observation leaves curve unchanged
5. Greenwood CI contains S(t) at every step

### T-14 Wilson score interval (`src/stats/wilson.ts`)

Implement `wilson(k: number, n: number, z?: number): { lower: number; upper: number }`.

### T-15 PBT for Wilson

Write `src/stats/__tests__/wilson.pbt.test.ts`. Three `it.prop` tests:
1. CI contains p
2. Both bounds in [0, 1]
3. Positive width for all p ∈ [0, 1], n ≥ 1

### T-16 Naive median (`src/stats/naive.ts`)

Implement `naiveMedian(durations: number[]): number` and `naivePercentile(durations: number[], p: number): number`.

### T-17 Run all PBT — must be green before proceeding

`npm test`

---

## Phase 2 — Data layer (14:30–15:15)

### T-20 Build-time fetch script (`scripts/fetch-data.ts`)

Paginate CKAN `datastore_search_sql` to retrieve all ~75,851 rows. Write:
- `public/data/boston-311.json` — array of normalized `Case` objects
- `public/data/summary.json` — tile values + fetch timestamp

Columns to request: `case_status`, `service_name`, `neighborhood`, `on_time`, `closure_reason`, `open_date`, `close_date`, `target_close_date`.

Duration computation: request `close_date::timestamp - open_date::timestamp AS duration` for closed cases. For in-progress, leave `close_date` null.

Fetch timestamp: write `new Date().toISOString()` to `summary.json`.

Acceptance: script runs in < 3 minutes, produces valid JSON, `Case[]` array has ≥ 70,000 entries.

### T-21 Endpoint shape verifier (`scripts/verify-endpoint.ts`)

Fetches one row from the endpoint and asserts the expected columns exist. Throws with a readable error if any column is missing.

### T-22 Data loader (`src/data/loader.ts`)

```ts
export function getCases(): Case[]
export function getCasesByService(service: string): Case[]
export function getSummary(): Summary
export const SERVICES: string[]
```

`SERVICES` = `['Street Light Outage', 'Sidewalk Repair', 'Pothole', 'Domestic Animal Issue', 'Pruning Request', 'Illegal Graffiti']`

---

## Phase 3 — Core UI above the fold (15:15–16:30)

### T-30 `StatTiles.tsx`

Three tiles. Values from `getSummary()` + live KM compute for default service.

Tile labels exactly as specified in product definition §4:
1. "Open & overdue right now" — `summary.openOverdue`
2. "Closed without resolution" — `summary.closedUnresolvedPct`%
3. "Underreported wait" — KM median − naive median for Street Light Outage, in days

Loading state: grey skeleton `animate-pulse` bars.

### T-31 `ServicePicker.tsx`

`role="tablist"`. Chips `role="tab"`. Arrow key navigation. `aria-live` announcement on change. Disabled + visual indicator while loading.

### T-32 `KMChart.tsx`

Recharts `LineChart`. KM step data (solid blue `#2563eb`). Naive ECDF steps (dashed slate `#64748b`). CI band (`Area`, fill `#2563eb22`). Two `ReferenceLine` for medians. Legend with n and censored count always visible (REQ-12). `aria-label` on chart container.

X-axis in days (seconds / 86400). Ticks: 0, 30, 60, 90, 180, 365.

Acceptance: renders correctly for Street Light Outage default. Two curves visibly diverge. Both median lines visible.

### T-33 `App.tsx` root

- State: `selectedService`, `isLoading`, `fetchTimestamp`
- Loads `boston-311.json` once on mount
- Passes filtered cases to all child components
- Header: "Wait Audit" / sub-line with timestamp

---

## Phase 4 — Below the fold (16:30–17:15)

### T-40 `BiasCallout.tsx`

Full-width `<section>` with highlighted background. Renders the sentence from REQ-06.  
Background: `bg-blue-50 border-l-4 border-blue-600`.  
Updates when service picker changes.

### T-41 `ClosureReasonPanel.tsx`

Recharts horizontal stacked `BarChart`. Color map: Resolved=green, Noted=amber, Transitioned=red, other=slate.  
Title: "How cases are closed — [service]".  
Annotation: "~23% of closed cases (Noted + Transitioned) were not resolved."  
`aria-label` on chart container.

### T-42 `NeighborhoodTable.tsx`

Columns: Neighborhood, n, Naive median, KM median, On-time rate [Wilson CI].  
Default sort: KM median descending.  
Suppressed cells (n < 30): `—` with tooltip (REQ-08).  
`aria-sort` on active sort column header.

Visible text above table: "Neighborhoods with fewer than 30 cases show —".

---

## Phase 5 — Honesty furniture (17:15–17:45)

### T-50 `HonestyFurniture.tsx`

Section with `aria-label="Data quality notes"`. Four paragraphs:
1. Suppression line
2. Confounder note (service-type templated, REQ-14)
3. Query timestamp as `<time>` element
4. Wilson CI note

### T-51 Header timestamp

Update `App.tsx` header to show "data.boston.gov · queried [timestamp]" where timestamp comes from `summary.json`.

---

## Phase 6 — Cambridge panel (17:45–18:15) [DROP FIRST IF BEHIND]

### T-60 Cambridge fetch

Add Cambridge query to `scripts/fetch-data.ts`. Writes `public/data/cambridge-311.json`. Proxy: `ticket_last_updated_date_time − ticket_created_date_time`.

### T-61 `CambridgePanel.tsx`

Collapsed by default. Toggle button with `aria-expanded`. Amber proxy label before chart (REQ-16). KM chart with `isCambridgeProxy` flag adds "(proxy: last-updated)" to axis label.

---

## Phase 7 — Accessibility pass (18:15–18:30)

### T-70 Install and run axe-core check

```bash
npx axe-cli http://localhost:5173 --tags wcag2a,wcag2aa
```

Fix all critical violations before proceeding.

### T-71 Keyboard navigation walkthrough

Manually tab through the page. Verify:
- Service picker: arrows move, Space/Enter select, `aria-live` fires
- Neighborhood table: suppressed cell tooltips reachable by focus
- Cambridge panel toggle: `aria-expanded` toggles correctly
- All Recharts SVGs have `aria-label` or `<title>`

---

## Phase 8 — Deploy + docs (18:30–19:00)

### T-80 Vercel deploy

```bash
npx vercel --prod
```

Confirm live URL returns 200 and all three stat tiles show real numbers.

### T-81 Update README

Add live URL to README. Update the submission checklist at top. Set track to "Civic Services".

### T-82 Write `docs/KIRO-USAGE.md`

Log how Kiro was used at each phase: CLI for spec generation, IDE for stats implementation, PBT via hooks, steering file for causal-language guardrail. Include specific prompts and the places Kiro caught errors or changed direction.

---

## Phase 9 — Video (19:00–19:45)

### T-90 Record demo (2:45 target)

Shot list from product definition §8:
1. 0:00–0:20 City portal showing on-time rate
2. 0:20–0:45 Wait Audit landing, tile 1
3. 0:45–1:15 KM chart — the peak — with gap number on screen
4. 1:15–1:35 Closure-reason panel
5. 1:35–1:55 Neighborhood table
6. 1:55–2:15 Honesty furniture
7. 2:15–2:35 Service picker switching
8. 2:35–2:45 Full page scroll + credits

Upload to YouTube/Vimeo, set to public.

---

## Phase 10 — Submit (19:45–20:00)

### T-100 Final submission checklist

- [ ] Repo is public
- [ ] `/.kiro` committed at root
- [ ] Track: Civic Services
- [ ] README has live URL and description
- [ ] Demo video public, under 3 minutes
- [ ] `docs/KIRO-USAGE.md` complete
- [ ] All team members added on hackathon site
- [ ] Submit on hackathon portal before 20:00 ET

---

## Cut order (repeat from design doc)

1. T-60/T-61 Cambridge panel
2. T-16 Log-rank + BH (if not yet started)
3. T-42 Neighborhood table sort (show static order)
4. Bootstrap CIs — never implement
5. Cox — never implement

**Floor:** T-30 (tiles), T-32 (KM chart), T-40 (bias callout), T-41 (closure-reason panel) for Street Light Outage default. These cannot be cut.
