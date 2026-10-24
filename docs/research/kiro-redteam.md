[tool] Reading brief-redteam.md:1
[tool] status: Completed
[tool] Reading 311-verified-facts.md:1, stats-plan.md:1
[tool] status: Completed
I've read everything. Here is the honest attack.

---

## Adversary 1 — Hostile judge, five minutes, laptop open

**Attacks ranked by damage:**

**1. "The city already publishes this." (High damage)**
The judge opens Analyze Boston, finds the 311 service data, and asks: what does this app tell me that I can't get from the city's own dashboard in three clicks? The KM correction is not on the city dashboard — that's our real answer — but KM is not intuitive to a civic judge. You have about fifteen seconds to explain why a censoring correction matters before their eyes glaze over. If you can't land that in one plain sentence during the demo, this attack wins. Honest answer: the official on-time rate counts only closed cases. We count the ones still waiting too. That sentence is survivable. Everything else about this attack is noise if that sentence is crisp.

**2. "This is just a chart." (High damage)**
The app shows a KM curve and a table. It does not let you file a complaint, alert your council member, notify you when your case closes, or trigger any action. A civic product at minimum implies some path from data to behavior change. The stats are rigorous but the product surface is a static audit report. This is the most honest and most damaging critique. Surviving it requires framing the submission explicitly as an accountability audit — a tool a journalist, council staffer, or BRA analyst would use, not a consumer app. That framing must be in the first paragraph of the demo.

**3. "Past news analyses already did this." (Medium-high damage)**
WBUR, the Globe, and Streetsblog have all run 311 wait-time pieces. The judge may have seen one. Our answer is that no published analysis has applied KM to quantify the censoring bias with the current open cases, and no piece has surfaced the 23% non-resolution rate cleanly. But if the demo leads with "wait times are long" instead of "the city's own metric is mathematically wrong," a judge who has read the Globe piece will dismiss it as familiar. The framing has to be: we are auditing the measurement, not reporting the wait times.

**4. "How do we know you didn't cherry-pick the services or neighborhoods?" (Medium damage)**
Every service in the table is present in the data. The 7,840 overdue figure is a live query. But the selection of which six services to show in the headline table invites this attack. Mitigation: show all services by default, not just the highlighted six. Let the judge sort the table herself. "We show everything; the city's data decides the ranking" is a strong answer. If the top panel has a curated list and the table doesn't exist, a judge who tries Sidewalk Repair vs. Tree Pruning and gets different numbers from your callouts will be hostile.

**5. "Why should I believe KM is the right method here?"**
A non-statistician judge will not challenge this. A statistician will (see Adversary 2). For the civic judge, the answer is: the same technique is used in clinical trials to measure survival time when some patients are still alive. We're measuring how long a pothole survives unfixed. That analogy lands.

**On whether "the official metric is biased" is a contribution or a statistics exercise:**

*For it:* The city publishes an on-time rate as an accountability metric. Demonstrating that it systematically undercounts the slowest cases — which are the cases most in need of accountability — is a genuine civic contribution. This isn't critique for its own sake; it's exposing a measurement design that happens to flatter the city's performance.

*Against it:* The audience for a corrected KM median is policy analysts and statisticians, not residents. A resident doesn't know what a KM median is. The civic benefit is one step removed: we tell a journalist or council member, who tells the city, who (maybe) changes the metric. That's a long chain for a hackathon demo.

**Ruling:** The concept survives this attack, but only if the demo centers the non-resolution finding (23% closed as Noted/Transitioned) as hard evidence that requires no statistics at all, and positions KM as the rigorous backup. Lead with the count; follow with the curve. If it's the other way around, a hostile judge shuts the laptop.

---

## Adversary 2 — Working statistician

**Attacks ranked by damage:**

**1. Left truncation / extract start date — this is the one that worries you, and it should. (Potentially critical damage)**

This is the strongest attack and the brief is right to flag it. The dataset appears to cover from roughly mid-2026 onward. Street Light Outage has a mean of 47 days. That means cases opened before the extract window — say, in early 2026 or late 2025 — that closed after the window opens are included in the closed sample, but cases opened before the window that are still open are included in the open sample. Cases opened before the window that closed before it opens are not in the data at all. This is left truncation, and it creates an entry-time bias: your open sample is enriched with long-duration survivors from before the extract, and your closed sample is missing all the fast ones that resolved before the window.

