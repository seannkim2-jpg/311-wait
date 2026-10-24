import { describe, expect, it } from 'vitest'
import { conditionalWait, type ServiceAudit } from './audit'

describe('conditional wait calculator', () => {
  const audit = {
    n: 100,
    maxDay: 30,
    durationHours: [
      ...Array(20).fill(24),
      ...Array(70).fill(5 * 24),
      ...Array(5).fill(20 * 24),
      ...Array(5).fill(30 * 24),
    ],
    kmSteps: [
      { t: 24, s: 0.8, atRisk: 100, events: 20 },
      { t: 20 * 24, s: 0.4, atRisk: 10, events: 5 },
    ],
  } as ServiceAudit

  it('counts censoring between closure events before deciding whether to show a result', () => {
    const result = conditionalWait(audit, 10)
    expect(result.atRisk).toBe(10)
    expect(result.thin).toBe(true)
    expect(result.medianMoreDays).toBe(10)
  })

  it('omits chances whose horizon exceeds the observed window', () => {
    expect(conditionalWait(audit, 0).chances.map((c) => c.days)).toEqual([7, 30])
    expect(conditionalWait(audit, 10).chances.map((c) => c.days)).toEqual([7])
  })
})
