/**
 * View model for "Where does my case stand?" (make-the-case, MC-03..MC-07).
 * Reuses the service audit the rest of the page already loads; the only new statistic is
 * conditionalClose(), read off the same Kaplan–Meier curve.
 */
import { COHORT_START, fetchCase, parseTimestamp, type CaseRecord } from '../lib/boston311'
import { conditionalClose } from '../lib/stats'
import { loadServiceAudit, type ServiceAudit } from './audit'
import { formatWait } from './format'

export const WINDOW_DAYS = 14
export const MIN_SIMILAR = 30
export const COUNCIL_URL = 'https://www.boston.gov/departments/city-council'
const HOUR = 3_600_000
const DAY = 24 * HOUR

export type CaseState = 'open-past-target' | 'open-on-track' | 'open-no-target' | 'transitioned' | 'noted' | 'closed' | 'other'

export type Chance =
  | { kind: 'shown'; in100: number; similar: number; ageDays: number }
  | { kind: 'too-few'; similar: number; ageDays: number }
  | { kind: 'beyond-data'; ageDays: number; maxDays: number }

export interface CaseView {
  record: CaseRecord
  state: CaseState
  opened: number
  closedAt: number | null
  target: number | null
  cutoff: number
  /** open: days since reported, to the extract cutoff; closed: days it took to close */
  days: number
  daysPastTarget: number | null
  district: string | null
  closureLabel: string | null
  audit: ServiceAudit | null
  chance: Chance | null
  request: string | null
  summary: string
}

export type LookupResult =
  | { kind: 'found'; view: CaseView }
  | { kind: 'not-found'; id: string }
  | { kind: 'before-cohort'; id: string; record: CaseRecord }

export function closureLabel(reason: string | null): string | null {
  if (!reason) return null
  if (reason === 'Noted') return 'Noted (no action required)'
  if (reason === 'Transitioned') return 'Transitioned (reassigned to another agency)'
  return reason
}

/** One specific, reasonable request that fits the case (plan table). */
export function requestFor(state: CaseState): string | null {
  switch (state) {
    case 'open-past-target':
    case 'open-no-target':
      return 'Please give a completion date for this case.'
    case 'open-on-track':
      return 'Please confirm it is still on track for the target date.'
    case 'transitioned':
      return 'Please confirm which agency now has this case.'
    case 'noted':
      return 'Please confirm what was decided on this request.'
    default:
      return null
  }
}

/** Number of observed durations strictly greater than `hours` (cases seen past that age). */
export function countBeyond(sortedHours: number[], hours: number): number {
  let lo = 0
  let hi = sortedHours.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (sortedHours[mid] <= hours) lo = mid + 1
    else hi = mid
  }
  return sortedHours.length - lo
}

/**
 * Read at the whole number of days the sentence states ("still open after 33 days"), so the
 * words and the figure describe exactly the same group of cases.
 */
export function chanceFor(audit: ServiceAudit, ageHours: number): Chance {
  const ageDays = Math.floor(ageHours / 24)
  const at = ageDays * 24
  const horizon = audit.sortedHours[audit.sortedHours.length - 1] ?? 0
  const c = conditionalClose(audit.km, at, WINDOW_DAYS * 24, horizon)
  if (c === null) return { kind: 'beyond-data', ageDays, maxDays: Math.floor(horizon / 24) }
  const similar = countBeyond(audit.sortedHours, at)
  if (similar < MIN_SIMILAR) return { kind: 'too-few', similar, ageDays }
  return { kind: 'shown', in100: Math.round(c * 100), similar, ageDays }
}

export function chanceSentence(service: string, ch: Chance): string {
  if (ch.kind === 'shown') {
    return `Historically, of similar ${service} cases still open after ${ch.ageDays} days, ${ch.in100} in 100 closed in the following ${WINDOW_DAYS} days (${ch.similar.toLocaleString('en-US')} similar cases).`
  }
  if (ch.kind === 'too-few') {
    return `Fewer than ${MIN_SIMILAR} similar ${service} cases were still open after ${ch.ageDays} days, too few to say how often they closed in the next ${WINDOW_DAYS} days.`
  }
  return `At ${ch.ageDays} days open, the next ${WINDOW_DAYS} days run past the longest wait the data covers (about ${ch.maxDays} days), so it cannot say how often similar cases closed.`
}

const dateFmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', day: 'numeric', month: 'short', year: 'numeric' })
export const formatDate = (ms: number) => dateFmt.format(ms)

function stateOf(r: CaseRecord, target: number | null, cutoff: number): CaseState {
  if (r.case_status === 'In progress') {
    if (target === null) return 'open-no-target'
    return target < cutoff ? 'open-past-target' : 'open-on-track'
  }
  if (r.case_status === 'Closed') {
    if (r.closure_reason === 'Transitioned') return 'transitioned'
    if (r.closure_reason === 'Noted') return 'noted'
    return 'closed'
  }
  return 'other'
}

export function buildSummary(v: Omit<CaseView, 'summary'>, siteUrl: string): string {
  const r = v.record
  const lines = [`Boston 311 case ${r.case_id} (${r.service_name})`]
  if (v.state.startsWith('open')) {
    lines.push(`Status: open, ${Math.floor(v.days)} days since it was reported on ${formatDate(v.opened)}.`)
    if (v.target !== null) {
      lines.push(
        v.daysPastTarget !== null
          ? `Target date: ${formatDate(v.target)}. It is ${Math.floor(v.daysPastTarget)} days past that target.`
          : `Target date: ${formatDate(v.target)}, not yet reached.`,
      )
    }
  } else if (v.closedAt !== null) {
    lines.push(`Status: closed on ${formatDate(v.closedAt)}, ${formatWait(v.days * 24)} after it was reported${v.closureLabel ? `, as ${v.closureLabel}` : ''}.`)
  } else {
    lines.push(`Status: ${r.case_status}.`)
  }
  if (v.district) lines.push(`City council district: ${v.district}.`)
  if (v.audit) {
    const a = v.audit
    lines.push('', `${r.service_name} requests opened since ${formatDate(Date.parse(`${COHORT_START}T12:00:00Z`))}:`)
    lines.push(
      `- Median among closed cases: ${formatWait(a.cityMedianHours)}. Estimate including open cases: ${
        a.kmMedianHours !== null ? formatWait(a.kmMedianHours) : `more than ${Math.floor(a.maxDay)} days (fewer than half have closed)`
      }.`,
    )
    if (v.chance) lines.push(`- ${chanceSentence(r.service_name, v.chance)}`)
  }
  if (v.request) lines.push('', `Request: ${v.request}`)
  lines.push(
    '',
    `Source: Boston 311 open data (data.boston.gov), extract of ${formatDate(v.cutoff)}. Analysis: ${siteUrl}`,
    `Find your city councilor: ${COUNCIL_URL}`,
  )
  return lines.join('\n')
}

export async function lookUpCase(caseId: string, siteUrl: string): Promise<LookupResult> {
  const record = await fetchCase(caseId)
  if (!record) return { kind: 'not-found', id: caseId }
  const opened = parseTimestamp(record.open_date)
  if (opened < Date.parse(`${COHORT_START}T00:00:00Z`)) return { kind: 'before-cohort', id: caseId, record }

  const audit = await loadServiceAudit(record.service_name)
  const cutoff = audit.cutoff
  const target = record.target_close_date ? parseTimestamp(record.target_close_date) : null
  const closedAt = record.case_status === 'Closed' && record.close_date ? parseTimestamp(record.close_date) : null
  const state = stateOf(record, target, cutoff)
  const isOpen = state.startsWith('open')
  const ageHours = Math.max(0, ((closedAt ?? cutoff) - opened) / HOUR)
  const district = record.city_council_district && /^[1-9]$/.test(record.city_council_district) ? record.city_council_district : null

  const base: Omit<CaseView, 'summary'> = {
    record,
    state,
    opened,
    closedAt,
    target,
    cutoff,
    days: ageHours / 24,
    daysPastTarget: state === 'open-past-target' && target !== null ? (cutoff - target) / DAY : null,
    district,
    closureLabel: closureLabel(record.closure_reason),
    audit,
    chance: isOpen ? chanceFor(audit, ageHours) : null,
    request: requestFor(state),
  }
  return { kind: 'found', view: { ...base, summary: buildSummary(base, siteUrl) } }
}
