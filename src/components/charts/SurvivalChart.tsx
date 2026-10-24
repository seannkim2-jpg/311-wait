import {
  Area,
  ComposedChart,
  Line,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { ServiceAudit } from '../../data/audit'
import { formatInt, formatNumber, formatWait } from '../../data/format'
import { useInViewOnce, usePrefersReducedMotion } from '../../hooks/motion'
import { C, axisTick, dayTicks } from './axes'

interface TipProps {
  active?: boolean
  payload?: { payload: ServiceAudit['curve'][number] }[]
}

function SurvivalTooltip({ active, payload }: TipProps) {
  const p = payload?.[0]?.payload
  if (!active || !p) return null
  return (
    <div className="rounded-xl border border-rule bg-white/95 px-3 py-2 text-sm shadow-[0_8px_24px_rgb(0_0_0/0.08)] backdrop-blur">
      <p className="figure text-ink-3">After {formatNumber(p.day, p.day < 10 ? 1 : 0)} days</p>
      <p className="figure font-semibold text-data">{formatNumber(p.km, 0)}% still waiting</p>
      <p className="figure text-city-text">Closed cases only: {formatNumber(p.city, 0)}%</p>
    </div>
  )
}

/**
 * Kaplan–Meier (with its 95% Greenwood band) against the closed-cases-only curve. Both are
 * step functions, so both use `stepAfter`; neither is ever smoothed.
 */
export function SurvivalChart({ audit }: { audit: ServiceAudit }) {
  const reduced = usePrefersReducedMotion()
  const { ref, seen } = useInViewOnce<HTMLDivElement>()
  const kmDay = audit.kmMedianHours !== null ? audit.kmMedianHours / 24 : null
  const cityDay = audit.cityMedianHours / 24
  const last = audit.curve[audit.curve.length - 1]

  const finding =
    kmDay !== null
      ? `Counting open cases, half of ${audit.service} requests close within ${formatWait(audit.kmMedianHours!)}. Looking only at closed cases gives ${formatWait(audit.cityMedianHours)}.`
      : `Counting open cases, ${formatNumber(audit.kmEnd * 100, 0)}% of ${audit.service} requests are still not closed after ${Math.floor(audit.maxDay)} days, so the curve never reaches half. Looking only at closed cases gives ${formatWait(audit.cityMedianHours)}.`

  return (
    <figure className="m-0">
      <div ref={ref} className="h-[340px] w-full sm:h-[400px]" role="img" aria-label={finding}>
        {seen && (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={audit.curve} margin={{ top: 16, right: 132, bottom: 28, left: 0 }}>
              <XAxis
                type="number"
                dataKey="day"
                scale="sqrt"
                domain={[0, audit.maxDay]}
                ticks={dayTicks(audit.maxDay)}
                tickLine={false}
                axisLine={{ stroke: C.rule }}
                tick={axisTick}
                dy={6}
                label={{ value: 'Days since reported', position: 'insideBottom', offset: -20, fill: C.ink3, fontSize: 12 }}
              />
              <YAxis
                domain={[0, 100]}
                ticks={[0, 25, 50, 75, 100]}
                tickFormatter={(v: number) => `${v}%`}
                tickLine={false}
                axisLine={false}
                tick={axisTick}
                width={48}
              />
              <Tooltip content={<SurvivalTooltip />} cursor={{ stroke: C.rule, strokeWidth: 1 }} />
              <ReferenceLine y={50} stroke={C.rule} strokeDasharray="3 4" label={{ value: 'Half closed', position: 'insideBottomRight', fill: C.ink3, fontSize: 12 }} />
              <Area
                dataKey="band"
                type="stepAfter"
                stroke="none"
                fill={C.dataBand}
                fillOpacity={0.12}
                isAnimationActive={!reduced}
                animationBegin={500}
                animationDuration={900}
                activeDot={false}
              />
              <Line
                dataKey="city"
                type="stepAfter"
                stroke={C.city}
                strokeWidth={2}
                strokeDasharray="6 5"
                dot={false}
                activeDot={{ r: 3.5, fill: C.city, stroke: '#fff' }}
                isAnimationActive={!reduced}
                animationBegin={0}
                animationDuration={700}
                animationEasing="ease-out"
              />
              <Line
                dataKey="km"
                type="stepAfter"
                stroke={C.data}
                strokeWidth={3}
                dot={false}
                activeDot={{ r: 4, fill: C.data, stroke: '#fff', strokeWidth: 2 }}
                isAnimationActive={!reduced}
                animationBegin={450}
                animationDuration={1000}
                animationEasing="ease-out"
              />
              <ReferenceDot x={cityDay} y={50} r={5} fill="#fff" stroke={C.city} strokeWidth={2} label={{ value: formatWait(audit.cityMedianHours), position: 'bottom', fill: C.ink2, fontSize: 12, offset: 10 }} />
              {kmDay !== null && (
                <ReferenceDot x={kmDay} y={50} r={5.5} fill={C.data} stroke="#fff" strokeWidth={2} label={{ value: formatWait(audit.kmMedianHours!), position: 'top', fill: C.data, fontSize: 13, fontWeight: 700, offset: 10 }} />
              )}
              {last && (
                <>
                  <ReferenceDot x={last.day} y={last.km} r={0} label={{ value: 'Counting open cases', position: 'right', fill: C.data, fontSize: 13, fontWeight: 600 }} />
                  <ReferenceDot x={last.day} y={last.city} r={0} label={{ value: 'Closed cases only', position: 'right', fill: C.ink2, fontSize: 13 }} />
                </>
              )}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
      <figcaption className="mt-4 text-[0.9375rem] leading-relaxed text-ink-2">
        <span className="text-ink">{finding}</span>{' '}
        <span className="figure text-ink-3">
          n = {formatInt(audit.n)} requests · {formatInt(audit.stillOpen)} still open (censored).
          Shaded band: 95% confidence interval. The time axis is stretched at the start so the
          first days are readable.
        </span>
      </figcaption>
    </figure>
  )
}
