import { useEffect, useId, useMemo, useState, type ReactNode } from 'react'
import type { ServiceAudit } from '../data/audit'
import { formatInt, inSentence, isoDateET } from '../data/format'
import { useAfterFirstFrame, useTween } from '../hooks/motion'
import {
  HORIZON_DAYS,
  MIN_CASES,
  kmChanceOfClosure,
  loadClosureModel,
  maxDaysWaited,
  modelChanceOfClosure,
  type ClosureModel,
  type ModelFallback,
  type ServiceWideChance,
  type Unavailable,
} from '../lib/closureForecast'

const ANALYSIS = 'https://github.com/seannkim2-jpg/kiro-hackachusetts/blob/main/docs/ANALYSIS.md#closure-forecast'
const DEFAULT_DAYS = 7
const PRESETS = [
  { days: 0, label: 'Just filed' },
  { days: 7, label: '1 week' },
  { days: 14, label: '2 weeks' },
  { days: 30, label: '30 days' },
]

type ModelState = { status: 'loading' } | { status: 'ready'; model: ClosureModel } | { status: 'error' }

/** `?forecast=preview` shows the neighborhood control even when the model did not pass its gate. */
function previewRequested(): boolean {
  return typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('forecast') === 'preview'
}

/** "34%", with the ends kept honest: a rounded 0% or 100% would read as a certainty. */
function chanceText(p: number): string {
  if (p > 0 && p < 0.005) return 'under 1%'
  if (p < 1 && p > 0.995) return 'over 99%'
  return `${Math.round(p * 100)}%`
}

