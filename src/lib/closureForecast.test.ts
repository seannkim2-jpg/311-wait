/**
 * The "Already waiting?" estimates.
 *
 * Parity: scripts/train_closure_forecast.py writes __fixtures__/forecastExamples.json from the
 * fitted lifelines model (Cox) and from lifelines' KaplanMeierFitter on cohortCases.json (KM).
 * The TypeScript reads only the exported artifact and src/lib/stats.ts, so agreement here means
 * the export and both readers are right, not that one implementation agrees with itself.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import {
  HORIZON_DAYS,
  conditionalClosure,
  kmChanceOfClosure,
  linearPredictor,
  maxDaysWaited,
  modelChanceOfClosure,
  modelProbability,
  parseClosureModel,
  stillOpenAfter,
  survivalAt,
  type ClosureModel,
} from './closureForecast'
import { kaplanMeier } from './stats'

const here = dirname(fileURLToPath(import.meta.url))
const fixture = (f: string) => JSON.parse(readFileSync(join(here, '__fixtures__', f), 'utf-8'))
const artifactRaw = JSON.parse(readFileSync(join(here, '../../public/model/boston-closure-forecast.json'), 'utf-8'))
const model = parseClosureModel(artifactRaw)
const examples = fixture('forecastExamples.json') as {
  artifactTrainedAtUtc: string
  queryTime: string
  cox: { service: string; neighborhood: string; daysWaited: number; p: number }[]
  km: { fixture: string; daysWaited: number; p: number; atRisk: number }[]
}
const cases = fixture('cohortCases.json') as Record<string, Row[]>
const atCutoff = Date.parse(model.extractCutoffUtc)

type Row = { case_status: string; closure_reason: string | null; open_date: string; close_date: string | null }

function ts(s: string): number {
  const iso = s.trim().replace(' ', 'T').replace(/\+00$/, 'Z')
  return Date.parse(iso.endsWith('Z') ? iso : `${iso}Z`)
}

/** Same rules as goldenVerification.test.ts and the Python fixture writer. */
function hoursOf(rows: Row[], censorAt: number) {
  const out: { hours: number; event: boolean }[] = []
  for (const r of rows) {
    const opened = ts(r.open_date)
    if (r.case_status === 'Closed' && r.close_date) {
      const hours = (ts(r.close_date) - opened) / 3_600_000
      if (hours >= 0) out.push({ hours, event: true })
    } else if (r.case_status === 'In progress') {
      const hours = (censorAt - opened) / 3_600_000
      if (hours >= 0) out.push({ hours, event: false })
    }
  }
  return out
}

describe('Cox reader matches the Python model', () => {
  it('the fixture was written from this artifact', () => {
    expect(examples.artifactTrainedAtUtc).toBe(model.trainedAtUtc)
    expect(examples.cox.length).toBeGreaterThan(40)
  })

  it.each(examples.cox.map((e) => [`${e.service} · ${e.neighborhood} · day ${e.daysWaited}`, e] as const))(
    '%s',
    (_, e) => {
      const p = modelProbability(model, model.services[e.service], e.neighborhood, e.daysWaited)
      expect(Math.abs(p - e.p)).toBeLessThan(1e-6)
    },
  )
})

describe('Kaplan–Meier chance matches lifelines on the case fixture', () => {
  const queryTime = Date.parse(examples.queryTime)
  it.each(examples.km.map((e) => [`${e.fixture} · day ${e.daysWaited}`, e] as const))('%s', (_, e) => {
    const obs = hoursOf(cases[e.fixture], queryTime)
    const km = kaplanMeier(obs)
    const sorted = Float64Array.from(obs, (o) => o.hours).sort()
    const from = e.daysWaited * 24
    const to = (e.daysWaited + HORIZON_DAYS) * 24
    expect(stillOpenAfter(sorted, from)).toBe(e.atRisk)
    expect(Math.abs(conditionalClosure(survivalAt(km.curve, from), survivalAt(km.curve, to)) - e.p)).toBeLessThan(1e-9)
    const chance = kmChanceOfClosure(km.curve, sorted, e.daysWaited)
    if (chance.kind === 'estimate') expect(Math.abs(chance.p - e.p)).toBeLessThan(1e-9)
  })
})

