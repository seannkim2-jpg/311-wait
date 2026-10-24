# Tasks: closure-forecast

- [x] **F-01** Spec: requirements, design, tasks (this folder)
- [x] **F-02** `scripts/train_closure_forecast.py`: pull by month, clean, count exclusions (REQ-F01)
- [x] **F-03** KM baseline and stratified Cox, same conditional quantity (REQ-F02)
- [x] **F-04** Held-out test on 1–17 September at N = 0, 14, 30; Brier, calibration bands, major
      services (REQ-F03). Also a service-only Nelson–Aalen ablation and bootstrap intervals
- [x] **F-05** Fixed gate; proportional-hazards checks before any coefficient is read (REQ-F04).
      **Result: not released** (1.3% Brier gain, 5% required); see `docs/ANALYSIS.md`
- [x] **F-06** Refit on the full cohort, export `public/model/boston-closure-forecast.json`, and
      check that the exported numbers reproduce lifelines (REQ-F05)
- [x] **F-07** `src/lib/closureForecast.ts` reader and `closureForecast.test.ts` parity, fallback
      and property tests (REQ-F06, REQ-F08)
- [x] **F-08** `AlreadyWaiting.tsx` in `Hero.tsx`: days input with presets and the service-wide
      figure; the neighborhood select only when the artifact's gate passed, or with
      `?forecast=preview` (REQ-F07)
- [x] **F-09** Motion: staggered hero entrance, comparison bars that grow in on first paint
      (CSS transitions don't run on mount), restaggered stats on a new service, tweened
      percentages, and one-time section-heading reveals. All with reduced-motion variants
- [x] **F-10** Checked in headless Chromium at 1280 px and 390 px with reduced motion: axe
      wcag2a/aa reported 0 violations, no horizontal overflow
- [x] **F-11** `docs/ANALYSIS.md` and README method notes
- [ ] **F-12** Separately, with its own pre-registered test: should the service-wide figure use
      Nelson–Aalen? It did better at 14 and 30 days in this test (see ANALYSIS.md)
