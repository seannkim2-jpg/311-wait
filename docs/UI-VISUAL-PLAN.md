# Wait Audit: look, feel and skills plan

Status: **approved 2026-10-24 and built** on `wait-audit-ui`. All 12 skills in §1 are installed
in `.kiro/skills/`. §7 records the decisions the team made; where they differ from the first
draft below, §7 wins.

This document covers how the site looks, moves and reads. Structure, data pipeline and the map
stack (MapLibre + Protomaps) are in [`UI-PLAN.md`](./UI-PLAN.md). Copy and accessibility rules
come from [`UI-DESIGN.md`](./UI-DESIGN.md) and the spec. This plan keeps all of those.

---

## 1. Skills to install (approval needed)

Each skill goes into `.kiro/skills/<name>/`, copied from the pinned commit below. Each folder
keeps the upstream `LICENSE` plus a `SOURCE.md` recording the repo and commit. Committing the
folders also counts as evidence of Kiro use, and each install gets logged in `KIRO-USAGE.md`.
All licences below were read from the repos on 2026-10-24.

### Recommended

| # | Skill | Source @ commit | Licence | What it does for us |
| --- | --- | --- | --- | --- |
| 1 | `frontend-design` | `anthropics/skills` @ `dbd4588` | Apache-2.0 | Visual direction: type, palette and hero, so the page doesn't look templated |
| 2 | `animate` | `emilkowalski/skill` @ `2d22863` | MIT | The energy: decides what moves, the easing curve, duration, interruption and the reduced-motion fallback |
| 3 | `make-interfaces-feel-better` | `jakubkrehel/make-interfaces-feel-better` @ `35545ea` | MIT | Final polish: spacing, tabular numbers, hover and press states, hit areas. From the original author; `ecc:` ships a copy |
| 4 | `tufte-data-viz` | `caylent/tufte-data-viz` @ `ae7ca0d` | MIT | Chart rules, with a dedicated Recharts guide: direct labels and no chart clutter. Replaces `dataviz` (see below) |
| 5 | `frontend-a11y` | `affaan-m/everything-claude-code` @ `90606c8` | MIT | Keyboard, ARIA and focus handling for the picker, tooltips and table |
| 6 | `web-design-guidelines` | `vercel-labs/agent-skills` @ `063bee9` | MIT | Review pass on the built UI. It fetches the latest rules from `vercel-labs/web-interface-guidelines` (MIT) at run time |
| 7 | `cartography-geoviz` | `muend/geoai-skills` @ `19937ce` | MIT | Choropleth classes, colour ramps, legends and map accessibility |
| 8 | `maplibre-cartography` | `maplibre/maplibre-agent-skills` @ `d150b23` | MIT | Label legibility, and placing our data layers underneath the basemap labels |
| 9 | `maplibre-source-wiring` | same | MIT | Hover and selection highlights (`promoteId` + feature-state), plus fixes for a blank map (CORS, glyphs) |
| 10 | `maplibre-pmtiles-patterns` | same | MIT | The static Protomaps basemap that `UI-PLAN.md` chose |

### Optional

| Skill | Source | Licence | Why it's optional |
| --- | --- | --- | --- |
| `maplibre-tile-sources` | `maplibre/maplibre-agent-skills` | MIT | Only confirms that plain GeoJSON is fine at our size (~7.9k points, 25 polygons) |
| `webapp-testing` | `anthropics/skills` | Apache-2.0 | Playwright screenshots of the running page for design checks. Adds Python and Playwright tooling |

### Considered and not recommended

| Skill | Why not |
| --- | --- |
| `dataviz` (named in the current docs) | A built-in Claude Code skill with no open licence. The only GitHub copies are in a leaked-prompts repo. Use #4 instead |
| `taste-skill` (Leonxlnx, MIT) | Aimed at gallery-style landing pages. It still fights the report tone, as `UI-DESIGN.md` already decided |
| `ui-ux-pro-max` (MIT) | A large, generic style database plus a CLI. Overlaps #1–3 |
| `mapbox-agent-skills` (MIT) | Mapbox requires an access token, which breaks the no-key rule |
| Leaflet skills (`mapsnippets`, `Fadhili5`, …) | We render with MapLibre, and these repos have about one star each |
| `map-design` (ashishkaloge) | Makes static poster maps, not interactive ones |
| `react-view-transitions` (Vercel) | Needs React 19; the repo is on React 18.3 |
| `react-best-practices` (Vercel) | Aimed at Next.js; little payoff for a static Vite page |

---

## 2. Direction: a live civic report

**It reads like a well-set public report and moves like a live instrument.** The energy comes
from scale, from motion that shows the data changing, and from one electric colour. It does not
come from dark mode, gradients, glow or extra colours.

Three rules keep it simple:

