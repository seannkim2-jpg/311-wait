import { useId, useMemo, useState } from 'react'
import type { NeighborhoodRow } from '../data/audit'
import { formatInt, formatNumber, inSentence } from '../data/format'

const MIN_N = 30
type SortKey = 'neighborhood' | 'n' | 'rate'

/** REQ-07, REQ-08, REQ-14. */
export function NeighborhoodTable({ rows, service }: { rows: NeighborhoodRow[]; service: string }) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'n', dir: 'desc' })

  const sorted = useMemo(() => {
    const copy = [...rows]
    copy.sort((a, b) => {
      // Suppressed rows have no reliable rate, so they always sort last by rate.
      if (sort.key === 'rate') {
        const sa = a.n < MIN_N
        const sb = b.n < MIN_N
        if (sa !== sb) return sa ? 1 : -1
      }
      const va = a[sort.key]
      const vb = b[sort.key]
      const cmp = typeof va === 'string' ? va.localeCompare(vb as string) : (va as number) - (vb as number)
      return sort.dir === 'asc' ? cmp : -cmp
    })
    return copy
  }, [rows, sort])

  const toggle = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'neighborhood' ? 'asc' : 'desc' }))

  const ariaSort = (key: SortKey) => (sort.key === key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none')

  return (
    <div>
      <p className="mb-3 text-sm text-ink-3">Neighborhoods with fewer than 30 cases show —</p>
      <div className="overflow-x-auto rounded-2xl border border-rule bg-white">
        <table className="w-full min-w-[560px] border-collapse text-left text-[0.9375rem]">
          <caption className="sr-only">
            On-time rate among closed {service} cases by neighborhood, with 95% Wilson intervals.
          </caption>
          <thead className="bg-mist text-sm text-ink-2">
            <tr>
              <Th label="Neighborhood" sortKey="neighborhood" ariaSort={ariaSort('neighborhood')} onSort={toggle} active={sort.key === 'neighborhood'} dir={sort.dir} />
              <Th label="Closed cases" sortKey="n" ariaSort={ariaSort('n')} onSort={toggle} active={sort.key === 'n'} dir={sort.dir} numeric />
              <Th label="On time" sortKey="rate" ariaSort={ariaSort('rate')} onSort={toggle} active={sort.key === 'rate'} dir={sort.dir} numeric />
              <th scope="col" className="px-4 py-3 font-medium">
                95% range
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => {
              const suppressed = r.n < MIN_N
              return (
                <tr key={r.neighborhood} className="border-t border-rule">
                  <th scope="row" className="px-4 py-2.5 font-medium">
                    {r.neighborhood}
                  </th>
                  <td className="figure px-4 py-2.5 text-right">{formatInt(r.n)}</td>
                  <td className="figure px-4 py-2.5 text-right font-semibold">
                    {suppressed ? <Suppressed n={r.n} /> : `${formatNumber(r.rate * 100, 0)}%`}
                  </td>
                  <td className="px-4 py-2.5">
                    {suppressed ? <span className="text-ink-3">—</span> : <IntervalBar row={r} />}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-4 max-w-[70ch] text-[0.9375rem] leading-relaxed text-ink-2">
        Neighborhood differences in {inSentence(service)} times may reflect{' '}
        {service === 'Street Light Outage'
          ? 'lamp ownership (city vs utility vs private)'
          : 'who owns or maintains the asset'}
        , contractor routing, and case volume — this dataset cannot separate those factors.
      </p>
    </div>
  )
}

function Th({ label, sortKey, ariaSort, onSort, active, dir, numeric = false }: {
  label: string
  sortKey: SortKey
  ariaSort: 'ascending' | 'descending' | 'none'
  onSort: (k: SortKey) => void
  active: boolean
  dir: 'asc' | 'desc'
  numeric?: boolean
}) {
  return (
    <th scope="col" aria-sort={ariaSort} className={`px-2 py-1.5 font-medium ${numeric ? 'text-right' : ''}`}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex min-h-[40px] items-center gap-1 rounded-lg px-2 hover:text-ink ${active ? 'text-ink' : ''}`}
      >
        {label}
        <svg
          aria-hidden
          viewBox="0 0 12 12"
          className={`h-3 w-3 transition-transform duration-150 ease-out ${active ? 'opacity-100' : 'opacity-30'} ${active && dir === 'asc' ? 'rotate-180' : ''}`}
        >
          <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </th>
  )
}

function IntervalBar({ row }: { row: NeighborhoodRow }) {
  return (
    <div className="flex items-center gap-3">
      <div className="relative h-2 w-28 shrink-0 rounded-full bg-rule sm:w-40" aria-hidden>
        <div
          className="absolute inset-y-0 rounded-full bg-data/30"
          style={{ left: `${row.lower * 100}%`, width: `${Math.max(1, (row.upper - row.lower) * 100)}%` }}
        />
        <div className="absolute -top-1 h-4 w-[3px] rounded-full bg-data" style={{ left: `calc(${row.rate * 100}% - 1.5px)` }} />
      </div>
      <span className="figure whitespace-nowrap text-sm text-ink-2">
        {formatNumber(row.lower * 100, 0)}–{formatNumber(row.upper * 100, 0)}%
      </span>
    </div>
  )
}

/** Focusable em dash with a tooltip on hover and keyboard focus (REQ-08). */
function Suppressed({ n }: { n: number }) {
  const id = useId()
  const text = `Suppressed: fewer than 30 cases (n=${n}). Results below this threshold are unreliable.`
  return (
    <span className="group relative inline-flex">
      <button type="button" aria-describedby={id} className="-my-1 min-h-[28px] min-w-[32px] rounded-md text-ink-3 hover:text-ink">
        —<span className="sr-only">suppressed</span>
      </button>
      <span
        role="tooltip"
        id={id}
        className="pointer-events-none absolute bottom-full right-0 z-10 mb-2 w-64 rounded-xl bg-ink px-3 py-2 text-left text-xs font-normal leading-relaxed text-white opacity-0 shadow-lg transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100"
      >
        {text}
      </span>
    </span>
  )
}
