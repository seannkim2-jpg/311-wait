[tool] Reading civic-wide-brief.md:1, civic-portal-inventory.md:1
[tool] status: Completed
Here is the full analysis.

---

## Context summary

Seven and a half hours remain. The only winning move is a static, no-backend, no-API-key browser app that loads live public data, does one thing beautifully, and tells a clear story in a three-minute video. The 311 live CKAN endpoint with server-side SQL is a structural advantage no other team is likely to have verified today.

---

## The six concepts

**Concept A — 311 Response-Time Equity Dashboard (V2)**

Problem: Boston residents don't know whether their neighborhood waits longer than others for the same city service, and the city's own 311 site shows only your case status, not the systemic pattern.

User and moment: A Dorchester block-association organizer preparing talking points for a city council budget hearing wants to know whether their neighborhood's Street Light Outage cases close in 13 days while Back Bay's close in 2.

Their question: "Does my neighborhood wait longer for the same service than wealthier ones?"

Datasets/endpoints: Live Boston 311 CKAN SQL endpoint (verified today, no key), optionally overlaid with EJ block groups for context. No backend. No API key.

Demo by 8 PM: A single-page app with a service-type picker and a neighborhood bar chart. User selects "Street Light Outage," sees median close time by neighborhood ranked bar chart, with a tooltip showing n, median, and on-time rate. Optional: EJ flag badge next to each neighborhood name.

Market saturation: Boston's official 311 tracker shows your own case. Analyze Boston and WBUR have run point-in-time 311 analyses, but they are static news articles from 2021–2023. No live, self-service, query-able equity view exists in the official product or any current tool. Honest differentiator: the CKAN SQL endpoint lets a static app compute live medians, which a news article cannot, and the per-neighborhood on-time rate is a column the official site never surfaces.

Failure modes: The data cannot establish why one neighborhood waits longer (staffing, density, call volume, geography — all confounded). The EJ overlay is descriptive proximity, not causation. Neighborhoods with small n for a given service type will produce noisy medians — must show n and suppress or warn when n < 30.

---

**Concept B — "What's the Next Step?" Permit & Violation Navigator (V1)**

Problem: A Boston homeowner trying to pull a renovation permit faces three separate sites (Inspectional Services, Assessing, Analyze Boston), each with different vocabulary and no handoff.

User and moment: A Jamaica Plain homeowner who just got a violation notice and doesn't know whether to appeal, pay, or pull a new permit.

Their question: "I got a violation. What do I do next?"

Datasets/endpoints: Boston permits (CKAN), Boston violations (CKAN), neighborhood estimates for context. All static queries, no key.

Demo by 8 PM: A plain-language decision-tree page. User answers three questions (type of violation, current status, ward) and gets a two-sentence plain-English next step with links to the relevant city office. A side panel shows recent permit and violation counts for their ward, fetched live.

Market saturation: The city's Inspectional Services site exists but has no plain-language guidance layer. Multiple civic tech orgs (Code for Boston, mySociety's FixMyStreet) have built generic "report a problem" tools, but none parse existing violation records into a next-step guide for Boston specifically. Honest differentiator: thin. The data has no "reason for violation" field that would make routing truly intelligent. This is mostly a UX exercise on top of thin data.

Failure modes: Violations data has no house number (only zip/ward), so you cannot verify a specific property. The permit data has no connection to the violation record, so you cannot close the loop. A judge could reasonably ask "why not just call 311?" This is the weakest concept on data depth.

---

**Concept C — Campus Safety & Mobility Map (V3)**

Problem: Students and staff navigating between Boston/Cambridge campuses by bike have no single view combining where crashes have happened, where bike counts are high, and where the nearest Bluebikes station is.

User and moment: A Northeastern student considering biking from campus to a Harvard Square internship for the first time, worried about safety.

Their question: "Where are the dangerous stretches on my route?"

Datasets/endpoints: Boston Vision Zero crashes (44,986 rows, CKAN), Cambridge crashes (17,230, Socrata), Cambridge bike counts (92,268, Socrata), Bluebikes station pairs (S3 zip — requires a one-time download/parse step), MassGIS college points (ArcGIS REST, no key), MBTA stops as context.

Demo by 8 PM: A Leaflet map. Crash heatmap layer. Bike-count markers sized by volume. College point markers. Bluebikes station markers. A layer toggle.

Market saturation: Boston's Vision Zero site has a crash map. Cambridge has its own crash viewer. Google Maps shows bike routes. Strava has a heatmap. The honest gap is narrow: none of them combine crash density with bike count volume and campus locations in one view, and none are purpose-built for the student commuter. But judges know those products exist, and a bare Leaflet map will look thin next to them.

Failure modes: Crash data is historical (not predictive). High bike count does not mean safe; it may correlate with more infrastructure or more crashes. Bluebikes S3 zip needs client-side parsing, which is doable but adds build risk. This concept requires a map library, more JS, and more moving parts than A or B — risky at seven hours.

---

**Concept D — MA Disaster Readiness Timeline (V2)**

Problem: Local emergency management volunteers and neighborhood preparedness groups have no quick, visual way to understand what types of disasters Massachusetts has declared in the past and how frequently different counties are hit, before designing a preparedness plan.

User and moment: A Somerville neighborhood emergency response team volunteer building a preparedness slide deck for a community meeting, who wants to know what the realistic threat types are for Middlesex County.

Their question: "What disasters have actually hit my county, and how often?"

Datasets/endpoints: OpenFEMA MA declarations API (415 rows, verified 200 today, no key). Optional: EJ block groups for demographic overlay by county.

Demo by 8 PM: A timeline chart and a county-level table. Filter by incident type. Show frequency, most recent event, declaration type (major vs. emergency vs. fire). Clean, readable, no map required.

