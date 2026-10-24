# Kiro brief: brainstorm the whole Civic Action track

## Situation
Hackachusetts 2026, Saturday October 24. Submission deadline 8:00 PM Eastern.
It is now about 12:15 PM Eastern, so roughly SEVEN AND A HALF HOURS remain, and that must
include building, deploying a free public demo, recording a video under three minutes, and
writing the Kiro-usage document. Treat time as the binding constraint.

We have committed to the **Civic Action** track. We are NOT limited to MBTA/transit any
more. The earlier transit shortlist is one candidate among many; widen the aperture to the
whole track and let the strongest idea win on merit.

## Hard rules (disqualification risk)
- Kiro must be the tool that builds it. `/.kiro` at repo root, never gitignored.
- Public repo, clean-clone runnable, free for judges, no login unless credentials are given.
- Video under 3 minutes showing the thing actually running.
- Original work.

## Judging criteria, in the judges' own words
1. **Potential value** — real, clearly defined problem; scalable and realistic; genuine
   consideration for accessibility, equity and adoption; a pitch showing who benefits and
   how it scales past the hackathon; and *how saturated the market already is*.
2. **Implementation** — breadth and depth of Kiro usage (IDE, CLI, Web, Crew; specs, hooks,
   steering, MCP, property-based testing, powers) and a deliberate AI-development strategy
   rather than ad-hoc prompting.
3. **Quality and design** — creativity and originality; *finding and using unique public
   datasets*; combining technology in a surprising way; intuitive, polished, intentional UI.

## The five challenges, verbatim from the portal
- **V1 Simplified public services** — "One task. Too many sites and agencies."
  Directions: "Plain language. Show the next step."
- **V2 Responsive and resilient communities** — "Volume hides who is waiting, and who an
  alert misses." Directions: "Triage the pattern. Prep is not a siren."
- **V3 Safer and connected places** — "The last mile is a street, a bike, or a crash."
  Directions: "Show what changed, and where it is unsafe."
- **V4 Better college experiences** — "Create more supportive college experiences."
  Directions: "Show the campus, the engagement, and the research."
- **V5 Pathways to education and opportunity** — "Expand access to life-changing
  opportunities." Directions: "Cost, wages, and the next step."

The track umbrella is "Better Together: improving where we live, work, study and play," with
sub-themes citizen-friendly digital government, more responsive neighborhood services, and
stronger community emergency readiness.

## The 22 datasets
Full inventory with direct source URLs, challenge tags, row counts and columns is in
`.context/civic-portal-inventory.md`. Read it. Summary by challenge:
- **V1**: Boston permits (8,240), violations (2,018), neighborhood estimates (24), EJ block
  groups (2,604), College Scorecard (140), O*NET occupations (1,016)
- **V2**: Boston 311 (snapshot 5,000), FEMA MA disaster declarations (415), EJ, IPEDS (144),
  OpenAlex 2024 works (500)
- **V3**: MBTA alerts / routes / stations, MassGIS college points (206), Bluebikes Nov-2024
  station pairs (63,063), Boston Vision Zero crashes (44,986), Cambridge crashes (17,230),
  Cambridge bike counts (92,268), Cambridge Broadway eco-totem (17,123), Fresh Pond usership
  (8,784), Somerville bike/ped counts (2,532), Boston Numina street sensors (245,555)
- **V4/V5**: IPEDS, OpenAlex, College Scorecard, O*NET

## Facts I verified MYSELF today — rely on these, do not re-assume
**Boston 311 is much richer live than the starter kit suggests.** The portal kit strips it to
10 columns and no address. The live CKAN resource `254adca6-64ab-4c5c-9fc0-a6da622be185` has
**75,851 rows** and 29 columns including `close_date`, `target_close_date`, `on_time`,
`closure_reason`, `closure_comments`, `full_address`, `latitude`, `longitude`,
`assigned_team`, `report_source`, and every district/ward/precinct cut.

The CKAN **`datastore_search_sql` endpoint permits server-side `GROUP BY`, `COUNT`, `SUM`,
`AVG`, and `percentile_cont(...) WITHIN GROUP (ORDER BY close_date::timestamp -
open_date::timestamp)`**. `EXTRACT` is blocked, but plain timestamp subtraction returns a
Postgres interval string such as `"13 days, 12:33:42.319741"`, which the client can parse.
So a **static browser-only app with no backend and no API key** can compute real distributions.

Real numbers I pulled, for closed cases:
| service_name | n | median | mean |
| --- | --- | --- | --- |
| Litter & Debris | 9,949 | 9h 32m | 14h 02m |
| Domestic Animal Issue | 4,259 | 5h 15m | 2d 14h |
| Missed Waste Pick-up | 3,890 | 13h 08m | 13h 42m |
| Street Light Outage | 3,485 | **13d 12h** | **47d 02h** |

Per-neighborhood cuts are dense enough to be meaningful: Dorchester Litter & Debris n=1,472
with 1,347 on time; Roxbury Litter & Debris n=896 with 792 on time.

Also verified responding 200 today: the FEMA MA declarations endpoint, and (from earlier
work) MBTA `/routes`, `/stops?filter[route]=Red` (22 stops) and `/alerts`.

## Sean's own background, for an honest personal story
From his notes: he co-authored a statistics project on how commuting by car, carpool and
public transit varies by race, occupation and income, using ACS data. He interned as a policy
intern in the **City of Boston Assessing Department**, validating FY2026 municipal property
tax records and researching policy. So he has first-hand experience of municipal
administrative data and what it does and does not support.
Do NOT claim he personally rides a particular MBTA line or filed a 311 case.

## What I need from you
Propose **six** sharply scoped concepts spanning **at least four of the five challenges** —
do not put five of them in V3/transit. For each concept give:
1. The challenge it answers and the one-sentence problem.
2. The precise user and their moment of need.
3. The one question they ask in ordinary language.
4. Exact datasets/endpoints needed, and whether a backend or API key is required.
5. What can honestly be demonstrated by 8 PM tonight.
6. Market saturation — what official or commercial tool already does this, and the honest
   differentiator. Be harsh here; "the official site is ugly" is not a differentiator.
7. Failure modes, and the claims the data CANNOT support.

Then give a comparison table scoring each on potential value, originality/market gap,
feasibility in seven hours, demo clarity, and strength of Sean's personal story.

Then recommend ONE concept, with a 30-second judge pitch and the smallest demo that proves
it. Also name your runner-up and say what would make you switch.

## Discipline
- No causal or equity *causation* claims. Descriptive comparisons only.
- Never present a historical distribution as a prediction or a guarantee.
- Say plainly what each dataset cannot establish.
- Favor one small complete thing over a broad shallow one. A static browser-only app that
  needs no key and no server is worth a lot tonight.
- Do not write code yet. This is concept selection.
