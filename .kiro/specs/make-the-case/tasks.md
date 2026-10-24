# Tasks: make-the-case

Deadline 20:00 ET. One commit per step. Cut order at the bottom.

- [x] **T-1** Check script `scripts/check_make_the_case.py`; first live run passes (MC-01)
- [x] **T-2** Plan `docs/plans/MAKE-THE-CASE.md`; five-card plan removed
- [x] **T-3** This spec (requirements, design, tasks)
- [x] **T-4** Steering `.kiro/steering/claims.md` (`fileMatch` on `src/components/**`, `docs/**`)
- [ ] **T-5** Hooks in `.kiro/hooks/`: claim lint, `npm test` on `src/lib/**`, accessibility review
- [ ] **T-6** `survivalAt` + `conditionalClose` in `stats.ts`; fast-check properties; golden
      cross-check against the script (MC-05)
- [ ] **T-7** `parseCaseId` + `fetchCase` in `boston311.ts`; property test (MC-02, MC-03)
- [ ] **T-8** `cambridge311.ts` + test (MC-08 data)
- [ ] **T-9** `CaseLookup` section: facts, chance, summary, copy (MC-04, MC-06, MC-07)
- [ ] **T-10** `Cambridge` section (MC-08)
- [ ] **T-11** Skills review (`frontend-a11y`, `tufte-data-viz`, `make-interfaces-feel-better`,
      `web-design-guidelines`); axe; 390 px check (MC-10)
- [ ] **T-12** End check: tests, build, lint, claim lint, `check_make_the_case.py` live and
      `--compare` against the rendered page (MC-01, MC-11)
- [ ] **T-13** `docs/KIRO-USAGE.md` entries; pull request into `main`

Cut order: 1. Cambridge issue-type picker (keep "all requests"). 2. Accessibility review hook.
Never cut: the check script, the ID validation, the "historically" wording.
