/**
 * Cambridge 311 data access (make-the-case, MC-08).
 *
 * Commonwealth Connect service requests on data.cambridgema.gov (Socrata dataset 2z9k-mv9g),
 * CORS-open and keyless. The dataset now carries ticket_closed_date_time, so the same
 * estimators apply as for Boston, with no last-updated proxy.
 *
 * Shown as its own city only: never pooled with Boston, charted with it or ranked against it.
 */
import type { Observation } from './boston311'

const ENDPOINT = 'https://data.cambridgema.gov/resource/2z9k-mv9g.json'
export const CAMBRIDGE_DATASET = '2z9k-mv9g'
export const CAMBRIDGE_SOURCE = 'https://data.cambridgema.gov/d/2z9k-mv9g'
/** Same window as Boston so the two pages describe the same months. */
export const CAMBRIDGE_COHORT_START = '2026-07-01T00:00:00'
export const OPEN_STATUSES = ['Open', 'Acknowledged'] as const
export const CLOSED_STATUSES = ['Closed', 'Archived'] as const

export interface CambridgeRow {
  ticket_status: string
  ticket_created_date_time: string
  ticket_closed_date_time?: string | null
}

export interface CambridgeType {
  issueType: string
  n: number
}

async function soql<T>(query: string): Promise<T[]> {
  const res = await fetch(`${ENDPOINT}?$query=${encodeURIComponent(query)}`)
  if (!res.ok) throw new Error(`Cambridge query failed: HTTP ${res.status}`)
  return (await res.json()) as T[]
}

/** SoQL string literal: single quotes, doubled inside. */
function soqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`
}

/**
 * Socrata floating timestamps carry no zone. Both ends of every duration are read the same way,
 * so durations are exact; read as UTC only to get a number.
 */
export function parseCambridgeTime(ts: string): number {
  const ms = Date.parse(`${ts.slice(0, 19)}Z`)
  if (Number.isNaN(ms)) throw new Error(`Unparseable timestamp: ${ts}`)
  return ms
}

const COHORT = `ticket_created_date_time >= ${soqlString(CAMBRIDGE_COHORT_START)}`

/** Cambridge's own extract cutoff: its latest created, closed or updated timestamp. */
export async function fetchCambridgeCutoff(): Promise<number> {
  const [r] = await soql<Record<string, string | undefined>>(
    'SELECT max(ticket_created_date_time) AS a, max(ticket_closed_date_time) AS b, max(ticket_last_updated_date_time) AS c',
  )
  return Math.max(...Object.values(r).filter((v): v is string => !!v).map(parseCambridgeTime))
}

/** Issue types in the cohort with at least `min` tickets, largest first. */
export async function fetchCambridgeTypes(min = 200): Promise<CambridgeType[]> {
  const rows = await soql<{ issue_type?: string; n: string }>(
    `SELECT issue_type, count(*) AS n WHERE ${COHORT} GROUP BY issue_type ORDER BY n DESC LIMIT 200`,
  )
  return rows
    .filter((r) => r.issue_type && Number(r.n) >= min)
    .map((r) => ({ issueType: r.issue_type!, n: Number(r.n) }))
}

/** Rows for one issue type, or every type when `issueType` is null. No address or location fields. */
export async function fetchCambridgeRows(issueType: string | null): Promise<CambridgeRow[]> {
  const where = issueType === null ? COHORT : `${COHORT} AND issue_type = ${soqlString(issueType)}`
  const rows = await soql<CambridgeRow>(
    `SELECT ticket_status, ticket_created_date_time, ticket_closed_date_time WHERE ${where} LIMIT 50000`,
  )
  if (rows.length >= 50000) throw new Error('Cambridge query hit the row cap')
  return rows
}

/**
 * Open and Acknowledged are still open, censored at `censorAt`. Closed and Archived with a close
 * time are events. Closed or Archived with no close time are left out and counted, never guessed.
 * Statuses outside both lists are ignored.
 */
export function toCambridgeObservations(rows: CambridgeRow[], censorAt: number) {
  const obs: Observation[] = []
  let excludedNoCloseTime = 0
  const open = new Set<string>(OPEN_STATUSES)
  const closed = new Set<string>(CLOSED_STATUSES)
  for (const r of rows) {
    const opened = parseCambridgeTime(r.ticket_created_date_time)
    if (open.has(r.ticket_status)) {
      const hours = (censorAt - opened) / 3_600_000
      if (hours >= 0) obs.push({ hours, cause: 0 })
    } else if (closed.has(r.ticket_status)) {
      if (!r.ticket_closed_date_time) {
        excludedNoCloseTime++
        continue
      }
      const hours = (parseCambridgeTime(r.ticket_closed_date_time) - opened) / 3_600_000
      if (hours >= 0) obs.push({ hours, cause: 1 })
    }
  }
  return { obs, excludedNoCloseTime }
}
