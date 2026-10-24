import { useEffect, useMemo, useRef, useState } from 'react'
import * as maplibregl from 'maplibre-gl'
import type { GeoJSONSource, Map as MLMap, MapLayerMouseEvent } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
// MapLibre 6 runs tile parsing in a module worker; Vite must emit it as its own asset.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import { Protocol } from 'pmtiles'
import type { FeatureCollection, Point, Polygon, MultiPolygon } from 'geojson'
import { countByNeighborhood, loadOpenCases, type HoodCount, type OpenCase } from '../../data/openCases'
import { formatInt, inSentence } from '../../data/format'
import { useInViewOnce, usePrefersReducedMotion } from '../../hooks/motion'
import { basemapStyle } from './basemap'

// Register the PMTiles protocol once for the page, before any map exists.
let protocolRegistered = false
function ensureProtocol() {
  if (protocolRegistered) return
  maplibregl.setWorkerUrl(workerUrl)
  maplibregl.addProtocol('pmtiles', new Protocol().tile)
  protocolRegistered = true
}

const BOSTON_CENTER: [number, number] = [-71.0843, 42.3155]
const CITY = '__city__'

/** Leave room for the floating summary card at the top-left on wide screens. */
function cityPadding() {
  return window.innerWidth < 640
    ? { top: 120, bottom: 24, left: 16, right: 16 }
    : { top: 28, bottom: 28, left: 230, right: 40 }
}
const MAX_RADIUS = 34 // px at zoom 12 for the busiest neighbourhood in view
const RED = '#C8242D'
const RED_SOFT = '#F3C7CA'

type Mode = 'service' | 'all'
type HoodGeo = FeatureCollection<Polygon | MultiPolygon, { name: string }>
type HoodPoints = FeatureCollection<Point, { name: string }>

interface Props {
  service: string
}

