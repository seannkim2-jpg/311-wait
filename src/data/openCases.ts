/**
 * Open cases for the map: every case in the cohort that is still in progress right now.
 *
 * Privacy: coordinates are rounded to 3 decimal places (about 100 m) inside the query, so the
 * exact reported spot never reaches the browser. No address fields are requested.
 */
import { COHORT_START } from '../lib/boston311'
import { loadExtractCutoff } from './audit'

const RESOURCE = '254adca6-64ab-4c5c-9fc0-a6da622be185'
const SQL_ENDPOINT = 'https://data.boston.gov/api/3/action/datastore_search_sql'

export interface OpenCase {
  service: string
  neighborhood: string | null
  overdue: boolean
  lat: number
  lon: number
}

export interface HoodCount {
  neighborhood: string
  open: number
  overdue: number
}

let openPromise: Promise<OpenCase[]> | null = null

export function loadOpenCases(): Promise<OpenCase[]> {
  if (openPromise) return openPromise
  const sql = `
    SELECT service_name, neighborhood, target_close_date,
           ROUND(CAST(latitude AS numeric), 3) AS lat,
           ROUND(CAST(longitude AS numeric), 3) AS lon
    FROM "${RESOURCE}"
    WHERE open_date::timestamp >= '${COHORT_START}'
      AND case_status = 'In progress'
      AND latitude <> '' AND longitude <> ''`
  openPromise = Promise.all([fetch(`${SQL_ENDPOINT}?sql=${encodeURIComponent(sql)}`), loadExtractCutoff('boston')])
    .then(async ([res, cutoff]) => {
      if (!res.ok) throw new Error(`Boston 311 query failed: HTTP ${res.status}`)
      const body = await res.json()
      if (!body?.success) throw new Error(body?.error?.message ?? 'Boston 311 query rejected')
      return (body.result.records as Record<string, string | null>[])
        .map((r) => ({
          service: r.service_name ?? '',
          neighborhood: r.neighborhood || null,
          // Dates, not on_time: the flag lags for open cases (Street Light months past target reads ONTIME).
          overdue: !!r.target_close_date && Date.parse(r.target_close_date.replace(' ', 'T').replace(/\+00(:00)?$/, 'Z')) < cutoff,
          lat: Number(r.lat),
          lon: Number(r.lon),
        }))
        .filter((c) => Number.isFinite(c.lat) && Number.isFinite(c.lon))
    })
    .catch((err) => {
      openPromise = null
      throw err
    })
  return openPromise
}

/** Count open and past-deadline cases per neighbourhood, largest first. */
export function countByNeighborhood(cases: OpenCase[]): { rows: HoodCount[]; unassigned: number } {
  const map = new Map<string, HoodCount>()
  let unassigned = 0
  for (const c of cases) {
    if (!c.neighborhood) {
      unassigned++
      continue
    }
    const row = map.get(c.neighborhood) ?? { neighborhood: c.neighborhood, open: 0, overdue: 0 }
    row.open++
    if (c.overdue) row.overdue++
    map.set(c.neighborhood, row)
  }
  const rows = [...map.values()].sort((a, b) => b.overdue - a.overdue || b.open - a.open)
  return { rows, unassigned }
}
