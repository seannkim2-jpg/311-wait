/** MC-06 / MC-07: the advocacy wording the case lookup produces, checked on every situation. */
import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { kaplanMeier } from '../lib/stats'
import type { ServiceAudit } from './audit'
import { COUNCIL_URL, MIN_SIMILAR, buildSummary, chanceFor, chanceSentence, countBeyond, requestFor, type CaseState, type CaseView } from './caseLookup'

const DAY = 24
const hours = Array.from({ length: 400 }, (_, i) => (i % 40) * DAY + 3) // 0..39 days
const obs = hours.map((h, i) => ({ hours: h, event: i % 3 !== 0 }))
const audit = {
  service: 'Pothole',
  km: kaplanMeier(obs),
  sortedHours: [...hours].sort((a, b) => a - b),
  cityMedianHours: 30,
  kmMedianHours: 60,
  maxDay: 39,
  cutoff: Date.parse('2026-10-24T09:00:00Z'),
} as unknown as ServiceAudit

const STATES: CaseState[] = ['open-past-target', 'open-on-track', 'open-no-target', 'transitioned', 'noted', 'closed', 'other']

describe('countBeyond', () => {
  it('counts durations strictly greater than the age', () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: 0, max: 100 })), fc.integer({ min: -1, max: 101 }), (xs, age) => {
        const sorted = [...xs].sort((a, b) => a - b)
        return countBeyond(sorted, age) === xs.filter((x) => x > age).length
      }),
    )
  })
})

describe('chanceFor', () => {
  it('suppresses below the floor and past the data, otherwise shows a whole number in 100', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 45 * DAY }), (age) => {
        const c = chanceFor(audit, age)
        if (c.kind === 'shown') return c.similar >= MIN_SIMILAR && Number.isInteger(c.in100) && c.in100 >= 0 && c.in100 <= 100
        if (c.kind === 'too-few') return c.similar < MIN_SIMILAR
        return Math.floor(age / DAY) * DAY + 14 * DAY > audit.sortedHours[audit.sortedHours.length - 1]
      }),
    )
  })

  it('never predicts the resident’s own case', () => {
    for (const age of [0, 5 * DAY, 20 * DAY, 30 * DAY, 44 * DAY]) {
      const s = chanceSentence('Pothole', chanceFor(audit, age))
      expect(s).not.toMatch(/\bwill\b|\blikely\b|\byour case\b|\bshould expect\b/i)
      if (chanceFor(audit, age).kind === 'shown') expect(s).toMatch(/^Historically,/)
    }
  })
})

describe('summary', () => {
  const base = (state: CaseState): Omit<CaseView, 'summary'> => ({
    record: {
      case_id: 'BCS-00000001',
      service_name: 'Pothole',
      case_status: state.startsWith('open') ? 'In progress' : state === 'other' ? 'Create' : 'Closed',
      closure_reason: state === 'transitioned' ? 'Transitioned' : state === 'noted' ? 'Noted' : state === 'closed' ? 'Resolved' : null,
      open_date: '2026-09-01 12:00:00+00',
      close_date: state.startsWith('open') ? null : '2026-09-03 12:00:00+00',
      target_close_date: state === 'open-no-target' ? null : '2026-09-02 12:00:00+00',
      city_council_district: '3',
    },
    state,
    opened: Date.parse('2026-09-01T12:00:00Z'),
    closedAt: state.startsWith('open') || state === 'other' ? null : Date.parse('2026-09-03T12:00:00Z'),
    target: state === 'open-no-target' ? null : Date.parse('2026-09-02T12:00:00Z'),
    cutoff: audit.cutoff,
    days: 20,
    daysPastTarget: state === 'open-past-target' ? 19 : null,
    district: '3',
    closureLabel: state === 'transitioned' ? 'Transitioned (reassigned to another agency)' : state === 'noted' ? 'Noted (no action required)' : null,
    audit,
    chance: state.startsWith('open') ? chanceFor(audit, 20 * DAY) : null,
    request: requestFor(state),
  })

  for (const state of STATES) {
    it(`${state}: one request at most, council link, no names or emails, no blame`, () => {
      const text = buildSummary(base(state), 'https://example.org')
      expect(text).toContain(COUNCIL_URL)
      expect(text).toContain('data.boston.gov')
      expect(text).not.toMatch(/@/)
      expect(text).not.toMatch(/\bwill\b|unfixed|ignored|failed|neglect|fault/i)
      expect(text).not.toMatch(/city'?s (figure|method)/i)
      expect(text.match(/^Request:/gm)?.length ?? 0).toBe(requestFor(state) ? 1 : 0)
    })
  }
})
