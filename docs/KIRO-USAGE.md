# How we used Kiro

311 Wait was built in one day by one person working with Kiro and two other AI assistants.
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

- **Kiro Web (Vibe mode, Claude Opus 5.5), 2026-10-24.** Planned and built the whole UI
  (`src/App.tsx`, `src/components/**`, `src/data/**`) on branch `wait-audit-ui`. Kiro found
  the repo, wrote the look-and-feel plan (`docs/UI-VISUAL-PLAN.md`), waited for team approval,
  then built it. It checked its own work in a headless browser using the Playwright power:
  screenshots at desktop and phone widths, axe-core with 0 violations, and scripted keyboard
  walkthroughs of the picker.
- **Kiro Web (Vibe mode), 2026-10-24, closure forecast.** From the team's written plan, Kiro
  wrote `.kiro/specs/closure-forecast/`. It fixed the release gate in the spec and in
  `scripts/train_closure_forecast.py` before running anything, trained and tested the model
  in lifelines, and built the TypeScript reader, its parity tests and the "Already waiting?"
  block. The model did not pass, and Kiro kept it off the page as the plan required. It added
  an ablation showing that the gains at 14 and 30 days came from the estimator form, not from
  neighborhood. Its first run looked like a disaster (Brier score +115%); the cause was that
  lifelines returns a stratified model's predictions grouped by stratum, not in row order.
  The script now evaluates the baseline as a step function itself and checks the result
  against lifelines' own predictions.

## Skills

Twelve agent skills sit in `.kiro/skills/`, each pinned to an upstream commit and shipped with
its licence and a `SOURCE.md`. The team approved the list (`docs/UI-VISUAL-PLAN.md` §1) before
anything was installed. They changed concrete decisions:

- `cartography-geoviz` flagged a raw-count choropleth as "a population map in disguise". The map
  became proportional circles (open now, with a solid past-deadline core) instead.
- `maplibre-source-wiring` → hover and selection use `promoteId` + feature-state.
  `maplibre-cartography` → data layers sit under basemap labels. `maplibre-pmtiles-patterns`
  → a 10 MB Boston-only basemap served as a static file, with no tile server and no key.
- `animate` → strong ease-out curves, transform/opacity only, reduced-motion fallbacks, no
  motion library. `make-interfaces-feel-better` → tabular numbers, 44 px hit areas,
  `scale(0.96)` on press.
- `tufte-data-viz` → no gridlines or legends on the charts; lines are labelled directly.
  `frontend-design` → set the type pairing (Bricolage Grotesque + Public Sans) and the copy voice.
- `frontend-a11y`, plus an axe-core run → the picker uses `aria-disabled` while loading, so focus
  is never lost. Contrast fixes were made where axe measured 4.43:1.

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

## Make the case (case lookup + Cambridge), 2026-10-24

Built in Kiro Web (Vibe mode, Claude Opus 5.5) on branch `make-the-case`, one commit per step.
The team dropped the five-card "What Boston could report" plan in favour of this one.

| Kiro feature | What it did | Commit |
| --- | --- | --- |
| **Check script first** | `scripts/check_make_the_case.py` was written and run before any feature code. It uses its own standard-library Kaplan–Meier and rechecked the six "chance of closing in the next 14 days" figures in the proposal, which came from an unchecked run. All six reproduced (4, 1, 25, 8, 16 and 2 in 100, each resting on at least 137 cases). It also confirmed that 0 case IDs break `^BCS-\d{8}$` and that the live single-case lookup works. It then found that Cambridge's data now has a real close time, so Cambridge needs no last-updated proxy. | `1216103` |
| **Plan** | `docs/plans/MAKE-THE-CASE.md` replaced `SOLUTION-HOME.md`. Every figure in it comes from the script. | `0ea224e` |
| **Spec** | `.kiro/specs/make-the-case/`: 11 SHALL requirements (MC-01 to MC-11), the design and the tasks, committed before any code. Tasks were ticked off in the same commit as each step. | `878fa7d` |
| **Steering** | `.kiro/steering/claims.md` (`inclusion: fileMatch` on `src/components/**` and `docs/**`) holds the advocacy wording: "historically", no promises or blame, no causal claims or rankings, Noted/Transitioned named, Cambridge labelled and never pooled. It loads only when copy is being written. | `57bfc3d` |
| **Hook: claim lint** | `.kiro/hooks/claim-lint-on-save.json`. When a file under `src/` or `docs/` is saved, run `refresh_numbers.py --lint-only` and fix the wording, never the lint. Every commit on this branch passed with 0 problems. | `259491c` |
| **Hook: tests on `src/lib`** | `.kiro/hooks/tests-on-lib-save.json`. When `src/lib/**` is saved, run `npm test` and fix the code, not the properties. | `259491c` |
| **Hook: accessibility review** | `.kiro/hooks/a11y-review-on-component-save.json`. When a component is saved, review keyboard access, labels, live regions, contrast and 390 px width using the `frontend-a11y` skill. | `259491c` |
| **Property-based testing** | `conditionalClose` stays in [0, 1], never falls as the window grows, equals `1 − S(age+window)/S(age)` read off the same curve exactly, and equals `1 − S(window)` at age 0. `parseCaseId` returns only well-formed IDs across 2,000 arbitrary strings and rejects injection payloads. Cambridge row accounting balances. The summary wording never predicts the case and makes at most one request. | `72bb776`, `8ca217e`, `5620929`, `6b18477` |
| **Cross-implementation test** | `conditionalGolden.test.ts`: TypeScript `conditionalClose` matches the script's independent Python to 1e-9 on 84 age × window cells of the real cohort. | `72bb776` |
| **Skills** | `web-design-guidelines` (fetched the live rules) led to the placeholder ellipsis, `translate="no"` on case IDs, hover states, scroll padding under the sticky header and explicit select colours. `frontend-a11y` led to labelled controls, `aria-describedby` errors and one short `aria-live` status line instead of re-reading the whole block. `make-interfaces-feel-better` set 44–48 px hit areas and `scale(0.96)` on press. `tufte-data-viz` kept the comparison to two directly labelled bars. | `c6f1e24` |
| **End check** | `check_make_the_case.py --compare` fetches each case shown on the built page and recomputes its chance and similar-case count independently. Five cases, three Cambridge views and four hero figures all matched (`data/make-the-case-page.json`). In the same pass axe found 0 violations, and the page was 390 px wide at 390 px with no horizontal scroll. | `5d09675` |

