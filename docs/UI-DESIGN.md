# UI and design brief

> **Companion document.** This is the *design* brief — principles, layers, tone, copy rules,
> accessibility. [`UI-PLAN.md`](./UI-PLAN.md) is the *architecture* plan — component tree, data
> flow, the map direction, open-source picks and build order. Read both; they agree. Where they
> appear to differ, this file governs design and tone, `UI-PLAN.md` governs structure.

For the separate Claude session that builds the interface. `src/lib/` is finished and tested —
treat it as a stable API and do not edit it. Everything here is the view layer.

## The design problem

Two audiences want opposite things from the same page.

A **resident** wants one plain answer: *if I report this, how long until it is actually fixed?*
They do not know what Kaplan–Meier is and should not have to.

A **judge or journalist** wants the audit: the estimator, the sample size, the censoring, the
assumptions, and the reason the city's own number differs.

Serving one by sacrificing the other fails. The answer is **progressive disclosure** — three
stacked layers, each complete on its own, each inviting the next.

## Layer 1 — the answer (above the fold)

A resident must get a usable answer without scrolling, clicking a legend, or reading a method.

Target: a sentence a person would say out loud.

> **Sidewalk repairs in Boston**
> Half are still open after 115 days. Only **18 in 100** actually get fixed.
> The city's published figure for this service is **under a day**.

Rules for this layer:
- One headline number, very large. One comparison number, clearly subordinate.
- Plain words only. No "median", no "censored", no "estimator", no Greek.
- The gap between what the city reports and what the data shows must be visible without
  interpretation — put the two numbers side by side and label which is which.
- A service picker driven by the live data, not a hardcoded list. This answers the
  cherry-picking objection and doubles as the main interaction.

## Layer 2 — the evidence (mid page)

Now the charts, for someone who wants to see why.

**The two curves.** Kaplan–Meier against the naive closed-only estimate, with a Greenwood
confidence band. `src/lib/stats.ts` returns `curve[]` with `t`, `s`, `atRisk`, `events`, `se`.
Recharts draws this as `<Line type="stepAfter">` plus an `<Area>` for the band — a survival
curve is a step function and must never be rendered as a smooth spline.

**The competing-risks bar.** Three mutually exclusive outcomes from `aalenJohansen`:
genuinely resolved, closed without being fixed, still open. One horizontal stacked bar, the
three segments directly labelled with percentages. This is the finding that needs no
statistics to understand, so it should read instantly.

**The neighborhood table.** On-time rate with Wilson intervals. Sortable. Cells under n=30 show
an em dash, with a focusable explanation of why.

## Layer 3 — the method (below)

Cohort window and why it starts 2026-07-01. The independent-censoring assumption and the
direction it biases. Confounders named. Query timestamp. Link to `ANALYSIS.md`.

This layer is where honesty lives, and it is graded, so it gets real typographic care rather
than small grey text at the bottom.

## The "current issues" panel

Sean's requirement: a user should see **current issues**, not only historical distributions.

The 311 resource carries `latitude` and `longitude`, and Boston publishes neighborhood
polygons. So: cases that are open **right now** and already past the city's own target,
mapped.

- Choropleth by neighborhood, shaded by count of open-and-overdue cases, or point markers
  coloured by how far past target they are. Choropleth is the safer build.
- Geometry: Boston Neighborhood Boundaries GeoJSON, 26 features, 1.3 MB, `Access-Control-Allow-Origin: *`.
  Its `name` property joins directly to the 311 `neighborhood` field. Simplify to roughly
  150 KB at build time; 1.3 MB on first paint is not acceptable.
- Label it as a prevalence snapshot, not a rate. It is a count of cases of differing ages.

## Visual direction

Not a dashboard. This is a **public audit document** that happens to be interactive — closer
to a well-set statistical report than to an admin panel. No dark-mode-neon KPI tiles, no
gauges, no sparkline chrome.

- Typography does the work. A real type scale, generous measure, numbers in a tabular figure.
- Restraint in colour. One accent for "what the data shows", one muted tone for "what the city
  reports", one alert tone reserved for the overdue count. Never colour by vibe.
- The largest element on the page should be a number, not a chart.
- Light background. This is a civic document, and it will be screenshotted into a slide.

### Accessibility is scored, so it is not a pass at the end

- Every control reachable and operable by keyboard, with a visible focus ring.
- Charts are not the only carrier of any finding — every number in a chart also appears as
  text or in a table.
- Colour is never the sole channel; pair it with a label or pattern.
- Contrast at WCAG AA or better, verified rather than assumed.
- `aria-live` on the figures when the selected service changes, so the update is announced.

## Claude skills to use

Read these before writing view code, not after:

| Skill | Use it for |
| --- | --- |
| `dataviz` | **Mandatory before the first line of chart code.** Covers chart form, palette, stat tiles, legends, axes, tooltips. |
| `web-design-guidelines` | Review the built UI against interface and accessibility guidelines. |
| `ecc:make-interfaces-feel-better` | Final polish: spacing, hit areas, text wrapping, interaction states. |
| `ecc:frontend-a11y` | The accessibility pass, alongside axe-core in dev. |

Do **not** reach for `taste-skill:design-taste-frontend` — it is explicitly scoped away from
dashboards and app screens, and its gallery-landing-page direction would fight the civic-report
tone this needs.

## Hard constraints

- No backend, no API key, no login. A judge must reach it free.
- Do not edit `src/lib/**`. If a statistic is missing, ask for it rather than recomputing it
  in a component.
- "Closed" and "resolved" are different words. Never use them interchangeably in copy.
- Every figure shows `n` and the censored count.
- No causal language anywhere. No income-gradient framing — it was tested and disproven.
