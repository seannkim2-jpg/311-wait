/**
 * The two cities the calculator can read, and what each one's data supports.
 *
 * Each entry pairs the fetchers for that city with the capability flags the page needs: a
 * section that depends on data a city does not publish is not rendered for that city rather
 * than rendered with a zero in it.
 */
import * as boston from '../lib/boston311'
import * as cambridge from '../lib/cambridge311'
import { loadCambridgeAudit } from './cambridge'
import type { CohortTotals, Observation, ServiceCount } from '../lib/boston311'

export type CityKey = 'boston' | 'cambridge'

export interface City {
  key: CityKey
  /** "Boston", for sentences */
  name: string
  /** the request system's own name, for attribution */
  system: string
  source: string
  sourceUrl: string
  cohortStart: string
  defaultService: string
  /** chips shown before "more" in the picker */
  featured: string[]
  /** what one row is called in copy: singular, plural */
  caseWord: [string, string]
  /** what the picker is choosing between */
  typeWord: string
  /** publishes a closure reason, so resolved can be split from administratively closed */
  hasOutcomes: boolean
  /** publishes a target close date, so an on-time share can be computed */
  hasTargets: boolean
  hasNeighborhoods: boolean
  hasMap: boolean
  /** shown wherever this city's figures appear next to the other's */
  caveat?: string
  fetchServices: () => Promise<ServiceCount[]>
  fetchCutoff: () => Promise<number>
  fetchTotals: (cutoff: number) => Promise<CohortTotals>
  /** fetch and convert in one step, so the differing row shapes stay inside each city's module */
  loadObservations: (service: string, censorAt: number) => Promise<Observation[]>
}

export const CITIES: Record<CityKey, City> = {
  boston: {
    key: 'boston',
    name: 'Boston',
    system: '311',
    source: 'data.boston.gov',
    sourceUrl: 'https://data.boston.gov/dataset/311-service-requests',
    cohortStart: boston.COHORT_START,
    defaultService: 'Street Light Outage',
    featured: ['Street Light Outage', 'Sidewalk Repair', 'Pothole', 'Litter & Debris'],
    caseWord: ['case', 'cases'],
    typeWord: 'service',
    hasOutcomes: true,
    hasTargets: true,
    hasNeighborhoods: true,
    hasMap: true,
    fetchServices: () => boston.fetchServices(200),
    fetchCutoff: boston.fetchExtractCutoff,
    fetchTotals: boston.fetchCohortTotals,
    loadObservations: async (service, censorAt) =>
      boston.toObservations(await boston.fetchServiceCases(service), censorAt),
  },
  cambridge: {
    key: 'cambridge',
    name: 'Cambridge',
    system: 'Commonwealth Connect',
    source: 'data.cambridgema.gov',
    sourceUrl: 'https://data.cambridgema.gov/dataset/Commonwealth-Connect-Service-Requests/2z9k-mv9g',
    cohortStart: cambridge.CAMBRIDGE_COHORT_START.slice(0, 10),
    defaultService: 'Tree Pruning Request',
    featured: ['Tree Pruning Request', 'Pothole', 'Vehicle blocking a bike lane', 'Sidewalk Defect'],
    caseWord: ['ticket', 'tickets'],
    typeWord: 'issue type',
    hasOutcomes: false,
    hasTargets: false,
    hasNeighborhoods: false,
    hasMap: false,
    caveat:
      'Cambridge runs Commonwealth Connect (SeeClickFix), a different system from Boston 311: it ' +
      'publishes no target dates and no closure reasons, and its issue types are its own. The wait ' +
      'calculation is the same; the two cities are not comparable type for type.',
    fetchServices: async () => (await cambridge.fetchCambridgeTypes(60)).map((t) => ({ service_name: t.issueType, n: t.n })),
    fetchCutoff: cambridge.fetchCambridgeCutoff,
    fetchTotals: async () => {
      const a = await loadCambridgeAudit(null)
      return { cohortN: a.n, closed: a.n - a.open, openNow: a.open, openOverdue: null, closedUnresolved: null }
    },
    loadObservations: async (service, censorAt) =>
      cambridge.toCambridgeObservations(await cambridge.fetchCambridgeRows(service), censorAt).obs,
  },
}

export const CITY_KEYS = Object.keys(CITIES) as CityKey[]
