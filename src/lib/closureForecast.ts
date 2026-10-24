/**
 * "Already waiting?": the historical chance that a request still open after N whole days
 * closes within the next 7.
 *
 * Both estimates answer P = 1 − S(N+7) / S(N):
 *   - service-wide: the live Kaplan–Meier curve the page already draws (src/lib/stats.ts);
 *   - by neighborhood: the Cox model trained offline by scripts/train_closure_forecast.py and
 *     shipped as public/model/boston-closure-forecast.json. It is used only if its release
 *     gate passed, and the page falls back to the service-wide figure whenever a rule below fails.
 *
 * "Closure" is any closure, including cases closed as Noted or Transitioned.
 * Pure apart from loadClosureModel(); no React.
 */
type SurvivalStep = { t: number; s: number }

export const HORIZON_DAYS = 7
/** Same floor as the neighborhood table's suppression. */
export const MIN_CASES = 30
const HOURS_PER_DAY = 24
const MS_PER_DAY = 86_400_000

// ---------------------------------------------------------------------------
// Service-wide: Kaplan–Meier
// ---------------------------------------------------------------------------

/** S(t) of a Kaplan–Meier curve: a right-continuous step that starts at 1. */
export function survivalAt(curve: SurvivalStep[], hours: number): number {
  let lo = 0
  let hi = curve.length - 1
  let s = 1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (curve[mid].t <= hours) {
      s = curve[mid].s
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  return s
}

/** How many observations last longer than `hours`, given durations in ascending order. */
export function stillOpenAfter(sortedHours: ArrayLike<number>, hours: number): number {
  let lo = 0
  let hi = sortedHours.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (sortedHours[mid] <= hours) lo = mid + 1
    else hi = mid
  }
  return sortedHours.length - lo
}

/** 1 − S(N+7) / S(N) from survival values. 1 when nothing survived to N. */
export function conditionalClosure(sN: number, sNplusH: number): number {
  if (!(sN > 0)) return 1
  return Math.min(1, Math.max(0, 1 - sNplusH / sN))
}

export type Unavailable = 'thin-sample' | 'beyond-horizon'

export type ServiceWideChance =
  | { kind: 'estimate'; p: number; stillOpen: number }
  | { kind: 'unavailable'; reason: Unavailable; stillOpen: number }

/**
 * Service-wide chance from the live Kaplan–Meier curve.
 *
 * Unavailable when fewer than `MIN_CASES` requests were still open after N days, or when
 * N + 7 days is past the longest wait observed, where the curve is undefined.
 */
export function kmChanceOfClosure(
  curve: SurvivalStep[],
  sortedHours: ArrayLike<number>,
  daysWaited: number,
): ServiceWideChance {
  const from = daysWaited * HOURS_PER_DAY
  const to = (daysWaited + HORIZON_DAYS) * HOURS_PER_DAY
  const stillOpen = stillOpenAfter(sortedHours, from)
  const longest = sortedHours.length ? sortedHours[sortedHours.length - 1] : 0
  if (to > longest) return { kind: 'unavailable', reason: 'beyond-horizon', stillOpen }
  if (stillOpen < MIN_CASES) return { kind: 'unavailable', reason: 'thin-sample', stillOpen }
  return { kind: 'estimate', p: conditionalClosure(survivalAt(curve, from), survivalAt(curve, to)), stillOpen }
}

/** Largest whole N for which N + 7 days stays inside the observed waits. */
export function maxDaysWaited(sortedHours: ArrayLike<number>): number {
  const longest = sortedHours.length ? sortedHours[sortedHours.length - 1] : 0
  return Math.max(0, Math.floor(longest / HOURS_PER_DAY) - HORIZON_DAYS)
}

// ---------------------------------------------------------------------------
// By neighborhood: the offline Cox model
// ---------------------------------------------------------------------------

export interface ServiceBaseline {
  cases: number
  closed: number
  /** S0 at day 0, 1, 2, …, with covariates at their training means. */
  baselineSurvival: number[]
  /** Training cases still open after each whole day. */
  atRisk: number[]
  neighborhoodCases: Record<string, number>
}

export interface ClosureModel {
  version: 1
  city: 'Boston'
  horizonDays: number
  minCases: number
  maxAgeDays: number
  trainedAtUtc: string
  extractCutoffUtc: string
  cohortStart: string
  sampleCounts: { cases: number; closed: number; stillOpen: number }
  featureNames: string[]
  coefficients: number[]
  featureMeans: number[]
  neighborhoods: string[]
  services: Record<string, ServiceBaseline>
  release: { passed: boolean; summary: string }
}

