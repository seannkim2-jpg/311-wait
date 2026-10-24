export type WaitUnit = 'hours' | 'days'

export interface Wait {
  value: number
  unit: WaitUnit
}

/** Pick a plain unit for a duration: hours under a day, days (one decimal) from there. */
export function toWait(hours: number, unit?: WaitUnit): Wait {
  const u: WaitUnit = unit ?? (hours < 24 ? 'hours' : 'days')
  return { value: u === 'hours' ? hours : hours / 24, unit: u }
}

export function waitDigits(w: Wait): number {
  return w.unit === 'hours' && w.value >= 10 ? 0 : 1
}

export function formatNumber(value: number, digits = 1): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

export function unitLabel(w: Wait): string {
  const singular = Math.abs(w.value - 1) < 0.05
  return w.unit === 'hours' ? (singular ? 'hour' : 'hours') : singular ? 'day' : 'days'
}

/** "14.7 days", "11 hours". */
export function formatWait(hours: number): string {
  const w = toWait(hours)
  return `${formatNumber(w.value, waitDigits(w))} ${unitLabel(w)}`
}

export function formatInt(n: number): string {
  return n.toLocaleString('en-US')
}

export function formatPct(share: number, digits = 1): string {
  return `${formatNumber(share * 100, digits)}%`
}

/** REQ-13: "data.boston.gov · queried YYYY-MM-DD HH:MM ET". */
export function formatQueried(d: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')} ET`
}

export function isoDateET(d: Date): string {
  return formatQueried(d).slice(0, 10)
}

/** Lower-case a service name for use mid-sentence, keeping acronyms. */
export function inSentence(service: string): string {
  return service
    .split(' ')
    .map((w) => (w === w.toUpperCase() && w.length > 1 ? w : w.toLowerCase()))
    .join(' ')
}
