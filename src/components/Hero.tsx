import { useId, useState } from 'react'
import { conditionalWait, type ServiceAudit, type Overview } from '../data/audit'
import type { City } from '../data/cities'
import {
  formatInt,
  formatNumber,
  formatPct,
  formatWait,
  isoDateET,
  toWait,
  unitLabel,
  waitDigits,
} from '../data/format'
import { useCountUp } from '../hooks/motion'
import { ServicePicker } from './ServicePicker'

interface Props {
  city: City
  overview: Overview | null
  audit: ServiceAudit | null
  selected: string
  loading: boolean
  onSelect: (s: string) => void
}

export function Hero({ city, overview, audit, selected, loading, onSelect }: Props) {
  return (
    <section id="answer" aria-labelledby="headline" className="mx-auto max-w-page px-5 pb-16 pt-10 sm:px-8 sm:pt-16">
      <div className="max-w-[46rem]">
        {overview ? (
          <>
            <h1
              id="headline"
              className="font-display text-[clamp(2rem,4.6vw,3.4rem)] font-bold leading-[1.02] tracking-[-0.035em]"
            >
              How long does a {city.name} {city.system} request really take?
            </h1>
            <p className="mt-4 text-lg leading-relaxed text-ink-2">
              A median over the {city.caseWord[1]} that have closed leaves out the{' '}
              <span className="figure font-semibold text-ink">{formatInt(overview.openNow)}</span> still
              open, and those are the slow ones. Choose from the {city.typeWord}s below to see the
              wait with open {city.caseWord[1]} put back in — then say how long you have been waiting.
            </p>
          </>
        ) : (
          <div aria-hidden className="space-y-3">
            <div className="h-10 w-full max-w-[38rem] rounded-lg bg-mist" />
            <div className="h-10 w-3/4 rounded-lg bg-mist" />
            <div className="h-5 w-2/3 rounded bg-mist" />
            <h1 id="headline" className="sr-only">
              311 Wait: {city.name} {city.system} wait times
            </h1>
          </div>
        )}
      </div>

      <div className="mt-8">
        {overview ? (
          <ServicePicker
            city={city}
            services={overview.services}
            selected={selected}
            loading={loading}
            onSelect={onSelect}
          />
        ) : (
          <div aria-hidden className="flex gap-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-11 w-36 rounded-full bg-mist" />
            ))}
          </div>
        )}
      </div>

      <div className="mt-12 border-t border-rule pt-10">
        {audit ? <Answer city={city} audit={audit} /> : <AnswerSkeleton />}
      </div>

      {audit && <AlreadyWaiting city={city} audit={audit} />}

      {overview && (
        <p className="mt-10 max-w-[70ch] text-sm leading-relaxed text-ink-3">
          Cohort: {city.caseWord[1]} opened {city.cohortStart} through{' '}
          {isoDateET(overview.queriedAt)} (n = {formatInt(overview.cohortN)}). Max observable
          duration ≈ {audit ? Math.floor(audit.maxDay) : 115} days. Source: {city.source}.
        </p>
      )}
    </section>
  )
}

function AnswerSkeleton() {
  return (
    <div aria-hidden className="grid gap-10 lg:grid-cols-[1.25fr_1fr]">
      <div className="space-y-4">
        <div className="h-6 w-48 rounded bg-mist" />
        <div className="h-36 w-80 max-w-full rounded-2xl bg-mist" />
        <div className="h-6 w-72 max-w-full rounded bg-mist" />
      </div>
      <div className="space-y-4 self-end">
        <div className="h-10 rounded-xl bg-mist" />
        <div className="h-10 rounded-xl bg-mist" />
      </div>
    </div>
  )
}