export default function CityMap({ service }: Props) {
  const reduced = usePrefersReducedMotion()
  const { ref: sectionRef, seen } = useInViewOnce<HTMLDivElement>('0px 0px -25% 0px')
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<MLMap | null>(null)
  const [mapReady, setMapReady] = useState(false)
  const [cases, setCases] = useState<OpenCase[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<Mode>('service')
  const [selected, setSelected] = useState<string | null>(null)
  const [hovered, setHovered] = useState<string | null>(null)
  const geoRef = useRef<{ polys: HoodGeo; points: HoodPoints; bounds: Map<string, maplibregl.LngLatBounds> } | null>(null)
  const radiiRef = useRef(new Map<string, { open: number; overdue: number }>())

  // Data: every open case in the cohort, fetched once.
  useEffect(() => {
    let alive = true
    loadOpenCases()
      .then((c) => alive && setCases(c))
      .catch((e: Error) => alive && setError(e.message))
    return () => {
      alive = false
    }
  }, [])

  const inView = useMemo(
    () => (cases ? (mode === 'all' ? cases : cases.filter((c) => c.service === service)) : []),
    [cases, mode, service],
  )
  const { rows, unassigned } = useMemo(() => countByNeighborhood(inView), [inView])
  const totalOverdue = useMemo(() => inView.filter((c) => c.overdue).length, [inView])
  const maxOpen = rows.reduce((m, r) => Math.max(m, r.open), 0)
  const countsByName = useMemo(() => new Map(rows.map((r) => [r.neighborhood, r])), [rows])

  // Map: created once, the first time the section scrolls near the viewport.
  useEffect(() => {
    if (!seen || !containerRef.current || mapRef.current) return
    ensureProtocol()
    const origin = window.location.origin
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: basemapStyle(origin),
      center: BOSTON_CENTER,
      zoom: 10.2,
      minZoom: 10,
      maxZoom: 16,
      maxBounds: [
        [-71.32, 42.18],
        [-70.86, 42.46],
      ],
      attributionControl: { compact: true },
      dragRotate: false,
      pitchWithRotate: false,
      cooperativeGestures: true,
    })
    map.touchZoomRotate.disableRotation()
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right')
    mapRef.current = map

    map.on('load', async () => {
      const [polys, points] = (await Promise.all([
        fetch('/map/neighborhoods.json').then((r) => r.json()),
        fetch('/map/neighborhood-points.json').then((r) => r.json()),
      ])) as [HoodGeo, HoodPoints]
      const bounds = new Map<string, maplibregl.LngLatBounds>()
      const city = new maplibregl.LngLatBounds()
      for (const f of polys.features) {
        const b = new maplibregl.LngLatBounds()
        const rings = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates
        for (const poly of rings) for (const ring of poly) for (const c of ring) b.extend(c as [number, number])
        bounds.set(f.properties.name, b)
        // The Harbor Islands stretch far offshore and have no 311 cases; leave them out of the fit.
        if (f.properties.name !== 'Harbor Islands') city.extend(b)
      }
      bounds.set(CITY, city)
      geoRef.current = { polys, points, bounds }

      map.addSource('hoods', { type: 'geojson', data: polys, promoteId: 'name' })
      map.addSource('hood-points', { type: 'geojson', data: { type: 'FeatureCollection', features: [] }, promoteId: 'name' })
      map.addSource('cases', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })

      // Data goes under the basemap labels (maplibre-cartography: layer injection).
      const firstSymbol = map.getStyle().layers.find((l: { type: string }) => l.type === 'symbol')?.id
      map.addLayer({
        id: 'hood-fill',
        type: 'fill',
        source: 'hoods',
        paint: {
          'fill-color': '#2F4BD0',
          'fill-opacity': ['case', ['boolean', ['feature-state', 'selected'], false], 0.1, ['boolean', ['feature-state', 'hover'], false], 0.06, 0],
          'fill-opacity-transition': { duration: 150 },
        },
      }, firstSymbol)
      map.addLayer({
        id: 'hood-line',
        type: 'line',
        source: 'hoods',
        paint: {
          'line-color': ['case', ['boolean', ['feature-state', 'selected'], false], '#2F4BD0', '#15171C'],
          'line-opacity': ['case', ['boolean', ['feature-state', 'selected'], false], 0.9, 0.22],
          'line-width': ['case', ['boolean', ['feature-state', 'selected'], false], 2.2, 1],
        },
      }, firstSymbol)

      // Street level: individual open cases (coordinates rounded to ~100 m) appear as you zoom in.
      map.addLayer({
        id: 'case-dots',
        type: 'circle',
        source: 'cases',
        minzoom: 12.5,
        paint: {
          'circle-color': ['case', ['get', 'overdue'], RED, '#7A818D'],
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 12.5, 2.5, 16, 6],
          'circle-stroke-color': '#fff',
          'circle-stroke-width': 1,
          'circle-opacity': ['interpolate', ['linear'], ['zoom'], 12.5, 0, 13.4, 0.85],
          'circle-stroke-opacity': ['interpolate', ['linear'], ['zoom'], 12.5, 0, 13.4, 1],
        },
      })

      // Neighbourhood level: proportional circles. Outer = open now; solid core = past deadline.
      const r = (prop: string) =>
        ['interpolate', ['linear'], ['zoom'], 10, ['*', 0.62, ['get', prop]], 12, ['get', prop], 14, ['*', 1.7, ['get', prop]]] as unknown as number
      // `zoom` may only drive a top-level interpolate, so each opacity gets its own ramp.
      const fadeOut = (peak: number) =>
        ['interpolate', ['linear'], ['zoom'], 12.8, peak, 13.6, 0] as unknown as number
      map.addLayer({
        id: 'hood-open',
        type: 'circle',
        source: 'hood-points',
        paint: {
          'circle-radius': r('rOpen'),
          'circle-color': RED_SOFT,
          'circle-opacity': fadeOut(0.75),
          'circle-stroke-color': RED,
          'circle-stroke-width': ['case', ['boolean', ['feature-state', 'selected'], false], 2.5, 1],
          'circle-stroke-opacity': fadeOut(1),
        },
      })
      map.addLayer({
        id: 'hood-overdue',
        type: 'circle',
        source: 'hood-points',
        paint: {
          'circle-radius': r('rOverdue'),
          'circle-color': RED,
          'circle-opacity': fadeOut(0.92),
        },
      })
      map.addLayer({
        id: 'hood-label',
        type: 'symbol',
        source: 'hood-points',
        minzoom: 11.3,
        maxzoom: 13.6,
        layout: {
          'text-field': ['format', ['get', 'name'], { 'font-scale': 0.85 }, '\n', {}, ['to-string', ['get', 'overdue']], { 'font-scale': 1, 'text-font': ['literal', ['Noto Sans Medium']] }],
          'text-font': ['Noto Sans Regular'],
          'text-size': 12,
          'text-offset': [0, 0],
          'text-variable-anchor': ['top', 'bottom', 'left', 'right'],
          'text-radial-offset': 1.6,
        },
        paint: { 'text-color': '#15171C', 'text-halo-color': '#ffffff', 'text-halo-width': 1.6 },
      })

      const hit = ['hood-fill']
      map.on('mousemove', hit[0], (e: MapLayerMouseEvent) => {
        const name = e.features?.[0]?.properties?.name as string | undefined
        map.getCanvas().style.cursor = name ? 'pointer' : ''
        setHovered(name ?? null)
      })
      map.on('mouseleave', hit[0], () => {
        map.getCanvas().style.cursor = ''
        setHovered(null)
      })
      map.on('click', hit[0], (e: MapLayerMouseEvent) => {
        const name = e.features?.[0]?.properties?.name as string | undefined
        if (name) setSelected((cur) => (cur === name ? null : name))
      })

      setMapReady(true)
      // The one orchestrated entrance: ease from Greater Boston into the city's own outline.
      const fit = map.cameraForBounds(city, { padding: cityPadding() })
      if (fit) {
        if (reduced) map.jumpTo(fit)
        else {
          map.jumpTo({ ...fit, zoom: (fit.zoom ?? 11) - 0.9 })
          map.flyTo({ ...fit, duration: 1600, curve: 1.2, essential: false })
        }
      }
    })

    return () => {
      map.remove()
      mapRef.current = null
      setMapReady(false)
    }
    // `reduced` only shapes the entrance; it must not rebuild the map.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seen])

  // Size motion: tween circle radii to the new counts whenever the selection changes.
  useEffect(() => {
    const map = mapRef.current
    const geo = geoRef.current
    if (!mapReady || !map || !geo) return
    const maxRadius = window.innerWidth < 640 ? MAX_RADIUS * 0.6 : MAX_RADIUS
    const k = maxOpen > 0 ? maxRadius / Math.sqrt(maxOpen) : 0
    const target = new Map<string, { open: number; overdue: number }>()
    for (const f of geo.points.features) {
      const c = countsByName.get(f.properties.name)
      target.set(f.properties.name, { open: c ? k * Math.sqrt(c.open) : 0, overdue: c ? k * Math.sqrt(c.overdue) : 0 })
    }
    const from = new Map(radiiRef.current)
    const src = map.getSource('hood-points') as GeoJSONSource | undefined
    const caseSrc = map.getSource('cases') as GeoJSONSource | undefined
    caseSrc?.setData({
      type: 'FeatureCollection',
      features: inView.map((c) => ({ type: 'Feature', properties: { overdue: c.overdue }, geometry: { type: 'Point', coordinates: [c.lon, c.lat] } })),
    })

    const frame = (t: number) => {
      const feats = geo.points.features.map((f) => {
        const name = f.properties.name
        const a = from.get(name) ?? { open: 0, overdue: 0 }
        const b = target.get(name)!
        const cur = { open: a.open + (b.open - a.open) * t, overdue: a.overdue + (b.overdue - a.overdue) * t }
        radiiRef.current.set(name, cur)
        const c = countsByName.get(name)
        return { ...f, properties: { name, rOpen: cur.open, rOverdue: cur.overdue, overdue: c?.overdue ?? 0, open: c?.open ?? 0 } }
      })
      src?.setData({ type: 'FeatureCollection', features: feats })
    }

    if (reduced) {
      frame(1)
      return
    }
    let raf = 0
    const start = performance.now()
    const ease = (x: number) => 1 - Math.pow(1 - x, 4)
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 700)
      frame(ease(t))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [mapReady, countsByName, maxOpen, inView, reduced])

  // Selection and hover live in feature-state (needs promoteId, see maplibre-source-wiring).
  useEffect(() => {
    const map = mapRef.current
    if (!mapReady || !map) return
    map.removeFeatureState({ source: 'hoods' })
    map.removeFeatureState({ source: 'hood-points' })
    if (hovered) map.setFeatureState({ source: 'hoods', id: hovered }, { hover: true })
    if (selected) {
      map.setFeatureState({ source: 'hoods', id: selected }, { selected: true })
      map.setFeatureState({ source: 'hood-points', id: selected }, { selected: true })
    }
  }, [mapReady, hovered, selected])

  // Selecting a neighbourhood flies the camera to it; clearing returns to the city.
  useEffect(() => {
    const map = mapRef.current
    const geo = geoRef.current
    if (!mapReady || !map || !geo) return
    const duration = reduced ? 0 : 900
    const target = selected ? geo.bounds.get(selected) : geo.bounds.get(CITY)
    if (target) map.fitBounds(target, { duration, padding: cityPadding(), maxZoom: 13.2 })
  }, [mapReady, selected, reduced])

  const focus = selected ?? hovered
  const focusRow = focus ? countsByName.get(focus) ?? { neighborhood: focus, open: 0, overdue: 0 } : null
  const label = mode === 'all' ? 'all services' : inSentence(service)

  return (
    <div ref={sectionRef}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div role="group" aria-label="Which cases to map" className="inline-flex rounded-full bg-mist p-1">
          {(['service', 'all'] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => setMode(m)}
              className={`min-h-[40px] rounded-full px-4 text-sm font-semibold transition-[background-color,color,box-shadow] duration-150 ${mode === m ? 'bg-white text-ink shadow-[0_1px_2px_rgb(0_0_0/0.08),0_0_0_1px_rgb(0_0_0/0.04)]' : 'text-ink-2 hover:text-ink'}`}
            >
              {m === 'service' ? service : 'All services'}
            </button>
          ))}
        </div>
        <Legend />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="relative overflow-hidden rounded-3xl border border-rule bg-[#FAFAFB]">
          <div
            ref={containerRef}
            className="h-[460px] w-full sm:h-[560px]"
            role="region"
            aria-label={`Map of open ${label} cases by neighborhood. The same numbers are in the list beside the map.`}
          />
          <div className="pointer-events-none absolute left-3 top-3 max-w-[15rem] rounded-2xl bg-white/90 p-3 shadow-[0_10px_30px_rgb(0_0_0/0.08),0_0_0_1px_rgb(0_0_0/0.05)] backdrop-blur sm:left-4 sm:top-4 sm:max-w-[17rem] sm:p-4">
            {focusRow ? (
              <div key={focusRow.neighborhood} className="animate-rise-in">
                <p className="text-sm font-semibold text-ink-2">{focusRow.neighborhood}</p>
                <p className="figure mt-1 font-display text-4xl font-extrabold tracking-[-0.04em] text-overdue">{formatInt(focusRow.overdue)}</p>
                <p className="text-sm text-ink-2">
                  {mode === 'all' ? '' : `${service} `}cases currently past their deadline, out of{' '}
                  {formatInt(focusRow.open)} open
                </p>
              </div>
            ) : (
              <div>
                <p className="figure font-display text-4xl font-extrabold tracking-[-0.04em] text-overdue">
                  {cases ? formatInt(totalOverdue) : '—'}
                </p>
                <p className="text-sm text-ink-2">
                  {mode === 'all' ? '' : `${service} `}cases currently past their deadline
                </p>
                <p className="mt-2 text-xs text-ink-3">A snapshot of open cases right now, not a rate.</p>
              </div>
            )}
          </div>
          {!mapReady && !error && (
            <div className="absolute inset-0 grid place-items-center text-sm text-ink-3">
              <span className="inline-flex items-center gap-2">
                <span aria-hidden className="animate-spin-slow inline-block h-4 w-4 rounded-full border-2 border-ink/15 border-t-ink/60" />
                Loading map
              </span>
            </div>
          )}
          {error && (
            <p role="alert" className="absolute inset-x-4 bottom-4 rounded-xl bg-white p-3 text-sm text-overdue shadow">
              The open-cases query did not complete: {error}
            </p>
          )}
        </div>

        <HoodList rows={rows} selected={selected} onSelect={setSelected} unassigned={unassigned} label={label} />
      </div>
    </div>
  )
}

