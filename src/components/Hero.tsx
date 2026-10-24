import { COHORT_START, type ServiceAudit, type Overview } from '../data/audit'
import {
  formatInt,
  formatNumber,
  formatPct,
  isoDateET,
  toWait,
  unitLabel,
  waitDigits,
} from '../data/format'
import { useCountUp } from '../hooks/motion'
import { ServicePicker } from './ServicePicker'

interface Props {
  overview: Overview | null
  audit: ServiceAudit | null
  selected: string
  loading: boolean
  onSelect: (s: string) => void
}

/** "Nearly 1 in 4" from a share, so the headline stays honest as the data moves. */
export function oneIn(share: number): string {
  if (!(share > 0)) return 'None'
  const n = Math.max(2, Math.round(1 / share))
  const exact = 1 / n
  const q = share < exact * 0.97 ? 'Nearly' : share > exact * 1.03 ? 'More than' : 'About'
  return `${q} 1 in ${n}`
}

export function Hero({ overview, audit, selected, loading, onSelect }: Props) {
  return (
    <section id="answer" aria-labelledby="headline" className="mx-auto max-w-page px-5 pb-16 pt-10 sm:px-8 sm:pt-16">
      <div className="max-w-[46rem]">
        {overview ? (
          <>
            <h1
              id="headline"
              className="font-display text-[clamp(2rem,4.6vw,3.4rem)] font-bold leading-[1.02] tracking-[-0.035em]"
            >
              {oneIn(overview.closedUnresolved / overview.closed)} Boston 311 cases marked closed
              were not resolved.
            </h1>
            <p className="mt-4 text-lg leading-relaxed text-ink-2">
              <span className="figure font-semibold text-ink">
                {formatPct(overview.closedUnresolved / overview.closed)}
              </span>{' '}
              of {formatInt(overview.closed)} closed cases since 1 July were filed as Noted or
              Transitioned. Pick a service to see how long people actually wait.
            </p>
          </>
        ) : (
          <div aria-hidden className="space-y-3">
            <div className="h-10 w-full max-w-[38rem] rounded-lg bg-mist" />
            <div className="h-10 w-3/4 rounded-lg bg-mist" />
            <div className="h-5 w-2/3 rounded bg-mist" />
            <h1 id="headline" className="sr-only">
              Wait Audit: Boston 311 wait times
            </h1>
          </div>
        )}
      </div>

      <div className="mt-8">
        {overview ? (
          <ServicePicker
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
        {audit ? <Answer audit={audit} /> : <AnswerSkeleton />}
      </div>

      {overview && (
        <p className="mt-10 max-w-[70ch] text-sm leading-relaxed text-ink-3">
          Cohort: cases opened {COHORT_START} through{' '}
          {isoDateET(overview.queriedAt)} (n = {formatInt(overview.cohortN)}). Max observable
          duration ≈ {audit ? Math.floor(audit.maxDay) : 115} days.
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

function Answer({ audit }: { audit: ServiceAudit }) {
  const reached = audit.kmMedianHours !== null
  const realHours = reached ? audit.kmMedianHours! : audit.maxDay * 24
  const real = toWait(realHours)
  const city = toWait(audit.cityMedianHours)
  const cityInRealUnit = toWait(audit.cityMedianHours, real.unit).value
  const shown = useCountUp(reached ? real.value : Math.floor(real.value), cityInRealUnit)
  const digits = reached ? waitDigits(real) : 0
  const ratio = reached ? realHours / audit.cityMedianHours : null
  const scaleMax = Math.max(realHours, audit.cityMedianHours)
  const resolvedIn100 = Math.round(audit.outcomes.resolved * 100)
  const notResolvedIn100 = Math.round(audit.outcomes.notResolved * 100)

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
            ? 'until half are closed, counting the requests that are still open.'
            : 'and fewer than half have closed. There is no honest typical wait.'}
        </p>
      </div>

      <div>
        <ul className="space-y-5" aria-label="Comparison">
          <CompareBar
            label="What the city reports"
            sub="closed cases only"
            value={`${formatNumber(city.value, waitDigits(city))} ${unitLabel(city)}`}
            share={audit.cityMedianHours / scaleMax}
            tone="city"
            delay={0}
          />
          <CompareBar
            label="Counting open cases"
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
              ? `${formatNumber(ratio, 1)}× longer than the city reports`
              : 'About what the city reports'
            : 'Most requests are still open'}
        </p>
      </div>

      <dl className="col-span-full grid grid-cols-2 gap-x-8 gap-y-4 border-t border-rule pt-6 text-[0.9375rem] sm:grid-cols-4">
        <Stat term="Requests" value={formatInt(audit.n)} />
        <Stat term="Still open" value={formatInt(audit.stillOpen)} note="counted as censored" />
        <Stat term="Actually resolved" value={`${resolvedIn100} in 100`} />
        <Stat term="Closed, not resolved" value={`${notResolvedIn100} in 100`} note="Noted or Transitioned" />
      </dl>
    </div>
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