What testing changed on this branch:

- **fast-check corrected a property, not the code.** The first injection property listed a
  newline. fast-check showed `"\nBCS-00000000"` correctly trims to the clean ID, so the
  property was wrong. Whitespace handling was already covered by the trimming property.
- **The end-to-end comparison caught a wording mismatch.** The page said "still open after 33
  days" but computed the chance at 33.8 days. The figure is now read at the whole day count the
  sentence states, and the script does the same, so the words and the number describe the same
  group of cases.
- **Hooks in Kiro Web.** Kiro Web stores hooks but does not run them, so in this session each
  hook's command was run by hand at every step. The hook files fire in the Kiro IDE and CLI V3.

## Answers to the judging questions

**Which Kiro tools, and how they differed.** We used three Kiro surfaces, each for the job it
suited best. The **CLI** worked well for long research and statistics sessions run from the repo
root. It also works as a scriptable reviewer, because `scripts/check-with-kiro.sh` runs it
non-interactively before merges. The **autonomous agent** handled a well-bounded planning task
(the UI plan and licence check) and opened a PR on its own. **Kiro Web (Vibe mode)** handled the
interactive UI and feature work. There we could approve a plan, then watch Kiro build and check
it in a headless browser in the same session. The trade-off we hit is that Kiro Web stores hooks
but does not fire them (see below).

**Spec-driven vs vibe coding.** Every non-trivial feature got a spec under `.kiro/specs/`
(`service-wait-audit`, `make-the-case`, `closure-forecast`), committed before any code. Each one
followed the same order: a check script, then requirements as numbered SHALL statements, then the
design, then tasks ticked off in the commit that does them. Vibe mode was still useful, but for
exploration and visual polish rather than statistics. The difference was clearest when something
went wrong. A spec let us say *which requirement* was wrong (the fast-check counterexample, the
closure-forecast release gate) and fix it in one place. With vibe coding, the same error would
have been an argument in a chat that the next session forgets.

**Agent hooks.** Three `PostFileSave` hooks encode our three non-negotiables. `claim-lint-on-save`
keeps the copy inside the sourced wording. `tests-on-lib-save` reruns the 164 tests and forbids
loosening a property to pass. `a11y-review-on-component-save` reviews keyboard access, labels,
contrast and 390 px width. Each prompt says what *not* to do (don't weaken the lint, don't relax
a tolerance), because that is where an agent cuts corners. Kiro Web doesn't execute hooks, so in
those sessions each hook's command was run by hand at every step. The hooks fire as written in
the IDE and CLI.

**Steering strategy.** The biggest gain came from turning *corrections* into steering instead of
chat messages (`data-facts.md`). After that came pointing steering at a generated file
(`data/numbers.json`) rather than hand-typed numbers. Third was **conditional inclusion**:
`claims.md` loads only when `src/components/**` or `docs/**` is being edited, so wording rules
don't crowd the context during statistics work.

**MCP and Powers.** The **Playwright power** (which bundles the Playwright MCP server) let Kiro
check its own UI in a real browser, something it can't do from source code alone. Kiro took
desktop and 390 px screenshots, ran axe-core, scripted keyboard walkthroughs and typed real case
IDs into the live lookup. The **github-cli power** handled branches, PRs and merges from Kiro Web
through `gh api`. The twelve **agent skills** in `.kiro/skills/` (above) bundled outside expertise
we would not otherwise have applied, from cartography to Tufte-style charts. Each one changed a
specific, recorded decision.

**Property-based testing.** PBT is enabled for every statistical invariant: survival curves in
[0, 1] and non-increasing, incidences summing to one, `conditionalClose` monotone in the window.
It also covers input safety (`parseCaseId` across 2,000 arbitrary strings) and copy rules (the
summary never predicts the case). PBT found two errors that unit tests would have missed, both in
our *specification*, not in Kiro's code (see above).

## Pre-submission check, 2026-10-24

Kiro Web (Vibe mode, Claude Opus 5.5), using the Playwright power, went through the rules page
line by line against the repo and the live site:

- `npm ci`, `npm test` (164 passing), `npm run lint` and `npm run build` all pass from a clean
  clone. `/.kiro` is committed and not in `.gitignore`. The repo is public.
- On the live site Kiro typed the README's test case IDs into the lookup, switched to Cambridge,
  and loaded the page at 390 px (no horizontal scroll). The console showed no errors.
- **Found and fixed:** after a malformed case ID, the hidden screen-reader status line still
  announced the previous "Found …" result. `CaseLookup` now clears it.
- Wrote `docs/SUBMISSION.md`, which has copy-ready form text, testing steps and a 3-minute video
  plan.
