---
inclusion: fileMatch
fileMatchPattern: ["src/components/**", "docs/**"]
---

# Claims and advocacy wording

Loaded whenever copy is being written. Sources: `docs/research/claim-check.md`,
`docs/plans/MAKE-THE-CASE.md`. Figures come from `data/numbers.json` and
`data/make-the-case.json`; never type them from memory.

## Comparisons

- Compare the **median among closed cases** with the **estimate including open cases**. Never
  call the first one the city's figure, the city's method, or "city-style".
- Do not say how Boston computes its on-time rate. Nothing documents it.

## Closure reasons

- Say "closed as **Noted** (no action required) or **Transitioned** (reassigned to another
  agency)". Never say those cases were unfixed, unresolved or ignored; a transitioned case may
  have been handled by the other agency.

## Advocacy language (the case lookup and its summary)

- Past tense, about other cases: "**Historically**, X in 100 similar cases still open after N days
  closed in the following 14 days." Never "your case will", "is likely to", "should expect".
- No promises and no blame. The summary asks for one specific, reasonable thing (a completion
  date, confirmation of the agency); it does not accuse anyone.
- No causal claims about why a case, service or district is slow. No neighborhood or income
  comparisons, and no ranking of districts or cities.
- Waits beyond about 115 days are outside what the data covers. Say so; do not extrapolate.
- Show only the case the resident typed. Never show other residents' addresses or case details.
  Never hardcode councilors' names or emails; link to
  https://www.boston.gov/departments/city-council.

## Counts

- "Past target" is a count at one moment, from `target_close_date` against the extract cutoff
  (not the `on_time` flag). No denominators on it, and no rates built from it.
- Suppress any figure resting on fewer than 30 cases, and say why.

## Cambridge

- Name the source (Cambridge Commonwealth Connect, `data.cambridgema.gov`, dataset `2z9k-mv9g`)
  wherever its numbers appear. Never pool it with Boston, chart the two together, or rank them.
- Say how many closed tickets were left out for having no close time.

Check: `python3 scripts/refresh_numbers.py --lint-only` must report 0 problems.
