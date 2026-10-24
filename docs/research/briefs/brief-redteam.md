# Kiro task: red-team this submission

Think hard and be hostile. Read `.context/311-verified-facts.md`, `.context/stats-plan.md`,
and `.kiro/steering/hackathon.md`.

We are submitting to Hackachusetts 2026 Civic Action tonight at 8:00 PM: a static browser app
that audits Boston 311 wait times, arguing that the city's published on-time rate and
closed-case median are biased downward by right-censoring (7,840 cases still open), correcting
it with Kaplan–Meier, and separately showing that ~23% of "closed" cases were closed as
`Noted` or `Transitioned` rather than resolved.

Play two adversaries in turn. Do not be kind. Our own fact-check already killed one
fabricated claim today, so assume more are hiding.

## Adversary 1 — a hostile judge with a laptop
They have five minutes, the live data, and no patience.
- What is the single question that most damages us, and what is our honest answer?
- Where would they say "the city already publishes this" or "this is just a chart"?
- What will they say about market saturation, given Analyze Boston and past news analyses?
- Is "the official metric is biased" a strong enough contribution, or does it read as a
  statistics exercise rather than a civic product? Argue both sides, then rule.
- What would make them suspect the numbers were cherry-picked?

## Adversary 2 — a statistician who does this for a living
- Is Kaplan–Meier actually appropriate here, or is this better framed as competing risks,
  since administrative closure (`Noted`/`Transitioned`) and genuine resolution are distinct
  terminal states? If competing risks is more correct, say so plainly and say what we lose by
  using plain KM — and whether a cumulative incidence function is feasible tonight.
- The independent-censoring assumption: is it defensible when the city may triage hard cases
  differently? What is the honest wording for the limitation, and does it undermine the
  headline?
- Is "7,840 open and overdue" a fair denominator, or does it mix cohorts of very different
  ages? Should the analysis restrict to a fixed open-date window?
- Left truncation: the resource appears to cover roughly mid-2026 onward. Does that distort
  long-duration services like Street Light Outage, whose mean is 47 days? Could the 122-day
  cluster in the longest-wait column be an artifact of the extract's start date rather than a
  real pattern? This one worries me — check the reasoning carefully.
- Which of our stated numbers would you refuse to put your name on without a further check,
  and what is the exact check?

## Output
For each adversary, the attacks ranked by how much damage they do. Then a single list of
concrete changes to the plan, separated into "must fix before building" and "fix if time."
Then state whether the concept survives, and if you would change course, what to instead.