/** Check the artifact's shape so a bad file degrades to the service-wide figure, not to NaN. */
export function parseClosureModel(raw: unknown): ClosureModel {
  const m = raw as ClosureModel
  const fail = (why: string): never => {
    throw new Error(`closure model: ${why}`)
  }
  if (!m || m.version !== 1 || m.city !== 'Boston') fail('unsupported version or city')
  if (m.horizonDays !== HORIZON_DAYS) fail(`horizon is ${m.horizonDays} days, expected ${HORIZON_DAYS}`)
  const k = m.featureNames?.length
  if (!k || m.coefficients?.length !== k || m.featureMeans?.length !== k) fail('feature arrays differ in length')
  if (![...m.coefficients, ...m.featureMeans].every(Number.isFinite)) fail('non-finite parameter')
  if (Number.isNaN(Date.parse(m.extractCutoffUtc))) fail('bad extract cutoff')
  for (const [name, s] of Object.entries(m.services ?? {})) {
    const n = s.baselineSurvival?.length
    if (!n || s.atRisk?.length !== n) fail(`${name}: curve and counts differ in length`)
    if (!s.baselineSurvival.every((v) => v >= 0 && v <= 1)) fail(`${name}: survival outside [0, 1]`)
  }
  if (typeof m.release?.passed !== 'boolean') fail('missing release decision')
  return m
}

/** lifelines' centered linear predictor, Σ β_j (x_j − mean_j), for a one-hot neighborhood. */
export function linearPredictor(model: ClosureModel, neighborhood: string): number {
  const key = `neighborhood=${neighborhood}`
  let lp = 0
  for (let j = 0; j < model.featureNames.length; j++) {
    const x = model.featureNames[j] === key ? 1 : 0
    lp += model.coefficients[j] * (x - model.featureMeans[j])
  }
  return lp
}

export type ModelFallback =
  | 'not-released'
  | 'stale'
  | 'unknown-service'
  | 'missing-neighborhood'
  | 'beyond-horizon'
  | 'thin-sample'

export type NeighborhoodChance =
  | {
      kind: 'model'
      p: number
      neighborhoodCases: number
      serviceCases: number
      stillOpen: number
      dataThrough: Date
    }
  | { kind: 'fallback'; reason: ModelFallback }

export interface ModelOptions {
  /** Epoch ms used for the age check. */
  now?: number
  /** Off only for the `?forecast=preview` review mode. */
  requireRelease?: boolean
}

/**
 * The model's arithmetic with no fallback rules: S(t | x) = S0(t) ^ exp(lp), so
 * S(N+7) / S(N) = (S0(N+7) / S0(N)) ^ exp(lp). `n + horizonDays` must be on the grid.
 */
export function modelProbability(model: ClosureModel, svc: ServiceBaseline, neighborhood: string, n: number): number {
  const s0n = svc.baselineSurvival[n]
  const ratio = s0n > 0 ? svc.baselineSurvival[n + model.horizonDays] / s0n : 0
  return Math.min(1, Math.max(0, 1 - Math.pow(ratio, Math.exp(linearPredictor(model, neighborhood)))))
}

/** Days between the model's extract cutoff and `now`. */
export function modelAgeDays(model: ClosureModel, now: number): number {
  return (now - Date.parse(model.extractCutoffUtc)) / MS_PER_DAY
}

/**
 * The model's chance of closure in the next 7 days, or the reason the page must fall back to
 * the service-wide figure. Checks run in the order a visitor would want explained.
 */
export function modelChanceOfClosure(
  model: ClosureModel,
  service: string,
  neighborhood: string,
  daysWaited: number,
  { now = Date.now(), requireRelease = true }: ModelOptions = {},
): NeighborhoodChance {
  const fallback = (reason: ModelFallback): NeighborhoodChance => ({ kind: 'fallback', reason })
  if (requireRelease && !model.release.passed) return fallback('not-released')
  if (modelAgeDays(model, now) > model.maxAgeDays) return fallback('stale')
  const svc = model.services[service]
  if (!svc) return fallback('unknown-service')
  if (!model.neighborhoods.includes(neighborhood)) return fallback('missing-neighborhood')
  const n = daysWaited
  const h = model.horizonDays
  if (!Number.isInteger(n) || n < 0 || n + h >= svc.baselineSurvival.length) return fallback('beyond-horizon')
  const neighborhoodCases = svc.neighborhoodCases[neighborhood] ?? 0
  const stillOpen = svc.atRisk[n]
  if (neighborhoodCases < model.minCases || stillOpen < model.minCases) return fallback('thin-sample')
  return {
    kind: 'model',
    p: modelProbability(model, svc, neighborhood, n),
    neighborhoodCases,
    serviceCases: svc.cases,
    stillOpen,
    dataThrough: new Date(model.extractCutoffUtc),
  }
}

let modelPromise: Promise<ClosureModel> | null = null

/** Fetch the static artifact once. A failure is not cached, so a later render can retry. */
export function loadClosureModel(): Promise<ClosureModel> {
  if (!modelPromise) {
    const base = import.meta.env?.BASE_URL ?? '/'
    modelPromise = fetch(`${base}model/boston-closure-forecast.json`)
      .then((res) => {
        if (!res.ok) throw new Error(`closure model: HTTP ${res.status}`)
        return res.json()
      })
      .then(parseClosureModel)
      .catch((err) => {
        modelPromise = null
        throw err
      })
  }
  return modelPromise
}