/** REQ-F07, REQ-F08: the "Already waiting?" block under the main answer. */
export function AlreadyWaiting({ audit }: { audit: ServiceAudit }) {
  const id = useId()
  const [daysText, setDaysText] = useState(String(DEFAULT_DAYS))
  const [hood, setHood] = useState('')
  const [modelState, setModelState] = useState<ModelState>({ status: 'loading' })
  const preview = useMemo(previewRequested, [])

  useEffect(() => {
    let alive = true
    loadClosureModel()
      .then((model) => alive && setModelState({ status: 'ready', model }))
      .catch(() => alive && setModelState({ status: 'error' }))
    return () => {
      alive = false
    }
  }, [])

  const service = audit.service
  const svc = inSentence(service)
  const maxDays = maxDaysWaited(audit.sortedHours)
  const typed = daysText.trim()
  const days = /^\d{1,4}$/.test(typed) && Number(typed) <= maxDays ? Number(typed) : null

  const model = modelState.status === 'ready' ? modelState.model : null
  const offerNeighborhood = model !== null && (model.release.passed || preview)
  const km = days === null ? null : kmChanceOfClosure(audit.kmSteps, audit.sortedHours, days)
  const nb =
    offerNeighborhood && hood && days !== null
      ? modelChanceOfClosure(model, service, hood, days, { requireRelease: !preview })
      : null
  const showNeighborhoodSlot = nb !== null

  return (
    <section
      aria-labelledby={`${id}-title`}
      className="animate-rise-in mt-14 rounded-[28px] border border-rule bg-mist px-5 py-7 sm:px-8 sm:py-9"
      style={{ animationDelay: '220ms' }}
    >
      <div className="grid gap-x-10 gap-y-8 lg:grid-cols-[1fr_1.15fr] lg:items-start">
        <div>
          <h2 id={`${id}-title`} className="font-display text-[clamp(1.5rem,2.6vw,2rem)] font-bold leading-tight tracking-[-0.025em]">
            Already waiting?
          </h2>
          <p className="mt-2 max-w-[46ch] text-[1.0625rem] leading-relaxed text-ink-2">
            Say how long your {svc} request has been open. We show how often requests that had
            already waited that long closed within the next {HORIZON_DAYS} days.
          </p>

          <div className="mt-6 flex flex-wrap items-end gap-x-5 gap-y-4">
            <div>
              <label htmlFor={`${id}-days`} className="block text-sm font-semibold">
                Days since you filed
              </label>
              <input
                id={`${id}-days`}
                type="number"
                inputMode="numeric"
                min={0}
                max={maxDays}
                step={1}
                value={daysText}
                onChange={(e) => setDaysText(e.target.value)}
                aria-invalid={days === null || undefined}
                aria-describedby={`${id}-days-hint`}
                className="figure mt-1.5 h-11 w-28 rounded-xl border border-rule bg-white px-3 text-lg font-semibold transition-[border-color,box-shadow] duration-150 ease-out aria-[invalid=true]:border-overdue"
              />
            </div>
            <div role="group" aria-label="Common waits" className="flex flex-wrap gap-2">
              {PRESETS.filter((p) => p.days <= maxDays).map((p) => {
                const active = days === p.days
                return (
                  <button
                    key={p.days}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setDaysText(String(p.days))}
                    className={[
                      'min-h-[44px] rounded-full border px-4 text-[0.9375rem] font-medium',
                      'transition-[background-color,border-color,color,transform] duration-150 ease-out active:scale-[0.96]',
                      active ? 'border-ink bg-ink text-white' : 'border-rule bg-white text-ink hover:border-ink-3',
                    ].join(' ')}
                  >
                    {p.label}
                  </button>
                )
              })}
            </div>
          </div>
          <p id={`${id}-days-hint`} className={`mt-2 text-sm ${days === null ? 'font-semibold text-overdue' : 'text-ink-3'}`}>
            {days === null
              ? `Enter a whole number of days from 0 to ${maxDays}.`
              : `Whole days, 0 to ${maxDays}. The data reach about ${Math.floor(audit.maxDay)} days.`}
          </p>

          {offerNeighborhood && model && (
            <div className="animate-rise-in mt-6">
              <label htmlFor={`${id}-hood`} className="block text-sm font-semibold">
                Neighborhood <span className="font-normal text-ink-3">(optional)</span>
              </label>
              <select
                id={`${id}-hood`}
                value={hood}
                onChange={(e) => setHood(e.target.value)}
                className="mt-1.5 h-11 w-full max-w-xs rounded-xl border border-rule bg-white px-3 text-[0.9375rem] font-medium"
              >
                <option value="">Any neighborhood</option>
                {model.neighborhoods.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>
          )}

          {preview && model && !model.release.passed && (
            <p className="animate-rise-in mt-5 max-w-[52ch] rounded-xl border border-notfixed/40 bg-[#FBF4EA] px-4 py-3 text-sm leading-relaxed text-ink">
              <strong className="font-semibold">Preview.</strong> This neighborhood model did not pass
              its release check, so visitors do not see this control. {model.release.summary}
            </p>
          )}
        </div>

        <div aria-live="polite" className={`grid gap-4 ${showNeighborhoodSlot ? 'sm:grid-cols-2' : ''}`}>
          <ChanceCard
            key={`km-${service}`}
            where="All of Boston"
            method="live data, Kaplan–Meier"
            chance={km}
            tone="data"
            detail={km ? serviceDetail(km, svc, days ?? 0) : null}
            unavailable={km?.kind === 'unavailable' ? unavailableText(km.reason, svc, days ?? 0) : null}
          />
          {showNeighborhoodSlot &&
            (nb?.kind === 'model' ? (
              <ChanceCard
                key={`nb-${hood}`}
                where={hood}
                method={preview && !model?.release.passed ? 'model preview' : 'model'}
                chance={{ kind: 'estimate', p: nb.p, stillOpen: nb.stillOpen }}
                tone="ink"
                delay={60}
                detail={
                  <>
                    Trained on data through <span className="whitespace-nowrap">{isoDateET(nb.dataThrough)}</span>:{' '}
                    {formatInt(nb.serviceCases)} {svc} requests, {formatInt(nb.neighborhoodCases)} of them from {hood}.
                  </>
                }
                unavailable={null}
              />
            ) : nb ? (
              <FallbackNote key={`fb-${hood}-${nb.reason}`} text={fallbackText(nb.reason, svc, hood, days ?? 0)} />
            ) : null)}
        </div>
      </div>

      <p className="mt-7 max-w-[75ch] text-sm leading-relaxed text-ink-3">
        A historical chance of closure, not a promise that your request will be resolved. It counts
        any closure, including cases closed as Noted or Transitioned, and like the rest of this page
        it assumes the cases still open are like those that closed.
        {modelState.status === 'ready' && !modelState.model.release.passed && !preview && (
          <>
            {' '}We also tested a neighborhood-level version; on later requests it did not beat this
            figure, so it is not shown.{' '}
            <a className="font-semibold text-data underline-offset-4 hover:underline" href={ANALYSIS}>
              How we checked
            </a>
          </>
        )}
        {modelState.status === 'error' && preview && <> The neighborhood model did not load.</>}
      </p>
    </section>
  )
}

