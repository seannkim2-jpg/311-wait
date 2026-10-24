/**
 * Boston 311 data access.
 *
 * Queries data.boston.gov's CKAN SQL endpoint straight from the browser. It sends
 * `Access-Control-Allow-Origin: *` and needs no API key, which is why this app has no
 * backend.
 */

const RESOURCE = '254adca6-64ab-4c5c-9fc0-a6da622be185'
const SQL_ENDPOINT = 'https://data.boston.gov/api/3/action/datastore_search_sql'

/**
 * Cases opened before this date are excluded from every query.
 *
 * The resource claims to span 2025-08-01 to now, but it is not a complete record: Sep-2025
 * holds 418 cases against Sep-2026's 15,573. Early months retain only cases that stayed open
 * or were touched recently, so they are enriched for slow cases — left truncation plus
 * selection on survival. July 2026 onward is internally consistent at 13-15k/month.
 */
export const COHORT_START = '2026-07-01'

/**
 * Closure reasons that are not a resolution. Per the 311 data dictionary, Noted means no action
 * is required and Transitioned means reassigned to another agency.
 */
export const UNRESOLVED_REASONS = ['Noted', 'Transitioned'] as const

export type Cause = 0 | 1 | 2 // 0 censored, 1 closed any other way, 2 closed as Noted/Transitioned

export interface CaseRow {
  case_status: string
  closure_reason: string | null
  open_date: string
  close_date: string | null
}

export interface Observation {
  hours: number
  cause: Cause
}

export interface CohortTotals {
  cohortN: number
  closed: number
  openNow: number
  openOverdue: number
  closedUnresolved: number
}

export interface ServiceCount {
  service_name: string
  n: number
}

async function runSql<T>(sql: string): Promise<T[]> {
  const res = await fetch(`${SQL_ENDPOINT}?sql=${encodeURIComponent(sql)}`)
  if (!res.ok) throw new Error(`Boston 311 query failed: HTTP ${res.status}`)
  const body = await res.json()
  if (!body?.success) {
    throw new Error(`Boston 311 query rejected: ${body?.error?.message ?? 'unknown error'}`)
  }
  return body.result.records as T[]
}

/** Single-quote escaping for values interpolated into SQL. */
function quote(value: string): string {
  return `'${value.replace(/'/g, "''")}'`
}

const COHORT_FILTER = `open_date::timestamp >= ${quote(COHORT_START)}`

/**
 * The three headline tiles. One round trip.
 *
 * "Overdue" compares target_close_date with the extract cutoff rather than reading on_time:
 * the flag lags for open cases (Street Light Outage cases months past target still read ONTIME).
 */
export async function fetchCohortTotals(cutoff: number): Promise<CohortTotals> {
  const cut = quote(new Date(cutoff).toISOString())
  const unresolved = UNRESOLVED_REASONS.map(quote).join(',')
  const rows = await runSql<Record<string, string>>(`
    SELECT COUNT(*) AS cohort_n,
           SUM(CASE WHEN case_status='Closed' THEN 1 ELSE 0 END) AS closed,
           SUM(CASE WHEN case_status='In progress' THEN 1 ELSE 0 END) AS open_now,
           SUM(CASE WHEN case_status='In progress' AND target_close_date::timestamptz < ${cut}::timestamptz THEN 1 ELSE 0 END) AS open_overdue,
           SUM(CASE WHEN case_status='Closed' AND closure_reason IN (${unresolved}) THEN 1 ELSE 0 END) AS closed_unresolved
    FROM "${RESOURCE}"
    WHERE ${COHORT_FILTER}`)
  const r = rows[0]
  return {
    cohortN: Number(r.cohort_n),
    closed: Number(r.closed),
    openNow: Number(r.open_now),
    openOverdue: Number(r.open_overdue),
    closedUnresolved: Number(r.closed_unresolved),
  }
}

/**
 * Service types in the cohort, most common first.
 *
 * Driving the picker from the data rather than a hardcoded list is deliberate: it answers
 * the "how do we know you didn't cherry-pick the services" objection.
 */
export async function fetchServices(minCases = 200): Promise<ServiceCount[]> {
  const rows = await runSql<Record<string, string>>(`
    SELECT service_name, COUNT(*) AS n
    FROM "${RESOURCE}"
    WHERE ${COHORT_FILTER} AND case_status IN ('Closed','In progress')
    GROUP BY service_name
    HAVING COUNT(*) >= ${Math.floor(minCases)}
    ORDER BY n DESC`)
  return rows.map((r) => ({ service_name: r.service_name, n: Number(r.n) }))
}

