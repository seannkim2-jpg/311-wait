# Design: service-wait-audit

Boston 311 wait-time audit — technical design document.  
Satisfies all 20 requirements in `requirements.md`.

---

## Architecture overview

Static browser-only app. No backend, no API key, no server at runtime (REQ-18).

```
data.boston.gov CKAN
       │
       │  HTTP at build time
       ▼
scripts/fetch-data.ts        ← Node script, runs during `npm run build`
       │
       │  writes
       ▼
public/data/
  boston-311.json            ← normalized cases, all service types
  cambridge-311.json         ← optional; Cambridge proxy data
       │
       │  static import
       ▼
src/data/loader.ts           ← typed accessor, groups by service type
       │
src/stats/
  interval.ts                ← Postgres interval → seconds
  km.ts                      ← Kaplan–Meier + Greenwood CI
  wilson.ts                  ← Wilson score interval
  logrank.ts                 ← log-rank test + BH correction (if time permits)
  naive.ts                   ← closed-only median + percentiles
       │
src/components/
  App.tsx                    ← root, service picker state
  StatTiles.tsx              ← three lede tiles
  ServicePicker.tsx          ← keyboard-navigable chips
  KMChart.tsx                ← Recharts LineChart, two curves + CI band
  BiasCallout.tsx            ← full-width highlighted sentence block
  ClosureReasonPanel.tsx     ← Recharts BarChart, stacked horizontal
  NeighborhoodTable.tsx      ← sortable table, Wilson CIs, suppression
  HonestyFurniture.tsx       ← suppression line, confounder note, timestamp
  CambridgePanel.tsx         ← collapsed by default, proxy label prominent
  Footer.tsx
```

Stack: React 18, Vite, Tailwind CSS, Recharts. All already scaffolded.  
Testing: Vitest + fast-check for property-based tests.

---

## Data pipeline

### Build-time fetch (`scripts/fetch-data.ts`)

Uses `datastore_search_sql` — the live endpoint supports `GROUP BY`, `COUNT`,
`percentile_cont`, `now()`, `date_trunc` (verified), but not `EXTRACT`.

Three queries per build:

**Query 1 — all cases (closed + in-progress), core columns**
```sql
SELECT
  case_status,
  service_name,
  neighborhood,
  on_time,
  closure_reason,
  open_date,
  close_date,
  target_close_date
FROM "254adca6-64ab-4c5c-9fc0-a6da622be185"
LIMIT 100000
```
Paginate with `OFFSET` until exhausted. Expected ~75,851 rows.

**Query 2 — server-side aggregates for fast tile values**
```sql
SELECT
  COUNT(*) FILTER (WHERE case_status = 'In progress' AND on_time = 'OVERDUE') AS open_overdue,
  COUNT(*) FILTER (WHERE case_status = 'Closed') AS total_closed,
  COUNT(*) FILTER (WHERE case_status = 'Closed'
    AND closure_reason IN ('Noted', 'Transitioned')) AS closed_unresolved
FROM "254adca6-64ab-4c5c-9fc0-a6da622be185"
```
Runs once; results written to `public/data/summary.json`.

**Query 3 — Cambridge (optional)**
```sql
SELECT
  ticket_status,
  service_name,
  ticket_created_date_time,
  ticket_last_updated_date_time
FROM "[cambridge-resource-id]"
LIMIT 200000
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
  closeDate: Date | null;        // null for in-progress
  targetCloseDate: Date | null;
  durationSeconds: number | null; // close_date - open_date, null if still open
  waitSeconds: number;            // close_date - open_date OR now() - open_date
  censored: boolean;              // true if still in-progress
}
```

Duration comes from the Postgres interval string returned by
`close_date::timestamp - open_date::timestamp`. Parsed by `src/stats/interval.ts`
(REQ-02). `now()` substituted client-side at load time for open cases, using the
fetch timestamp stored in `public/data/summary.json`.

---

## Statistics module

### `src/stats/interval.ts`

