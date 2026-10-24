/**
 * Cross-implementation check.
 *
 * `scripts/reference_impl.py` is a separately written Python implementation of the same
 * estimators. It ran on the real 2026-07-01 cohort and wrote __fixtures__/golden.json.
 * These tests assert the TypeScript lands on the same numbers. Two implementations written
 * independently agreeing is stronger evidence than either one's own unit tests.
 */
import { describe, it, expect } from 'vitest'
import { kaplanMeier, aalenJohansen, naiveMedian } from './stats'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const read = (f: string) => JSON.parse(readFileSync(join(here, '__fixtures__', f), 'utf-8'))
const golden = read('golden.json')
const cases = read('cohortCases.json')

type Row = { case_status: string; closure_reason: string | null; open_date: string; close_date: string | null }
type GoldenService = {
  n: number
  censored: number
  events: number
  naiveMedianHours: number
  kmMedianHours: number | null
  cifResolved: number
  cifAdminClosed: number
  stillUnresolved: number
}

const QUERY_TIME = Date.parse('2026-10-24T16:00:00Z')
const COHORT_START = Date.parse('2026-07-01T00:00:00Z')
const UNRESOLVED = new Set(['Noted', 'Transitioned'])

function ts(s: string): number {
  const iso = s.trim().replace(' ', 'T').replace(/\+00$/, 'Z')
  return Date.parse(iso.endsWith('Z') ? iso : `${iso}Z`)
}

function observations(rows: Row[]) {
  const out: { hours: number; cause: 0 | 1 | 2 }[] = []
  for (const r of rows) {
    const opened = ts(r.open_date)
    if (opened < COHORT_START) continue
    if (r.case_status === 'Closed' && r.close_date) {
      const hours = (ts(r.close_date) - opened) / 3_600_000
      if (hours < 0) continue
      out.push({ hours, cause: UNRESOLVED.has(r.closure_reason ?? '') ? 2 : 1 })
    } else if (r.case_status === 'In progress') {
      const hours = (QUERY_TIME - opened) / 3_600_000
      if (hours >= 0) out.push({ hours, cause: 0 })
    }
  }
  return out
}

describe('TypeScript matches the Python reference on the real cohort', () => {
  for (const [service, want] of Object.entries(golden.services as Record<string, GoldenService>)) {
    const rows = (cases as Record<string, Row[]>)[service]
    if (!rows) continue

    it(`${service}: counts, naive median, KM median, and CIF`, () => {
      const obs = observations(rows)
      expect(obs.length).toBe(want.n)
      expect(obs.filter((o) => o.cause === 0).length).toBe(want.censored)
      expect(obs.filter((o) => o.cause !== 0).length).toBe(want.events)

      const events = obs.filter((o) => o.cause !== 0).map((o) => o.hours)
      expect(naiveMedian(events)).toBeCloseTo(want.naiveMedianHours, 3)

      const km = kaplanMeier(obs.map((o) => ({ hours: o.hours, event: o.cause !== 0 })))
      if (want.kmMedianHours === null) {
        expect(km.median).toBeNull()
      } else {
        expect(km.median).toBeCloseTo(want.kmMedianHours, 3)
      }

      const aj = aalenJohansen(obs)
      expect(aj.final1).toBeCloseTo(want.cifResolved, 5)
      expect(aj.final2).toBeCloseTo(want.cifAdminClosed, 5)
      expect(aj.stillUnresolved).toBeCloseTo(want.stillUnresolved, 5)
    })
  }

  it('cumulative incidences and the unresolved share sum to 1', () => {
    for (const service of Object.keys(golden.services)) {
      const rows = (cases as Record<string, Row[]>)[service]
      if (!rows) continue
      const aj = aalenJohansen(observations(rows))
      expect(aj.final1 + aj.final2 + aj.stillUnresolved).toBeCloseTo(1, 9)
    }
  })
})