1. **One question per screen.** How long? → Where? → Why is the city's number low? → How do we know?
2. **One control drives everything.** The service picker updates every number, chart and the map.
3. **Every motion shows a change in the data.** No decorative or looping animation.

---

## 3. The page, screen by screen

### Screen 1: the answer (above the fold, fits a 390 × 844 phone)

```
WAIT AUDIT · Boston 311                    data.boston.gov · queried 2026-10-24 13:40 ET
──────────────────────────────────────────────────────────────────────────────
Nearly 1 in 4 closed Boston 311 cases ended as Noted or Transitioned rather than Resolved.
23.9% of 48,903 closed cases were filed as Noted or Transitioned.

( Street lights ● )( Potholes )( Sidewalks )( Litter )( More services ▾ )

Street light outages
┃ 14.5 days                                 Closed cases only
┃ until half are closed,                    4.7 days
┃ counting the ones still open.             closed cases only
┃
┃ [ 3.1× longer ]   Only 70 in 100 were actually resolved.

n = 1,413 · 37.9% still open · cases opened 1 Jul–24 Oct 2026 · max ≈115 days observed
                           ↓  See where people are waiting
```

- The city-wide line goes first because REQ-09 requires the closure finding to be the first headline.
- The hero number is the largest thing on the page (cobalt, display face). The city's figure sits
  beside it in slate, clearly smaller and clearly labelled.
- **No-median state** (Sidewalk Repair): the slot reads **"70 in 100"** with
  *"sidewalk repair requests are still open, so there is no honest typical wait."* The city's
  method says 0.86 days.
- Past the hero, a **sticky mini bar** slides in showing the service name, both numbers and the
  picker, so you can switch services from anywhere on the page.

### Screen 2: where people are waiting (map, full width, ~80vh)

- A floating card says **"6,624 cases are past the city's own deadline"** (count from `target_close_date`, not `on_time`), with
  *"A snapshot of open cases today, not a rate."* underneath.
- The map follows the picker by default, with a `This service | All services` toggle.
- City view: a choropleth with a single-hue red ramp. Hover or focus lifts the outline and shows the count.
- Desktop gets a neighbourhood list docked on the right; phones get a bottom sheet. The list stays
  in sync with the map and is the keyboard route.

### Screen 3: why the city's number is too low (evidence, in spec order)

1. **What happens to a report.** Cumulative incidence (Aalen–Johansen) as stacked step-areas over
   0–115 days: resolved, Noted or Transitioned, still open. A 100% bar at the right edge carries
   the direct labels (*70% · 7% · 23%*), so it reads in one glance and still meets REQ-21.
   Annotation: *"23.9% of closed cases were closed as Noted or Transitioned rather than Resolved."*
2. **Bias callout** (the exact REQ-06 sentence), full width on a pale-cobalt panel, with
   **3.1×** set large on the left.
3. **Still waiting, day by day.** The Kaplan–Meier step line (cobalt) with its band, against the
   closed-only line (slate, dashed). Lines are labelled directly, with no legend. Dots mark where
   each line crosses 50%, labelled *4.7 d* and *14.7 d*. The REQ-22 caveat sits directly below the chart.
4. **Neighbourhood table**, with the n<30 line above it and the REQ-14 confounder note below.

### Screen 4: how we counted (method)

Four cards: **Cohort** · **The assumption** (and which way it biases the estimate) ·
**What this can't tell you** · **Checked three ways** (TypeScript, Python, `lifelines` agree to
six decimals). Then links to `ANALYSIS.md` and the repo, the `Protomaps © OpenStreetMap` credit,
and "Built with Kiro".

---

## 4. Visual system

### Colour: six roles, one meaning each

Contrast is measured against the paper colour.

| Role | Hex | Used for | Contrast |
| --- | --- | --- | --- |
| Paper | `#FAFAF7` | Page background (cards `#FFFFFF`, rules `#E6E6E1`) | — |
| Ink | `#14161A` | Text | 17.3:1 |
| Data | `#2440E8` | What the data shows: hero number, KM line, resolved | 6.75:1 |
| City | `#5E6676` | Closed-cases-only comparison figure and line | 5.52:1 |
| Noted/Transitioned | `#A35F00` | Noted/Transitioned segment (hatched), caveats | 4.79:1 |
| Overdue | `#C8242D` | Still open or past deadline, map ramp end (dotted) | 5.36:1 |

Cobalt and red are only 1.26:1 against each other, so adjacent segments get 2 px paper gaps,
patterns and direct labels. Colour is never the only signal.

### Type: self-hosted, no third-party request at run time

- **Bricolage Grotesque Variable** (OFL) for display text: hero number, section titles. Weight
  700–800, tracking −0.03em at large sizes. Gives the page its character and energy.
- **Public Sans Variable** (OFL) for body text. It is the US Web Design System's typeface, so the
  page carries a quiet civic signal.
