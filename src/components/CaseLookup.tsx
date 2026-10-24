import { useId, useRef, useState, type FormEvent } from 'react'
import { parseCaseId } from '../lib/boston311'
import {
  COUNCIL_URL,
  WINDOW_DAYS,
  chanceSentence,
  formatDate,
  lookUpCase,
  type CaseView,
  type LookupResult,
} from '../data/caseLookup'
import { formatInt, formatWait } from '../data/format'

/**
 * "Where does my case stand?" (MC-02..MC-07). The typed ID is checked with parseCaseId before
 * anything is sent; only that one case is requested, and nothing is stored.
 */
export function CaseLookup() {
  const inputId = useId()
  const hintId = `${inputId}-hint`
  const errorId = `${inputId}-error`
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<LookupResult | null>(null)
  const [status, setStatus] = useState('')
  const inputRef = useRef<HTMLInputElement | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const id = parseCaseId(value)
    if (!id) {
      setError('Enter the case number as BCS- followed by 8 digits, for example BCS-00253943.')
      setResult(null)
      setStatus('')
      inputRef.current?.focus()
      return
    }
    setError(null)
    setBusy(true)
    setStatus(`Looking up ${id}…`)
    try {
      const r = await lookUpCase(id, window.location.origin)
      setResult(r)
      setStatus(
        r.kind === 'found'
          ? `Found ${id}, ${r.view.record.service_name}.`
          : r.kind === 'not-found'
            ? `No case ${id} in the data.`
            : `${id} was opened before July 2026, outside the period this page covers.`,
      )
    } catch (err) {
      setResult(null)
      setError(`Boston's open-data service did not answer (${(err as Error).message}). Try again in a moment.`)
      setStatus('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <form onSubmit={submit} noValidate className="max-w-[40rem]">
        <label htmlFor={inputId} className="block text-[0.9375rem] font-semibold">
          Case number
        </label>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input
            ref={inputRef}
            id={inputId}
            name="case-id"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="e.g. BCS-00253943…"
            translate="no"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={40}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${hintId} ${errorId}` : hintId}
            className={`figure min-h-[48px] w-full min-w-0 flex-1 rounded-xl border bg-white px-4 text-lg tracking-wide placeholder:text-ink-3 ${error ? 'border-overdue' : 'border-rule'}`}
          />
          <button
            type="submit"
            disabled={busy}
            className="min-h-[48px] shrink-0 rounded-xl bg-ink px-6 font-semibold text-white transition-[transform,background-color] duration-150 ease-out hover:bg-[#2B2E36] active:scale-[0.96] disabled:cursor-progress disabled:opacity-70"
          >
            {busy ? 'Looking up…' : 'Look up'}
          </button>
        </div>
        <p id={hintId} className="mt-2 text-sm text-ink-3">
          It is on your 311 confirmation: BCS- and 8 digits. The page asks Boston&rsquo;s open-data
          service for that one case. Nothing is stored.
        </p>
        {error && (
          <p id={errorId} role="alert" className="mt-2 text-sm font-medium text-overdue">
            {error}
          </p>
        )}
      </form>

      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {status}
      </p>

      {result?.kind === 'not-found' && (
        <p className="mt-8 max-w-[60ch] rounded-2xl bg-mist px-5 py-4 text-[0.9375rem]">
          No case <span translate="no" className="figure font-semibold">{result.id}</span> in Boston&rsquo;s 311
          data. Check the number on your confirmation; very new cases appear after the city&rsquo;s
          next daily update.
        </p>
      )}
      {result?.kind === 'before-cohort' && (
        <p className="mt-8 max-w-[60ch] rounded-2xl bg-mist px-5 py-4 text-[0.9375rem]">
          Case <span translate="no" className="figure font-semibold">{result.id}</span> ({result.record.service_name})
          was opened before 1 July 2026. Earlier months in the city&rsquo;s file are incomplete, so
          this page does not estimate waits for them.
        </p>
      )}
      {result?.kind === 'found' && <CaseResult key={result.view.record.case_id} view={result.view} />}
    </div>
  )
}

function stateLabel(v: CaseView): { text: string; tone: string } {
  switch (v.state) {
    case 'open-past-target':
      return { text: `Open · ${formatInt(Math.floor(v.daysPastTarget ?? 0))} days past target`, tone: 'bg-overdue text-white' }
    case 'open-on-track':
      return { text: 'Open · before its target date', tone: 'bg-ink text-white' }
    case 'open-no-target':
      return { text: 'Open · no target date', tone: 'bg-ink text-white' }
    case 'transitioned':
      return { text: 'Closed as Transitioned', tone: 'bg-notfixed text-white' }
    case 'noted':
      return { text: 'Closed as Noted', tone: 'bg-notfixed text-white' }
    case 'closed':
      return { text: 'Closed', tone: 'bg-data text-white' }
    default:
      return { text: v.record.case_status, tone: 'bg-mist text-ink' }
  }
}

function CaseResult({ view: v }: { view: CaseView }) {
  const r = v.record
  const isOpen = v.state.startsWith('open')
  const label = stateLabel(v)
  const a = v.audit
  return (
    <article aria-labelledby="case-result-title" className="animate-rise-in mt-10 rounded-3xl border border-rule bg-white p-5 sm:p-8">
      <div className="flex flex-wrap items-center gap-3">
        <h3 id="case-result-title" className="font-display text-2xl font-bold tracking-[-0.02em]">
          {r.service_name}
        </h3>
        <span className={`rounded-full px-3 py-1 text-sm font-semibold ${label.tone}`}>{label.text}</span>
        <span translate="no" className="figure text-sm text-ink-3">{r.case_id}</span>
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 text-[0.9375rem] sm:grid-cols-4">
        <Fact term="Reported" value={formatDate(v.opened)} />
        <Fact term={isOpen ? 'Open for' : 'Took'} value={isOpen ? `${formatInt(Math.floor(v.days))} days` : formatWait(v.days * 24)} />
        <Fact term="Target date" value={v.target !== null ? formatDate(v.target) : 'None set'} />
        {v.closureLabel ? (
          <Fact term="Closed as" value={v.closureLabel} />
        ) : (
          <Fact term="Council district" value={v.district ?? 'Not recorded'} />
        )}
        {v.closureLabel && <Fact term="Council district" value={v.district ?? 'Not recorded'} />}
      </dl>
      <p className="mt-3 text-xs text-ink-3">Days counted to the city&rsquo;s data extract of {formatDate(v.cutoff)}.</p>

      {v.chance && (
        <div className="mt-8 border-t border-rule pt-6">
          {v.chance.kind === 'shown' ? (
            <p className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <span className="animate-pop-in figure font-display text-[clamp(2.75rem,9vw,4.5rem)] font-extrabold leading-none tracking-[-0.04em] text-ink">
                {v.chance.in100} in 100
              </span>
              <span className="max-w-[40ch] text-[1.0625rem] leading-snug text-ink-2">{chanceSentence(r.service_name, v.chance)}</span>
            </p>
          ) : (
            <p className="max-w-[60ch] text-[1.0625rem] leading-relaxed text-ink-2">{chanceSentence(r.service_name, v.chance)}</p>
          )}
          <p className="mt-3 max-w-[70ch] text-sm text-ink-3">
            This is what happened to other cases, not a forecast for this one. It reads the next{' '}
            {WINDOW_DAYS} days off the same curve as the chart below.
          </p>
        </div>
      )}

      {a && (
        <p className="mt-6 text-[0.9375rem] text-ink-2">
          {r.service_name} since July: median among closed cases{' '}
          <strong className="figure font-semibold text-city-text">{formatWait(a.cityMedianHours)}</strong>, estimate including open
          cases{' '}
          <strong className="figure font-semibold text-data">
            {a.kmMedianHours !== null ? formatWait(a.kmMedianHours) : `more than ${Math.floor(a.maxDay)} days`}
          </strong>
          .
        </p>
      )}

      <Summary text={v.summary} request={v.request} />
    </article>
  )
}

function Fact({ term, value }: { term: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-ink-3">{term}</dt>
      <dd className="figure mt-0.5 break-words font-semibold">{value}</dd>
    </div>
  )
}

function Summary({ text, request }: { text: string; request: string | null }) {
  const id = useId()
  const [copyStatus, setCopyStatus] = useState('')
  const lines = text.split('\n').length

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopyStatus('Summary copied. Paste it into an email or message.')
    } catch {
      setCopyStatus('Copying did not work in this browser. Select the text and copy it.')
    }
  }

  return (
    <div className="mt-8 border-t border-rule pt-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <label htmlFor={id} className="block font-display text-lg font-bold tracking-[-0.01em]">
            Summary to send
          </label>
          <p className="text-sm text-ink-3">
            {request ? `It ends with one request: ${request.toLowerCase().replace(/\.$/, '')}.` : 'The case is closed, so it makes no request.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={copy}
            className="min-h-[44px] rounded-xl bg-ink px-5 font-semibold text-white transition-[transform,background-color] duration-150 ease-out hover:bg-[#2B2E36] active:scale-[0.96]"
          >
            Copy summary
          </button>
          <a
            href={COUNCIL_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[44px] items-center rounded-xl border border-rule px-5 font-semibold text-data hover:border-ink-3"
          >
            Find your councilor<span className="sr-only"> (opens boston.gov in a new tab)</span>
          </a>
        </div>
      </div>
      <textarea
        id={id}
        readOnly
        value={text}
        rows={Math.min(16, lines + 1)}
        onFocus={(e) => e.currentTarget.select()}
        className="figure mt-4 w-full resize-y rounded-2xl border border-rule bg-mist p-4 font-sans text-sm leading-relaxed text-ink"
      />
      <p role="status" aria-live="polite" aria-atomic="true" className="mt-2 min-h-[1.25rem] text-sm font-medium text-ink-2">
        {copyStatus}
      </p>
    </div>
  )
}
