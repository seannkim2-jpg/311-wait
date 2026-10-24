import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react'
import { loadOverview, loadServiceAudit, type Overview, type ServiceAudit } from './data/audit'
import { formatWait, inSentence } from './data/format'
import { SiteHeader } from './components/SiteHeader'
import { Hero } from './components/Hero'
import { Section } from './components/Section'
import { SurvivalChart } from './components/charts/SurvivalChart'
import { BiasCallout } from './components/BiasCallout'
import { OutcomeChart } from './components/charts/OutcomeChart'
import { NeighborhoodTable } from './components/NeighborhoodTable'
import { Footer, Method } from './components/Method'

// MapLibre is the heaviest dependency; load it after the answer has painted.
const CityMap = lazy(() => import('./components/map/CityMap'))

/** REQ-10: first load shows Street Light Outage. */
const DEFAULT_SERVICE = 'Street Light Outage'

export default function App() {
  const [overview, setOverview] = useState<Overview | null>(null)
  const [service, setService] = useState(DEFAULT_SERVICE)
  const [audit, setAudit] = useState<ServiceAudit | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const [attempt, setAttempt] = useState(0)
  const heroEndRef = useRef<HTMLDivElement | null>(null)
  const [compact, setCompact] = useState(false)

  useEffect(() => {
    loadOverview()
      .then(setOverview)
      .catch((e: Error) => setError(e.message))
  }, [attempt])

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError(null)
    loadServiceAudit(service)
      .then((a) => {
        if (!alive) return
        setAudit(a)
        setLoading(false)
        const real = a.kmMedianHours !== null ? `${formatWait(a.kmMedianHours)} until half are closed` : 'Fewer than half have ever closed'
        setAnnouncement(`Now showing ${a.service}. ${real}; the city reports ${formatWait(a.cityMedianHours)}.`)
      })
      .catch((e: Error) => {
        if (!alive) return
        setError(e.message)
        setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [service, attempt])

  // The compact header summary appears once the answer block leaves the viewport.
  useEffect(() => {
    const el = heroEndRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([e]) => setCompact(!e.isIntersecting && e.boundingClientRect.top < 0))
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const select = useCallback((s: string) => setService(s), [])
  const retry = () => setAttempt((n) => n + 1)
  const svc = audit?.service ?? service

  return (
    <>
      <a href="#answer" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-ink focus:px-4 focus:py-2 focus:text-white">
        Skip to the answer
      </a>
      <SiteHeader
        queriedAt={audit?.queriedAt ?? overview?.queriedAt ?? null}
        compact={compact}
        audit={audit}
        services={overview?.services ?? []}
        selected={service}
        loading={loading}
        onSelect={select}
      />
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>

      <main>
        {error && (
          <div role="alert" className="mx-auto mt-6 max-w-page px-5 sm:px-8">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-overdue/30 bg-overdue-soft px-5 py-4 text-[0.9375rem]">
              <p>
                <strong className="font-semibold">Boston&rsquo;s open-data service did not respond.</strong>{' '}
                <span className="text-ink-2">{error}</span>
              </p>
              <button type="button" onClick={retry} className="min-h-[40px] rounded-full bg-ink px-4 font-semibold text-white active:scale-[0.96]">
                Try again
              </button>
            </div>
          </div>
        )}

        <Hero overview={overview} audit={audit} selected={service} loading={loading} onSelect={select} />
        <div ref={heroEndRef} aria-hidden />

        <Section
          id="map"
          tone="mist"
          title="Where people are waiting right now"
          lede="Each circle is a neighborhood. Its size is the number of requests open today; the solid core is the part already past the city's own deadline. Select a neighborhood to compare."
        >
          <Suspense fallback={<div className="h-[560px] rounded-3xl border border-rule bg-white" />}>
            <CityMap service={service} />
          </Suspense>
        </Section>

        {audit && (
          <>
            <Section
              id="evidence"
              title="Still waiting, day by day"
              lede={
                <>
                  Of every 100 {inSentence(svc)} requests, how many are still not closed after a given
                  number of days. The dashed line is the city&rsquo;s method, which only looks at cases
                  that have already closed.
                </>
              }
            >
              <SurvivalChart audit={audit} />
              <p className="mt-6 max-w-[70ch] rounded-2xl border-l-4 border-notfixed bg-[#FBF4EA] px-5 py-4 text-[0.9375rem] leading-relaxed text-ink">
                Kaplan–Meier assumes cases still open are a random sample of open cases with respect
                to eventual close time. If the city defers difficult cases, our estimate is{' '}
                <strong>optimistic</strong> — the true wait is longer.
              </p>
              <div className="mt-12">
                <BiasCallout audit={audit} />
              </div>
            </Section>

            <Section
              id="outcomes"
              title="What happens to a report"
              lede={`Closing a case is not the same as fixing it. This is every ${inSentence(svc)} request, split by how it ended: resolved, closed without being resolved (Noted or Transitioned), or still open.`}
            >
              <OutcomeChart
                audit={audit}
                citywideShare={overview ? overview.closedUnresolved / overview.closed : null}
                citywideClosed={overview?.closed ?? null}
              />
            </Section>

            <Section
              id="neighborhoods"
              tone="mist"
              title="On time, by neighborhood"
              lede={`The share of closed ${inSentence(svc)} cases that met the city's own target, with a 95% range. It counts closed cases only, the same way the city does.`}
            >
              <NeighborhoodTable rows={audit.neighborhoods} service={svc} />
            </Section>
          </>
        )}

        <Section id="method" title="How we counted">
          <Method overview={overview} audit={audit} />
        </Section>
      </main>
      <Footer />
    </>
  )
}