- Both install via `@fontsource-variable/*`, and both were checked to support tabular figures (`tnum`).
- Scale: 14 · 16 · 20 · 28 · 40 · 64, and `clamp(88px, 16vw, 200px)` for the hero number. All
  figures use `tabular-nums`. Body text stays under 68 characters per line.

### Shape

An 8-pt spacing grid with content up to 1120 px wide; the map runs full-bleed. Cards use a
16 px radius and chips are fully rounded. Cards get 1 px borders instead of shadows; only the
floating map card has a soft shadow. Focus ring: 2 px cobalt with a 2 px offset.

---

## 5. Motion (where the energy comes from)

| Moment | What moves | Timing | Reduced motion |
| --- | --- | --- | --- |
| Load or service change | The hero number counts up from the city's figure to the corrected one, then the `3.1×` chip pops in | 900 ms ease-out; chip +150 ms | Final value appears at once |
| Picker | The active pill slides to the chosen chip | 250 ms ease-out | Instant |
| Incidence bar and areas | Grow left to right, staggered | 600 ms, 60 ms stagger | Static |
| Survival chart scrolls into view | The city's line draws first, then the real line runs on past it | 700 ms + 700 ms | Static |
| Map scrolls into view | The camera eases from Greater Boston to fit the city, and the choropleth fades in | 1.2 s `flyTo` | `jumpTo` |
| Map hover or focus | The outline lifts and the count tooltip appears | 120 ms | Same |
| Scroll past the hero | The sticky mini bar slides down | 200 ms | Instant |

Motion rules:

- Animate only `transform` and `opacity`, and never loop.
- No animation library. Use CSS, one small `requestAnimationFrame` count-up hook, Recharts'
  built-in animation and MapLibre's `flyTo`.
- The count-up digits are `aria-hidden`. A visually hidden `aria-live` region announces only the
  final sentence, e.g. *"Now showing street light outages: 14.5 days; closed cases alone say 4.7 days."*

---

## 6. Accessibility built into these designs

- **Picker:** arrow keys move between chips and Space/Enter selects (REQ-11). Chips are disabled
  while loading, with a visible spinner. Hit areas are at least 44 px.
- **Charts:** each has a `<figcaption>` stating the finding in words, plus a "Show the numbers"
  disclosure with a table.
- **Map:** the canvas has a text summary, and the synced neighbourhood list is the keyboard
  route. Every map finding also appears in the neighbourhood table.
- Run axe-core in dev; the target is zero critical violations in the default state (REQ-17).

---

## 7. Decisions (team, 2026-10-24)

1. **Evidence order: day-by-day chart first**, then the bias callout, then the outcomes chart.
   This departs from REQ-09's visual order; REQ-06 still holds (the callout sits between the two).
   Can be reordered later. Noted in the spec.
2. **Closure visual:** incidence curves with the labelled bar on top (meets REQ-21).
3. **Energy comes from motion and size, not colour.** The look stays restrained and modern: ink
   carries the page, and colour only ever encodes data. Moving parts: the hero number counts up
   from the city's figure, comparison bars grow, map circles resize when the service changes,
   and the map flies in once.
4. **Comparison label is "What the city reports"**: the team confirmed the city publishes it.
5. **Map default:** follows the selected service, with an "All services" toggle.
6. **Map form: proportional circles, not a choropleth.** The `cartography-geoviz` skill flags
   raw-count choropleths as population maps in disguise, and the steering forbids giving the
   overdue count a denominator. So circle size = open now, solid core = past deadline (the "little
   comparison"), plus a ranked list. Individual cases appear past zoom 13, rounded to ~100 m.

As built, the text tones are ink `#15171C`, `#4A505C` and `#636A76`. The lightest was darkened
from `#6B7280` after axe flagged 4.43:1 on the grey sections; it now measures 5.0:1.

---

## 8. Build order (time-boxed to the 20:00 ET deadline in `tasks.md`)

| Done by | Step |
| --- | --- |
| 14:15 | Install the approved skills; set design tokens in `tailwind.config.js` (colours, fonts, radii); replace the Manila stub |
| 15:15 | Screen 1: picker, count-up hero, city comparison, no-median state, n line |
| 16:30 | Screen 3: incidence chart and bar, bias callout, survival chart and caveat, neighbourhood table |
| 17:30 | Screen 2: basemap, choropleth and synced list |
| 18:00 | Screen 4 and the sticky mini bar |
| 18:30 | Polish and accessibility pass with skills 3, 5 and 6; axe at zero critical |
| 19:00 | Deploy (only when requested), then the demo video |

Cut order if behind: street-level points → sticky mini bar → map `flyTo` intro → chart draw-in.
The floor (Screen 1 + the incidence chart + the bias callout) does not move.
