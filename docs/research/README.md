# Research record

How the concept was chosen, checked, and corrected. Kept in the repo because the corrections
matter as much as the conclusions — two findings here were killed by fact-checking, and a judge
reading `ANALYSIS.md` should be able to see that work rather than take it on trust.

The authority on the numbers is [`NUMBERS.md`](NUMBERS.md) / [`../../data/numbers.json`](../../data/numbers.json),
regenerated from live data by `python3 scripts/refresh_numbers.py`. Kiro loads
`.kiro/steering/data-facts.md` in every session, which points there. Everything else here is
the dated trail that produced it.

| File | What it is |
| --- | --- |
| [`NUMBERS.md`](NUMBERS.md) | **Authoritative, generated.** Every figure for every service with 200+ cases. Do not edit by hand. |
| [`claim-check.md`](claim-check.md) | What the city does and doesn't document about on-time rates, `on_time`, `Noted` and `Transitioned`, and the wording that follows. |
| [`311-corrected-numbers.md`](311-corrected-numbers.md) | Cohort-restricted figures after the extract defect was found. Superseded by `NUMBERS.md`; its "not fixed" wording is withdrawn (see `claim-check.md`). |
| [`311-first-pass-facts.md`](311-first-pass-facts.md) | First pass. **Headline figures superseded** — kept because it records the disproven income-gradient claim. |
| [`statistical-plan.md`](statistical-plan.md) | The survival-analysis design and why censoring is the crux. |
| [`kiro-redteam.md`](kiro-redteam.md) | Kiro as hostile judge and working statistician. Independently flagged the left-truncation problem and the competing-risks error. |
| [`kiro-concept-sweep.md`](kiro-concept-sweep.md) | Six concepts across four Civic Action challenges, ranked. |
| [`kiro-product-definition.md`](kiro-product-definition.md) | Screens, numbers, interactions, video beats. |
| [`product-definition.md`](product-definition.md) | Long-form version Kiro wrote alongside the spec. |
| [`kiro-transit-critique.md`](kiro-transit-critique.md) | The earlier MBTA direction, before the pivot. |
| [`civic-portal-inventory.md`](civic-portal-inventory.md) | All 22 Civic Action datasets with source URLs and columns. |
| [`briefs/`](briefs/) | The exact prompts given to Kiro, so its output can be judged against its instructions. |

## Two things that were wrong and got caught

**An invented statistic.** The first concept recommendation pitched "street light outages take a
median of 13 days in some neighborhoods versus two in others" and framed the product around an
income gradient. Checking it found no neighborhood near two days, and the slowest medians in
South Boston Waterfront (54 d), Bay Village (52 d), North End (31 d) and Beacon Hill (28 d) —
several of the city's wealthiest areas. The gradient is not in this data. The framing was
dropped and is not claimed anywhere.

**A contaminated extract.** The resource spans 2025-08 to 2026-10, but Sep-2025 holds 418 cases
against Sep-2026's 15,573. Early months retain only cases that stayed open, so they are
selected on survival. Every query now restricts to `open_date >= 2026-07-01`. This invalidated
three long-wait callouts (122, 361 and 449 days) that are no longer used.

Neither error would have survived a judge with the live data, which is why the red-team pass and
the independent re-implementation exist.
