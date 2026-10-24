# Wait Audit — website & architecture plan

> **Companion document.** This is the *architecture* plan. [`UI-DESIGN.md`](./UI-DESIGN.md) is
> the *design* brief and governs tone, copy and accessibility.

Status: **planning only. Do not build or deploy from this yet.** This document collects the
agreed UI structure plus an expanded "God's-eye map" direction and the open-source building
blocks researched for it. We iterate on this before writing view code.

It builds on, and does not replace, [`UI-DESIGN.md`](./UI-DESIGN.md) (the interface brief) and
[`ROADMAP.md`](./ROADMAP.md) (status and open-source tiers). Where this document and those
disagree, treat this as the newer thinking and reconcile deliberately.

---

## 1. What the service actually does (one paragraph)

A median closure time taken over closed cases only leaves out the thousands of 311 requests
still open, which skew slow. (Boston publishes no 311 median, and CityScore does not document
how its per-service on-time measures count open cases, so this is not a claim about the city's
calculation — see `docs/research/claim-check.md`.) **Wait Audit puts the open cases back in.** It queries Boston's live open-data endpoint from
the browser (no API key, no backend) and applies survival analysis: **Kaplan–Meier** for
time-to-closure with still-open (censored) cases included, and **Aalen–Johansen** competing-risks
incidence to separate requests closed as *resolved* from those closed as `Noted` (no action
required) or `Transitioned` (reassigned to another agency). It makes **no causal claim**: it audits the measurement, shows sample
sizes, censoring counts, and confidence intervals, and says where the data cannot answer. The
estimators are implemented three times independently (Kiro TypeScript, an independent Python
reference, and `lifelines`) and agree to six decimal places.

Track: **Civic Action.** Audiences: a **resident** who wants one plain answer, and a
**judge/journalist** who wants the full audit.

---

## 2. Website structure (agreed core)

One scrolling public audit document — **not a dashboard** — with three progressive-disclosure
layers, each complete on its own.

### Layer 1 — the answer (above the fold)
- Live-data-driven `ServicePicker` (kills the cherry-picking objection; also the main control).
- One very large headline number + one subordinate comparison, side by side: **what the data
  shows** vs **what the city reports.**
- Spoken-sentence copy. No "median", "censored", "estimator", or Greek.

### Layer 2 — the evidence (mid page)
- **Survival curves:** Kaplan–Meier vs naive closed-only, Greenwood CI band. Recharts
  `type="stepAfter"` + `<Area>`; never a smooth spline.
- **Bias callout block** (REQ-06): the exact naive-vs-corrected sentence, full width, between
  the chart and the closure panel.
- **Competing-risks bar:** one horizontal stacked bar — resolved / closed-not-fixed / still
  open — directly % labelled. Reads with no statistics.
- **Neighborhood table:** on-time rate with Wilson intervals, sortable; cells under n=30 show an
  em dash with a focusable explanation.

### Layer 3 — the method (below)
- Cohort window and why it starts 2026-07-01; the independent-censoring assumption and the
  direction it biases; named confounders; query timestamp; link to `ANALYSIS.md`. Real
  typographic care — honesty is graded.

### Component tree
```
App
├─ Header            title · one-line thesis · query timestamp
├─ AnswerLayer       ServicePicker · HeadlineGap (data vs city)
├─ EvidenceLayer     SurvivalChart · BiasCallout · CompetingRisksBar · NeighborhoodTable
├─ CityMap           the "God's-eye" map (see §3) — new, phased
└─ MethodLayer       cohort · assumptions · confounders · links
```

### Data flow
- Build time: `scripts/fetch_cohort_cases.sh` → static JSON bundled with the build.
- Runtime: components call the **finished, frozen** `src/lib/stats.ts` + `boston311.ts`.
  **Do not edit `src/lib/**`.** If a statistic is missing, request it rather than recompute it
  in a component.

---

## 3. The "God's-eye" map (expanded direction)

