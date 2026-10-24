/**
 * MC-05 properties for conditionalClose. These are the claims the case lookup puts on screen,
 * so each one is stated as a property over arbitrary data rather than a few examples.
 */
import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { conditionalClose, kaplanMeier, survivalAt, type KMResult } from './stats'

// Durations strictly above 0 so S(0) = 1, with plenty of ties (integers) and some censoring.
const observation = fc.record({
  hours: fc.integer({ min: 1, max: 2000 }).map((h) => h / 4),
  event: fc.boolean(),
})
const sample = fc.array(observation, { minLength: 1, maxLength: 200 })
const hoursArb = fc.integer({ min: 0, max: 2400 }).map((h) => h / 4)

const horizonOf = (obs: { hours: number }[]) => obs.reduce((m, o) => Math.max(m, o.hours), 0)

/** S(t) by a plain linear scan, deliberately not the binary search survivalAt uses. */
function sByScan(km: KMResult, t: number): number {
  let s = 1
  for (const step of km.curve) if (step.t <= t) s = step.s
  return s
}

describe('conditionalClose', () => {
  it('stays between 0 and 1', () => {
    fc.assert(
      fc.property(sample, hoursArb, hoursArb, (obs, age, win) => {
        const c = conditionalClose(kaplanMeier(obs), age, win, horizonOf(obs))
        return c === null || (c >= 0 && c <= 1)
      }),
      { numRuns: 400 },
    )
  })

  it('never falls as the time window grows', () => {
    fc.assert(
      fc.property(sample, hoursArb, hoursArb, hoursArb, (obs, age, a, b) => {
        const [w1, w2] = a <= b ? [a, b] : [b, a]
        const km = kaplanMeier(obs)
        const h = horizonOf(obs)
        const c1 = conditionalClose(km, age, w1, h)
        const c2 = conditionalClose(km, age, w2, h)
        // A wider window is answerable only if the narrower one is.
        if (c2 !== null) expect(c1).not.toBeNull()
        return c1 === null || c2 === null || c1 <= c2
      }),
      { numRuns: 400 },
    )
  })

  it('matches 1 - S(age + window) / S(age) read off the same curve exactly', () => {
    fc.assert(
      fc.property(sample, hoursArb, hoursArb, (obs, age, win) => {
        const km = kaplanMeier(obs)
        const c = conditionalClose(km, age, win, horizonOf(obs))
        if (c === null) return true
        return c === 1 - sByScan(km, age + win) / sByScan(km, age)
      }),
      { numRuns: 400 },
    )
  })

  it('at age 0 equals 1 - S(window)', () => {
    fc.assert(
      fc.property(sample, hoursArb, (obs, win) => {
        const km = kaplanMeier(obs)
        const c = conditionalClose(km, 0, win, horizonOf(obs))
        return c === null || c === 1 - sByScan(km, win)
      }),
      { numRuns: 300 },
    )
  })

  it('returns null outside the observed range or when nothing is still open', () => {
    fc.assert(
      fc.property(sample, hoursArb, (obs, age) => {
        const km = kaplanMeier(obs)
        const h = horizonOf(obs)
        return conditionalClose(km, age, h - age + 0.25, h) === null
      }),
    )
    const allClosed = kaplanMeier([{ hours: 1, event: true }, { hours: 2, event: true }])
    expect(survivalAt(allClosed, 2)).toBe(0)
    expect(conditionalClose(allClosed, 2, 0, 2)).toBeNull()
    expect(conditionalClose(allClosed, -1, 1, 2)).toBeNull()
  })

  it('survivalAt agrees with a linear scan of the curve', () => {
    fc.assert(
      fc.property(sample, hoursArb, (obs, t) => {
        const km = kaplanMeier(obs)
        return survivalAt(km, t) === sByScan(km, t)
      }),
      { numRuns: 400 },
    )
  })
})
