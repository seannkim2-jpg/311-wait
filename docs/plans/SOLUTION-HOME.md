# Plan: the solution home page ("What Boston could report")

Status: **plan for Kiro to turn into a spec, then build.** Written 2026-10-24, 15:20 ET.
Deadline 20:00 ET. Nothing here is built yet.

## Why

The live site (https://wait-audit-livid.vercel.app) shows the problem: a median taken over
closed cases makes Boston 311 look faster than it is. It does not yet show the **solution**.
This extension adds a front section that says what Boston could report instead, with every
number computed live by the engine already in `src/lib/`. The research is done; this is
implementation.

## What the page does, top to bottom

One scrolling page. New sections go **above** the existing ones; nothing existing is removed.

1. **The resident's question (existing Hero, reused).** "I reported a broken sidewalk. When
   will it be done?" Service picker → median among closed cases next to the estimate
   including open cases. Keep it as is.

2. **"Five changes Boston could make" (new).** Five cards. Each card has: the change in one
   sentence, how it works today, and the live number it would show for the selected service
   (or citywide where noted).

   | # | Change | Today | Live number (example, Street Light Outage) | Source |
   |---|---|---|---|---|
   | 1 | Report waits that include open cases | Not published | 14.5 days, against 4.7 among closed cases | `ServiceAudit.kmMedianHours`, `cityMedianHours` |
   | 2 | Publish the count of open cases past their target date | Not published | 353 (citywide 6,624) | new `fetchServiceOnTime` (below), `CohortTotals.openOverdue` |
   | 3 | Report Noted and Transitioned separately from Resolved | All counted as "closed" | 7 in 100 (citywide 23.9%) | `ServiceAudit.outcomes.notResolved`, `CohortTotals` |
   | 4 | Keep the on-time flag current for open cases | 324 Street Light cases past target still read ONTIME | count for selected service | new `fetchServiceOnTime` |
   | 5 | Publish CityScore's 311 on-time measures again | CityScore's metric list has no Pothole values since 2026-06-18 and no Streetlight values at all | on-time share by target date: among closed vs counting open-and-past-target as late (75.1% vs 53.5%) | new `fetchServiceOnTime`; CityScore fact is static, dated, linked to `docs/research/claim-check.md` |

3. **"Who can act" (new).** Three short columns:
   - **Residents:** a "Copy this summary" button that puts a plain-text paragraph with the
     live numbers on the clipboard, to send to a city councilor. Link to
     https://www.boston.gov/departments/city-council for contacts. Do not hardcode names
     or emails.
   - **Councilors and reporters:** link to the method section and `docs/ANALYSIS.md`.
   - **The city's 311 team:** the five changes as a short checklist.

4. **Existing sections, unchanged:** map, survival chart, outcome chart, neighborhood
   table, method.

5. **"How this was built" (new, small, near the footer).** Three sentences and one diagram
   of the loop below, linking to `/.kiro/`, `docs/KIRO-USAGE.md` and the claim check.
   Judges should not have to dig through the repo to find the Kiro story.

## Data and logic to add

Only one new data function. Everything else already exists.

- `src/lib/boston311.ts`: `fetchServiceOnTime(serviceName, cutoff)` returning
  `{ closedMet, closedMissed, openPastTarget, openPastTargetFlaggedOnTime }`, computed from
  `close_date` / `target_close_date` against the extract cutoff, **not** from `on_time`
  (the flag lags for open cases). One SQL round trip using `SUM(CASE …)` (CKAN rejects
  `FILTER`). Quote values with the existing `quote()`.
- Derived shares: `onTimeAmongClosed = met / (met + missed)` and
  `onTimeCountingOverdue = met / (met + missed + openPastTarget)`.
- Expected values to check against (from `data/numbers.json`, extract cutoff
  2026-10-24 09:01 UTC): Street Light 353 past target, 75.1% and 53.5%; Pothole 481, 38.1%
  and 29.8%; citywide 6,624 open past target, 384 of them flagged ONTIME.

## Wording rules (already in `.kiro/steering/data-facts.md`)

- Compare the median among closed cases with the estimate including open cases. Never label
  the first one as the city's figure or method.
- Say "closed as Noted (no action required) or Transitioned (reassigned to another
  agency)". Never say those cases were unfixed.
- "Past target" counts are a snapshot, not a rate. No denominators on them.
- No causal claims, no neighborhood or income comparisons.
- `python3 scripts/refresh_numbers.py --lint-only` must report 0 problems.

## Kiro strategy: Kiro builds, hooks enforce, independent agents audit

Use each Kiro tool for a defined job, and record each in `docs/KIRO-USAGE.md` with a commit
link as it happens.

| Kiro feature | Job in this extension |
|---|---|
| **Spec** | Write `.kiro/specs/solution-home/` (requirements, design, tasks) from this plan **before** any code. Requirements in testable SHALL form. |
| **Steering** | Add `.kiro/steering/claims.md` with `inclusion: fileMatch` on `src/components/**` and `docs/**`, holding the wording rules above, so they load when copy is being written. |
| **Hooks** | Add three agent hooks: (1) on save of `src/**` or `docs/**`, run `python3 scripts/refresh_numbers.py --lint-only` and fix any hit; (2) on save of `src/lib/**`, run `npm test`; (3) on save of `src/components/**`, review the component for keyboard access, labels and contrast. |
| **Property-based testing** | fast-check properties for the new logic: `onTimeCountingOverdue <= onTimeAmongClosed` always; both shares stay in [0, 1]; `openPastTargetFlaggedOnTime <= openPastTarget`. |
| **Skills** | Use the installed `.kiro/skills/` (`frontend-a11y`, `tufte-data-viz`, `make-interfaces-feel-better`, `web-design-guidelines`) for the cards and the copy button. |
| **Kiro agent / web** | Build from the spec on a branch and open a pull request into `main`. |
| **Audit (outside Kiro)** | Claude and `scripts/refresh_numbers.py` independently re-check every number before merge. |

Skip MCP and powers unless one genuinely fits; padding reads as padding.

## Acceptance checks

- `npm test`, `npm run build`, `npm run lint` pass; claim lint reports 0.
- The five cards show live numbers for the selected service and match `data/numbers.json`
  within rounding (snapshot dated 2026-10-24).
- Keyboard: every card, the copy button and the service picker are reachable and labelled;
  the copy button announces success through an `aria-live` region.
- Works at 390 px wide with no horizontal scroll, signed out, on the deployed URL.
- `docs/KIRO-USAGE.md` has entries for the new spec, the steering file, each hook and the
  new properties.

## Out of scope

New datasets, new statistics, neighborhood rankings, a second city, routing, a backend, any
change to the existing estimators.

## Cut order if time runs short

1. Accessibility review hook. 2. "How this was built" diagram (keep the three sentences).
3. Copy-summary button (keep the three "who can act" columns as text). Never cut: the five
cards, the claim-check hook, the spec.

## Schedule (ET)

| Time | Work |
|---|---|
| 15:30–16:00 | Kiro writes the spec and the `claims.md` steering file |
| 16:00–16:20 | Kiro adds the hooks |
| 16:20–18:00 | Kiro builds the page from the spec; pull request into `main` |
| 18:00–18:30 | Review, number check, deploy, `KIRO-USAGE.md` |
| 18:30–19:30 | Record the video |
