# Boston 311 — facts verified live on 2026-10-24

Resource: `254adca6-64ab-4c5c-9fc0-a6da622be185` on data.boston.gov (CKAN).
No API key. `Access-Control-Allow-Origin: *`, so a static browser app can query it directly.
Also CORS-open and keyless: Cambridge Socrata, MassGIS ArcGIS, FEMA, MBTA.

## The endpoint is more capable than the starter kit implies
The portal kit strips 311 to 10 columns, 5,000 rows, no address. The live resource has
**75,851 rows and 29 columns**, including `close_date`, `target_close_date`, `on_time`,
`closure_reason`, `closure_comments`, `full_address`, `latitude`, `longitude`,
`assigned_team`, `report_source`, and every district/ward/precinct cut.

`datastore_search_sql` permits server-side `GROUP BY`, `COUNT`, `SUM`, `AVG`, `now()`,
`date_trunc` (verified), and `percentile_cont(0.5) WITHIN GROUP (ORDER BY
close_date::timestamp - open_date::timestamp)`. `EXTRACT` is **blocked**. Durations come back
as Postgres interval strings like `"13 days, 12:33:42.319741"` — parse client-side.

## Finding 1 — people are waiting right now, past the city's own target
7,840 cases are `case_status='In progress'` AND `on_time='OVERDUE'`. By service:

| service | open & overdue | longest current wait |
| --- | --- | --- |
| Sidewalk Repair | 1,882 | 122 days |
| Pruning Request | 755 | 361 days |
| Pothole | 493 | 122 days |
| Domestic Animal Issue | 475 | **449 days** |
| Street Light Outage | 475 | 367 days |
| Illegal Graffiti | 452 | 122 days |

By neighborhood: Dorchester 1,039, South End 616, Jamaica Plain 565, Back Bay 516,
South Boston 476, Roxbury 473, Brighton 418, East Boston 411.

## Finding 2 — "Closed" does not mean fixed
Of 66,251 closed cases, `closure_reason` is:
Resolved 48,125 · Noted 12,312 · Transitioned 2,842 · Resolved successfully 1,938 · null 1,034.
So **~23% of closed cases were closed without being resolved**, and the on-time rate counts
them. Worst offenders: Illegal Dumping 996/3,017 (33%), Improper Trash Storage 895/3,420
(26%), Trash Placed Out Early 772/2,953 (26%), Litter & Debris 1,715/9,949 (17%).

## Finding 3 — the mean/median gap hides the tail
Closed cases: Litter & Debris median 9h32m / mean 14h02m (n=9,949) · Domestic Animal Issue
median 5h15m / mean 2d14h (n=4,259) · Missed Waste Pick-up median 13h08m / mean 13h42m
(n=3,890) · **Street Light Outage median 13d12h / mean 47d02h** (n=3,485).

## Finding 4 — channel split
BOS311 app 49,265 · Call 26,585 · Email 1. A real adoption dimension, but do not infer that
one channel *causes* slower service.

## FACT-CHECK: the equity-gap framing is NOT supported
Kiro's draft pitch claimed Street Light Outage takes "a median of 13 days in some
neighborhoods versus two in others" and framed the app around "does my neighborhood wait
longer than wealthier ones." **Both are wrong.** Verified medians, slowest first:

South Boston Waterfront 54d (n=40) · Bay Village 52d (n=61) · East Boston 34d (n=167) ·
North End 31d (n=149) · Beacon Hill 28d (n=132) · Downtown 23d (n=100) · Charlestown 23d
(n=224) · Allston 21d (n=55) · Hyde Park 19d (n=108) · Back Bay 19d (n=236) · Brighton 18d
(n=172) · South End 18d (n=410).

No neighborhood is near two days, and the slowest list is led by some of the city's
wealthiest areas. Do not pitch an income-gradient story — a judge who checks will find the
opposite. Density, lamp ownership (city vs utility vs private) and contractor routing are all
confounded and the dataset cannot separate them.
