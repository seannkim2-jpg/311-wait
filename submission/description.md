# Project description — paste into the form

311 Wait helps residents understand how long a 311 request may take. A median calculated only from closed requests leaves out the people still waiting, who often have the longest waits. The site includes those open requests in a Kaplan–Meier wait estimate and separates closures marked Resolved from those marked Noted or Transitioned with a competing-risks analysis.

Visitors can choose a service, compare the closed-case median with the estimate that includes open cases, inspect a closure chart and a neighborhood map, and read the sample sizes and limits behind each result. A Boston case lookup shows its current public status and a historical 14-day closure chance for similar cases; it can draft a factual summary to send to a councilor. An “Already waiting?” calculator shows the historical chance of closure in the next seven days. A separate Cambridge view uses Cambridge's own request data without pooling it with Boston's.

The app runs in a browser and queries public city data directly. It needs no login, API key, or backend. Its numbers describe historical cases, not a promise about any individual request. For example, in the documented Boston cohort opened since July 1, 2026, the closed-only median for Street Light Outage was 4.7 days while the estimate including open cases was 14.5 days. For Sidewalk Repair, too few cases had closed to estimate a median. The site shows where the data cannot support a stronger claim.

**Track:** Civic Action. **Live site:** https://311-wait.vercel.app/. **Source:** https://github.com/seannkim2-jpg/311-wait.