function Answer({ city, audit }: { city: City; audit: ServiceAudit }) {
  const reached = audit.kmMedianHours !== null
  const realHours = reached ? audit.kmMedianHours! : audit.maxDay * 24
  const real = toWait(realHours)
  const cityWait = toWait(audit.cityMedianHours)
  const cityInRealUnit = toWait(audit.cityMedianHours, real.unit).value
  const shown = useCountUp(reached ? real.value : Math.floor(real.value), cityInRealUnit)
  const digits = reached ? waitDigits(real) : 0
  const ratio = reached ? realHours / audit.cityMedianHours : null
  const scaleMax = Math.max(realHours, audit.cityMedianHours)
  const o = audit.outcomes

  return (
    <div className="grid items-end gap-x-12 gap-y-10 lg:grid-cols-[1.2fr_1fr]">
      <div>
        <p className="text-xl font-semibold tracking-[-0.01em]">{audit.service}</p>
        {/* The count-up digits are decorative; the live region in App announces the result. */}
        <p aria-hidden key={audit.service} className="animate-pop-in mt-2 flex items-baseline gap-3 font-display font-extrabold leading-[0.82] tracking-[-0.055em]">
          <span className="figure text-[clamp(5.5rem,17vw,12.5rem)]">
            {formatNumber(shown, digits)}
            {!reached && '+'}
          </span>
          <span className="text-[clamp(1.75rem,4vw,3rem)] tracking-[-0.03em]">
            {reached ? unitLabel(real) : 'days'}
          </span>
        </p>
        <p className="sr-only">
          {reached
            ? `${formatNumber(real.value, digits)} ${unitLabel(real)}`
            : `More than ${Math.floor(real.value)} days`}
        </p>
        <p className="mt-5 max-w-[30ch] text-xl leading-snug text-ink-2">
          {reached
            ? `until half are closed, counting the ${city.caseWord[1]} that are still open.`
            : 'and fewer than half have closed. There is no honest typical wait.'}
        </p>
      </div>

      <div>
        <ul className="space-y-5" aria-label="Comparison">
          <CompareBar
            label={`Closed ${city.caseWord[1]} only`}
            sub={`median of the ${city.caseWord[1]} that have closed`}
            value={`${formatNumber(cityWait.value, waitDigits(cityWait))} ${unitLabel(cityWait)}`}
            share={audit.cityMedianHours / scaleMax}
            tone="city"
            delay={0}
          />
          <CompareBar
            label={`Counting open ${city.caseWord[1]}`}
            sub={reached ? 'half closed by then' : 'still under half closed'}
            value={
              reached
                ? `${formatNumber(real.value, waitDigits(real))} ${unitLabel(real)}`
                : `${Math.floor(real.value)}+ days`
            }
            share={realHours / scaleMax}
            tone="data"
            openEnded={!reached}
            delay={140}
          />
        </ul>
        <p key={audit.service} className="animate-pop-in mt-6 inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-[0.9375rem] font-semibold text-white" style={{ animationDelay: '650ms' }}>
          {ratio !== null
            ? ratio >= 1.05
              ? `${formatNumber(ratio, 1)}× longer than closed ${city.caseWord[1]} alone suggest`
              : `About what closed ${city.caseWord[1]} alone suggest`
            : `Most ${city.caseWord[1]} are still open`}
        </p>
      </div>

      <dl className="col-span-full grid grid-cols-2 gap-x-8 gap-y-4 border-t border-rule pt-6 text-[0.9375rem] sm:grid-cols-4">
        <Stat term="Requests" value={formatInt(audit.n)} />
        <Stat term="Still open" value={formatInt(audit.stillOpen)} note="counted as censored" />
        {o ? (
          <>
            <Stat term="Closed as resolved" value={`${Math.round(o.resolved * 100)} in 100`} />
            <Stat
              term="Noted or Transitioned"
              value={`${Math.round(o.notResolved * 100)} in 100`}
              note="no action required, or sent to another agency"
            />
          </>
        ) : (
          <Stat
            term="Closure reason"
            value="Not published"
            note={`${city.name} records no reason, so resolved cannot be split out`}
          />
        )}
      </dl>
    </div>
  )
}

const PRESET_DAYS = [1, 7, 14, 30, 90]

/**
 * The calculator's second question: not "how long does this take", but "how much longer for
 * mine". Reads the same Kaplan-Meier curve conditioned on having waited this long, which is the
 * only honest way to answer it — the headline median is measured from the day of filing, and
 * whatever is still open after three weeks is not an average request any more.
 */