/** Raw case rows for one service. Durations are computed client-side. */
export async function fetchServiceCases(serviceName: string, limit = 32000): Promise<CaseRow[]> {
  return runSql<CaseRow>(`
    SELECT case_status, closure_reason, open_date, close_date
    FROM "${RESOURCE}"
    WHERE ${COHORT_FILTER}
      AND service_name = ${quote(serviceName)}
      AND case_status IN ('Closed','In progress')
    LIMIT ${Math.floor(limit)}`)
}

/** On-time counts per neighborhood, for the Wilson-interval table. */
export async function fetchNeighborhoodOnTime(serviceName: string) {
  const rows = await runSql<Record<string, string>>(`
    SELECT neighborhood,
           COUNT(*) AS n,
           SUM(CASE WHEN on_time='ONTIME' THEN 1 ELSE 0 END) AS ontime
    FROM "${RESOURCE}"
    WHERE ${COHORT_FILTER}
      AND service_name = ${quote(serviceName)}
      AND case_status='Closed'
      AND neighborhood IS NOT NULL
    GROUP BY neighborhood
    ORDER BY n DESC`)
  return rows.map((r) => ({
    neighborhood: r.neighborhood,
    n: Number(r.n),
    onTime: Number(r.ontime),
  }))
}

/**
 * When the city cut the current extract: the latest open or close timestamp in the data.
 * Open cases must be censored here, not at Date.now() — the extract is refreshed about once a
 * day, so "now" would pad every open case's wait by however stale the extract is.
 */
export async function fetchExtractCutoff(): Promise<number> {
  const [r] = await runSql<{ mo: string; mc: string }>(
    `SELECT MAX(open_date::timestamptz) AS mo, MAX(close_date::timestamptz) AS mc FROM "${RESOURCE}"`,
  )
  return Math.max(parseTimestamp(r.mo), parseTimestamp(r.mc))
}

export function parseTimestamp(ts: string): number {
  // CKAN returns "2026-07-14 10:56:30.994145+00"; make it ISO-8601 so Date can read it.
  const iso = ts.trim().replace(' ', 'T').replace(/\+00(:00)?$/, 'Z')
  const ms = Date.parse(iso.endsWith('Z') ? iso : `${iso}Z`)
  if (Number.isNaN(ms)) throw new Error(`Unparseable timestamp: ${ts}`)
  return ms
}

/**
 * Turn raw rows into survival observations.
 *
 * Closed cases are events, dated by `close_date`. Cases still in progress are censored at
 * `censorAt`, which should come from fetchExtractCutoff(). A closure reason of Noted or
 * Transitioned is a *competing event* (cause 2), not censoring — treating it as censored would
 * assume the case would eventually be resolved.
 */
export function toObservations(rows: CaseRow[], censorAt: number): Observation[] {
  const out: Observation[] = []
  const unresolved = new Set<string>(UNRESOLVED_REASONS)
  for (const row of rows) {
    const opened = parseTimestamp(row.open_date)
    if (row.case_status === 'Closed' && row.close_date) {
      const hours = (parseTimestamp(row.close_date) - opened) / 3_600_000
      if (hours < 0) continue // clock-skew rows; dropping is safer than clamping to 0
      out.push({ hours, cause: unresolved.has(row.closure_reason ?? '') ? 2 : 1 })
    } else if (row.case_status === 'In progress') {
      const hours = (censorAt - opened) / 3_600_000
      if (hours >= 0) out.push({ hours, cause: 0 })
    }
  }
  return out
}

// ---------------------------------------------------------------------------
// Single-case lookup (make-the-case, MC-02 / MC-03)
// ---------------------------------------------------------------------------

/** Every case ID in the resource has this shape (checked by scripts/check_make_the_case.py). */
export const CASE_ID_PATTERN = /^BCS-\d{8}$/

/**
 * Normalise what a resident typed (trim, upper-case) and accept it only if it is exactly a case
 * ID. Anything else returns null and must never reach a query.
 */
export function parseCaseId(input: string): string | null {
  const id = input.trim().toUpperCase()
  return CASE_ID_PATTERN.test(id) ? id : null
}

export interface CaseRecord {
  case_id: string
  service_name: string
  case_status: string
  closure_reason: string | null
  open_date: string
  close_date: string | null
  target_close_date: string | null
  city_council_district: string | null
}

/**
 * One case by exact ID. Asks for no address, street, coordinate, photo or comment fields: the
 * page shows only what the resident needs about their own request.
 */
export async function fetchCase(caseId: string): Promise<CaseRecord | null> {
  // Re-checked here so no caller can skip validation; the value is then also quoted.
  if (!CASE_ID_PATTERN.test(caseId)) throw new Error('Not a case ID')
  const rows = await runSql<CaseRecord>(`
    SELECT case_id, service_name, case_status, closure_reason, open_date, close_date,
           target_close_date, city_council_district
    FROM "${RESOURCE}"
    WHERE case_id = ${quote(caseId)}
    LIMIT 2`)
  return rows[0] ?? null
}