```ts
// Parses: "13 days, 12:33:42.319741" | "9:32:19" | "1 day, 4:00:00"
export function parseInterval(s: string): number  // → total seconds
export function formatInterval(seconds: number): string  // → canonical form for round-trip
```

### `src/stats/km.ts`

```ts
export interface Observation { duration: number; censored: boolean; }
export interface KMStep { t: number; survival: number; lower95: number; upper95: number; }

export function kaplanMeier(obs: Observation[]): KMStep[]
export function kmMedian(steps: KMStep[]): number | null  // t where S(t) first ≤ 0.5
```

Algorithm: standard product-limit estimator. Sort by duration. At each event time t_i:
- d_i = deaths (events) at t_i
- n_i = at-risk count
- S(t_i) = S(t_{i-1}) × (1 − d_i / n_i)

Greenwood variance: `Var[S(t)] = S(t)² × Σ d_i / (n_i × (n_i - d_i))`  
CI: log–log transform to keep bounds in (0,1): `exp(log(-log(S)) ± 1.96 × σ / (log(S) × √n))`

### `src/stats/wilson.ts`

```ts
export function wilson(k: number, n: number, z?: number): { lower: number; upper: number }
// z defaults to 1.96 (95% CI)
```

Standard Wilson formula. Handles p=0 and p=1 without collapsing.

### `src/stats/naive.ts`

```ts
export function naiveMedian(durations: number[]): number  // median of closed-case durations
export function naivePercentile(durations: number[], p: number): number
```

### `src/stats/logrank.ts` _(drop first if time runs short)_

```ts
export function logRank(groups: Observation[][]): { statistic: number; pValue: number }
export function benjaminiHochberg(pValues: number[]): number[]
```

---

## UI components

### `App.tsx`

Top-level state:
- `selectedService: string` — initialized to `"Street Light Outage"`
- `isLoading: boolean`
- `fetchTimestamp: string`

Loads `boston-311.json` on mount. Passes filtered `Case[]` down to all panels.

### `ServicePicker.tsx`

```tsx
// Props: services: string[], selected: string, onChange: (s: string) => void, disabled: boolean
```

Renders as `role="tablist"`. Each chip is `role="tab"` with `aria-selected`. Arrow
key navigation via `onKeyDown`. On select: `aria-live` region announces service name.

Services shown (in order):
1. Street Light Outage
2. Sidewalk Repair
3. Pothole
4. Domestic Animal Issue
5. Pruning Request
6. Illegal Graffiti
7. (All services — aggregate, no neighborhood suppression warning needed if n is large)

### `KMChart.tsx`

Uses `Recharts LineChart` with two `Line` data series:
- KM steps: `dataKey="survival"`, stroke `#2563eb` (blue), solid
- Naive ECDF steps: `dataKey="naive"`, stroke `#64748b` (slate), dashed

CI band: `Area` component with `dataKey="lower95"` / `upper95`, fill `#2563eb22`.

Median lines: two `ReferenceLine` components (vertical, dashed).

Legend: hardcoded text showing n and censored count (REQ-12).  
Chart `aria-label`: "Survival curve for [service]. KM median [X] days, naive median [Y] days."

Axes:
- X: days (convert seconds ÷ 86400). Ticks: 0, 30, 60, 90, 180, 365.
- Y: 0.0 – 1.0.

### `NeighborhoodTable.tsx`

Columns:
1. Neighborhood (string)
2. Cases (n) — integer
3. Naive median (days) — one decimal, or `—` if n < 30
4. KM median (days) — computed; or `—` if n < 30
5. On-time rate — percentage + Wilson CI display: `62% [55%–68%]`

Default sort: KM median descending.  
Click column header to sort; `aria-sort` attribute updates.  
Suppressed cells: `—` with `title` and `aria-describedby` tooltip (REQ-08).

### `ClosureReasonPanel.tsx`

Recharts `BarChart` in horizontal layout. One bar per service type (or single bar
for selected service). Stacked segments per closure reason.

Color map:
- Resolved / Resolved successfully: `#16a34a` (green)
- Noted: `#f59e0b` (amber)
- Transitioned: `#dc2626` (red)
- null / Other: `#94a3b8` (slate)

