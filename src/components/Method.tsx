import type { Overview, ServiceAudit } from '../data/audit'
import { COHORT_START } from '../data/audit'
import { formatInt, isoDateET } from '../data/format'

const REPO = 'https://github.com/seannkim2-jpg/kiro-hackachusetts'

export function Method({ overview, audit }: { overview: Overview | null; audit: ServiceAudit | null }) {
  const end = overview ? isoDateET(overview.queriedAt) : '—'
  const maxDay = audit ? Math.floor(audit.maxDay) : 115
  const blocks = [
    {
      title: 'The cohort',
      body: (
        <>
          Cases opened {COHORT_START} through {end}
          {overview ? ` (n = ${formatInt(overview.cohortN)})` : ''}. Earlier months in the city&rsquo;s
          file are incomplete and keep mostly slow cases, so they are left out. The longest wait we can
          observe is about {maxDay} days, so nothing here speaks to longer waits.
        </>
      ),
    },
    {
      title: 'The assumption',
      body: (
        <>
          Kaplan–Meier assumes cases still open are a random sample of open cases with respect to
          eventual close time. If the city defers difficult cases, our estimate is{' '}
          <strong className="font-semibold text-ink">optimistic</strong> — the true wait is longer.
        </>
      ),
    },
    {
      title: 'What this cannot tell you',
      body: (
        <>
          Why a wait is long. This audits how the wait is measured, not what drives it. The map
          is a snapshot count of open cases of different ages, not a rate or a performance
          score, and neighborhood counts are not adjusted for size.
        </>
      ),
    },
    {
      title: 'Checked three ways',
      body: (
        <>
          The estimators were written three times independently — TypeScript built by Kiro from the
          spec, a separate Python reference, and the <code className="text-[0.9em]">lifelines</code>{' '}
          library — and agree to six decimal places. 17 automated tests, 12 of them property-based.
        </>
      ),
    },
  ]

  return (
    <div>
      <div className="grid gap-x-12 gap-y-10 md:grid-cols-2">
        {blocks.map((b) => (
          <div key={b.title} className="border-t-2 border-ink pt-5">
            <h3 className="font-display text-xl font-bold tracking-[-0.02em]">{b.title}</h3>
            <p className="mt-3 max-w-[56ch] text-[1.0625rem] leading-relaxed text-ink-2">{b.body}</p>
          </div>
        ))}
      </div>
      <p className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-[0.9375rem] font-semibold">
        <a className="text-data underline-offset-4 hover:underline" href={`${REPO}/blob/main/docs/ANALYSIS.md`}>
          Full method and results
        </a>
        <a className="text-data underline-offset-4 hover:underline" href={REPO}>
          Source code on GitHub
        </a>
      </p>
    </div>
  )
}

export function Footer() {
  return (
    <footer className="border-t border-rule">
      <div className="mx-auto flex max-w-page flex-col gap-3 px-5 py-10 text-sm text-ink-3 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <p>
          Data: City of Boston 311 service requests via data.boston.gov. Boundaries: City of Boston
          (public domain). Map: Protomaps © OpenStreetMap contributors.
        </p>
        <p className="shrink-0 font-medium text-ink-2">Built with Kiro</p>
      </div>
    </footer>
  )
}
