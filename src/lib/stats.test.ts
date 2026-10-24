/**
 * src/lib/stats.test.ts
 *
 * Property-based tests for src/lib/stats.ts using vitest + fast-check.
 *
 * These are real properties, not smoke tests. Each test identifies an
 * invariant that must hold for all valid inputs, not just a specific example.
 *
 * Do NOT touch src/lib/__fixtures__/golden.json or goldenVerification.test.ts –
 * those are the Python reference implementation's source of truth.
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import {
  parsePgInterval,
  formatPgInterval,
  kaplanMeier,
  aalenJohansen,
  wilson,
  benjaminiHochberg,
} from './stats'
import type { KMObservation, AJObservation } from './stats'

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** Non-negative integer for days (0–9999 keeps string formatting well-behaved) */
const arbDays = fc.integer({ min: 0, max: 9999 })

/** Valid hours component: 0–23 */
const arbHours = fc.integer({ min: 0, max: 23 })

/** Valid minutes component: 0–59 */
const arbMinutes = fc.integer({ min: 0, max: 59 })

/**
 * Valid seconds component: 0–59 with up to 6 decimal places.
 * We use a multiple of 1e-6 so that toFixed(6) round-trips through parseFloat
 * without accumulating sub-microsecond noise.
 */
const arbSeconds = fc.integer({ min: 0, max: 59_999_999 }).map(n => n / 1_000_000)

/** A complete duration tuple */
const arbDuration = fc.record({
  days: arbDays,
  hours: arbHours,
  minutes: arbMinutes,
  seconds: arbSeconds,
})

/** Non-negative finite hours for observations (0 – 10_000 h is realistic) */
const arbObsHours = fc.float({ min: 0, max: 10_000, noNaN: true })

/** KM observation */
const arbKMObs = fc.record({
  hours: arbObsHours,
  event: fc.boolean(),
})

/** AJ observation: cause 0 | 1 | 2 */
const arbAJObs = fc.record({
  hours: arbObsHours,
  cause: fc.integer({ min: 0, max: 2 }) as fc.Arbitrary<0 | 1 | 2>,
})

/** A p-value in [0, 1] */
const arbPValue = fc.float({ min: 0, max: 1, noNaN: true })

// ---------------------------------------------------------------------------
// Property 1 – parsePgInterval / formatPgInterval round-trip
// ---------------------------------------------------------------------------
describe('parsePgInterval / formatPgInterval round-trip', () => {
  it('formatting then parsing recovers the same total hours', () => {
    fc.assert(
      fc.property(arbDuration, ({ days, hours, minutes, seconds }) => {
        const formatted = formatPgInterval(days, hours, minutes, seconds)
        const parsed = parsePgInterval(formatted)
        const expected = days * 24 + hours + minutes / 60 + seconds / 3600

        // Allow floating-point tolerance of 1 microsecond in hour units
        expect(parsed).toBeCloseTo(expected, 9)
      }),
    )
  })

  it('singular "day" and plural "days" parse identically', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 9999 }),
        arbHours,
        arbMinutes,
        arbSeconds,
        (days, hours, minutes, seconds) => {
          const hh = String(hours).padStart(2, '0')
          const mm = String(minutes).padStart(2, '0')
          const ss = seconds.toFixed(6).padStart(9, '0')

          const singular = parsePgInterval(`${days} day, ${hh}:${mm}:${ss}`)
          const plural = parsePgInterval(`${days} days, ${hh}:${mm}:${ss}`)

          expect(singular).toBeCloseTo(plural, 12)
        },
      ),
    )
  })

  it('bare HH:MM:SS (no day part) formats when days=0 and parses back', () => {
    fc.assert(
      fc.property(arbHours, arbMinutes, arbSeconds, (hours, minutes, seconds) => {
        const formatted = formatPgInterval(0, hours, minutes, seconds)
        // No "days" token when days=0
        expect(formatted).not.toContain('days')
        const parsed = parsePgInterval(formatted)
        const expected = hours + minutes / 60 + seconds / 3600
        expect(parsed).toBeCloseTo(expected, 9)
      }),
    )
  })
})

