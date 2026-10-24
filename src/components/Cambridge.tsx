import { useEffect, useId, useState } from 'react'
import { CAMBRIDGE_SOURCE } from '../lib/cambridge311'
import type { CambridgeType } from '../lib/cambridge311'
import { loadCambridgeAudit, loadCambridgeTypes, type CambridgeAudit } from '../data/cambridge'
import { formatInt, formatWait } from '../data/format'
import { useInViewOnce } from '../hooks/motion'

const localFmt = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })

/**
 * MC-08. Cambridge's Commonwealth Connect requests through the same estimators. Shown on its
 * own: never pooled with Boston, put on the same chart, or ranked against it.
 */
export function Cambridge() {
  const selectId = useId()
  const { ref, seen } = useInViewOnce<HTMLDivElement>('0px 0px 200px 0px')
  const [types, setTypes] = useState<CambridgeType[] | null>(null)
  const [type, setType] = useState<string | null>(null)
  const [audit, setAudit] = useState<CambridgeAudit | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!seen) return
    let alive = true
    loadCambridgeTypes()
      .then((t) => alive && setTypes(t))
      .catch((e: Error) => alive && setError(e.message))
    return () => {
      alive = false
    }
  }, [seen, attempt])

  useEffect(() => {
    if (!seen) return
    let alive = true
    setError(null)
    loadCambridgeAudit(type)
      .then((a) => alive && setAudit(a))
      .catch((e: Error) => alive && setError(e.message))
    return () => {
      alive = false
    }
  }, [seen, type, attempt])

  const loading = !audit || audit.issueType !== type
  const total = types?.reduce((s, t) => s + t.n, 0)

  return (
    <div ref={ref}>
      <label htmlFor={selectId} className="block text-[0.9375rem] font-semibold">
        Request type
      </label>
      <select
        id={selectId}
        value={type ?? ''}
        onChange={(e) => setType(e.target.value || null)}
        className="mt-2 min-h-[48px] w-full max-w-[28rem] rounded-xl border border-rule bg-white px-4 text-[0.9375rem] text-ink"
      >
        <option value="">All request types</option>
        {types?.map((t) => (
          <option key={t.issueType} value={t.issueType}>
            {t.issueType} ({formatInt(t.n)})
          </option>
        ))}
      </select>
      {types && total !== undefined && (
        <p className="mt-2 text-sm text-ink-3">Types with at least 200 tickets since July are listed; &ldquo;All&rdquo; includes every type.</p>
      )}

      {error && (
        <div role="alert" className="mt-6 flex flex-wrap items-center gap-3 rounded-2xl bg-overdue-soft px-5 py-4 text-[0.9375rem]">
          <span>Cambridge&rsquo;s open-data service did not answer ({error}).</span>
          <button type="button" onClick={() => setAttempt((n) => n + 1)} className="min-h-[40px] rounded-full bg-ink px-4 font-semibold text-white">
            Try again
          </button>
        </div>
      )}

      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {audit && !loading
          ? `${audit.issueType ?? 'All Cambridge requests'}: median among closed tickets ${formatWait(audit.closedMedianHours)}, estimate including open tickets ${
              audit.kmMedianHours !== null ? formatWait(audit.kmMedianHours) : `more than ${Math.floor(audit.maxDays)} days`
            }.`
          : ''}
      </p>
      <div aria-busy={loading} className="mt-8">
        {audit && (
          <div className={`transition-opacity duration-200 ${loading ? 'opacity-50' : 'opacity-100'}`}>
            <p className="text-xl font-semibold tracking-[-0.01em]">{audit.issueType ?? 'All Cambridge requests'}</p>
            <ul className="mt-5 max-w-[40rem] space-y-5">
              <Bar
                label="Median among closed tickets"
                value={formatWait(audit.closedMedianHours)}
                share={audit.closedMedianHours / Math.max(audit.closedMedianHours, audit.kmMedianHours ?? audit.maxDays * 24)}
                tone="city"
              />
              <Bar
                label="Estimate including open tickets"
                value={audit.kmMedianHours !== null ? formatWait(audit.kmMedianHours) : `more than ${Math.floor(audit.maxDays)} days`}
                share={1}
                tone="data"
                openEnded={audit.kmMedianHours === null}
              />
            </ul>
            <p className="figure mt-6 text-[0.9375rem] text-ink-2">
              {formatInt(audit.open)} of {formatInt(audit.n)} tickets still open (Open or Acknowledged).{' '}
              {audit.excludedNoCloseTime > 0 &&
                `${formatInt(audit.excludedNoCloseTime)} closed tickets had no close time and are left out.`}
            </p>
          </div>
        )}
        {!audit && !error && <div aria-hidden className="h-40 max-w-[40rem] rounded-2xl bg-white" />}
      </div>

      <p className="mt-8 max-w-[70ch] text-sm leading-relaxed text-ink-3">
        Source:{' '}
        <a href={CAMBRIDGE_SOURCE} className="text-ink underline underline-offset-2">
          Cambridge Commonwealth Connect service requests
        </a>{' '}
        (data.cambridgema.gov, dataset 2z9k-mv9g), tickets created since 1 July 2026
        {audit ? `, extract of ${localFmt.format(audit.cutoff)} Cambridge time` : ''}. Same estimators as
        Boston. Shown on its own: the two cities use different request types and systems, so the
        figures are not lined up against Boston&rsquo;s.
      </p>
    </div>
  )
}

function Bar({ label, value, share, tone, openEnded = false }: { label: string; value: string; share: number; tone: 'city' | 'data'; openEnded?: boolean }) {
  const scale = Math.max(0.015, Math.min(1, share))
  return (
    <li>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4">
        <span className="font-semibold">{label}</span>
        <span className={`figure font-display text-2xl font-bold tracking-[-0.02em] ${tone === 'data' ? 'text-data' : 'text-city-text'}`}>{value}</span>
      </div>
      <div className="mt-2 h-3 overflow-hidden rounded-full bg-white">
        <div
          className={`motion-bar h-full origin-left rounded-full ${tone === 'data' ? 'bg-data' : 'bg-city'}`}
          style={{
            transform: `scaleX(${scale})`,
            transition: 'transform 700ms var(--ease-out)',
            ...(openEnded ? { maskImage: 'linear-gradient(90deg, #000 78%, transparent)', WebkitMaskImage: 'linear-gradient(90deg, #000 78%, transparent)' } : {}),
          }}
        />
      </div>
    </li>
  )
}
