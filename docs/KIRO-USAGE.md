# How we used Kiro

Submission write-up. Fill each section as it happens — judges score "Implementation"
almost entirely from this document plus the contents of `/.kiro`.

## Tools

Which Kiro tools did we use — IDE, CLI, Web, Crew? How did they differ?

- **Kiro Web (Vibe mode, Claude Opus 5.5), 2026-10-24.** Planned and built the whole UI
  (`src/App.tsx`, `src/components/**`, `src/data/**`) on branch `wait-audit-ui`. Kiro found
  the repo, wrote the look-and-feel plan (`docs/UI-VISUAL-PLAN.md`), waited for team approval,
  then built it. It checked its own work in a headless browser using the Playwright power:
  screenshots at desktop and phone widths, axe-core with 0 violations, and scripted keyboard
  walkthroughs of the picker.

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

How did we structure the specs in `.kiro/specs/` for Kiro to implement? How did the
spec-driven approach change the process compared with vibe coding?

## Agent hooks

Which workflows did we automate with hooks in `.kiro/hooks/`? What did they save?

## Steering docs

How did `.kiro/steering/` change Kiro's responses? Which strategy mattered most?

## MCP

Which MCP servers did we add in `.kiro/settings/mcp.json`, and what did they make
possible that would otherwise have been hard?

## Property-based testing

What did PBT catch that unit tests missed? Which requirements did we enable it for?

## Powers

Which Kiro powers did we use for bundled best practices? Any third-party tooling we
would not have reached for otherwise?
