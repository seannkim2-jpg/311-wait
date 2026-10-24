#!/usr/bin/env bash
# Rebuilds the static map assets in public/map/. Needs no API key or account.
#
#   public/map/neighborhoods.json        Boston neighbourhood polygons, simplified (~1.3 MB -> small)
#   public/map/neighborhood-points.json  one interior point per neighbourhood, for the circles
#   public/map/boston.pmtiles            Boston-only basemap cut from a Protomaps daily build
#   public/map/fonts/                    Noto Sans glyph ranges for map labels (Latin only)
#
# Sources and licences:
#   Boundaries: City of Boston, "BPDA Neighborhood Boundaries", PDDL (public domain)
#   Basemap:    Protomaps daily build of OpenStreetMap data, ODbL. Credit "© OpenStreetMap" on the map.
#   Glyphs:     protomaps/basemaps-assets, Noto Sans (SIL OFL 1.1)
#
# Requires: node (for mapshaper, a devDependency), curl, and the `pmtiles` CLI
# (https://github.com/protomaps/go-pmtiles/releases) on PATH or in $PMTILES.
set -euo pipefail
cd "$(dirname "$0")/.."

OUT=public/map
mkdir -p "$OUT/fonts"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

BOUNDARIES_URL='https://data.boston.gov/dataset/bf1a7b50-4c72-4637-b0fa-11d632e3aff1/resource/e5849875-a6f6-4c9c-9d8a-5048b0fbd03e/download/boston_neighborhood_boundaries.geojson'
curl -sSL --max-time 120 -o "$TMP/boundaries.geojson" "$BOUNDARIES_URL"
echo "fetched boundaries: $(wc -c < "$TMP/boundaries.geojson") bytes"

# Polygons: keep only the name (it joins 1:1 to the 311 `neighborhood` field).
npx --no-install mapshaper "$TMP/boundaries.geojson" \
  -simplify 6% keep-shapes \
  -filter-fields name \
  -o "$OUT/neighborhoods.json" format=geojson precision=0.00001

# One interior point per neighbourhood, for the proportional circles and labels.
npx --no-install mapshaper "$TMP/boundaries.geojson" \
  -points inner \
  -filter-fields name \
  -o "$OUT/neighborhood-points.json" format=geojson precision=0.00001

# Basemap: Boston bounding box, zoom 0-14 (MapLibre overzooms past 14).
PMTILES=${PMTILES:-pmtiles}
BUILD=${PROTOMAPS_BUILD:-$(date -u -d 'yesterday' +%Y%m%d)}
"$PMTILES" extract "https://build.protomaps.com/${BUILD}.pmtiles" "$OUT/boston.pmtiles" \
  --bbox=-71.215,42.215,-70.95,42.42 --maxzoom=14

# Glyphs: Latin ranges only. Boston's map labels are all Latin script.
for stack in 'Noto Sans Regular' 'Noto Sans Medium' 'Noto Sans Italic'; do
  mkdir -p "$OUT/fonts/$stack"
  for range in 0-255 256-511 8192-8447; do
    curl -sSL --max-time 60 -o "$OUT/fonts/$stack/$range.pbf" \
      "https://protomaps.github.io/basemaps-assets/fonts/${stack// /%20}/$range.pbf"
  done
done

ls -la "$OUT"
