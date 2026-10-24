# Kiro task: revise the spec, then implement the statistics module

Read `.context/311-corrected-numbers.md` and `.context/kiro-redteam.txt` first. The corrected
numbers file **supersedes** any figure in `.context/311-verified-facts.md`.

## Part 1 — revise `.kiro/specs/service-wait-audit/{requirements,design,tasks}.md` in place
A previous attempt was interrupted before writing, so the files still contain stale numbers.
Four changes:
1. Every query restricts to `open_date >= '2026-07-01'`. Explain why in the design: the
   resource spans 2025-08-01 to 2026-10-24 but is **not a complete record** — Sep-2025 has 418
   cases against Sep-2026's 15,573, so early months retain only cases that stayed open and are
   enriched for slow ones. That is left truncation plus selection on survival.
2. Replace stale headline numbers with the corrected cohort values. Drop the 122-day, 361-day
   and 449-day callouts entirely; they were artifacts.
3. Add **Aalen-Johansen competing-risks CIF** as a first-class requirement beside Kaplan-Meier,
   because `Noted`/`Transitioned` is a competing event and not censoring. Per the red-team, the
   closure-reason panel becomes the PRIMARY framing and KM is the supporting evidence.
4. Default the service picker to Street Light Outage for its clean 3.09x number, and feature
   Sidewalk Repair as the case where the metric breaks entirely. Add the independent-censoring
   caveat as on-screen UI copy, not a README line.

## Part 2 — implement `src/lib/stats.ts`
Pure TypeScript, no runtime dependencies, no React, no fetch. Exported functions:

- `parsePgInterval(s: string): number` — hours. Postgres interval strings arrive as
  `"13 days, 12:33:42.319741"`, `"1 day, 00:00:01"`, or bare `"9:32:19.776794"`. Handle the
  singular/plural `day`/`days` split and an optional fractional seconds part. Throw on garbage.
- `naiveMedian(hours: number[]): number` — the closed-cases-only median we are criticising.
- `kaplanMeier(obs: {hours: number, event: boolean}[])` — returns the step curve as
  `{t, s, atRisk, events}[]`, the median or `null` when `S` never reaches 0.5, and a Greenwood
  variance standard error per step so the UI can draw a confidence band.
- `aalenJohansen(obs: {hours: number, cause: 0|1|2}[])` — `0` censored, `1` resolved,
  `2` administratively closed. Returns per-cause cumulative incidence curves and the final
  incidence for each cause, plus the share still unresolved.
- `wilson(successes: number, n: number, z?: number)` — score interval, must stay inside
  `[0,1]` at `p=0` and `p=1`.
- `logRank(a, b)` — chi-square statistic on 1 df and a p-value.
- `benjaminiHochberg(p: number[]): number[]` — adjusted p-values, monotone, never below input.

## Part 3 — implement `src/lib/stats.test.ts` using vitest and fast-check
Property-based tests are explicitly graded, so make these real properties, not smoke tests:
- `parsePgInterval` round-trips: generate `{days,h,m,s}`, format both ways, parse back to the
  same total hours.
- `S(t)` is monotonically non-increasing and every value is within `[0,1]`.
- With zero censored observations, KM equals `1 - ECDF` exactly.
- Appending a censored observation beyond the largest event time leaves the curve unchanged.
- Wilson contains the point estimate and stays in `[0,1]`, including at `p=0` and `p=1`.
- BH output is monotone in the input and never below it.
- Aalen-Johansen: the cause incidences plus the still-unresolved share sum to 1 within 1e-9.

Install `vitest` and `fast-check` as devDependencies and add a `test` script. There are golden
values in `src/lib/__fixtures__/golden.json` — a unit test must reproduce them within
tolerance; they came from an independent Python implementation on the real cohort.

Do not build any UI in this task. Report what you changed and what you could not verify.
