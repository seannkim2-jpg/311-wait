---
inclusion: always
---

# Data facts and claim guardrails

**The authority on every number is [`data/numbers.json`](../../data/numbers.json)**, with a
readable copy in [`docs/research/NUMBERS.md`](../../docs/research/NUMBERS.md). Both are generated
by `python3 scripts/refresh_numbers.py`, which re-pulls the live data, self-checks it, and fails
if a live doc uses a claim below. Do not type figures from memory; read them from that file or
rerun the script. Figures here are from the run at 2026-10-24 18:45 UTC.

## Build priority

Push a **working slice to `main` early**, before polishing: pick a service → see the wait
(closed-only median vs estimate including open cases) and the open cases → see where they are
on the map. Then test the deployed site on a phone, signed out. One reliable map that answers
one question beats extra layers.

## Wording rules (sources: `docs/research/claim-check.md`)

- Compare the **median among closed cases** with the **estimate including open cases**.
  Never call the first "the city's method", "the city's figure" or "city-style".
- Do not say Boston's on-time rate is computed only over closed cases. Nothing documents how
  it is computed, CityScore lists only per-service on-time measures, and Boston publishes no 311
  median.
- `Noted` = "no action is required"; `Transitioned` = "reassigned to another agency" (311 data
  dictionary). Say **closed as Noted or Transitioned**, never that those cases went unfixed.
  A transitioned case may have been handled by the other agency; the data can't show it.
- Count "past target" from `target_close_date` < extract cutoff, **not** from `on_time`. The
  flag lags for open cases: 384 open cases past target still read ONTIME (324 Street Light).
- "Open" means `case_status = 'In progress'` (7,876). 18 more cases sit in `Create` or
  `Needs Reallocation`; leave them out and say so if asked.

## Cohort

The resource starts in 2025-08 but early months hold only cases that stayed open (Sep-2025 418
cases vs Sep-2026 15,573), so they are selected on survival. **Every query uses
`open_date >= 2026-07-01`**: n = 56,797, longest observable wait about 115 days. Long-wait
callouts from before that restriction are artifacts; do not use them.

**Censor open cases at the extract cutoff** (`fetchExtractCutoff()` in `src/lib/boston311.ts`,
the latest timestamp in the data), not at `Date.now()`. The city refreshes the extract about
daily; "now" pads every open case's wait. Fixing this moved Street Light from 14.67 to 14.50 d.

| Measure | Value |
| --- | --- |
| Cases opened since 2026-07-01 | 56,797 |
| Closed / still open | 48,903 / 7,876 |
| Still open **and** past the city's target date | **6,624** |
| Closed as `Noted` or `Transitioned` | **11,701 of 48,903 = 23.9%** |
| On time among closed / counting open-and-past-target as late | 86.5% / 76.2% |

## Headline services (days)

| Service | City target | Still open | Median, closed only | Estimate incl. open | Resolved | Noted/Transitioned | Still open at 115 d |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Litter & Debris | 1 | 4.1% | 0.40 | 0.45 | 80.1% | 16.4% | 3.5% |
| Pothole | 1 | 21.9% | 1.83 | 3.08 | 64.4% | 16.0% | 19.5% |
| Street Light Outage | 14 | 37.9% | 4.74 | **14.50** | 70.6% | 7.0% | 22.4% |
| Sidewalk Repair | 1 | 70.2% | 0.86 | **not reached** | 17.8% | 14.0% | **68.2%** |

Sidewalk Repair is the strongest case: target one day, seven in ten still open, so no median
exists. Litter & Debris (1.13×) is the control showing the method does not inflate everything.
Other large gaps worth knowing: Pruning Request 1.23 → 19.82 d, Illegal Graffiti 1.93 → 11.78 d,
Tree or Stump Removal 2.11 → 10.74 d.

## Required caveats, on screen

- Kaplan–Meier assumes open cases are independent of eventual close time. If the city defers
  hard cases, the estimate is **optimistic**; the truth is slower.
- Nothing here speaks to waits longer than ~115 days.
- "6,624 open cases past their target" is a count at one moment, not a rate. No denominator.
- The income-gradient story is disproven. Do not reintroduce it. No causal claims.
