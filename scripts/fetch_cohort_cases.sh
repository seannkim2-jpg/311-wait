#!/usr/bin/env bash
# Regenerates src/lib/__fixtures__/cohortCases.json, the raw-case fixture the
# cross-implementation test runs on. Needs no API key.
set -euo pipefail
cd "$(dirname "$0")/.."
R='254adca6-64ab-4c5c-9fc0-a6da622be185'
for SVC in "Street Light Outage" "Sidewalk Repair" "Pothole" "Litter & Debris"; do
  SQL="SELECT case_status, closure_reason, open_date, close_date FROM \"$R\"
       WHERE open_date::timestamp >= '2026-07-01'
         AND service_name='${SVC//\'/\'\'}'
         AND case_status IN ('Closed','In progress') LIMIT 32000"
  curl -sS --max-time 90 -G "https://data.boston.gov/api/3/action/datastore_search_sql" \
    --data-urlencode "sql=$SQL" \
    > "/tmp/km_$(echo "$SVC" | tr -cd '[:alnum:]').json"
  echo "fetched: $SVC"
done
python3 -I - <<'PY'
import json, glob, os
out = {}
for p in sorted(glob.glob('/tmp/km_*.json')):
    recs = json.load(open(p))['result']['records']
    out[os.path.basename(p)[3:-5]] = [
        {k: r.get(k) for k in ('case_status', 'closure_reason', 'open_date', 'close_date')}
        for r in recs
    ]
json.dump(out, open('src/lib/__fixtures__/cohortCases.json', 'w'))
print('wrote src/lib/__fixtures__/cohortCases.json', sum(len(v) for v in out.values()), 'rows')
PY
python3 -I scripts/reference_impl.py