The 122-day cluster in Sidewalk Repair and Pothole is suspicious precisely because of this. If the extract starts on, say, June 1, 2026, then any case opened before that date and still open on the query date has a wait time measured from June 1 at minimum — even if the actual open date is recorded and the measured duration looks correct. Whether that's happening depends entirely on whether `open_date` timestamps predate the extract window and whether those old-open cases are in the data.

The check: query `MIN(open_date)` across all rows. If cases with `open_date` before a clear cutoff appear in the data but there are conspicuously few of them, the extract window is real and the longest-wait tail may be an artifact. The 122-day cluster appearing in three unrelated services simultaneously is consistent with all three hitting a single start-date floor.

If confirmed, the fix is to restrict the analysis to cases with `open_date` within the extract window, which shrinks the long-tail significantly and may substantially change the KM estimates for slow services. This is a "must fix before building" item, because if the 122-day figures are artifacts and a statistician checks, the whole analysis is discredited.

**2. Competing risks — KM is technically wrong here, and you should say so. (Medium-high damage)**

Genuine resolution and administrative closure (Noted, Transitioned) are distinct terminal states. From a survival analysis standpoint, Noted closure is a competing event, not independent censoring. KM handles one event type: it treats everything else as censored. If you call Noted/Transitioned closures censored, you're assuming that those cases would eventually resolve given enough time — a strong and probably false assumption. If you call them events, you're lumping them in with genuine resolution.

The correct tool is a cumulative incidence function (CIF) with two risks: resolution and administrative closure. CIF does not require independent censoring between the two event types. It decomposes the overall failure probability into cause-specific contributions. KM of time-to-event treating both closure types as events overestimates the probability of genuine resolution at any given time.

Can you implement CIF tonight? Yes. CIF from cause-specific hazards requires fitting two separate non-parametric hazard functions (one for resolution, one for administrative closure), neither of which is harder to implement than a single KM. The output is two curves: cumulative incidence of genuine resolution and cumulative incidence of administrative closure, both plotted against time. The visual is more compelling than a single KM curve, and it makes the non-resolution finding structural rather than supplementary.

What you lose with plain KM: you understate the probability of never being genuinely resolved, because KM treats administrative closures as censored and acts as if those cases could eventually resolve. The KM curve for "time to close" is fine — it just doesn't distinguish resolution type. The KM curve for "time to genuine resolution" that treats Noted as censored is biased upward (optimistic). For the headline comparison to the city's naive median, using KM on all closures is defensible. For the "closed but not resolved" finding, CIF is the right tool and is feasible tonight.

**3. Independent censoring assumption — not fully defensible, must be disclosed. (Medium damage)**

KM's validity requires that the event time for censored observations is independent of the censoring mechanism, conditional on the analysis time. Translation: cases that are still open now must be open for reasons unrelated to how long they will eventually take to close. This is violated if the city systematically reclassifies cases to avoid the OVERDUE flag, or if hard cases are triage-deprioritized and accumulate in the open pile. There is no test for this in the dataset.

Honest wording: "Kaplan–Meier assumes cases still open are a random sample of all open cases with respect to eventual close time. If the city is more likely to reclassify or defer difficult cases, the KM estimate is optimistic — the true time-to-close distribution is slower than we report." This does not undermine the headline; a biased KM is still closer to the truth than the naive median, which excludes all open cases entirely. But you have to say it, because a statistician will ask.

**4. Is "7,840 open and overdue" a fair denominator? (Medium damage)**

The 7,840 mixes a Sidewalk Repair case opened 122 days ago with one opened yesterday that has already passed its target. The denominator is not a cohort — it is a cross-sectional prevalence count of a heterogeneous stock. For the headline claim ("X people are waiting past the city's own deadline right now"), that's fine — it's literally what it measures. For any rate-based inference, it's not a denominator at all. The analysis plan doesn't try to use it as a survival analysis denominator — the KM uses all cases, not just this overdue subset — so this attack is limited to the headline framing. Make sure the headline says "7,840 cases are currently past their deadline" and not "7,840 of N cases experienced a delay," because the second form implies a rate you can't compute from this number.

