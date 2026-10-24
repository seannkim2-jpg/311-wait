# Status and what to build on

## What is complete

| Area | State |
| --- | --- |
| Concept selected, red-teamed by a hostile-judge and statistician pass | Done |
| Live endpoint verified keyless and CORS-open | Done |
| Cohort window diagnosed and fixed (`open_date >= 2026-07-01`) | Done |
| Data access layer `src/lib/boston311.ts` | Done |
| Statistics `src/lib/stats.ts` — KM, Aalen–Johansen, Wilson, log-rank, BH | Done, by Kiro |
| 12 property-based tests `src/lib/stats.test.ts` | Done, by Kiro |
| Cross-implementation check against a Python reference | Done, 5 tests |
| **Third-opinion validation against `lifelines`** | **Done, agrees to 6 decimals** |
| Spec `.kiro/specs/service-wait-audit/` | Done, 843 lines, by Kiro |
| `ANALYSIS.md`, `PLAN.md`, `UI-DESIGN.md` | Done |
| UI | **Not started** — the website session's job |
| `KIRO-USAGE.md` | Skeleton only |
| Vercel deploy | Not started |
| Demo video | Not started |

`npm test` → 17 passing.

### Three implementations agree

The estimators were written three times, independently:

1. `src/lib/stats.ts` — TypeScript, by Kiro from the spec
2. `scripts/reference_impl.py` — Python, by Claude, no sight of the TypeScript
3. `lifelines` 0.30.0 — the established Python survival-analysis library

`scripts/validate_against_lifelines.py` confirms all three land on the same Kaplan–Meier
medians and Aalen–Johansen incidences to six decimal places, including the degenerate case
where Sidewalk Repair's median is undefined and `lifelines` returns infinity.

The harness found two real errors, one in each direction:
- Our Python took the upper middle value instead of averaging for even-sized samples. **Kiro's
  TypeScript was correct.**
- A property as originally specified claimed that appending a censored observation beyond the
  last event leaves the curve unchanged. `fast-check` falsified it — that subject is in the
  risk set at every earlier event time. **The requirement was wrong, not the code.**

Agreement between implementations written by different agents is the real evidence here. One
agent writing both would only prove self-consistency.

## Open source to build on

The rules allow open source where the licence is respected and we **build on top rather than
reship**. Licences below were checked against the registry, not recalled.

### Tier 1 — worth adding today

| Project | Licence | What it buys |
| --- | --- | --- |
| **shadcn/ui** | MIT | Components are copied into the repo, not imported, so we own and adapt them. Tailwind-native, fits the existing scaffold. |
| **Radix UI primitives** | MIT | Keyboard and ARIA correctness for select, tabs, tooltip, dialog. Accessibility is a scored criterion and this is the cheapest way to earn it. |
| **lifelines** | MIT | Dev-only. Already integrated — the third-opinion validation above. |
| **axe-core** | MPL-2.0 | Automated accessibility checks in dev. Catches contrast and labelling before a judge does. |
| **@tanstack/react-table** | MIT | Accessible sortable table for the neighborhood panel, with correct `aria-sort`. |
| **recharts** | MIT | Already installed. `type="stepAfter"` draws a survival curve correctly. |
| **Boston Neighborhood Boundaries** | City open data | 26 polygons, CORS-open, `name` joins straight to the 311 `neighborhood` field. |

### Tier 2 — if the UI lands early

| Project | Licence | What it buys |
| --- | --- | --- |
| **Leaflet** | BSD-2-Clause | The "current issues" map. Raster tiles, no key, small. |
| **MapLibre GL JS** | BSD-3-Clause | Vector alternative, no key, nicer at zoom. Heavier bundle. |
| **mapshaper** | MPL-2.0 | Build-time simplification of the 1.3 MB GeoJSON down to roughly 150 KB. |
| **@testing-library/react** | MIT | Component tests for the honesty furniture — that the caveats actually render. |

### Avoid

| Project | Why |
| --- | --- |
| **react-leaflet** | Licensed **Hippocratic-2.1**, which is not OSI-approved and carries ethical-use restrictions. For a submission that must warrant no third-party rights problems, use Leaflet's own API directly instead. |
| Any charting library beyond recharts | recharts is installed and sufficient. A second charting dependency is bundle weight and build risk for no judged gain. |
| Chart libraries requiring an API key or account | Breaks the "free for judges, no restrictions" rule. |

## Ways to deepen the project

Ordered by payoff against risk, with the deadline in mind.

1. **The current-issues map.** *Highest payoff.* The analysis is currently all distributions.
   A map of cases open and past target right now turns it from a report into something a
   resident reads about their own street. Geometry and join key are both verified.
2. **Drive the service picker from the data.** Removes the cherry-picking objection entirely
   and costs one query that `boston311.ts` already exposes.
3. **Report channel as a covariate.** The cohort splits BOS311 app against phone. Describing
   the difference in outcome mix is honest and interesting. State it as association only — it
   does not establish that the channel causes anything.
4. **Log-rank with Benjamini–Hochberg across neighborhoods.** Already implemented and tested.
   Reporting that most apparent differences do *not* survive correction is a stronger, more
   honest result than claiming a gap, and it is the kind of restraint judges remember.
5. **Cambridge as a second municipality.** 156,112 rows back to 2023. Its closure time must be
   proxied by `ticket_last_updated_date_time`, which is an upper bound, so the proxy must be
   unmissable on screen. First item on the cut list.
6. **Cox proportional hazards.** Hazard ratios for service type and area, as association only.
   Precompute; do not fit in the browser. Post-hackathon.
7. **Historical tracking.** Re-pulling on a schedule to watch the backlog move over time would
   be genuinely valuable, but it needs storage and therefore a backend. Out of scope for a
   static submission.

## What to keep resisting

More surface is not more value here. The judged criteria are potential value, Kiro usage, and
quality of design — none rewards feature count. A second municipality, a third chart library,
or a trend view all add risk to a submission whose strength is that one finding is airtight
and triple-verified.

The floor to ship: the censoring correction and the competing-risks breakdown. Everything else
is optional.
