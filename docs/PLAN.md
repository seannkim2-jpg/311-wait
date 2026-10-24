# Build plan

Hackachusetts 2026 · Civic Action track · submission 8:00 PM Eastern, 24 October 2026.

## What we are building

**311 Wait** — a one-page, browser-only statistical audit of Boston 311 that shows how far
a median taken over closed cases only understates what residents waiting on open cases
experience. No login,
no backend, no API key. It queries the city's live open-data endpoint from the browser and runs
the statistics on the page.

Next extension: [`plans/MAKE-THE-CASE.md`](./plans/MAKE-THE-CASE.md): a case lookup that
tells a resident where their request stands and gives them a summary to send, plus Cambridge.
It replaces the earlier five-card "What Boston could report" plan, which was dropped.

Full statistical detail: [`ANALYSIS.md`](./ANALYSIS.md). Spec:
[`.kiro/specs/service-wait-audit/`](../.kiro/specs/service-wait-audit/).

## Division of work

Three agents on one repository. The split keeps a hard boundary between whoever writes the
statistics and whoever checks them.

| Agent | Owns | Does not touch |
| --- | --- | --- |
| **Kiro (desktop IDE + CLI)** | `src/lib/stats.ts`, `src/lib/stats.test.ts`, `.kiro/specs/**` | `scripts/reference_impl.py` |
| **Claude Code (this workspace)** | `src/lib/boston311.ts`, `scripts/reference_impl.py`, `docs/**`, verification | `src/lib/stats.ts` |
| **Website chat (separate session)** | `src/App.tsx`, `src/components/**`, `src/index.css` | `src/lib/**` |

The statistics module and its Python reference are written by different agents on purpose. If
both land on the same numbers, that is real evidence of correctness; if one agent wrote both,
it is only evidence of consistency.

## Status

- [x] Concept selected and red-teamed
- [x] Live endpoint verified keyless and CORS-open
- [x] Cohort window diagnosed and fixed (`open_date >= 2026-07-01`)
- [x] Python reference implementation + golden fixtures
- [x] Data access layer (`src/lib/boston311.ts`)
- [ ] Statistics module + property-based tests — *Kiro, in progress*
- [ ] Spec revision for cohort + competing risks — *Kiro, in progress*
- [ ] UI — *website chat*
- [ ] `KIRO-USAGE.md`
- [ ] Vercel deploy
- [ ] Demo video under 3 minutes

## Schedule

| Window | Work | Owner |
| --- | --- | --- |
| 12:30–13:30 | Stats module, property tests, spec revision | Kiro |
| 13:00–14:00 | Verify TS against golden fixtures; fix disagreements | Claude Code |
| 13:30–16:00 | UI: tiles, service picker, KM chart, CIF bar, neighborhood table | Website chat |
| 16:00–16:45 | Honesty furniture and accessibility pass | Website chat |
| 16:45–17:30 | `KIRO-USAGE.md`, README, testing instructions | Claude Code |
| 17:30–18:15 | Vercel deploy, re-pull headline numbers | Claude Code |
| 18:15–19:15 | Record video | Sean |
| 19:15–20:00 | Buffer, submit | Sean |

Cut order if behind: Cambridge panel first, then the log-rank/BH comparison, then the
neighborhood table. **The censoring correction and the competing-risks breakdown are the
floor** — ship those or ship nothing.

## Non-negotiables

- `/.kiro` stays at the repo root and out of `.gitignore`. It is the evidence of Kiro usage.
- No causal claims. No income-gradient framing — it was checked and disproven.
- "Closed" and "resolved" are different words everywhere, in code and in copy.
- Every figure shows `n` and the censored count. Cells below n = 30 are suppressed.
- The independent-censoring caveat appears in the UI, not only in the README.
- Numbers get re-pulled before the video. They move as the city works cases.

## Screen

One scrolling page.

Above the fold: extract timestamp · three stat tiles (6,624 open past target · 23.9% closed as
Noted or Transitioned · the gap in days) · service picker driven by the data, not a hardcoded
list · Kaplan–Meier curve against the naive median with a confidence band.

Below: competing-risks bar (resolved / Noted or Transitioned / still open) · neighborhood table with
Wilson intervals and suppressed small cells · methodology and caveats in the main flow ·
optional Cambridge panel, clearly labelled as a proxy.

Default service is Street Light Outage, for the clean 3.06x gap against a 14-day target. Sidewalk Repair is featured
separately as the case where the metric breaks entirely.