**5. Numbers I would not put my name on without a check:**

- The 122-day figures in Sidewalk Repair, Pothole, and Illegal Graffiti all being the same number is suspicious. Three unrelated services sharing an identical maximum is consistent with a data quality issue or an extract-window artifact. Exact check: `SELECT open_date, case_enquiry_id FROM table WHERE service_name = 'Sidewalk Repair' ORDER BY now() - open_date::timestamp DESC LIMIT 5`. If the oldest cases all cluster around a single open_date, the extract floor is real.
- The 449-day Domestic Animal Issue case. A single case with a 449-day duration in a service with a 5-hour median is almost certainly either a data entry error, a reopened case, or a case that was closed and manually reopened. Check: retrieve that specific case_enquiry_id and read the closure_comments. If it looks like a system artifact, exclude it and say so. If it's a real case, it's a legitimate story — but say it's one case.
- The Cambridge proxy. "Last updated" is not "closed." An active case that received a comment update has a last-updated timestamp that is not its closure time. Cambridge KM estimates are upward-biased (too slow) in an unknowable way. If Cambridge appears in the demo, the proxy warning must be visually unavoidable, not a footnote.

---

## Concrete changes

**Must fix before building:**

1. **Check the extract window.** Query `MIN(open_date)` and `MAX(open_date)`. If any of the three services with 122-day maximums have `open_date` values at or near the minimum date, the extract floor is real. Restrict the KM analysis to cases opened after a safe start date (e.g., 30 days after the minimum, to avoid the left-truncation cliff). Recalculate the headline numbers after restriction. If the 122-day cluster disappears, it was an artifact; update the figures and do not claim them.

2. **Check the 449-day Domestic Animal case.** Retrieve and inspect. If it's a data artifact, drop it from the headline table and note "outlier removed pending data review." Do not present an unverified 449-day wait in the demo.

3. **Implement CIF alongside KM, or at minimum make the competing-risks framing explicit.** If CIF is not feasible tonight, the KM analysis should clearly separate: KM on all closures (time to any closure) vs. KM treating Noted/Transitioned as censored (time to genuine resolution, with the stated optimism bias). The plan already calls for this as a "secondary KM fit" — make it the primary framing of the closure-reason panel, not a secondary one.

4. **Add the independent-censoring caveat.** One sentence in the methodology, visible in the UI, not buried in a README.

5. **Lead the demo with the closure-reason finding, not the KM curve.** "23% of closed cases were not resolved" requires no statistics and survives any hostile question. KM is the supporting evidence, not the headline.

**Fix if time:**

6. Replace plain KM for the "time to genuine resolution" analysis with a proper CIF. The implementation is not much harder than KM and it eliminates the competing-risks attack entirely.

7. Show all services in the main table, sortable, not just the six highlighted ones. Eliminates the cherry-picking attack.

8. Add Wilson intervals to the on-time proportion column. The plan already calls for this — make sure it ships and that cells below n=30 are visually suppressed.

9. Clearly label Cambridge data as "proxy only — last-updated timestamp, not close date" in a way a judge running the demo can't miss.

---

## Verdict

The concept survives. The core finding — that the city's on-time metric is biased by right-censoring, quantifiable with KM, and independently undermined by the non-resolution count — is genuine, defensible, and not published elsewhere in this form. The statistical method is appropriate with the stated caveats.

The execution risk is the extract window / left-truncation issue. If the 122-day cluster is an artifact of when the dataset starts, and you demo those numbers without checking, a statistician or an attentive judge who pulls the raw data will find the discrepancy and it will discredit everything else. That check is thirty seconds of SQL. Do it first, before any code is written.

If the 122-day figures hold up after checking, the app is viable and the plan is sound. If they don't, the honest response is to drop those specific maximum-wait callouts, tighten the analysis window, and let the KM curves and the 23% non-resolution finding carry the story. Those two findings don't depend on the long-tail numbers and both survive hostile scrutiny.

Do not change course on the project. Fix the extract-window question, fix the 449-day outlier, put CIF on the build list, and lead with the count.