Market saturation: FEMA's own DisasterDeclarations page exists and is searchable. It is not bad — filtering by state and county works. Honest differentiator: the FEMA site returns a raw table; a pre-filtered, Massachusetts-only, visually readable timeline with "what to prepare for in your county" framing is genuinely more usable for a non-expert volunteer. But 415 rows is a small dataset. The demo risks looking sparse.

Failure modes: 415 rows is not a lot of history depth per county. "Declared disaster" is not a complete picture of local emergencies; smaller events often go undeclared. Cannot say anything about individual household risk or damage. Narrative risk: judges may ask why FEMA's own site is insufficient.

---

**Concept E — College ROI Explorer: Cost vs. Earnings for Massachusetts Students (V5)**

Problem: Massachusetts high school students and community college transfer students trying to decide whether a four-year degree is worth the cost have no clean, side-by-side comparison of net price, debt, and 10-year earnings for in-state institutions.

User and moment: A first-generation student in Roxbury comparing UMass Boston to Northeastern for a business degree, wanting to know whether the extra cost of a private school is justified by earnings outcomes.

Their question: "If I borrow this much, will I earn enough to pay it back?"

Datasets/endpoints: College Scorecard (140 MA institutions, static CSV download), IPEDS (144 institutions, static CSV). Both need a one-time parse; no live API key required once the CSVs are bundled or fetched. O*NET for occupation-to-earnings context (static txt).

Demo by 8 PM: A scatter plot of net price vs. median 10-year earnings, sized by completion rate, colored by sector (public/private/for-profit). Click a school to see a card: cost, debt, earnings, completion. Optionally a "debt-to-earnings ratio" pre-calculated column.

Market saturation: The College Scorecard site itself has a school comparison tool. Peterson's, Niche, and College Raptor all do similar scatter/comparison views. This is a saturated space. Honest differentiator: none that would impress a judge who Googles "college ROI tool" and finds the official scorecard comparison in thirty seconds. The personal-story angle (Sean's policy background) could help framing, but the product itself is not novel.

Failure modes: Suppressed Scorecard cells (small programs suppress earnings and debt) create gaps. Earnings figures are median for a cohort 10 years out — they reflect the economic conditions of a decade ago. Cannot say anything causal about whether a given school caused the earnings outcome.

---

**Concept F — Neighborhood Service Demand Forecaster (V2 + V1)**

Problem: City planners and constituent advocates want to anticipate when and where 311 service demand will spike before a budget cycle, rather than reacting after the fact.

User and moment: A ward city councillor staffer reviewing service trends in advance of a fall budget hearing.

Their question: "Which services are getting slower to close in my ward, and is that trend worsening?"

Datasets/endpoints: Live Boston 311 CKAN SQL (same endpoint as A, with GROUP BY open_date truncated to month and ward). No backend, no key.

Demo by 8 PM: A line chart of monthly case volume per service type per neighborhood, with a second panel showing rolling on-time rate over time. Trend lines.

Market saturation: Same as Concept A — the official 311 tracker does not surface trends. However, this concept is harder to query (requires month truncation; `EXTRACT` is blocked, plain subtraction works but `date_trunc` may or may not be available on CKAN's Postgres). More query uncertainty, more build risk. Less immediately visceral than median close-time by neighborhood.

Failure modes: `date_trunc` availability on CKAN is unverified — the brief confirms `EXTRACT` is blocked. If truncation fails, the monthly grouping falls apart. Historical trend ≠ forecast. Cannot predict future demand.

---

## Comparison table

| | A: 311 Equity | B: Permit Nav | C: Campus Map | D: FEMA Timeline | E: College ROI | F: 311 Trend |
|---|---|---|---|---|---|---|
| **Potential value** (real problem, scalable, equity) | ★★★★★ | ★★★☆☆ | ★★★☆☆ | ★★★☆☆ | ★★★☆☆ | ★★★★☆ |
| **Originality / market gap** | ★★★★★ | ★★☆☆☆ | ★★☆☆☆ | ★★★☆☆ | ★☆☆☆☆ | ★★★★☆ |
| **Feasibility in 7 hrs** (static, no key, few deps) | ★★★★★ | ★★★★☆ | ★★★☆☆ | ★★★★☆ | ★★★☆☆ | ★★★☆☆ |
| **Demo clarity** (one screen, one insight) | ★★★★★ | ★★★☆☆ | ★★★☆☆ | ★★★★☆ | ★★★★☆ | ★★★☆☆ |
| **Sean's personal story** | ★★★★★ | ★★★★★ | ★★☆☆☆ | ★★☆☆☆ | ★★★☆☆ | ★★★★☆ |
| **Overall** | **24/25** | **17/25** | **14/25** | **16/25** | **14/25** | **18/25** |

---

## Recommendation

**Build Concept A: the 311 Response-Time Equity Dashboard.**

30-second judge pitch: "A Boston resident who files a 311 case has no idea whether their neighborhood waits longer than others for the same service. We built a live, no-login dashboard that queries the city's own data in real time, computes median close times and on-time rates by neighborhood, and lets any resident or advocate see the pattern in under ten seconds. The data shows Street Light Outages in some neighborhoods take a median of 13 days versus two in others. We can't say why — but now at least the gap is visible."

Smallest demo that proves it: One service type selector (pre-loaded with "Street Light Outage"), one horizontal bar chart sorted by median close time, neighborhood labels, on-time % tooltip, and a footer note saying "live data via Boston Open Data." That's it. One screen, one finding, two minutes of video.

**Runner-up: Concept F (311 Trend).** It uses the same endpoint and tells a richer story over time. Switch to F if, during build, `date_trunc` is confirmed available on CKAN's Postgres, because a trend line adds temporal depth A lacks. If CKAN blocks it, stay with A — the query for A is already verified working.
