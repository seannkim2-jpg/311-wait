import { layers, namedFlavor } from '@protomaps/basemaps'
import type { LayerSpecification, StyleSpecification } from 'maplibre-gl'

/**
 * A quiet Protomaps basemap served from our own static file (public/map/boston.pmtiles).
 * The basemap must never win against the data (cartography-geoviz), so: the "white" flavor,
 * no POIs, no shields, no one-way arrows, and no sprite at all.
 */
export function basemapStyle(origin: string): StyleSpecification {
  const flavor = {
    ...namedFlavor('white'),
    // Slightly cooler water so the harbour reads as water without competing with red.
    water: '#E3E8F0',
    background: '#FAFAFB',
    earth: '#FAFAFB',
  }
  const base = layers('protomaps', flavor, { lang: 'en' }) as LayerSpecification[]
  const cleaned = base
    // Keep place names (Boston, Cambridge, Brookline) for orientation; road names are clutter here.
    .filter(
      (l) =>
        !['roads_oneway', 'roads_shields', 'address_label', 'roads_labels_minor', 'roads_labels_major'].includes(l.id) &&
        !l.id.startsWith('pois'),
    )
    .map((l) => {
      if (l.type === 'symbol' && l.layout && 'icon-image' in l.layout) {
        // places_locality uses a dot icon; keep the label, drop the icon (no sprite shipped).
        const { ['icon-image']: _icon, ...layout } = l.layout as Record<string, unknown>
        void _icon
        return { ...l, layout } as LayerSpecification
      }
      return l
    })

  return {
    version: 8,
    glyphs: `${origin}/map/fonts/{fontstack}/{range}.pbf`,
    sources: {
      protomaps: {
        type: 'vector',
        url: `pmtiles://${origin}/map/boston.pmtiles`,
        attribution:
          '<a href="https://protomaps.com">Protomaps</a> © <a href="https://openstreetmap.org/copyright">OpenStreetMap</a> · Boundaries: City of Boston',
      },
    },
    layers: cleaned,
  }
}
