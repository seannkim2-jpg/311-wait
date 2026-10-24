/** View model for the Cambridge section (MC-08): same estimators, Cambridge's own data. */
import {
  CAMBRIDGE_COHORT_START,
  fetchCambridgeCutoff,
  fetchCambridgeRows,
  fetchCambridgeTypes,
  toCambridgeObservations,
  type CambridgeType,
} from '../lib/cambridge311'
import { kaplanMeier, naiveMedian } from '../lib/stats'

export interface CambridgeAudit {
  issueType: string | null
  n: number
  open: number
  excludedNoCloseTime: number
  /** median among closed tickets, hours */
  closedMedianHours: number
  /** Kaplan–Meier median including open tickets, hours; null when fewer than half have closed */
  kmMedianHours: number | null
  maxDays: number
  cutoff: number
}

let cutoffP: Promise<number> | null = null
let typesP: Promise<CambridgeType[]> | null = null
const audits = new Map<string, Promise<CambridgeAudit>>()

const retryable = <T>(p: Promise<T>, reset: () => void) =>
  p.catch((e) => {
    reset()
    throw e
  })

export function loadCambridgeTypes(): Promise<CambridgeType[]> {
  typesP ??= retryable(fetchCambridgeTypes(200), () => (typesP = null))
  return typesP
}

function loadCutoff(): Promise<number> {
  cutoffP ??= retryable(fetchCambridgeCutoff(), () => (cutoffP = null))
  return cutoffP
}

export function loadCambridgeAudit(issueType: string | null): Promise<CambridgeAudit> {
  const key = issueType ?? '\u0000all'
  let p = audits.get(key)
  if (!p) {
    p = retryable(build(issueType), () => audits.delete(key))
    audits.set(key, p)
  }
  return p
}

async function build(issueType: string | null): Promise<CambridgeAudit> {
  const [rows, cutoff] = await Promise.all([fetchCambridgeRows(issueType), loadCutoff()])
  const { obs, excludedNoCloseTime } = toCambridgeObservations(rows, cutoff)
  const km = kaplanMeier(obs.map((o) => ({ hours: o.hours, event: o.cause !== 0 })))
  const closed = obs.filter((o) => o.cause !== 0).map((o) => o.hours)
  return {
    issueType,
    n: obs.length,
    open: obs.length - closed.length,
    excludedNoCloseTime,
    closedMedianHours: naiveMedian(closed),
    kmMedianHours: km.median,
    maxDays: (cutoff - Date.parse(`${CAMBRIDGE_COHORT_START}Z`)) / 86_400_000,
    cutoff,
  }
}
