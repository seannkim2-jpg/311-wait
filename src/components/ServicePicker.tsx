import { useMemo, useRef, useState, type KeyboardEvent } from 'react'
import type { ServiceCount } from '../lib/boston311'
import { formatInt } from '../data/format'

/** Shown first; every other service in the data sits behind "More services". */
const FEATURED = ['Street Light Outage', 'Sidewalk Repair', 'Pothole', 'Litter & Debris']

interface Props {
  services: ServiceCount[]
  selected: string
  loading: boolean
  onSelect: (service: string) => void
}

/**
 * REQ-11. A toolbar of toggle buttons: arrow keys move focus, Space or Enter selects.
 * While a service loads the chips stay focusable but inert (`aria-disabled`), so keyboard
 * focus is never thrown away mid-interaction.
 */
export function ServicePicker({ services, selected, loading, onSelect }: Props) {
  const [expanded, setExpanded] = useState(false)
  const refs = useRef<(HTMLButtonElement | null)[]>([])

  const { featured, rest } = useMemo(() => {
    const names = new Set(services.map((s) => s.service_name))
    const featuredList = FEATURED.filter((f) => names.has(f)).map(
      (f) => services.find((s) => s.service_name === f)!,
    )
    const restList = services.filter((s) => !FEATURED.includes(s.service_name))
    return { featured: featuredList, rest: restList }
  }, [services])

  // If the selected service lives in the overflow, keep the overflow open.
  const showAll = expanded || rest.some((s) => s.service_name === selected)
  const visible = showAll ? [...featured, ...rest] : featured
  const [focusIndex, setFocusIndex] = useState(() =>
    Math.max(0, visible.findIndex((s) => s.service_name === selected)),
  )
  const toggleIndex = visible.length // the "More services" button is the last stop
  const stops = visible.length + (rest.length ? 1 : 0)

  const move = (i: number) => {
    const next = (i + stops) % stops
    setFocusIndex(next)
    refs.current[next]?.focus()
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const keys: Record<string, () => void> = {
      ArrowRight: () => move(focusIndex + 1),
      ArrowDown: () => move(focusIndex + 1),
      ArrowLeft: () => move(focusIndex - 1),
      ArrowUp: () => move(focusIndex - 1),
      Home: () => move(0),
      End: () => move(stops - 1),
    }
    const fn = keys[e.key]
    if (fn) {
      e.preventDefault()
      fn()
    }
  }

  return (
    <div className="relative">
      <div
        role="toolbar"
        aria-label="Choose a service type"
        aria-busy={loading}
        onKeyDown={onKeyDown}
        className="flex flex-wrap items-center gap-2"
      >
        {visible.map((s, i) => {
          const active = s.service_name === selected
          return (
            <button
              key={s.service_name}
              ref={(el) => {
                refs.current[i] = el
              }}
              type="button"
              tabIndex={i === focusIndex ? 0 : -1}
              aria-pressed={active}
              aria-disabled={loading || undefined}
              onFocus={() => setFocusIndex(i)}
              onClick={() => {
                if (!loading && !active) onSelect(s.service_name)
              }}
              className={[
                'group inline-flex min-h-[44px] items-center gap-2 rounded-full border px-4 text-[0.9375rem] font-medium',
                'transition-[background-color,border-color,color,transform] duration-150 ease-out active:scale-[0.96]',
                active
                  ? 'border-ink bg-ink text-white'
                  : 'border-rule bg-white text-ink hover:border-ink-3',
                loading && !active ? 'cursor-progress opacity-60' : '',
              ].join(' ')}
            >
              {s.service_name}
              <span
                className={`figure text-[0.8125rem] font-normal ${active ? 'text-white/70' : 'text-ink-3'}`}
              >
                {formatInt(s.n)}
              </span>
              {active && loading && (
                <span
                  aria-hidden
                  className="animate-spin-slow ml-0.5 inline-block h-3.5 w-3.5 rounded-full border-2 border-white/40 border-t-white"
                />
              )}
            </button>
          )
        })}
        {rest.length > 0 && (
          <button
            ref={(el) => {
              refs.current[toggleIndex] = el
            }}
            type="button"
            tabIndex={focusIndex === toggleIndex ? 0 : -1}
            aria-expanded={showAll}
            onFocus={() => setFocusIndex(toggleIndex)}
            onClick={() => setExpanded((v) => !v)}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-4 text-[0.9375rem] font-medium text-data underline-offset-4 hover:underline"
          >
            {showAll ? 'Fewer services' : `${rest.length} more services`}
          </button>
        )}
      </div>
      {loading && (
        <p className="mt-3 text-sm text-ink-3" aria-hidden>
          Loading live data from data.boston.gov…
        </p>
      )}
    </div>
  )
}
