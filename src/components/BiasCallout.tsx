import type { ServiceAudit } from '../data/audit'
import { formatInt, formatNumber, formatWait } from '../data/format'

/** REQ-06: the exact naive-vs-corrected sentence, full width, updated from live data. */
export function BiasCallout({ audit }: { audit: ServiceAudit }) {
  const reached = audit.kmMedianHours !== null
  const ratio = reached ? audit.kmMedianHours! / audit.cityMedianHours : null

  return (
    <aside
      aria-label="How much a closed-cases-only median understates the wait"
      className="grid gap-6 rounded-3xl bg-ink px-6 py-8 text-white sm:grid-cols-[auto_1fr] sm:items-center sm:gap-10 sm:px-10 sm:py-10"
    >
      <p key={audit.service} className="animate-pop-in figure font-display text-[clamp(3.5rem,9vw,6rem)] font-extrabold leading-none tracking-[-0.05em]">
        {ratio !== null ? `${formatNumber(ratio, 1)}×` : 'No median'}
      </p>
      <p className="max-w-[60ch] text-lg leading-relaxed text-white/85">
        {reached ? (
          <>
            The naive median is <strong className="text-white">{formatWait(audit.cityMedianHours)}</strong>. The
            KM-corrected median is <strong className="text-white">{formatWait(audit.kmMedianHours!)}</strong>. The
            naive estimate understates the wait by{' '}
            <strong className="text-white">{formatNumber(ratio!, 2)}×</strong> because it excludes{' '}
            <strong className="text-white">{formatInt(audit.stillOpen)}</strong> open cases.
          </>
        ) : (
          <>
            The naive median says <strong className="text-white">{formatWait(audit.cityMedianHours)}</strong>.
            Fewer than half of {audit.service} cases have ever closed: the survival curve ends at S ={' '}
            <strong className="text-white">{formatNumber(audit.kmEnd, 3)}</strong>. There is no honest median.
          </>
        )}
      </p>
    </aside>
  )
}
