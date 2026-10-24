# How Kiro was used — paste into the form

Kiro was part of the build, not just the final review. I used **Kiro CLI** to explore concepts, check the public data, red-team the statistical framing, write the first feature spec and implement the statistics with property-based tests. I used a **Kiro autonomous agent** for the UI architecture plan, and **Kiro Web** to plan and build the interface, case lookup, Cambridge view and closure calculator. The Web sessions could inspect rendered pages and run browser checks; CLI was useful for repository-wide reasoning and repeatable review from the terminal. The committed briefs, plans, specs and Kiro-authored commits show the sequence. I did not rely on Kiro IDE or Crew for this entry, so I do not claim work from them.

## Specs shaped the build

The three folders under [`.kiro/specs/`](../.kiro/specs/) contain requirements, design and ordered tasks for the service wait audit, case lookup, and closure forecast. Kiro wrote testable requirements before implementation. A data check showed that pre-July 2026 Boston rows were selected toward long-running cases, so the spec restricted the cohort to requests opened from July 1. A red-team pass changed the closure analysis to Aalen–Johansen competing risks: treating Noted and Transitioned as censoring would imply those cases might later resolve in the same workflow. The written spec let a separate Python implementation challenge the TypeScript results. Compared with ad-hoc vibe coding, the spec made the assumptions and failure conditions reviewable before UI work began. Kiro Web's Vibe mode was then effective for visual iteration against those constraints.

## Steering and hooks

Always-loaded [steering](../.kiro/steering/) carries the hackathon rules and verified data facts. A file-match steering document adds careful claim wording when editing components and docs. This mattered after early generated copy overstated a neighborhood income gap and treated a closed-case statistic as an official city figure. Later sessions read the corrected cohort, source-backed wording, and generated numbers instead of relying on chat memory.

Three committed [agent hooks](../.kiro/hooks/) cover common review steps: a source or docs save runs the claim lint, a `src/lib` save runs tests, and a component save requests an accessibility review. Kiro Web stored but did not execute those hooks during the Web sessions, so their checks were run manually there. The hook files are intended to automate the same checks in Kiro IDE or CLI V3; I do not count the Web runs as automatic hook executions.

## Tests, powers, and integrations

Kiro wrote fast-check properties for survival curves, probability bounds, interval parsing, case-ID validation, and calculator behavior. One generated property was itself wrong: adding a later censored case *does* change earlier risk sets. The smallest counterexample led to a corrected requirement. A separate Python reference and lifelines check caught other errors, including an even-sized median bug in the reference implementation. The case lookup and calculator also have cross-implementation checks and a release gate for an offline forecast model. The neighborhood model missed that gate and remains off the page.

Kiro Web used its **Playwright power** for desktop and phone screenshots, keyboard walkthroughs and axe accessibility checks. The repository also includes pinned Kiro skills in [`.kiro/skills/`](../.kiro/skills/); cartography, accessibility and data-visualization guidance changed the map, controls and chart presentation. There is **no project MCP server configured** in `.kiro/settings/`, and I do not claim an MCP integration. Public Boston and Cambridge data are fetched through the app's own code and check scripts.

The detailed development record, including concrete corrections and commit references, is in [`docs/KIRO-USAGE.md`](../docs/KIRO-USAGE.md). Other AI assistants contributed independent checks and repository fixes, as the README discloses; Kiro's role is documented in the committed specs, steering, hooks, plans, tests and implementation history.
