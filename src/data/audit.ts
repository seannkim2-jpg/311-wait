/**
 * View-model layer: calls the frozen statistics in `src/lib/` and shapes the results for the
 * page. Nothing here re-implements an estimator. It only evaluates the step functions that
 * `stats.ts` returns at chart grid points and formats numbers.
 */
import {
  COHORT_START,
  fetchCohortTotals,
  fetchExtractCutoff,
  fetchNeighborhoodOnTime,
  fetchServiceCases,
  fetchServices,
  toObservations,
  type CohortTotals,
  type ServiceCount,
} from '../lib/boston311'
import { aalenJohansen, kaplanMeier, naiveMedian, wilson, type KMStep } from '../lib/stats'

const HOURS_PER_DAY = 24

export interface CurvePoint {
  /** days since the case was opened */
  day: number
  /** % of cases still not closed, counting open cases (Kaplan–Meier) */
  km: number
  /** 95% Greenwood band for `km`, as [low, high] */
  band: [number, number]
  /** % of closed cases not yet closed at `day`, closed cases only (the naive view) */
  city: number
  /** stacked outcome shares at `day`, in % (Aalen–Johansen) */
  resolved: number
  notResolved: number
  stillOpen: number
}

export interface NeighborhoodRow {
  neighborhood: string
  n: number
  onTime: number
  rate: number
  lower: number
  upper: number
}

export interface ServiceAudit {
  service: string
  queriedAt: Date
  n: number
  stillOpen: number
  closed: number
  /** Kaplan–Meier median, in hours; null when fewer than half have ever closed */
  kmMedianHours: number | null
  /** closed-cases-only median, in hours */
  cityMedianHours: number
  /** survival at the last event time: the floor of the curve */
  kmEnd: number
  maxDay: number
  curve: CurvePoint[]
  /** The Kaplan–Meier steps themselves, for the "Already waiting?" estimate. */
  kmSteps: KMStep[]
  /** Every observed duration in hours, ascending: who was still open after a given wait. */
  sortedHours: Float64Array
  outcomes: { resolved: number; notResolved: number; stillOpen: number }
  neighborhoods: NeighborhoodRow[]
}

export interface Overview extends CohortTotals {
  queriedAt: Date
  services: ServiceCount[]
}

/** Evaluate a right-continuous step function given as ascending `t` with values. */
function stepAt<T>(steps: T[], tOf: (s: T) => number, vOf: (s: T) => number, x: number, before: number) {
  let lo = 0
  let hi = steps.length - 1
  let found = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (tOf(steps[mid]) <= x) {
      found = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  return found === -1 ? before : vOf(steps[found])
}

/** Grid that is dense early and sparse late, matching the stretched (sqrt) time axis. */
function timeGrid(maxDay: number, extras: number[], points = 260): number[] {
  const grid = new Set<number>()
  for (let i = 0; i <= points; i++) grid.add(Math.pow(i / points, 2) * maxDay)
  for (const e of extras) if (e >= 0 && e <= maxDay) grid.add(e)
  return [...grid].sort((a, b) => a - b)
}

const pct = (v: number) => Math.round(v * 10000) / 100

let cutoffPromise: Promise<number> | null = null

/** When the city cut the current extract. Open cases are timed to this, not to page load. */
export function loadExtractCutoff(): Promise<number> {
  if (!cutoffPromise) {
    cutoffPromise = fetchExtractCutoff().catch((err) => {
      cutoffPromise = null
      throw err
    })
  }
  return cutoffPromise
}

const auditCache = new Map<string, Promise<ServiceAudit>>()

export function loadServiceAudit(service: string): Promise<ServiceAudit> {
  const cached = auditCache.get(service)
  if (cached) return cached
  const p = buildServiceAudit(service).catch((err) => {
    auditCache.delete(service) // let a retry go back to the network
    throw err
  })
  auditCache.set(service, p)
  return p
}

async function buildServiceAudit(service: string): Promise<ServiceAudit> {
  const [rows, hoods, cutoff] = await Promise.all([
    fetchServiceCases(service),
    fetchNeighborhoodOnTime(service),
    loadExtractCutoff(),
  ])
  const queriedAt = new Date()
  const obs = toObservations(rows, cutoff)

  const km = kaplanMeier(obs.map((o) => ({ hours: o.hours, event: o.cause !== 0 })))
  const closedHours = obs.filter((o) => o.cause !== 0).map((o) => o.hours)
  const cityKm = kaplanMeier(closedHours.map((hours) => ({ hours, event: true })))
  const aj = aalenJohansen(obs)

  const maxHours = obs.reduce((m, o) => Math.max(m, o.hours), 0)
  const maxDay = maxHours / HOURS_PER_DAY
  const cityMedianHours = naiveMedian(closedHours)

  const grid = timeGrid(maxDay, [
    cityMedianHours / HOURS_PER_DAY,
    ...(km.median !== null ? [km.median / HOURS_PER_DAY] : []),
  ])

  const curve: CurvePoint[] = grid.map((day) => {
    const h = day * HOURS_PER_DAY
    const s = stepAt(km.curve, (c) => c.t, (c) => c.s, h, 1)
    const se = stepAt(km.curve, (c) => c.t, (c) => c.se, h, 0)
    const city = stepAt(cityKm.curve, (c) => c.t, (c) => c.s, h, 1)
    const f1 = stepAt(aj.curve1, (c) => c.t, (c) => c.cif, h, 0)
    const f2 = stepAt(aj.curve2, (c) => c.t, (c) => c.cif, h, 0)
    return {
      day,
      km: pct(s),
      band: [pct(Math.max(0, s - 1.96 * se)), pct(Math.min(1, s + 1.96 * se))],
      city: pct(city),
      resolved: pct(f1),
      notResolved: pct(f2),
      stillOpen: pct(Math.max(0, 1 - f1 - f2)),
    }
  })

  const stillOpen = obs.filter((o) => o.cause === 0).length
  const neighborhoods: NeighborhoodRow[] = hoods.map((r) => {
    const ci = r.n > 0 ? wilson(r.onTime, r.n) : { lower: 0, upper: 0 }
    return { ...r, rate: r.n > 0 ? r.onTime / r.n : 0, ...ci }
  })

  return {
    service,
    queriedAt,
    n: obs.length,
    stillOpen,
    closed: obs.length - stillOpen,
    kmMedianHours: km.median,
    cityMedianHours,
    kmEnd: km.curve.length ? km.curve[km.curve.length - 1].s : 1,
    maxDay,
    curve,
    kmSteps: km.curve,
    sortedHours: Float64Array.from(obs, (o) => o.hours).sort(),
    outcomes: { resolved: aj.final1, notResolved: aj.final2, stillOpen: aj.stillUnresolved },
    neighborhoods,
  }
}

let overviewPromise: Promise<Overview> | null = null

export function loadOverview(): Promise<Overview> {
  if (!overviewPromise) {
    overviewPromise = Promise.all([loadExtractCutoff().then(fetchCohortTotals), fetchServices(200)])
      .then(([totals, services]) => ({ ...totals, services, queriedAt: new Date() }))
      .catch((err) => {
        overviewPromise = null
        throw err
      })
  }
  return overviewPromise
}

export { COHORT_START }