function AlreadyWaiting({ city, audit }: { city: City; audit: ServiceAudit }) {
  const [daysText, setDaysText] = useState('14')
  const inputId = useId()
  const maxDays = Math.floor(audit.maxDay)
  const days = Number(daysText)
  const validDays = daysText.trim() !== '' && Number.isInteger(days) && days >= 0 && days <= maxDays
  const w = validDays ? conditionalWait(audit, days) : null
  const presets = PRESET_DAYS.filter((d) => d <= maxDays)
  const remaining = w ? w.medianMoreDays : null

  return (
    <section
      aria-labelledby={`${inputId}-heading`}
      className="mt-14 rounded-3xl border border-rule bg-mist/60 px-6 py-8 sm:px-10"
    >
      <h2 id={`${inputId}-heading`} className="font-display text-2xl font-bold tracking-[-0.025em]">
        Already waiting?
      </h2>
      <p className="mt-2 max-w-[62ch] text-[1.0625rem] leading-relaxed text-ink-2">
        The figure above is measured from the day a request is filed. If yours is already open, the
        {' '}{city.caseWord[1]} like it are the ones the city has not got to yet.
      </p>

      <div className="mt-6 flex flex-wrap items-end gap-x-4 gap-y-3">
        <div>
          <label htmlFor={inputId} className="block text-sm font-semibold text-ink-2">
            Days since I filed
          </label>
          <input
            id={inputId}
            type="number"
            inputMode="numeric"
            min={0}
            max={maxDays}
            value={daysText}
            onChange={(e) => setDaysText(e.target.value)}
            aria-invalid={!validDays}
            aria-describedby={!validDays ? `${inputId}-error` : undefined}
            className="figure mt-1.5 min-h-[44px] w-28 rounded-xl border border-rule bg-white px-3 text-lg font-semibold tabular-nums"
          />
        </div>
        <div role="group" aria-label="Common waits" className="flex flex-wrap gap-2">
          {presets.map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={validDays && days === d}
              onClick={() => setDaysText(String(d))}
              className={[
                'min-h-[44px] rounded-full border px-4 text-[0.9375rem] font-medium',
                'transition-colors duration-150 active:scale-[0.96]',
                days === d ? 'border-ink bg-ink text-white' : 'border-rule bg-white hover:border-ink-3',
              ].join(' ')}
            >
              {d} {d === 1 ? 'day' : 'days'}
            </button>
          ))}
        </div>
      </div>

      <div aria-live="polite" className="mt-7">
        {!w ? (
          <p id={`${inputId}-error`} className="text-overdue">
            Enter a whole number from 0 to {formatInt(maxDays)} days.
          </p>
        ) : w.thin ? (
          <p className="max-w-[62ch] text-lg leading-relaxed">
            Only <strong className="figure font-semibold">{formatInt(w.atRisk)}</strong>{' '}
            {audit.service} {city.caseWord[1]} in this cohort were still open after{' '}
            {formatInt(w.elapsedDays)} days — too few to put a number on, so none is shown.
          </p>
        ) : remaining !== null ? (
          <>
            <p className="font-display text-[clamp(1.75rem,4vw,2.6rem)] font-extrabold leading-tight tracking-[-0.04em]">
              <span className="figure">{formatWait(remaining * 24)}</span>{' '}
              <span className="font-bold text-ink-2">more, for half of them</span>
            </p>
            <p className="mt-3 max-w-[62ch] text-[1.0625rem] leading-relaxed text-ink-2">
              Half of the {audit.service} {city.caseWord[1]} still open after{' '}
              {formatInt(w.elapsedDays)} days close within the next {formatWait(remaining * 24)}.{' '}
              {w.chances.map((c, i) => (
                <span key={c.days}>
                  {i === 0 ? '' : ' '}
                  <strong className="figure font-semibold text-ink">{formatPct(c.share, 0)}</strong> close
                  within {c.days} days.
                </span>
              ))}
            </p>
          </>
        ) : (
          <>
            <p className="font-display text-[clamp(1.75rem,4vw,2.6rem)] font-extrabold leading-tight tracking-[-0.04em]">
              <span className="figure">{formatInt(maxDays - w.elapsedDays)}+ days</span>{' '}
              <span className="font-bold text-ink-2">more, at least</span>
            </p>
            <p className="mt-3 max-w-[62ch] text-[1.0625rem] leading-relaxed text-ink-2">
              Fewer than half of the {audit.service} {city.caseWord[1]} still open after{' '}
              {formatInt(w.elapsedDays)} days close inside the {maxDays} days this data covers, so
              there is no honest number for how much longer.{' '}
              {w.chances.map((c) => (
                <span key={c.days}>
                  <strong className="figure font-semibold text-ink">{formatPct(c.share, 0)}</strong> close
                  within {c.days} days.{' '}
                </span>
              ))}
            </p>
          </>
        )}
        {w && !w.thin && (
          <p className="mt-3 text-sm text-ink-3">
            An estimated {formatPct(w.stillOpenShare, 0)} of all {audit.service} {city.caseWord[1]} are still open
            at {formatInt(w.elapsedDays)} days; {formatInt(w.atRisk)} were still open that long in this
            cohort. These are historical estimates, not a completion date for one report.
          </p>
        )}
      </div>
    </section>
  )
}

function Stat({ term, value, note }: { term: string; value: string; note?: string }) {
  return (
    <div>
      <dt className="text-ink-3">{term}</dt>
      <dd className="figure mt-1 text-lg font-semibold text-ink">
        {value}
        {note && <span className="block text-sm font-normal text-ink-3">{note}</span>}
      </dd>
    </div>
  )
}

function CompareBar({
  label,
  sub,
  value,
  share,
  tone,
  openEnded = false,
  delay,
}: {
  label: string
  sub: string
  value: string
  share: number
  tone: 'city' | 'data'
  openEnded?: boolean
  delay: number
}) {
  // A floor keeps a tiny value visible as a sliver rather than vanishing.
  const scale = Math.max(0.015, Math.min(1, share))
  return (
    <li>
      <div className="flex items-baseline justify-between gap-4">
        <span className="font-semibold">
          {label} <span className="font-normal text-ink-3">· {sub}</span>
        </span>
        <span className={`figure font-display text-2xl font-bold tracking-[-0.02em] ${tone === 'data' ? 'text-data' : 'text-city-text'}`}>
          {value}
        </span>
      </div>
      <div className="mt-2 h-3.5 overflow-hidden rounded-full bg-mist">
        <div
          className={`motion-bar h-full origin-left rounded-full ${tone === 'data' ? 'bg-data' : 'bg-city'}`}
          style={{
            transform: `scaleX(${scale})`,
            transition: `transform 800ms var(--ease-out) ${delay}ms`,
            ...(openEnded
              ? { maskImage: 'linear-gradient(90deg, #000 78%, transparent)', WebkitMaskImage: 'linear-gradient(90deg, #000 78%, transparent)' }
              : {}),
          }}
        />
      </div>
    </li>
  )
}
