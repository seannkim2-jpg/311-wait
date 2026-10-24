# Hackachusetts submission: 311 Wait

Copy-ready text for each field of the submission form. Items marked **TODO** need a person.

| Field | Value |
| --- | --- |
| Project name | 311 Wait |
| Challenge track | **Civic Action** (listed as "Civic Services" on the prize page) |
| Live demo | <https://311-wait.vercel.app/>, free with no login, account or API key |
| Source code | <https://github.com/seannkim2-jpg/311-wait> (public, `/.kiro` at the root) |
| Kiro write-up | [`docs/KIRO-USAGE.md`](KIRO-USAGE.md) |
| Demo video | **TODO**: public YouTube/Vimeo link, under 3:00 |
| Team members | **TODO**: add on the hackathon site (max 4); one person is the Representative |

## Tagline

How long does a Boston 311 request really take? These estimates include the cases that are still open.

## Text description

**The problem.** When a Boston resident reports a broken street light, a pothole or a cracked
sidewalk through 311, they have no honest way to know how long they will wait. The usual answer
is the median time among cases that have *closed*. That leaves out every request still open, and
those are the slow ones. The quick answer understates the wait, sometimes by a lot.

**What 311 Wait does.** It queries the city's live open-data endpoints directly from the browser,
with no backend, API key or account. It then applies survival analysis, the standard statistics
for "time until something happens" when some cases haven't finished yet:

- **Kaplan–Meier time-to-closure, with open cases put back in.** For street light outages the
  median among closed cases is 4.7 days. Counting open cases gives **14.5 days**, right at the
  city's 14-day target. Sidewalk repairs have a one-day target, yet 70% are still open, so
  **no median exists at all**.
- **Competing risks (Aalen–Johansen).** These separate cases closed as *Resolved* from those
  closed as *Noted* ("no action is required") or *Transitioned* ("reassigned to another agency"),
  using the city's own definitions. That is 23.9% of closed cases.
- **"Where does my case stand?"** You type your case number (BCS- and 8 digits). The page fetches
  that one case and shows how long it has been open and whether it is past target. It gives the
  historical chance that similar cases at the same age closed in the next 14 days, and a short,
  neutral summary you can copy to a city councilor, with a link to find yours. Nothing is stored.
- **"Already waiting?"** For any service and any wait so far, the page shows how much longer
  similar cases historically took, read off the same curve.
- **A live map of where people are waiting.** It shows open requests and the share already past
  the city's own deadline, by neighborhood, on a self-hosted basemap.
- **Cambridge, same check.** The same analysis runs on Cambridge's Commonwealth Connect data.
  It is labelled and never pooled with Boston's.

**Honesty built in.** Every figure shows its sample size, how many cases are still open, and
a confidence interval. Small groups are suppressed rather than ranked. The page makes no causal
claims and gives no promise about any one case. Where the data can't answer, it says so: an
offline neighborhood forecast missed its own release threshold, so it stays off the page.

**Who benefits and how it scales.** Residents get a realistic expectation and a ready-made way to
follow up. Councilors, reporters and city staff get a measurement that doesn't hide the backlog.
Many US cities publish 311 data through the same open-data platforms (CKAN, Socrata). The
estimators are city-agnostic, and Cambridge shows that adding a city means writing one adapter.
The site is static, works on a phone, is keyboard accessible and checked with axe-core, and costs
nothing to run.

**How it was built.** Kiro built it with spec-driven development: three specs, three steering
files, three agent hooks, twelve pinned agent skills and the Playwright power/MCP. There are 164
tests, including fast-check property tests. The statistics were implemented three times
independently (Kiro's TypeScript, a separate Python reference, and the `lifelines` library), and
the three agree to six decimal places. See `docs/KIRO-USAGE.md`.

## Testing instructions

1. Open <https://311-wait.vercel.app/>. No login is needed. The page queries live city data, so
   figures can differ slightly from the October 24, 2026 snapshot in the README.
2. Pick a service in the hero (e.g. **Sidewalk Repair**) and compare "closed cases only" with
   "counting open cases".
3. In **Where does my case stand?**, try:
   - `BCS-00327633`: open past target, with the historical 14-day chance and summary
   - `BCS-00253943`: closed as Transitioned
   - `BCS-0025394X`: malformed, so it is rejected before any request is sent
4. In **Already waiting?**, choose a wait (e.g. 14 days).
5. Switch **Boston → Cambridge** in the header.
6. Run it locally: `git clone https://github.com/seannkim2-jpg/311-wait.git && cd 311-wait && npm ci && npm test && npm run build && npm run preview`

## Demo video plan (under 3:00)

Record the live site in a browser. Use your own voice or no audio: no copyrighted music and no
third-party logos beyond the page itself.

| Time | Show | Say (roughly) |
| --- | --- | --- |
| 0:00–0:20 | Hero, Street Light Outage | "You file a 311 request in Boston. How long will you wait? The usual answer only counts cases that closed: 4.7 days. Put the open ones back in and it's 14.5." |
| 0:20–0:40 | Click Sidewalk Repair | "Sidewalk repairs have a one-day target. 70% are still open, so there is no median at all." |
| 0:40–1:05 | Scroll to "What happens to a report" | "Closed doesn't always mean fixed. About a quarter of closed cases were Noted or Transitioned, in the city's own words." |
| 1:05–1:40 | Case lookup: `BCS-00327633`, then Copy summary | "Type your case number. It's 19 days past target. Historically, 14 in 100 similar cases closed in the next two weeks. Here's a neutral summary to send your councilor." |
| 1:40–1:55 | Already waiting?: 14 days | "Already waiting? The page shows what happened to cases like yours." |
| 1:55–2:10 | Map, then Cambridge toggle | "Where people are waiting right now, and the same check on Cambridge's data." |
| 2:10–2:50 | GitHub: `.kiro/specs`, `steering`, `hooks`, then `npm test` passing | "Built with Kiro: specs before code, steering that holds the verified facts, hooks that lint every claim. 164 tests, and three independent implementations that agree to six decimals." |
| 2:50–3:00 | Live URL on screen | "311-wait.vercel.app. Free, no login." |
