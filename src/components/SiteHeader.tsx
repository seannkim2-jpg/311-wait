import type { ServiceCount } from '../lib/boston311'
import type { ServiceAudit } from '../data/audit'
import { formatQueried, formatWait } from '../data/format'

interface Props {
  queriedAt: Date | null
  compact: boolean
  audit: ServiceAudit | null
  services: ServiceCount[]
  selected: string
  loading: boolean
  onSelect: (s: string) => void
}

/**
 * Sticky header. Once the answer has scrolled away, a compact summary slides in with a native
 * select, so the one control that drives the page is reachable from anywhere.
 */
export function SiteHeader({ queriedAt, compact, audit, services, selected, loading, onSelect }: Props) {
  return (
    <header className="sticky top-0 z-40 border-b border-rule/80 bg-white/85 backdrop-blur-md supports-[backdrop-filter]:bg-white/70">
      <div className="mx-auto flex h-16 max-w-page items-center gap-4 px-5 sm:px-8">
        <a href="#answer" className="flex shrink-0 items-center gap-2.5 rounded-md">
          <svg aria-hidden viewBox="0 0 32 32" className="h-7 w-7">
            <rect width="32" height="32" rx="9" fill="#15171C" />
            <rect x="7" y="18" width="7" height="6" rx="2" fill="#7A818D" />
            <rect x="7" y="9" width="18" height="6" rx="2" fill="#fff" />
          </svg>
          <span className="font-display text-lg font-bold tracking-[-0.02em]">Wait Audit</span>
        </a>

        <div
          className={[
            'hidden min-w-0 flex-1 items-center justify-center gap-3 md:flex',
            'transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none',
            compact ? 'translate-y-0 opacity-100' : 'pointer-events-none -translate-y-2 opacity-0',
          ].join(' ')}
          aria-hidden={!compact}
        >
          <label className="sr-only" htmlFor="compact-service">
            Service type
          </label>
          <select
            id="compact-service"
            tabIndex={compact ? 0 : -1}
            value={selected}
            disabled={loading}
            onChange={(e) => onSelect(e.target.value)}
            className="max-w-[16rem] truncate rounded-full border border-rule bg-white py-1.5 pl-3 pr-8 text-sm font-medium"
          >
            {services.map((s) => (
              <option key={s.service_name} value={s.service_name}>
                {s.service_name}
              </option>
            ))}
          </select>
          {audit && (
            <p className="figure truncate text-sm text-ink-2">
              <span className="font-semibold text-data">
                {audit.kmMedianHours !== null
                  ? formatWait(audit.kmMedianHours)
                  : `${Math.floor(audit.maxDay)}+ days`}
              </span>{' '}
              counting open cases · closed only {formatWait(audit.cityMedianHours)}
            </p>
          )}
        </div>

        <p className="figure ml-auto shrink-0 text-right text-xs leading-tight text-ink-3 sm:text-sm">
          <span className="block sm:inline">data.boston.gov</span>
          <span className="hidden sm:inline"> · </span>
          <span className="block sm:inline">{queriedAt ? `queried ${formatQueried(queriedAt)}` : 'connecting…'}</span>
        </p>
      </div>
    </header>
  )
}