describe('kmChanceOfClosure', () => {
  // Ten cases closing at days 1..10, plus 40 still open at day 20.
  const obs = [
    ...Array.from({ length: 10 }, (_, i) => ({ hours: (i + 1) * 24, event: true })),
    ...Array.from({ length: 40 }, () => ({ hours: 20 * 24, event: false })),
  ]
  const km = kaplanMeier(obs)
  const sorted = Float64Array.from(obs, (o) => o.hours).sort()

  it('is 1 − S(N+7)/S(N) on a hand-checkable curve', () => {
    // Day 0: 7 of 50 close by day 7.
    const c = kmChanceOfClosure(km.curve, sorted, 0)
    expect(c).toEqual({ kind: 'estimate', p: expect.closeTo(7 / 50, 12), stillOpen: 50 })
    // Day 5: 45 still open; days 6..10 close 5 of them by day 12.
    const d = kmChanceOfClosure(km.curve, sorted, 5)
    expect(d.kind === 'estimate' && d.p).toBeCloseTo(5 / 45, 12)
  })

  it('refuses to look past the longest observed wait', () => {
    expect(maxDaysWaited(sorted)).toBe(13)
    expect(kmChanceOfClosure(km.curve, sorted, 13).kind).toBe('estimate')
    expect(kmChanceOfClosure(km.curve, sorted, 14)).toMatchObject({ kind: 'unavailable', reason: 'beyond-horizon' })
  })

  it('says so when fewer than 30 were still open', () => {
    const few = obs.slice(0, 25)
    const fewKm = kaplanMeier(few)
    const fewSorted = Float64Array.from(few, (o) => o.hours).sort()
    expect(kmChanceOfClosure(fewKm.curve, fewSorted, 0)).toMatchObject({ kind: 'unavailable', reason: 'thin-sample' })
  })
})

describe('modelChanceOfClosure fallbacks (REQ-F08)', () => {
  const service = 'Street Light Outage'
  const svc = model.services[service]
  const thin = Object.entries(svc.neighborhoodCases).find(([, n]) => n < model.minCases)?.[0]
  const full = Object.entries(svc.neighborhoodCases).find(([, n]) => n >= model.minCases)![0]
  const preview = { now: atCutoff, requireRelease: false }

  it('follows the release gate recorded in the artifact', () => {
    const r = modelChanceOfClosure(model, service, full, 7, { now: atCutoff })
    if (model.release.passed) expect(r.kind).toBe('model')
    else expect(r).toEqual({ kind: 'fallback', reason: 'not-released' })
  })

  it('returns the model estimate, with its sample counts, when every rule passes', () => {
    const r = modelChanceOfClosure(model, service, full, 7, preview)
    expect(r).toMatchObject({ kind: 'model', neighborhoodCases: svc.neighborhoodCases[full], serviceCases: svc.cases })
  })

  it('falls back when the model is more than 30 days old', () => {
    const now = atCutoff + (model.maxAgeDays + 1) * 86_400_000
    expect(modelChanceOfClosure(model, service, full, 7, { ...preview, now })).toEqual({ kind: 'fallback', reason: 'stale' })
    const fresh = atCutoff + (model.maxAgeDays - 1) * 86_400_000
    expect(modelChanceOfClosure(model, service, full, 7, { ...preview, now: fresh }).kind).toBe('model')
  })

  it('falls back for a service or neighborhood the model does not know', () => {
    expect(modelChanceOfClosure(model, 'Not A Service', full, 7, preview)).toEqual({ kind: 'fallback', reason: 'unknown-service' })
    expect(modelChanceOfClosure(model, service, 'Other or unknown', 7, preview)).toEqual({
      kind: 'fallback',
      reason: 'missing-neighborhood',
    })
  })

  it('falls back for thin samples', () => {
    expect(thin).toBeDefined()
    expect(modelChanceOfClosure(model, service, thin!, 7, preview)).toEqual({ kind: 'fallback', reason: 'thin-sample' })
    const n = svc.atRisk.filter((k) => k >= model.minCases).length // at-risk only falls
    if (n + HORIZON_DAYS < svc.baselineSurvival.length) {
      expect(modelChanceOfClosure(model, service, full, n, preview)).toEqual({ kind: 'fallback', reason: 'thin-sample' })
    }
  })

  it('falls back past the end of the baseline curve, and for a fractional day', () => {
    const end = svc.baselineSurvival.length - HORIZON_DAYS
    expect(modelChanceOfClosure(model, service, full, end, preview)).toEqual({ kind: 'fallback', reason: 'beyond-horizon' })
    expect(modelChanceOfClosure(model, service, full, 2.5, preview)).toEqual({ kind: 'fallback', reason: 'beyond-horizon' })
  })
})

