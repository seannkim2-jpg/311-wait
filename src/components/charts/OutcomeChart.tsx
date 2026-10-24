import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { ServiceAudit } from '../../data/audit'
import { formatInt, formatNumber } from '../../data/format'
import { useInViewOnce, usePrefersReducedMotion } from '../../hooks/motion'
import { C, axisTick, dayTicks } from './axes'

const SEGMENTS = [
  { key: 'resolved', label: 'Resolved', className: 'bg-data', text: 'text-data' },
  { key: 'notResolved', label: 'Closed, not resolved', className: 'hatch-notfixed', text: 'text-notfixed' },
  { key: 'stillOpen', label: 'Still open', className: 'dots-open', text: 'text-overdue' },
] as const

interface TipProps {
  active?: boolean
  payload?: { payload: ServiceAudit['curve'][number] }[]
}

function OutcomeTooltip({ active, payload }: TipProps) {
  const p = payload?.[0]?.payload
  if (!active || !p) return null
  return (
    <div className="rounded-xl border border-rule bg-white/95 px-3 py-2 text-sm shadow-[0_8px_24px_rgb(0_0_0/0.08)]">
      <p className="figure text-ink-3">After {formatNumber(p.day, p.day < 10 ? 1 : 0)} days</p>
      <p className="figure text-data">Resolved {formatNumber(p.resolved, 0)}%</p>
      <p className="figure text-notfixed">Closed, not resolved {formatNumber(p.notResolved, 0)}%</p>
      <p className="figure text-overdue">Still open {formatNumber(p.stillOpen, 0)}%</p>
    </div>
  )
}

/**
 * REQ-09 / REQ-21: Aalen–Johansen cumulative incidence as the primary visual. The bar is the
 * right-hand edge of the curves, read out in words; the stacked areas show how it got there.
 */
export function OutcomeChart({ audit, citywideShare, citywideClosed }: {
  audit: ServiceAudit
  citywideShare: number | null
  citywideClosed: number | null
}) {
  const reduced = usePrefersReducedMotion()
  const { ref, seen } = useInViewOnce<HTMLDivElement>()
  const o = audit.outcomes
  const shares = { resolved: o.resolved, notResolved: o.notResolved, stillOpen: o.stillOpen }
  const summary = `${audit.service}, after up to ${Math.floor(audit.maxDay)} days: ${formatNumber(o.resolved * 100, 1)}% resolved, ${formatNumber(o.notResolved * 100, 1)}% closed without being resolved, ${formatNumber(o.stillOpen * 100, 1)}% still open.`

  return (
    <figure className="m-0" ref={ref}>
      <div role="img" aria-label={summary}>
        <div className="flex h-14 w-full gap-[3px] overflow-hidden rounded-2xl sm:h-16">
          {SEGMENTS.map((s, i) => (
            <div
              key={s.key}
              className={`motion-bar h-full origin-left ${s.className}`}
              style={{
                flexBasis: `${Math.max(0.5, shares[s.key] * 100)}%`,
                transform: `scaleX(${seen ? 1 : 0})`,
                opacity: seen ? 1 : 0,
                transition: `transform 700ms var(--ease-out) ${i * 70}ms, opacity 300ms ease ${i * 70}ms, flex-basis 700ms var(--ease-out)`,
              }}
            />
          ))}
        </div>
        <ul className="mt-4 grid grid-cols-3 gap-3" aria-hidden>
          {SEGMENTS.map((s) => (
            <li key={s.key}>
              <p className={`figure font-display text-[clamp(1.75rem,4vw,2.75rem)] font-bold leading-none tracking-[-0.03em] ${s.text}`}>
                {formatNumber(shares[s.key] * 100, 0)}%
              </p>
              <p className="mt-1.5 flex items-center gap-2 text-sm font-medium text-ink-2">
                <span className={`inline-block h-3 w-3 shrink-0 rounded-[3px] ${s.className}`} />
                {s.label}
              </p>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-8 h-[220px] w-full" aria-hidden>
        {seen && (
          <ResponsiveContainer width="100%" height="100%">
            {/* Decorative repeat of the bar above (which carries the text alternative), so it
                must not take keyboard focus inside an aria-hidden region. */}
            <AreaChart accessibilityLayer={false} data={audit.curve} margin={{ top: 4, right: 8, bottom: 22, left: 0 }}>
              <defs>
                <pattern id="hatch-notfixed" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                  <rect width="6" height="6" fill={C.notfixed} />
                  <rect width="2" height="6" fill="rgb(255 255 255 / 0.32)" />
                </pattern>
                <pattern id="dots-open" width="5" height="5" patternUnits="userSpaceOnUse">
                  <rect width="5" height="5" fill={C.overdue} />
                  <circle cx="2.5" cy="2.5" r="1" fill="rgb(255 255 255 / 0.35)" />
                </pattern>
              </defs>
              <XAxis type="number" dataKey="day" scale="sqrt" domain={[0, audit.maxDay]} ticks={dayTicks(audit.maxDay)} tickLine={false} axisLine={{ stroke: C.rule }} tick={axisTick} dy={6} label={{ value: 'Days since reported', position: 'insideBottom', offset: -16, fill: C.ink3, fontSize: 12 }} />
              <YAxis domain={[0, 100]} ticks={[0, 50, 100]} tickFormatter={(v: number) => `${v}%`} tickLine={false} axisLine={false} tick={axisTick} width={48} />
              <Tooltip content={<OutcomeTooltip />} cursor={{ stroke: C.ink, strokeOpacity: 0.25 }} />
              <Area dataKey="resolved" stackId="1" type="stepAfter" stroke="none" fill={C.data} fillOpacity={0.95} isAnimationActive={!reduced} animationDuration={800} />
              <Area dataKey="notResolved" stackId="1" type="stepAfter" stroke="none" fill="url(#hatch-notfixed)" isAnimationActive={!reduced} animationDuration={800} animationBegin={80} />
              <Area dataKey="stillOpen" stackId="1" type="stepAfter" stroke="none" fill="url(#dots-open)" isAnimationActive={!reduced} animationDuration={800} animationBegin={160} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      <figcaption className="mt-4 space-y-2 text-[0.9375rem] leading-relaxed text-ink-2">
        {citywideShare !== null && (
          <p className="font-semibold text-ink">
            {formatNumber(citywideShare * 100, 1)}% of closed cases were Noted or Transitioned —
            not resolved.{' '}
            <span className="figure font-normal text-ink-3">
              All services, {citywideClosed !== null ? formatInt(citywideClosed) : '—'} closed cases.
            </span>
          </p>
        )}
        <p className="figure text-ink-3">
          {audit.service}: n = {formatInt(audit.n)} requests · {formatInt(audit.stillOpen)} still
          open (censored). Estimated with Aalen–Johansen cumulative incidence, which treats Noted and
          Transitioned as their own outcome rather than as cases that will be fixed later.
        </p>
      </figcaption>
    </figure>
  )
}