The current analysis is all distributions. A map of what is **open and overdue right now** turns
the audit into something a resident reads about their own street. This is the highest-payoff
addition in the roadmap, and the geometry + join key are already verified.

### Three zoom levels (progressive, same honesty rules)
1. **City view — choropleth.** Neighborhoods shaded by the count of cases open *and already past
   the city's own target.* Safer first build than points.
2. **Neighborhood zoom.** Clicking a neighborhood surfaces its survival curve and competing-risks
   bar for that area (reuses Layer 2 components, filtered).
3. **Street-level points.** Individual open cases plotted from `latitude`/`longitude`, coloured by
   how far past target; click for detail (service type, age, status). This is the
   `311InYourNeighborhood` drill-down pattern.

### Honesty furniture for the map (mandatory)
- Label it a **prevalence snapshot, not a rate** — a count of cases of differing ages, not a
  performance score.
- Colour is never the only channel: every shaded area also exposes its number as text/tooltip.
- Keyboard reachable; map findings also available in the neighborhood table.

### Geometry & rendering
- **Boston Neighborhood Boundaries** GeoJSON — official city open data, 26 features, CORS-open;
  its `name` property joins directly to the 311 `neighborhood` field. Simplify to ~150 KB at
  build time (1.3 MB on first paint is not acceptable).
- Render with **Leaflet** (BSD-2) directly, or **MapLibre GL JS** (BSD-3) for vector zoom.
  **Do not use `react-leaflet`** — it is Hippocratic-2.1, not OSI-approved; a submission that must
  carry no third-party rights problems uses Leaflet's own API instead.
- Build-time simplification via **mapshaper** (MPL-2.0).

---

## 4. Open-source building blocks researched (2026-10-24)

We build *on top of* these, respecting licences — we do not reship them. Reference patterns are
for learning the interaction, not copying code.

### Geometry / basemap (data we can use directly)
| Source | What it gives | Notes |
| --- | --- | --- |
| Boston Neighborhood Boundaries (data.boston.gov / gis.data.mass.gov) | 26 neighborhood polygons | `name` joins to 311 `neighborhood`; public domain |
| `blackmad/neighborhoods` → `boston.geojson` | clean ready GeoJSON mirror | convenience copy of the above |
| Boston Ward / Precinct Boundaries (data.boston.gov) | finer geographies | optional finer zoom |

### Map rendering / tooling (libraries)
| Project | Licence | Use |
| --- | --- | --- |
| Leaflet | BSD-2 | raster map, no key, small — the safe choice |
| MapLibre GL JS | BSD-3 | vector alternative, nicer at zoom, heavier |
| mapshaper | MPL-2.0 | build-time GeoJSON simplification (1.3 MB → ~150 KB) |
| recharts | MIT | already installed; survival curves via `stepAfter` |
| shadcn/ui + Radix | MIT | accessible primitives, copied into repo |
| @tanstack/react-table | MIT | accessible sortable neighborhood table |
| axe-core | MPL-2.0 | dev-time accessibility checks |

### Reference projects (patterns, not dependencies)
| Project | Why it's useful |
| --- | --- |
| `awgreene/311InYourNeighborhood` | closest to the God's-eye vision: all 311 on a map, per-request drill-down, priority voting |
| `urban-hazards/urban-hazard-maps` | Leaflet heatmap of Boston 311 density; confirms Leaflet path |
| `hersh-gupta/boston-311-dash` | 311 overview dashboard; chart-form inspiration |
| `johnsliao/bostonservicemap` | service-call map across Metro Boston |
| `BostonRedevelop/BRA_webmap_static` | static, no-backend Boston web map with neighborhood layers |
| `nattaylor/analyzeboston` | browser SQL against the same CKAN `datastore_search_sql` API |
| `simonw/datasette-geojson-map` | Leaflet choropleth-from-geometry reference (demoed on Boston) |
| `CityOfBoston/opendatachallenge`, `codeforboston/civic_tech_resources` | catalogs of prior work, APIs, libraries |

