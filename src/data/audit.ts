/**
 * View-model layer: calls the frozen statistics in `src/lib/` and shapes the results for the
 * page. Nothing here re-implements an estimator. It only evaluates the step functions that
 * `stats.ts` returns at chart grid points, derives conditional waits from the Kaplan-Meier
 * curve it returns, and formats numbers.
 */
import { fetchNeighborhoodOnTime, type CohortTotals, type ServiceCount } from '../lib/boston311'
import { aalenJohansen, kaplanMeier, naiveMedian, wilson, type KMResult } from '../lib/stats'
import { CITIES, type City, type CityKey } from './cities'

const HOURS_PER_DAY = 24

/** Below this many still at risk, a conditional figure is suppressed rather than shown. */
const MIN_AT_RISK = 30

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

/** The Kaplan–Meier step function, kept so conditional waits can be read off it exactly. */
export interface SurvivalStep {
  t: number
  s: number
  atRisk: number
  events: number
}

export interface ServiceAudit {
  city: CityKey
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
  kmSteps: SurvivalStep[]
  /** observed time to closure or censoring for each case, in hours */
  durationHours: number[]
  /** The same fitted curve, used by the Boston case lookup. */
  km: KMResult
  sortedHours: number[]
  cutoff: number
  /** null where the city publishes no closure reason, so nothing can be split out */
  outcomes: { resolved: number; notResolved: number; stillOpen: number } | null
  neighborhoods: NeighborhoodRow[]
}

export interface Overview extends CohortTotals {
  city: CityKey
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

export interface ConditionalWait {
  /** days already waited, clamped to what the data can speak to */
  elapsedDays: number
  /** share of all requests still open at `elapsedDays` */
  stillOpenShare: number
  /** more days until half of those still open at `elapsedDays` close; null if never reached */
  medianMoreDays: number | null
  /** of those still open at `elapsedDays`, the share closing within each horizon */
  chances: { days: number; share: number }[]
  /** how many comparable requests were still open that long; drives suppression */
  atRisk: number
  /** true when too few were still open that long for the figure to mean anything */
  thin: boolean
}

/**
 * What the Kaplan–Meier curve says about a request that is *already* `elapsedDays` old.
 *
 * Conditioning on survival to t is a division on the same curve, S(t + u) / S(t) — not a new
 * estimator. It is the honest answer to "mine has been open three weeks, now what?", which the
 * headline median cannot give: that median is measured from the day a request is filed, and
 * the requests still open after three weeks are the slow ones.
 */
export function conditionalWait(
  audit: ServiceAudit,
  elapsedDays: number,
  horizonDays: number[] = [7, 30],
): ConditionalWait {
  const clamped = Math.min(Math.max(elapsedDays, 0), audit.maxDay)
  const elapsed = clamped * HOURS_PER_DAY
  const base = stepAt(audit.kmSteps, (s) => s.t, (s) => s.s, elapsed, 1)
  const atRisk = audit.durationHours.filter((hours) => hours > elapsed).length

  if (base <= 0) {
    return { elapsedDays: clamped, stillOpenShare: 0, medianMoreDays: null, chances: [], atRisk: 0, thin: true }
  }

  let medianMoreDays: number | null = null
  for (const step of audit.kmSteps) {
    if (step.t <= elapsed) continue
    if (step.s / base <= 0.5) {
      medianMoreDays = (step.t - elapsed) / HOURS_PER_DAY
      break
    }
  }

  const chances = horizonDays.filter((days) => days >= 0 && clamped + days <= audit.maxDay).map((days) => {
    const s = stepAt(audit.kmSteps, (st) => st.t, (st) => st.s, elapsed + days * HOURS_PER_DAY, 1)
    return { days, share: Math.min(1, Math.max(0, 1 - s / base)) }
  })

  return {
    elapsedDays: clamped,
    stillOpenShare: base,
    medianMoreDays,
    chances,
    atRisk,
    thin: atRisk < MIN_AT_RISK,
  }
}

const cutoffPromises = new Map<CityKey, Promise<number>>()

/** When the city cut the current extract. Open cases are timed to this, not to page load. */
export function loadExtractCutoff(city: CityKey): Promise<number> {
  const cached = cutoffPromises.get(city)
  if (cached) return cached
  const p = CITIES[city].fetchCutoff().catch((err) => {
    cutoffPromises.delete(city)
    throw err
  })
  cutoffPromises.set(city, p)
  return p
}

const auditCache = new Map<string, Promise<ServiceAudit>>()

export function loadServiceAudit(city: CityKey, service: string): Promise<ServiceAudit> {
  const key = `${city}:${service}`
  const cached = auditCache.get(key)
  if (cached) return cached
  const p = buildServiceAudit(CITIES[city], service).catch((err) => {
    auditCache.delete(key) // let a retry go back to the network
    throw err
  })
  auditCache.set(key, p)
  return p
}

async function buildServiceAudit(city: City, service: string): Promise<ServiceAudit> {
  const cutoff = await loadExtractCutoff(city.key)
  const [obs, hoods] = await Promise.all([
    city.loadObservations(service, cutoff),
    city.hasNeighborhoods ? fetchNeighborhoodOnTime(service) : Promise.resolve([]),
  ])
  const queriedAt = new Date()

  const km = kaplanMeier(obs.map((o) => ({ hours: o.hours, event: o.cause !== 0 })))
  const closedHours = obs.filter((o) => o.cause !== 0).map((o) => o.hours)
  const cityKm = kaplanMeier(closedHours.map((hours) => ({ hours, event: true })))
  const aj = city.hasOutcomes ? aalenJohansen(obs) : null

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
    const city2 = stepAt(cityKm.curve, (c) => c.t, (c) => c.s, h, 1)
    const f1 = aj ? stepAt(aj.curve1, (c) => c.t, (c) => c.cif, h, 0) : 0
    const f2 = aj ? stepAt(aj.curve2, (c) => c.t, (c) => c.cif, h, 0) : 0
    return {
      day,
      km: pct(s),
      band: [pct(Math.max(0, s - 1.96 * se)), pct(Math.min(1, s + 1.96 * se))],
      city: pct(city2),
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
    city: city.key,
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
    kmSteps: km.curve.map((c) => ({ t: c.t, s: c.s, atRisk: c.atRisk, events: c.events })),
    durationHours: obs.map((o) => o.hours),
    km,
    sortedHours: obs.map((o) => o.hours).sort((a, b) => a - b),
    cutoff,
    outcomes: aj ? { resolved: aj.final1, notResolved: aj.final2, stillOpen: aj.stillUnresolved } : null,
    neighborhoods,
  }
}

const overviewPromises = new Map<CityKey, Promise<Overview>>()

export function loadOverview(city: CityKey): Promise<Overview> {
  const cached = overviewPromises.get(city)
  if (cached) return cached
  const source = CITIES[city]
  const p = Promise.all([loadExtractCutoff(city).then(source.fetchTotals), source.fetchServices()])
    .then(([totals, services]) => ({ ...totals, city, services, queriedAt: new Date() }))
    .catch((err) => {
      overviewPromises.delete(city)
      throw err
    })
  overviewPromises.set(city, p)
  return p
}
