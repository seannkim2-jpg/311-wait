Good corrections — let me tighten everything up.

---

## Revised concept evaluation

### What the live data actually gives us

From the real Red Line alert you tested:

> "Red Line Braintree Branch: Signal maintenance near Quincy Adams will take place Saturday, October 24, through Sunday, October 25, to improve reliability. Riders may experience longer than usual wait times during this work."
> Affected stops: North Quincy, Wollaston, Quincy Center, Quincy Adams, Braintree
> Active period: now (Oct 24). One additional alert: UPCOMING, starts November — not currently active.

Facts the API gives: affected route, affected stops, effect type, header text, active period start/end. Facts the API does not give: minutes of delay, whether trains are running at all, elevator/escalator operational status confirmed independently. "No active alerts" means no alerts were filed — it does not mean service is normal.

---

## Three concepts, corrected

### Concept A — Narrow alert explainer
User types "Is the Red Line running?" → app fetches `/alerts?filter[route]=Red`, filters to `active_period` that brackets now, surfaces the header text in plain language.

**Honest sample answer grounded only in the supplied alert:**
> "There is an active service advisory on the Red Line Braintree Branch today. Signal maintenance near Quincy Adams is scheduled through Sunday October 25. Riders to/from North Quincy, Wollaston, Quincy Center, Quincy Adams, and Braintree may experience longer than usual waits. No numeric delay estimate is available. Alerts for other branches: none currently active."

**What it cannot say:** how long the wait will be, whether trains are running at all (no predictions call), whether this alert is the only factor affecting service.

**Differentiator claim:** The MBTA app surfaces alerts, but requires the user to navigate to the correct route page and read raw agency text. This app accepts a plain-language question. That differentiator is real but modest — the raw alert text is already readable English in this case.

**Minimum API calls:** 1 (`/alerts?filter[route]=<route>`). No LLM required if you use template-based formatting. An LLM (whatever model the team has access to — not assumed to be OpenAI) adds paraphrase quality but isn't load-bearing.

**Demo risk:** Low. One API call, known response shape, filter on `active_period`. The demo is reliable.

**Weakness:** The raw alert in this example is already clear English. The value-add of "translation" is hard to show when the source text isn't jargon-heavy. The differentiator argument is weakest here.

---

### Concept B — Accessibility status card
User asks "Are the elevators working at Quincy Adams?" → app fetches `/alerts?filter[stop]=<stop_id>`, filters for `effect: ELEVATOR_CLOSURE` or `ESCALATOR_CLOSURE`, shows a status card.

**Honest sample answer:**
> "No elevator or escalator closure alerts are currently filed for Quincy Adams. This reflects only alerts the MBTA has published — it does not confirm equipment is operational."

**What it cannot say:** whether equipment is actually working (only absence of a filed alert). Must carry that disclaimer prominently — which hurts the demo's crispness.

**Differentiator claim:** Accessibility alerts are buried in the general alert feed. Surfacing them by station, with a clear card format and an honest disclaimer, serves a user group the main app navigation disadvantages. This is a real, specific user need.

**Minimum API calls:** 2 (`/stops?filter[route]=Red` to resolve stop name → ID, then `/alerts?filter[stop]=<stop_id>`). Stop name matching is the key engineering risk — fuzzy string matching against 22 stop names is manageable.

**Demo risk:** Medium. The stop-ID resolution join is the fragile step. If the alert structure for elevator closures uses facility stop IDs (child stops) rather than parent station IDs, the filter may return nothing even when a closure exists. This needs a test call before committing.

**Weakness:** The honest disclaimer ("absence of alert ≠ working") undermines the card's apparent utility in the demo. A judge may reasonably ask "so what does it actually tell me?"

---

### Concept C — Station-based disruption decision card
User enters a station name or picks from a list → app shows a single card: what is currently disrupted at or near that station, which affected stops are on this alert, and whether this station is one of them — a yes/no relevance answer.

**Honest sample answer for someone asking about Quincy Adams:**
> "Active advisory affects your station today. Red Line Braintree Branch signal maintenance is scheduled through Sunday October 25 near Quincy Adams. Your station (Quincy Adams) is listed as directly affected. No elevator or escalator alerts are filed for this station. Source: MBTA Alerts API, checked [timestamp]."

**What it cannot say:** predictions, delay minutes, whether the disruption is resolved early.