Annotation below bar: "~23% of closed cases (Noted + Transitioned) were not resolved."

### `HonestyFurniture.tsx`

Rendered as a `<section aria-label="Data quality notes">` at the bottom of the main
content, before the footer. Renders:
1. Suppression line (one `<p>`)
2. Confounder note (one `<p>`, service-type templated)
3. Query timestamp (already in header, mirrored here as `<time>` element)
4. Wilson CI footnote (one `<p>`)

### `CambridgePanel.tsx`

```tsx
// state: expanded: boolean
// aria-expanded on toggle button
```

Collapsed by default. When expanded, shows:
- Amber callout with proxy label (REQ-16)
- Cambridge KM chart (same component as `KMChart`, `isCambridgeProxy` flag adds label)
- No neighborhood table (Cambridge neighborhood field is unreliable)

---

## Layout (Tailwind)

```
<main class="max-w-5xl mx-auto px-4 py-8 space-y-10">
  <header>…</header>
  <StatTiles />
  <ServicePicker />
  <KMChart />
  <BiasCallout />
  <ClosureReasonPanel />
  <NeighborhoodTable />
  <HonestyFurniture />
  <CambridgePanel />
  <Footer />
</main>
```

Responsive: single-column on mobile (< 640 px). Stat tiles stack vertically on mobile,
row on ≥ 640 px.

Color contrast: all text on background ≥ 4.5:1. Blue (`#2563eb`) on white passes.
Amber callout background `#fef3c7` with text `#92400e`: passes 4.5:1.

---

## Property-based tests (`src/stats/__tests__/`)

Test file: `stats.pbt.test.ts`, run by Vitest.

```ts
// fast-check generators
const intervalArb = fc.record({
  days: fc.nat(400),
  hours: fc.integer({ min: 0, max: 23 }),
  minutes: fc.integer({ min: 0, max: 59 }),
  seconds: fc.float({ min: 0, max: 59.999999 })
})

const observationArb = fc.record({
  duration: fc.nat(86400 * 400),  // up to 400 days in seconds
  censored: fc.boolean()
})
```

Properties (one `it.prop` each, maps to REQ-19):
1. Interval round-trip (REQ-02)
2. KM monotonicity (REQ-03)
3. KM range [0,1] (REQ-03)
4. KM = 1−ECDF when no censoring (REQ-03)
5. KM invariant to late censored observation (REQ-03)
6. Greenwood CI contains S(t) (REQ-04)
7. Wilson contains p (REQ-07)
8. Wilson bounds in [0,1] (REQ-07)
9. Wilson positive width (REQ-07)

---

## Build & deploy

```json
// package.json scripts
{
  "prebuild": "tsx scripts/fetch-data.ts",
  "build": "vite build",
  "dev": "tsx scripts/fetch-data.ts && vite",
  "test": "vitest run"
}
```

Vercel: zero-config. Framework preset: Vite. Output directory: `dist`.  
No environment variables required.

---

## Kiro hooks

`.kiro/hooks/stats-pbt.json`:
```json
{
  "name": "Run PBT on stats save",
  "trigger": { "type": "file_save", "glob": "src/stats/**/*.ts" },
  "command": "npm run test -- --reporter=dot src/stats"
}
```

`.kiro/hooks/endpoint-shape.json`:
```json
{
  "name": "Verify CKAN endpoint shape",
  "trigger": { "type": "file_save", "glob": "scripts/fetch-data.ts" },
  "command": "tsx scripts/verify-endpoint.ts"
}
```

---

## Cut decisions

If time is short, drop in this order:
1. Cambridge panel — remove `CambridgePanel.tsx`, `cambridge-311.json` query
2. Log-rank + BH — remove `logrank.ts`, keep the rest of stats
3. Neighborhood table sort — remove `onSort`, hardcode descending KM order
4. Bootstrap CIs — never implement
5. Cox — never implement

Floor that cannot be cut: `KMChart`, `BiasCallout`, `StatTiles`, `ClosureReasonPanel`
for Street Light Outage.