describe('parseClosureModel', () => {
  const clone = (): ClosureModel => JSON.parse(JSON.stringify(artifactRaw))

  it('accepts the committed artifact', () => {
    expect(model.city).toBe('Boston')
    expect(model.featureNames.length).toBe(model.coefficients.length)
  })

  it('rejects mismatched parameter arrays and curves', () => {
    const a = clone()
    a.coefficients.pop()
    expect(() => parseClosureModel(a)).toThrow(/length/)
    const b = clone()
    b.services['Pothole'].atRisk.pop()
    expect(() => parseClosureModel(b)).toThrow(/Pothole/)
    const c = clone()
    c.horizonDays = 14
    expect(() => parseClosureModel(c)).toThrow(/horizon/)
  })
})

describe('properties', () => {
  const services = Object.keys(model.services)

  it('every model estimate is a probability', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...services),
        fc.constantFrom(...model.neighborhoods),
        fc.nat({ max: 200 }),
        (service, hood, n) => {
          const svc = model.services[service]
          if (n + HORIZON_DAYS >= svc.baselineSurvival.length) return
          const p = modelProbability(model, svc, hood, n)
          expect(p).toBeGreaterThanOrEqual(0)
          expect(p).toBeLessThanOrEqual(1)
        },
      ),
    )
  })

  it('a higher hazard never gives a lower chance of closure', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...services),
        fc.constantFrom(...model.neighborhoods),
        fc.constantFrom(...model.neighborhoods),
        (service, a, b) => {
          const svc = model.services[service]
          const [lo, hi] = linearPredictor(model, a) <= linearPredictor(model, b) ? [a, b] : [b, a]
          for (const n of [0, 14, 30]) {
            expect(modelProbability(model, svc, hi, n)).toBeGreaterThanOrEqual(modelProbability(model, svc, lo, n) - 1e-12)
          }
        },
      ),
    )
  })

  it('the Kaplan–Meier chance is a probability for any sample', () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({ hours: fc.double({ min: 0, max: 2000, noNaN: true }), event: fc.boolean() }), {
          minLength: 1,
          maxLength: 120,
        }),
        fc.nat({ max: 80 }),
        (obs, n) => {
          const km = kaplanMeier(obs)
          const sorted = Float64Array.from(obs, (o) => o.hours).sort()
          const c = kmChanceOfClosure(km.curve, sorted, n)
          if (c.kind === 'estimate') {
            expect(c.p).toBeGreaterThanOrEqual(0)
            expect(c.p).toBeLessThanOrEqual(1)
            expect(c.stillOpen).toBeGreaterThanOrEqual(30)
          }
        },
      ),
    )
  })
})