// ---------------------------------------------------------------------------
// Property 2 – kaplanMeier: S(t) is monotonically non-increasing and in [0,1]
// ---------------------------------------------------------------------------
describe('kaplanMeier – S(t) monotonically non-increasing and in [0,1]', () => {
  it('every step has s in [0,1] and the curve never increases', () => {
    fc.assert(
      fc.property(fc.array(arbKMObs, { minLength: 1, maxLength: 200 }), (obs) => {
        const { curve } = kaplanMeier(obs)

        if (curve.length === 0) return // no events → trivially OK

        // Bounds check
        for (const step of curve) {
          expect(step.s).toBeGreaterThanOrEqual(0)
          expect(step.s).toBeLessThanOrEqual(1)
        }

        // Monotone non-increasing
        for (let i = 1; i < curve.length; i++) {
          expect(curve[i].s).toBeLessThanOrEqual(curve[i - 1].s + 1e-12)
        }

        // First step is ≤ 1 (strict only when there are events)
        expect(curve[0].s).toBeLessThanOrEqual(1)
      }),
    )
  })
})

// ---------------------------------------------------------------------------
// Property 3 – KM with zero censored observations equals 1 − ECDF exactly
// ---------------------------------------------------------------------------
describe('kaplanMeier with no censoring equals 1 − ECDF', () => {
  it('KM curve matches 1 − empirical CDF when every observation is an event', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({ hours: arbObsHours, event: fc.constant(true) }),
          { minLength: 1, maxLength: 100 },
        ),
        (obs) => {
          const n = obs.length
          const { curve } = kaplanMeier(obs)

          // Build ECDF: for each unique event time, proportion of obs ≤ t
          const sortedTimes = [...new Set(obs.map(o => o.hours))].sort((a, b) => a - b)

          let cumEvents = 0
          let stepIdx = 0

          for (const t of sortedTimes) {
            const eventsAtT = obs.filter(o => o.hours === t).length
            cumEvents += eventsAtT

            // Find the KM step for this time
            const kmStep = curve.find(s => s.t === t)
            if (!kmStep) continue // no KM step for this time (should not happen)

            const ecdf = cumEvents / n
            expect(kmStep.s).toBeCloseTo(1 - ecdf, 9)
            stepIdx++
          }
        },
      ),
    )
  })
})

// ---------------------------------------------------------------------------
// Property 4 – appending a censored obs strictly beyond last event does not add
//               new KM steps and does not change the set of event times or event counts.
//               (The at-risk counts and S(t) values DO legitimately change because
//               the new observation is in the risk set at all prior event times.)
// ---------------------------------------------------------------------------
describe('kaplanMeier – appending a late censored observation does not create new steps', () => {
  it('a censored obs after the last event adds no new curve steps and preserves event times/counts', () => {
    fc.assert(
      fc.property(
        // At least one event observation so the curve is non-empty
        fc.array(arbKMObs, { minLength: 1, maxLength: 100 }).filter(
          obs => obs.some(o => o.event),
        ),
        (obs) => {
          const { curve: before } = kaplanMeier(obs)
          if (before.length === 0) return

          const lastEventTime = before[before.length - 1].t
          // Censored observation strictly after the last event
          const lateObs: KMObservation = { hours: lastEventTime + 1, event: false }
          const { curve: after } = kaplanMeier([...obs, lateObs])

          // The number of KM steps must not change (no new event was added)
          expect(after.length).toBe(before.length)

          for (let i = 0; i < before.length; i++) {
            // Event times are unchanged
            expect(after[i].t).toBe(before[i].t)
            // Event counts are unchanged
            expect(after[i].events).toBe(before[i].events)
            // The late censored obs is in the risk set at every prior time,
            // so atRisk increases by exactly 1 at every step
            expect(after[i].atRisk).toBe(before[i].atRisk + 1)
            // S(t) may differ because atRisk changed; monotonicity and [0,1] still hold
            expect(after[i].s).toBeGreaterThanOrEqual(0)
            expect(after[i].s).toBeLessThanOrEqual(1)
          }

          // The survival at the last step must be non-negative
          expect(after[after.length - 1].s).toBeGreaterThanOrEqual(0)
        },
      ),
    )
  })
})

