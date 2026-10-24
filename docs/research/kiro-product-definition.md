[tool] Reading brief-product-def.md:1
[tool] status: Completed
[tool] Reading 311-verified-facts.md:1, stats-plan.md:1, civic-portal-inventory.md:1
[tool] status: Completed
Now I have everything I need. Let me write the complete product definition.
[tool] Creating task list: Write the complete product definition document for the Bo...
[tool] status: Completed
[tool] Finding .kiro/**/* in manila
[tool] status: Completed
Good — no specs exist yet. Now I'll write all four documents.
[tool] Creating product-definition.md
[tool] status: Completed
[tool] Completing #1
[tool] status: Completed
Now I'll write all three Kiro spec files.
[tool] Creating requirements.md
[tool] status: Completed
[tool] Creating design.md
[tool] status: Completed
[tool] Creating tasks.md
[tool] status: Completed
[tool] Completing #2, #3, #4
[tool] status: Completed
Here is the complete product definition. Everything concrete and buildable.

---

## 1. Name → **Wait Audit**

"A statistically honest account of how long Bostonians actually wait for 311 service requests to close."

Rejected "Dashboard" (implies live ops monitoring, not an audit). Rejected "ClearTime" (marketable but opaque to a judge in three seconds). "Audit" names the action: we are checking official numbers against a corrected estimate and finding they fall short.

---

## 2. One-sentence product definition

Wait Audit is a browser-only statistical audit for Boston residents and journalists that shows, service type by service type, how much the city's published 311 on-time rate and median closure time understate the true wait — because 7,840 cases are still open and the ones still open are disproportionately the slow ones.

---

## 3. Screen inventory

One screen, scroll-based, ~2,400 px total height.

**Above the fold:** header bar with timestamp · three stat tiles · service type picker · KM chart (two curves + CI band).

**Below the fold:** bias callout block · closure-reason stacked bar · neighborhood table with Wilson CIs · honesty furniture strip · Cambridge panel (collapsed) · footer.

---

## 4. Exact numbers on screen

**Tile 1 — "Open & overdue right now":** live `COUNT(*)` where `case_status='In progress' AND on_time='OVERDUE'`. Verified value: **7,840**. Sub-label: "cases past the city's own deadline."

**Tile 2 — "Closed without resolution":** live count of Noted + Transitioned divided by total closed. Verified: **~23%** (15,154 / 66,251). Sub-label: "of 'closed' cases were Noted or Transitioned, not fixed."

**Tile 3 — "Underreported wait":** KM median minus naive closed-only median for Street Light Outage, in days. Verified closed-only median: 13d 12h; verified mean: 47d 2h (gap confirms the tail is heavy). Exact KM value recomputed at build time.

**KM chart legend:** "Kaplan–Meier estimate (n=[total], [k] censored)" · "Naive (closed cases only, n=[k])". Always visible in legend, never in a tooltip.

**Neighborhood table columns:** Neighborhood · n · Naive median · KM median · On-time rate [Wilson 95% CI]. Cells with n < 30 show `—`.

---

## 5. Default state

A judge lands and sees in three seconds: header, three tiles (7,840 · ~23% · +X days), Street Light Outage chip highlighted, KM chart loaded with two visibly diverging curves.

**Why Street Light Outage:** largest median/mean gap in the dataset (13d 12h median vs 47d 2h mean), 475 currently open-and-overdue cases with a 367-day longest wait, n=3,485 closed cases for a smooth KM curve, infrastructure affecting safety and visible to everyone including judges who live in Boston.

---

## 6. Interactions

- **Service picker:** horizontal chip row, single-select, arrow keys + Space/Enter, `aria-live` announcement, chips disabled during load.
- **Neighborhood table sort:** click column header, `aria-sort` updates.
- **Cambridge panel:** collapsed toggle with `aria-expanded`.
- **Suppressed cell tooltip:** hover/focus on `—` shows "Suppressed: fewer than 30 cases (n=[k])."
- No date picker. No neighborhood filter. No comparison selector. That's the whole list.

---

## 7. Honesty furniture (placed in primary flow, not footnotes)

| Element | Exact placement |
|---|---|
| n + censored count | KM chart legend, always visible |
| Suppression rule | One line of body text directly above the neighborhood table |
| Bias callout | Full-width `bg-blue-50` block between KM chart and closure-reason panel |
| Closed ≠ resolved definition | Body text directly above the closure-reason bar |
| Confounder note | One sentence directly below the neighborhood table; names lamp ownership, contractor routing, case volume |
| Query timestamp | Header bar + mirrored as `<time>` in honesty furniture section |
| Cambridge proxy label | Amber callout at the top of the Cambridge panel, before the chart |

---

## 8. Video beats

2:45 total. Emotional peak: **1:05 — the KM corrected median lands on screen**. The single number to flash large is "+[X] days" (KM minus naive). Hold three seconds.

Shot list: city portal → tile 1 (7,840) → KM chart gap [**peak**] → closure-reason panel → neighborhood table → honesty furniture → service picker switch → full-page scroll + credits.

---

## 9. Build order (13:00–20:00)

| Window | Work |
|---|---|
| 13:00–13:30 | Lock spec (done) |
| 13:30–14:30 | Stats module + PBT (interval parser, KM, Wilson, naive) |
| 14:30–15:15 | Data layer (fetch script, loader) |
| 15:15–16:30 | Core UI above the fold (tiles, picker, KM chart) |
| 16:30–17:15 | Below the fold (bias callout, closure-reason panel, neighborhood table) |
| 17:15–17:45 | Honesty furniture |
| 17:45–18:15 | Cambridge panel — **drop first if behind** |
| 18:15–18:30 | axe-core accessibility pass |
| 18:30–19:00 | Vercel deploy + README + KIRO-USAGE.md |
| 19:00–19:45 | Record video |
| 19:45–20:00 | Submit |

**Cut order:** Cambridge → log-rank/BH → table sort → bootstrap CIs → Cox. Floor that cannot be cut: three stat tiles + KM chart + bias callout + closure-reason panel.

---

## 10. Spec files written

- `.kiro/specs/service-wait-audit/requirements.md` — 20 testable REQ statements
- `.kiro/specs/service-wait-audit/design.md` — architecture, stats module APIs, component specs, PBT properties, Kiro hooks
- `.kiro/specs/service-wait-audit/tasks.md` — 10 phases, T-00 through T-100, time-boxed with explicit cut order

The spec is complete. You can start T-04 (install Vitest + fast-check) and T-20 (fetch script) right now.
