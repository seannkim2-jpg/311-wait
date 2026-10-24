# How we used Kiro

Wait Audit was built in one day by one person working with Kiro and two other AI assistants.
The approach: Kiro writes the spec and the statistics; a separate assistant writes an
independent reference implementation; the two have to agree. Kiro's numbers and claims were
checked against the live data, and a script now repeats that check on every figure. The places where that check changed something are
the most useful part of this write-up, so each section says what changed.

## Tools

| Tool | What it did |
| --- | --- |
| **Kiro CLI** (`kiro-cli chat`) | Concept sweep, product definition, red-team review, the full spec, the statistics module and its property tests. `scripts/check-with-kiro.sh` also runs the CLI as a read-only reviewer over the repo before merges. |
| **Kiro autonomous agent** (commits as *Kiro Agent*) | Wrote the UI architecture plan, `docs/UI-PLAN.md` (commits `07b5a2e`, `ec99c6e`; PR #2), including a licence check that ruled out `react-leaflet` (Hippocratic-2.1, not OSI-approved). |

The exact prompts are committed in [`docs/research/briefs/`](research/briefs/), next to what
Kiro produced from them in [`docs/research/`](research/), so a reader can compare instruction
and output.

## Spec-driven development

`.kiro/specs/service-wait-audit/` holds `requirements.md` (testable SHALL statements),
`design.md` (data model, estimators, screen) and `tasks.md` (ordered build list), about 1,000
lines in all. Kiro wrote them from the product definition, then **revised them in place** when
the data changed under us:

- **Cohort restriction.** A month-by-month count showed the 311 resource is not a complete
  record before July 2026 (418 cases in Sep-2025 against 15,573 in Sep-2026). Kiro rewrote every
  query in the spec to use `open_date >= 2026-07-01` and recorded why in `design.md`.
- **Competing risks.** The spec first measured "time to resolution" with plain Kaplan–Meier.
  After the red-team pass it was changed to Aalen–Johansen cumulative incidence (below).

The spec mattered most as a contract between agents. Because the requirements were written
down, a second implementation could be built against them independently, and disagreements
could be traced to a specific requirement rather than argued about.

## Steering docs

`.kiro/steering/` has two files, both `inclusion: always`:

- `hackathon.md`: the rules and judging criteria as hard constraints.
- `data-facts.md`: the verified figures, the cohort rule, and claims the data cannot support.

`data-facts.md` exists because Kiro made two factual errors early on. Its first concept pitch
claimed street-light outages take "13 days in some neighborhoods versus two in others" and
framed it as an income gap; the live data did not support either the number or the gap. Its
first spec also carried numbers from an extract we later found
was contaminated. Corrections typed into a chat don't survive into the next session; a
steering file does. After it was added, later sessions started from the corrected figures.
It now points Kiro at `data/numbers.json`, which a script regenerates from live data, instead
of figures typed by hand.

## Property-based testing

`src/lib/stats.test.ts` has 12 fast-check properties written by Kiro: the interval parser
round-trips, the Kaplan–Meier curve is non-increasing and stays in [0, 1], it equals 1 − ECDF
when nothing is censored, Wilson intervals stay in [0, 1] at p = 0 and p = 1,
Benjamini–Hochberg is monotone, and Aalen–Johansen incidences sum to one.

**What PBT caught that unit tests would not:** one requirement was wrong. It said adding a
censored observation after the last event leaves the survival curve unchanged. fast-check
found a one-event counterexample: a subject censored later is still at risk at every earlier
event time, so the curve does change. The requirement was replaced with the invariants that do
hold (no new steps, same event times and counts, at-risk count up by exactly one).

## What changed after testing

| Check | What it found | Who was right |
| --- | --- | --- |
| Kiro red-team (hostile judge + statistician) | Old months in the extract are enriched for slow cases (left truncation); `Noted`/`Transitioned` must be a competing event, not censoring | Kiro. Both became spec changes. |
| Cross-implementation test (`goldenVerification.test.ts`) | The Python reference took the upper middle value for even-sized samples | Kiro's TypeScript. The reference was fixed. |
| fast-check | A property in the requirements was false | fast-check. The requirement was fixed. |
| lifelines 0.30.0 as a third implementation | All Kaplan–Meier medians and Aalen–Johansen incidences agree to six decimals, including Sidewalk Repair, where no median exists | All three agree. |
| `scripts/refresh_numbers.py` | Open cases were being timed to "now" rather than to when the city cut the extract, adding hours to each; Street Light moved from 14.67 to 14.50 days | Fixed in `boston311.ts` and the spec. |
| Independent review of that change | The city's `on_time` flag lags for open cases: 384 open cases past their target still read ONTIME, 324 of them Street Light. Counting by date, 6,624 open cases are past target; the flag alone undercounts | Now computed from `target_close_date`; spec, steering and docs updated. |
| Source check against the city's data dictionary | `Noted` means "no action is required" and `Transitioned` means "reassigned to another agency", so calling those cases unfixed overstated it | Wording corrected everywhere; the script now lints for it. |

Testing caught errors from every side, not only Kiro's: the Python reference, a requirement
written during planning, and an unsourced claim in our own README.