function Legend() {
  return (
    <div className="flex items-center gap-5 text-sm text-ink-2" aria-label="Legend">
      <span className="inline-flex items-center gap-2">
        <svg aria-hidden width="30" height="30" viewBox="0 0 30 30">
          <circle cx="15" cy="15" r="13" fill="#F3C7CA" fillOpacity="0.75" stroke="#C8242D" />
          <circle cx="15" cy="15" r="8" fill="#C8242D" />
        </svg>
        <span>
          Circle size: <strong className="font-semibold text-ink">open now</strong>
          <br />
          Solid core: <strong className="font-semibold text-overdue">past deadline</strong>
        </span>
      </span>
      <span className="hidden items-center gap-2 sm:inline-flex">
        <svg aria-hidden width="14" height="14" viewBox="0 0 14 14">
          <circle cx="7" cy="7" r="5" fill="#C8242D" stroke="#fff" />
        </svg>
        Zoom in for each case (placed within ~100 m)
      </span>
    </div>
  )
}

function HoodList({ rows, selected, onSelect, unassigned, label }: {
  rows: HoodCount[]
  selected: string | null
  onSelect: (n: string | null) => void
  unassigned: number
  label: string
}) {
  const [showAll, setShowAll] = useState(false)
  const max = rows.reduce((m, r) => Math.max(m, r.open), 0)
  const visible = showAll ? rows : rows.slice(0, 10)
  return (
    <div className="flex flex-col rounded-3xl border border-rule p-4">
      <p className="px-1 text-sm font-semibold">Past deadline, by neighborhood</p>
      <p className="px-1 text-xs text-ink-3">Counts, not rates: bigger neighborhoods have more cases.</p>
      <ol className="mt-3 space-y-1">
        {visible.map((r, i) => {
          const active = selected === r.neighborhood
          return (
            <li key={r.neighborhood}>
              <button
                type="button"
                aria-pressed={active}
                onClick={() => onSelect(active ? null : r.neighborhood)}
                className={`w-full rounded-xl px-2 py-1.5 text-left transition-colors duration-150 ${active ? 'bg-data-soft' : 'hover:bg-mist'}`}
              >
                <span className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="truncate">
                    <span className="figure mr-2 text-ink-3">{i + 1}</span>
                    <span className={active ? 'font-semibold text-data' : 'font-medium'}>{r.neighborhood}</span>
                  </span>
                  <span className="figure shrink-0">
                    <strong className="font-semibold text-overdue">{formatInt(r.overdue)}</strong>
                    <span className="text-ink-3"> / {formatInt(r.open)}</span>
                  </span>
                </span>
                <span aria-hidden className="mt-1 block h-1.5 w-full overflow-hidden rounded-full bg-mist">
                  <span className="motion-bar block h-full origin-left rounded-full bg-[#F3C7CA]" style={{ transform: `scaleX(${max ? r.open / max : 0})`, transition: 'transform 600ms var(--ease-out)' }}>
                    <span className="motion-bar block h-full origin-left rounded-full bg-overdue" style={{ transform: `scaleX(${r.open ? r.overdue / r.open : 0})`, transition: 'transform 600ms var(--ease-out)' }} />
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ol>
      {rows.length > 10 && (
        <button type="button" onClick={() => setShowAll((v) => !v)} aria-expanded={showAll} className="mt-2 min-h-[40px] rounded-xl text-sm font-semibold text-data hover:bg-mist">
          {showAll ? 'Show top 10' : `Show all ${rows.length}`}
        </button>
      )}
      <p className="mt-auto px-1 pt-3 text-xs text-ink-3">
        Red = past deadline, of all open {label} cases.{unassigned > 0 ? ` ${formatInt(unassigned)} open cases have no neighborhood and are not shown.` : ''}
      </p>
    </div>
  )
}