function serviceDetail(km: ServiceWideChance, svc: string, days: number): string {
  return days === 0
    ? `Based on ${formatInt(km.stillOpen)} ${svc} requests, counting those still open.`
    : `${formatInt(km.stillOpen)} ${svc} requests were still open after ${days} ${days === 1 ? 'day' : 'days'}.`
}

function unavailableText(reason: Unavailable, svc: string, days: number): string {
  return reason === 'thin-sample'
    ? `Fewer than ${MIN_CASES} ${svc} requests have stayed open ${days} days, too few for a figure.`
    : `The data do not yet reach ${days + HORIZON_DAYS} days, so there is nothing to compare against.`
}

function fallbackText(reason: ModelFallback, svc: string, hood: string, days: number): string {
  switch (reason) {
    case 'not-released':
      return 'The neighborhood model has not passed its release check.'
    case 'stale':
      return 'The neighborhood model is more than 30 days old, so only the figure for all of Boston is shown.'
    case 'unknown-service':
      return `The neighborhood model has no ${svc} requests to learn from yet.`
    case 'missing-neighborhood':
      return `${hood} has too few requests to model on its own.`
    case 'beyond-horizon':
      return `The neighborhood model's data do not reach ${days + HORIZON_DAYS} days.`
    case 'thin-sample':
      return `Fewer than ${MIN_CASES} ${svc} requests from ${hood}, or fewer than ${MIN_CASES} still open after ${days} days, so only the figure for all of Boston is shown.`
  }
}

function ChanceCard({
  where,
  method,
  chance,
  tone,
  detail,
  unavailable,
  delay = 0,
}: {
  where: string
  method: string
  chance: ServiceWideChance | null
  tone: 'data' | 'ink'
  detail: ReactNode
  unavailable: string | null
  delay?: number
}) {
  const p = chance?.kind === 'estimate' ? chance.p : null
  // Counts up on mount; later changes retarget mid-flight, so stepping the days stays smooth.
  const shown = useTween(p ?? 0, 420, 0)
  const ready = useAfterFirstFrame()
  const scale = p === null ? 0 : ready ? Math.max(0.015, p) : 0.015
  // Mid-tween show plain whole percents; "under 1%" would flash as the count leaves zero.
  const text = p === null ? '' : shown === p ? chanceText(p) : `${Math.round(shown * 100)}%`

  return (
    <div className="animate-rise-in rounded-2xl border border-rule bg-white p-5 sm:p-6" style={{ animationDelay: `${delay}ms` }}>
      <p className="text-sm font-semibold text-ink">Historical chance of closure</p>
      <p className="text-sm text-ink-3">
        {where} · {method}
      </p>
      {p !== null ? (
        <>
          <p aria-hidden className={`figure mt-4 font-display text-[clamp(2.75rem,6vw,4rem)] font-extrabold leading-none tracking-[-0.045em] ${tone === 'data' ? 'text-data' : 'text-ink'}`}>
            {text}
          </p>
          <p className="sr-only">
            {where}: {chanceText(p)} historical chance of closure within the next {HORIZON_DAYS} days.
          </p>
          <p className="mt-1 text-[0.9375rem] text-ink-2">within the next {HORIZON_DAYS} days</p>
        </>
      ) : (
        <p className="mt-4 font-display text-[clamp(2.75rem,6vw,4rem)] font-extrabold leading-none text-ink-3">
          —
        </p>
      )}
      <div aria-hidden className="mt-4 h-2.5 overflow-hidden rounded-full bg-mist">
        <div
          className={`motion-bar h-full origin-left rounded-full ${tone === 'data' ? 'bg-data' : 'bg-ink'}`}
          style={{ transform: `scaleX(${scale})`, transition: 'transform 520ms var(--ease-out)' }}
        />
      </div>
      {(unavailable ?? detail) && <p className="mt-3 text-sm leading-relaxed text-ink-3">{unavailable ?? detail}</p>}
    </div>
  )
}

function FallbackNote({ text }: { text: string }) {
  return (
    <div className="animate-rise-in flex items-center rounded-2xl border border-dashed border-ink-3/40 p-5 text-[0.9375rem] leading-relaxed text-ink-2 sm:p-6">
      {text}
    </div>
  )
}
