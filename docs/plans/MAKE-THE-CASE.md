# Plan: Make the case (case calculator + Cambridge)

Status: **plan for Kiro to spec, then build.** Written 2026-10-24, 15:45 ET; deadline 20:00 ET.
It **replaces** the five-card "What Boston could report" plan, which the team dropped.

## Why

The site shows that closed cases alone make Boston 311 look faster than it is. A resident with
a stuck request still has nothing to *do* with that. This turns the site into a small toolkit:
type your case ID, see where it stands against similar cases, and copy a short, factual summary
to send to someone who can act. Cambridge is added to show the same check works on a second
city's data.

## Finding it rests on (checked, `scripts/check_make_the_case.py`)

Once a case is late it usually stalls, so waiting longer rarely helps. Chance a case still open
at a given age closes in the next 14 days, from the same Kaplan–Meier curve the site already
draws (extract cutoff 2026-10-24 09:01 UTC):

| Still open after… | Closes in the next 14 days | Similar cases behind it |
| --- | --- | --- |
| Sidewalk Repair, 1 week | 4 in 100 | 1,794 |
| Sidewalk Repair, 1 month | 1 in 100 | 1,405 |
| Street Light Outage, 2 weeks (its target) | 25 in 100 | 572 |
| Street Light Outage, 2 months | 8 in 100 | 137 |
| Pothole, 2 weeks | 16 in 100 | 522 |
| Pothole, 1 month | 2 in 100 | 380 |

The script also confirmed: 0 case IDs in the whole resource break `^BCS-\d{8}$`; all 56,797
cohort IDs are unique; a single-case lookup through the live API returns one row; 99.4% of
cohort cases carry a council district 1–9.

## What gets built

1. **"Where does my case stand?"** (new section, right after the existing answer). The resident
   enters a case ID such as `BCS-00253943` and sees:
   - service, status, date opened, days open (to the extract cutoff), the city's target date
     and how far past it the case is, the closure reason if closed, and the council district;
   - for an open case: "Historically, of similar cases still open after N days, X in 100
     closed in the following 14 days", with the number of similar cases;
   - a **copyable summary** (the short evidence brief): the case facts, the service's median
     among closed cases next to the estimate including open cases, the historical line, data
     date and source, one request that fits the situation, and the city council page link.
2. **Cambridge** (new section, before the method). Cambridge's Commonwealth Connect requests
   (`data.cambridgema.gov`, dataset `2z9k-mv9g`), same cohort window, same estimators: an issue
   type picker, the median among closed cases next to the estimate including open cases, and
   how many are still open. Shown as its own city, never pooled with Boston or ranked against it.

The request in the summary follows the case:

| Situation | Request |
| --- | --- |
| Open and past target | Please give a completion date for this case. |
| Open, not yet due | Please confirm it is still on track for the target date. |
| Closed as Transitioned | Please confirm which agency now has this case. |
| Closed as Noted | Please confirm what was decided on this request. |
| Closed any other way | No request; the summary says the case is closed. |

## Not built (cut)

- The five-card "What Boston could report" section, `fetchServiceOnTime` and the
  "Who can act" columns. Dropped by the team.
- The district view for councilors. After the deadline, if at all.

## Data and logic

- `src/lib/stats.ts`: new `conditionalClose(curve, ageHours, windowHours, horizonHours)` =
  `1 − S(age + window) / S(age)` from an existing `kaplanMeier()` result. Returns `null` when
  `age + window` passes the longest observed wait or nothing is still open at that age. No
  existing estimator changes.
- `src/lib/boston311.ts`: `parseCaseId(input)` (trim, upper-case, then strict
  `^BCS-\d{8}$`, else `null`) and `fetchCase(caseId)`, which only runs on a parsed ID and
  requests no address fields.
- `src/lib/cambridge311.ts`: issue-type counts, rows for one type, extract cutoff, and
  `toCambridgeObservations()`. Open or Acknowledged = still open, censored at the cutoff;
  Closed or Archived with a close time = closed. Closed or Archived without a close time are
  left out and counted on screen (87 in the cohort). Open tickets that also carry an earlier
  close time stay open (11).
- Similar cases = cases of the same service observed past the case's age (open or not yet
  closed at that age). Fewer than 30 → no figure, say why.

## Wording rules (new steering file `.kiro/steering/claims.md`)

- "Historically, X in 100 similar cases closed…", never "your case will…". No promises, no
  blame, no causal claims about why a case or district is slow.
- Compare the "median among closed cases" with the "estimate including open cases". Never call
  the first one the city's figure or method.
- "Closed as Noted (no action required) or Transitioned (reassigned to another agency)", never
  that those cases were unfixed.
- Past-target counts are a snapshot: no denominators, no neighborhood or income comparisons.
- Waits beyond about 115 days are outside what the data can show; say so instead of guessing.
- Show only the case the resident typed. No other residents' details; no address fields.
- Cambridge: label its source; never pool it with Boston or rank the two cities.

## Kiro strategy

| Kiro feature | Job |
| --- | --- |
| Check script, first | `scripts/check_make_the_case.py` is written and run before any feature code, and run again at the end against the rendered page |
| Spec | `.kiro/specs/make-the-case/` (requirements in SHALL form, design, tasks) before code |
| Steering | `.kiro/steering/claims.md`, `inclusion: fileMatch` on `src/components/**` and `docs/**` |
| Hooks | `.kiro/hooks/`: claim lint on save of `src/**` or `docs/**`; `npm test` on save of `src/lib/**`; accessibility review on save of `src/components/**` |
| Property tests | `conditionalClose` stays in [0, 1], never falls as the window grows, and matches the curve exactly; `parseCaseId` only ever returns a well-formed ID |
| Cross-check | TypeScript `conditionalClose` against the script's independent Python on the committed fixture |
| Skills | `frontend-a11y`, `tufte-data-viz`, `make-interfaces-feel-better`, `web-design-guidelines` review the new sections |

## Acceptance checks

- `npm test`, `npm run build`, `npm run lint` pass; `python3 scripts/refresh_numbers.py
  --lint-only` reports 0; `python3 scripts/check_make_the_case.py` reports 0 failures.
- Figures read off the rendered page match the script (`--compare`), and the existing figures
  still match `data/numbers.json` (Street Light Outage: 14.50 d including open cases).
- A malformed ID never reaches the network; a well-formed unknown ID says it was not found.
- Keyboard: the ID field, the lookup button, the copy button and the Cambridge picker are
  reachable and labelled; copying is announced through `aria-live`.
- Works at 390 px wide with no horizontal scroll.