### Avoid
- `react-leaflet` (Hippocratic-2.1, not OSI-approved).
- Any second charting library beyond recharts (bundle weight, build risk, no judged gain).
- Anything requiring an API key or login (breaks "free for judges, no restrictions").

---

## 5. Design & accessibility rules (carried from the brief)

- Civic **document**, not a neon dashboard. Light background, typography-led, tabular figures;
  the largest element on the page is a **number**.
- One accent (data), one muted tone (city's figure), one alert tone (overdue). Never colour by
  vibe.
- Accessibility is scored and built throughout, not bolted on: keyboard-reachable, visible focus
  rings, charts never the sole carrier of a finding, colour never the sole channel, WCAG AA
  contrast verified, `aria-live` on figures when the service changes, axe-core in dev.
- Copy discipline: "closed" ≠ "resolved" ever; every figure shows `n` and the censored count; no
  causal language; no income-gradient framing (tested and disproven).

### Claude skills (via Conductor), read before view code
`dataviz` (mandatory before the first chart line) · `web-design-guidelines` ·
`ecc:make-interfaces-feel-better` · `ecc:frontend-a11y`. Do **not** use
`taste-skill:design-taste-frontend` — scoped away from app screens; its landing-page direction
fights the civic-report tone.

---

## 6. Proposed build order (not started; deploy deferred)

Working branch `wait-audit-ui`, PRs into `main`; each step its own commit so the tree stays
reversible to the original scaffold.

1. **Scaffold cleanup** — replace the placeholder `App.tsx` (still the "Manila/ClimaTech"
   stub), fix `package.json` name to `wait-audit`, wire Tailwind/layout, confirm
   `npm install && npm test` green (17 tests), generate the static data fixture.
2. **Layer 1** — `ServicePicker` + `HeadlineGap`.
3. **Layer 2** — `SurvivalChart` + `BiasCallout` + `CompetingRisksBar` + `NeighborhoodTable`.
4. **Layer 3** — method section.
5. **CityMap phase 1** — neighborhood choropleth of open-and-overdue counts.
6. **CityMap phase 2** — neighborhood zoom (reuse Layer 2 filtered).
7. **CityMap phase 3** — street-level points with drill-down.
8. **Accessibility + polish pass** — axe-core + skills.
9. **Vercel deploy config** — *deferred until explicitly requested.*

Floor to ship (from `ROADMAP.md`): the censoring correction and the competing-risks breakdown.
Everything else, the map included, is enhancement.

---

## 7. Decisions (resolved 2026-10-24, ~13:50)

Settled so the build is not blocked. Roughly six hours remain before the deadline, so each
call favours shipping one airtight thing over breadth.

| Question | Decision | Why |
| --- | --- | --- |
| Choropleth only, or choropleth + points? | **Choropleth only.** Points are a stretch goal. | 26 polygons join on a key we verified. Plotting thousands of markers adds clustering, performance and a11y work for no extra finding. |
| Leaflet or MapLibre GL? | **Leaflet.** | BSD-2, smaller, raster tiles need no key or style host. Vector zoom quality is not worth the bundle tonight. |
| Does neighborhood zoom reuse Layer 2 components? | **Reuse as-is.** No compact variant. | A second variant doubles the a11y and testing surface. If a component is too tall, cut content rather than fork it. |
| `CityMap` as a scroll section or its own route? | **Section in the one-page scroll.** | A route needs navigation, deep-link state and its own loading story. The whole argument should be readable in one scroll. |
| Layer extra datasets (wards/precincts, second service)? | **No.** | The roadmap is explicit that more surface is not more value here. The service picker already covers breadth; wards add a geography nobody asked about. |

### Still genuinely open
- Whether the map ships at all. It is the highest-payoff addition but the **first cut** if the
  three layers are not finished and accessible by 16:00.
