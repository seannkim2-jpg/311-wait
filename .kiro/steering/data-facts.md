---
inclusion: always
---

# Data facts and claim guardrails

Verified against the live endpoint on 2026-10-24. These supersede any number you
recall or infer. If a figure you want is not here, query for it rather than guessing.


Computed 2026-10-24 ~16:00 UTC. Everything below is on the **restricted cohort**.

## Why the restriction exists
The resource spans `2025-08-01` to `2026-10-24`, but it is **not a complete record**. Monthly
case counts: Aug-2025 539 · Sep-2025 418 · Oct-2025 775 · Mar-2026 1,787 · May-2026 3,212 ·
Jun-2026 6,067 · **Jul-2026 13,317 · Aug-2026 15,411 · Sep-2026 15,573 · Oct-2026 12,496**
(24 days). A 37x gap between Sep-2025 and Sep-2026 is not real demand growth. The early
months retain only cases that stayed open or were recently touched, so they are **enriched for
slow cases** — left truncation plus selection on survival.

**Cohort = cases with `open_date >= 2026-07-01`.** July through October are internally
consistent at 13–15k/month, so the window looks complete. Max observable duration is ~115 days.

This invalidates the earlier "longest wait" callouts (122d / 361d / 449d) — they came from the
contaminated tail. **Do not use them.** It also means the all-time 7,840 overdue count is
replaced by the cohort figure below.

## Cohort headline counts (n = 56,797)
| Measure | Value |
| --- | --- |
| Cases opened since 2026-07-01 | 56,797 |
| Closed | 48,903 |
| Still open | 7,876 |
| Still open **and** past the city's own target | **6,240** |
| Closed as `Noted` or `Transitioned` (not resolved) | **11,701 of 48,903 = 23.9%** |

The ~23% non-resolution finding **survives** the restriction. It is the most robust number we
have and needs no inference at all.

## Kaplan–Meier vs naive closed-only median (the central finding)
Censored = still open, duration measured to the query time.

| Service | n | censored | Naive median | **KM median** | Understatement |
| --- | --- | --- | --- | --- | --- |
| Litter & Debris | 9,839 | 4.1% | 0.40 d | 0.45 d | 1.13x |
| Pothole | 2,214 | 21.9% | 1.83 d | 3.09 d | **1.69x** |
| Street Light Outage | 1,413 | 37.9% | 4.75 d | **14.67 d** | **3.09x** |
| Sidewalk Repair | 2,561 | 70.2% | 0.86 d | **never reached** | metric breaks |

**Sidewalk Repair is the strongest case.** With 70.2% of cases still open, the survival curve
never falls to 0.50 — it ends at S=0.683. A closed-cases-only median says "0.86 days." The
honest statement is that **fewer than half of sidewalk repair cases have ever closed**.

**Litter & Debris is the credibility control.** At 1.13x it shows the method does not simply
inflate everything — it corrects in proportion to how much censoring there is.

## Competing risks: Aalen-Johansen CIF
The red-team was right that `Noted`/`Transitioned` is a **competing event**, not censoring.
Plain KM treating them as censored assumes they would eventually resolve, which is false.
Cause-specific CIF, computed and verified:

| Service | Genuinely resolved | Admin-closed, not fixed | Still unresolved at 115 d |
| --- | --- | --- | --- |
| Litter & Debris | 80.1% | 16.4% | 3.6% |
| Street Light Outage | 70.4% | 7.0% | 22.6% |
| Pothole | 64.4% | 16.0% | 19.6% |
| **Sidewalk Repair** | **17.7%** | 14.0% | **68.3%** |

Aalen-Johansen is barely harder than KM: accumulate `S(t-) * d_cause/at_risk` per cause while
decrementing the shared survival. Implementation confirmed working in ~25 lines.

## Required caveats, to be on screen
- KM assumes cases still open are independent of eventual close time. If the city defers hard
  cases, our estimate is **optimistic** — the truth is slower. Say this.
- The cohort starts 2026-07-01, so nothing here speaks to waits longer than ~115 days.
- "6,240 cases are currently past their deadline" is a prevalence count, not a rate. Do not
  give it a denominator.
- The income-gradient story remains disproven. Do not reintroduce it.