**Differentiator claim:** This is the strongest differentiator of the three. The MBTA alert page is route-scoped, not station-scoped. A rider's question is "does this affect *me, at my stop*?" not "what's happening on the Red Line generally." Mapping the alert's `informed_entity` list down to "yes, your station is specifically named" or "no, this is on a branch you don't use" is a filtering step the official tools don't do for the user. The accessibility check is addable as a second row on the same card.

**Minimum API calls:** 2 (`/stops?filter[route]=Red` for stop ID, `/alerts?filter[stop]=<stop_id>` for both service and elevator alerts in one call). Alternatively, `/alerts?filter[route]=Red` (1 call) and then client-side filter on `informed_entity.stop` — avoids the stop-ID join entirely for the service alert portion, adds the elevator filter as a second call only if the feature is included.

**Demo risk:** Low-to-medium. Route-filtered alerts plus client-side stop matching is robust. The main risk is that the November upcoming alert appears and needs to be correctly excluded by active-period check — which the user's fact-check already identified as the right filter to apply.

---

## Comparison table (corrected)

| | **A — Alert explainer** | **B — Accessibility card** | **C — Disruption decision card** |
|---|---|---|---|
| **Core question answered** | Is my route running? | Are the elevators working? | Does this disruption affect my station? |
| **Differentiator vs. MBTA tools** | Weak — alert text is already readable | Moderate — surfaces buried accessibility alerts | Strongest — station-scoped rather than route-scoped |
| **Honest disclaimer burden** | Low | High ("no alert ≠ working") | Low |
| **Minimum API calls** | 1 | 2 (with fragile stop-ID join risk) | 1–2 (route filter + client-side stop match) |
| **Demo reliability today** | Highest | Medium-low | High |
| **LLM dependency** | Optional | Not needed | Not needed |
| **Personal story fit** | Moderate | Good (equity angle) | Best — station-level data legibility = civic data usability thesis |
| **NLU required** | Light (route name) | None if station picked from list | None if station picked from list |
| **Key remaining risk** | Weak differentiator | Elevator facility stop IDs may not match | Active-period filter must exclude the November alert |

---

## Corrected recommendation: Concept C — Station disruption decision card

**Rationale:** It answers the question a rider actually has ("does this affect me?") rather than the question the data was filed under ("what's happening on this route?"). It requires no LLM, no API key beyond the public MBTA keyless tier, and the demo is reliable given the real alert structure you've already tested. The disclaimer burden is low because "your station is named in this alert" is a factual, verifiable statement. The accessibility row is an honest additive: show elevator alerts if present, show "none filed" with the caveat if absent — it doesn't dominate the card.

The personal story is authentic: someone who studied commuting disparities by race and income, and processed municipal data at City of Boston, has a clear motivation for making station-level civic information more legible — especially for riders who can't quickly parse a route-wide alert page to determine whether their specific stop is affected.

**Free demo:** Deployable as a static React app on Vercel or GitHub Pages with no server, calling the MBTA API directly from the browser. No API key required for keyless tier. Judges can use it without any credentials.

---

## Three decision questions for Sean

**[1] Station selection UI:** How should the user specify their station?
- a. **Free-text input** — type "Quincy Adams," app resolves to stop ID via `/stops` name match. More natural, but fuzzy matching is an engineering risk in a few hours.
- b. **Dropdown / searchable list** — pre-load the 22 Red Line stops (or all 8 routes' stops) on app start, user picks from list. Zero resolution ambiguity, simpler to build, slightly less "conversational."
- c. **Other** — your own approach.

**[2] Scope of routes covered:** Which routes should the demo support at launch?
- a. **Red Line only** — matches the tested alert, keeps scope tight, demo is reliable, you can say "Red Line focus" in the pitch.
- b. **All 8 subway/light rail routes** — broader civic value, but requires testing alert structure and stop IDs across all routes before 8 PM.
- c. **Other** — e.g., Red + Orange as the two you test.

**[3] Accessibility row on the card:** Should the station card include an elevator/escalator alert section?
- a. **Yes, with explicit caveat** — "No elevator alerts filed (absence does not confirm equipment is working)." Adds equity dimension to the pitch but adds the stop-ID-to-facility-ID risk.
- b. **No — keep card to service disruption only** — cleaner demo, fewer API dependencies, add accessibility as a stretch goal if time allows.
- c. **Other** — e.g., include it only if you can verify the elevator alert stop-ID structure works in a test call first.
