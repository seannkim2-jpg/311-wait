# The statistical analysis

## The claim

Boston publishes an on-time rate for 311 service requests. That rate, and any median closure
time computed the obvious way, is calculated over **closed** cases. Cases still open are left
out — and the cases still open are disproportionately the slow ones.

That is right-censoring, and dropping censored observations biases the estimate downward. The
correction is the standard one from survival analysis.

## The data

`data.boston.gov`, CKAN resource `254adca6-64ab-4c5c-9fc0-a6da622be185`. 29 columns, including
`open_date`, `close_date`, `target_close_date`, `on_time` and `closure_reason`. No API key, and
it sends `Access-Control-Allow-Origin: *`, so the browser queries it directly and this project
has no backend.

The portal's starter kit ships a 5,000-row extract with 10 columns and no closure timestamps.
The live resource has 75,851 rows. The analysis needs `close_date`, so it uses the live
resource.

### Why the cohort starts 2026-07-01

The resource spans 2025-08-01 to 2026-10-24, but it is **not a complete record of that
period**. Monthly case counts:

| Month | Cases |
| --- | --- |
| 2025-08 | 539 |
| 2025-09 | 418 |
| 2025-10 | 775 |
| 2026-03 | 1,787 |
| 2026-05 | 3,212 |
| 2026-06 | 6,067 |
| 2026-07 | 13,317 |
| 2026-08 | 15,411 |
| 2026-09 | 15,573 |
| 2026-10 | 12,496 (24 days) |

Sep-2026 has 37x the cases of Sep-2025. Boston's 311 volume did not grow 37-fold in a year.
The early months retain only cases that stayed open or were recently touched, which means they
are a sample **selected on survival** — exactly the cases that inflate a duration estimate.
That is left truncation on top of the censoring the analysis is already about.

July 2026 onward is internally consistent at 13–15k cases a month, so the cohort is **cases
with `open_date >= 2026-07-01`**: n = 56,797. Maximum observable duration is about 115 days,
and the app says so rather than implying it can see longer waits.

This restriction invalidated three figures from an earlier pass — "longest wait 122 days / 361
days / 449 days". Those came from the contaminated tail and are not used anywhere.

## Methods

**Kaplan–Meier** for time-to-closure. Events are closed cases timed by `close_date`; cases
still in progress are censored at the query time. Greenwood's formula gives the variance for a
confidence band. Where the survival function never falls to 0.5, the median is reported as
undefined rather than substituted with the largest observed time.

**Aalen–Johansen cumulative incidence** for resolution type. A closure reason of `Noted` or
`Transitioned` means the case was closed without being fixed. That is a **competing event**,
not censoring: treating it as censored would assume such a case would eventually be resolved
given more time, which is false. Cause-specific cumulative incidence separates "genuinely
resolved" from "closed without resolution" without that assumption.

**Wilson score intervals** for on-time proportions, because the normal approximation fails at
proportions near 0 and 1 and several neighborhood-service cells sit there. Cells below n = 30
are suppressed rather than shown with a wide interval.

**Benjamini–Hochberg** correction on any set of group comparisons. With roughly two dozen
neighborhoods, uncorrected pairwise testing would manufacture significance.

## Results

Cohort of 56,797 cases opened on or after 2026-07-01:

| Measure | Value |
| --- | --- |
| Closed | 48,903 |
| Still open | 7,876 |
| Still open and past the city's own target | 6,240 |
| Closed as `Noted` or `Transitioned` | 11,701 of 48,903 — **23.9%** |

### Censoring correction

| Service | n | Censored | Naive median | Kaplan–Meier median | Understatement |
| --- | --- | --- | --- | --- | --- |
| Litter & Debris | 9,839 | 4.1% | 0.40 d | 0.45 d | 1.13x |
| Pothole | 2,214 | 21.9% | 1.83 d | 3.09 d | 1.69x |
| Street Light Outage | 1,413 | 37.9% | 4.75 d | 14.67 d | **3.09x** |
| Sidewalk Repair | 2,561 | 70.2% | 0.86 d | **undefined** | metric breaks |

Sidewalk Repair is the clearest case. With 70.2% of cases still open the survival function
ends at S = 0.683, so fewer than half have ever closed and no median exists. A closed-cases
median reports 0.86 days.

Litter & Debris is the control. At 1.13x it shows the method corrects in proportion to how much
censoring is present rather than inflating everything.

### Competing risks

| Service | Genuinely resolved | Closed, not fixed | Still unresolved at 115 d |
| --- | --- | --- | --- |
| Litter & Debris | 80.1% | 16.4% | 3.6% |
| Street Light Outage | 70.4% | 7.0% | 22.6% |
| Pothole | 64.4% | 16.0% | 19.6% |
| Sidewalk Repair | **17.7%** | 14.0% | **68.3%** |

## Limitations

- **Independent censoring.** Kaplan–Meier assumes cases still open are independent of eventual
  closure time. If the city defers difficult cases, the estimate is *optimistic* and real waits
  are longer than reported. There is no test for this in the data.
- **No causal claims.** The data cannot say why one service or area is slower. Case density,
  street-light ownership (city, utility or private) and contractor routing are all confounded.
- **No income gradient.** An earlier pass proposed an equity-gap framing. Checking it found the
  slowest street-light medians in South Boston Waterfront (54 d), Bay Village (52 d), North End
  (31 d) and Beacon Hill (28 d) — several of the city's wealthiest areas. The gradient is not
  in this data and is not claimed.
- **Prevalence, not a rate.** "6,240 cases are currently past their deadline" is a
  cross-sectional count over cases of differing ages. It has no denominator.
- **Horizon.** The cohort cannot speak to waits beyond about 115 days.

## Verification

`scripts/reference_impl.py` is an independently written Python implementation. It produces
`src/lib/__fixtures__/golden.json` from the real cohort, and `src/lib/stats.test.ts` asserts
that the TypeScript reproduces those values. Two implementations written separately agreeing is
a stronger check than either one's own unit tests.
