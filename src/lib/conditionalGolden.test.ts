/**
 * Cross-check: conditionalClose() against the separately written Python in
 * scripts/check_make_the_case.py (its own Kaplan-Meier, standard library only), on the real
 * cohort fixture. Regenerate the expected grid with `python3 scripts/check_make_the_case.py --golden`.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { COHORT_START, toObservations, type CaseRow } from './boston311'
import { conditionalClose, kaplanMeier } from './stats'

const here = dirname(fileURLToPath(import.meta.url))
const read = (f: string) => JSON.parse(readFileSync(join(here, '__fixtures__', f), 'utf-8'))
const golden = read('conditional-golden.json') as {
  censorAtUtc: string
  services: Record<string, { n: number; maxHours: number; grid: { ageDays: number; windowDays: number; chance: number | null }[] }>
}
const cases = read('cohortCases.json') as Record<string, CaseRow[]>
const cohortStart = Date.parse(`${COHORT_START}T00:00:00Z`)
const opened = (r: CaseRow) => Date.parse(r.open_date.trim().replace(' ', 'T').replace(/\+00$/, 'Z'))

describe('conditionalClose matches the independent Python check on the real cohort', () => {
  for (const [service, want] of Object.entries(golden.services)) {
    it(`${service}: ${want.grid.length} age × window cells`, () => {
      const rows = cases[service].filter((r) => opened(r) >= cohortStart)
      const obs = toObservations(rows, Date.parse(golden.censorAtUtc))
      expect(obs.length).toBe(want.n)
      const horizon = obs.reduce((m, o) => Math.max(m, o.hours), 0)
      // JS dates keep milliseconds, Python keeps microseconds: horizons agree to ~1e-6 h.
      expect(horizon).toBeCloseTo(want.maxHours, 5)
      const km = kaplanMeier(obs.map((o) => ({ hours: o.hours, event: o.cause !== 0 })))
      for (const cell of want.grid) {
        const got = conditionalClose(km, cell.ageDays * 24, cell.windowDays * 24, horizon)
        if (cell.chance === null) expect(got, `${cell.ageDays}d/${cell.windowDays}d`).toBeNull()
        else expect(got, `${cell.ageDays}d/${cell.windowDays}d`).toBeCloseTo(cell.chance, 9)
      }
    })
  }
})
