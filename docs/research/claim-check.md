# Claim check: what Boston documents about 311 timeliness

Checked 2026-10-24. Prompted by a reviewer who found that CityScore lists service-specific
on-time measures but found no source for the README's claim that "Boston's published on-time
rate is computed only over closed cases". **That claim is withdrawn.** This file records what
is and isn't documented so the wording stays defensible.

## What the sources say

| Question | Answer | Source |
| --- | --- | --- |
| Does Boston publish a 311 on-time rate? | Only per service, in CityScore: Pothole, Streetlight, Graffiti, Missed Trash, Signal Repair, Sign Installation, Tree Maintenance, Parks Maintenance, Code Enforcement "ON-TIME %". No citywide 311 rate. | CityScore Full Metric List, Analyze Boston resource `dd657c02-3443-4c00-8b29-56a40cfe7ee4` (queried) |
| How is it calculated? | `metric_logic` is `sum(numerator_value)/sum(denominator_value)/target`. **What goes into the denominator, and whether open cases count, is not documented.** | Same resource (queried) |
| Are those 311 metrics current? | Not in that file. Graffiti, Pothole, Missed Trash and Code Enforcement last carry values on 2026-06-18; Signal Repair and Sign Installation on 2026-09-30; **Streetlight, Tree and Parks Maintenance have no values**. Rows are still written daily with empty numerators. | Same resource (queried: latest row with a non-null denominator per metric) |
| Targets | "80% of potholes … within 1 business day"; "80% of streetlight outages … within 10 business days". | CityScore metric definitions PDF, labelled LEGACY on the portal. Quoted by our research agent; the PDF's text could not be extracted locally, so **not re-verified**. The data's own `target_close_date` is consistent: median target 1 day for Pothole, 14 calendar days for Street Light Outage. |
| Does Boston publish a 311 median closure time? | None found on boston.gov, CityScore, Analyze Boston or BOS:311. | Research agent search |
| What does `on_time` mean? | "Whether the case was closed within the SLA. 'ONTIME' if the case was closed on or before the Target Close Date, 'OVERDUE' otherwise." | [311 data dictionary, new system](https://data.boston.gov/dataset/8048697b-ad64-4bfc-b090-ee00169f2323/resource/6e443a5d-8027-41d5-9574-35e8f84b8284/download/311-service-requests-data-dictionary-new-system.pdf), p. 2 (read) |
| Is `on_time` set for open cases? | **Yes**, despite the dictionary's wording. Cohort: In progress 1,636 ONTIME, 6,240 OVERDUE. For an open case OVERDUE can only mean already past target. | Live query, `data/numbers.json` |
| What do `Noted` and `Transitioned` mean? | "'Transitioned' if the case was reassigned to another agency / 'Noted' if no action is required / 'Resolved' if the case was resolved." | Data dictionary p. 1 (read) |

The data also contains closure reasons the dictionary does not list: `Resolved successfully`
(1,583 in the cohort) and blank (958). We count both with `Resolved`.

## Consequences for our wording

- **Withdrawn:** "the city's on-time rate is computed only over closed cases", "the city's
  method", "city-style median", "the city's published figure for this service".
- **Use instead:** "median among closed cases" versus "estimate including open cases".
- **Withdrawn:** "23.9% of closed cases were never resolved". **Use:** "23.9% were closed as
  Noted (no action required) or Transitioned (reassigned to another agency) rather than
  Resolved". A transitioned case may have been handled by the other agency.
- **New, sourced:** the per-service CityScore on-time measures for potholes and streetlights
  currently show no values in the published metric list, so Wait Audit gives a resident a
  number where that file has none. Say "in CityScore's published metric list", not "the city
  stopped measuring" — the dashboard may draw on another source.
- **New, needs no inference:** 6,240 open cases are already marked OVERDUE by the city's own
  field.

`scripts/refresh_numbers.py` lints the live docs for the withdrawn phrases and fails if any
come back.