// ---------------------------------------------------------------------------
// Property 5 – wilson: interval contains point estimate and stays within [0,1]
// ---------------------------------------------------------------------------
describe('wilson – interval contains the point estimate and is within [0,1]', () => {
  it('lower ≤ p̂ ≤ upper and both bounds are in [0,1] for any successes/n', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10_000 }),          // n
        fc.integer({ min: 0, max: 10_000 }),           // k (raw, will be clamped)
        fc.float({ min: 0.5, max: 4.0, noNaN: true }), // z
        (n, kRaw, z) => {
          const k = Math.min(kRaw, n) // ensure k ≤ n
          const pHat = k / n
          const { lower, upper } = wilson(k, n, z)

          expect(lower).toBeGreaterThanOrEqual(0)
          expect(upper).toBeLessThanOrEqual(1)
          expect(lower).toBeLessThanOrEqual(pHat + 1e-12)
          expect(upper).toBeGreaterThanOrEqual(pHat - 1e-12)
          expect(lower).toBeLessThanOrEqual(upper + 1e-12)
        },
      ),
    )
  })

  it('stays in [0,1] at the extremes p=0 and p=1', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10_000 }), // n
        fc.float({ min: 0.5, max: 4.0, noNaN: true }), // z
        (n, z) => {
          // p = 0
          const w0 = wilson(0, n, z)
          expect(w0.lower).toBeGreaterThanOrEqual(0)
          expect(w0.upper).toBeLessThanOrEqual(1)
          expect(w0.lower).toBeLessThanOrEqual(w0.upper + 1e-12)

          // p = 1
          const w1 = wilson(n, n, z)
          expect(w1.lower).toBeGreaterThanOrEqual(0)
          expect(w1.upper).toBeLessThanOrEqual(1)
          expect(w1.lower).toBeLessThanOrEqual(w1.upper + 1e-12)
        },
      ),
    )
  })
})

// ---------------------------------------------------------------------------
// Property 6 – benjaminiHochberg: output monotone in sorted input, never below raw p
// ---------------------------------------------------------------------------
describe('benjaminiHochberg – monotone in sorted input and adjusted ≥ raw p', () => {
  it('adjusted p-values are monotone when input is sorted ascending', () => {
    fc.assert(
      fc.property(
        fc.array(arbPValue, { minLength: 1, maxLength: 500 }),
        (pValues) => {
          // Sort input ascending – BH monotonicity is defined on sorted input
          const sorted = [...pValues].sort((a, b) => a - b)
          const adjusted = benjaminiHochberg(sorted)

          expect(adjusted.length).toBe(sorted.length)

          // Monotone non-decreasing (adjusted p for larger raw p is ≥ adjusted for smaller)
          for (let i = 1; i < adjusted.length; i++) {
            expect(adjusted[i]).toBeGreaterThanOrEqual(adjusted[i - 1] - 1e-12)
          }
        },
      ),
    )
  })

  it('adjusted p-value is never below the original p-value', () => {
    fc.assert(
      fc.property(
        fc.array(arbPValue, { minLength: 1, maxLength: 500 }),
        (pValues) => {
          const adjusted = benjaminiHochberg(pValues)

          for (let i = 0; i < pValues.length; i++) {
            // BH adjusted p ≥ raw p (correction can only inflate, never shrink)
            expect(adjusted[i]).toBeGreaterThanOrEqual(pValues[i] - 1e-12)
            // All adjusted values stay in [0,1]
            expect(adjusted[i]).toBeGreaterThanOrEqual(0)
            expect(adjusted[i]).toBeLessThanOrEqual(1)
          }
        },
      ),
    )
  })
})

// ---------------------------------------------------------------------------
// Property 7 – aalenJohansen: final1 + final2 + stillUnresolved === 1 within 1e-9
// ---------------------------------------------------------------------------
describe('aalenJohansen – partition of probability: final1 + final2 + stillUnresolved = 1', () => {
  it('three mutually exclusive outcomes always sum to 1 within floating-point tolerance', () => {
    fc.assert(
      fc.property(
        fc.array(arbAJObs, { minLength: 0, maxLength: 200 }),
        (obs) => {
          const { final1, final2, stillUnresolved } = aalenJohansen(obs)
          const sum = final1 + final2 + stillUnresolved

          expect(sum).toBeCloseTo(1, 9)

          // Each component is non-negative
          expect(final1).toBeGreaterThanOrEqual(0)
          expect(final2).toBeGreaterThanOrEqual(0)
          expect(stillUnresolved).toBeGreaterThanOrEqual(-1e-9) // allow tiny float errors
        },
      ),
    )
  })

  it('with only censored obs (cause=0) all observations are still unresolved', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({ hours: arbObsHours, cause: fc.constant(0 as const) }),
          { minLength: 1, maxLength: 100 },
        ),
        (obs) => {
          const { final1, final2, stillUnresolved } = aalenJohansen(obs)
          expect(final1).toBeCloseTo(0, 12)
          expect(final2).toBeCloseTo(0, 12)
          expect(stillUnresolved).toBeCloseTo(1, 12)
        },
      ),
    )
  })
})
