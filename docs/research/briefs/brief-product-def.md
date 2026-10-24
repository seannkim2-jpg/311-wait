# Kiro task: define exactly what we are building

Think hard. This is the decision that everything else depends on, and we build immediately
after it. Read these first, they are all verified:
- `.context/311-verified-facts.md` — live facts I confirmed myself today. Trust these over
  any assumption.
- `.context/stats-plan.md` — the statistical design already agreed.
- `.kiro/steering/hackathon.md` — the hard rules and judging criteria.
- `.context/civic-portal-inventory.md` — the 22 Civic Action datasets.

## Where the decision already landed
Hackachusetts 2026, Civic Action track, submission 8:00 PM Eastern tonight. It is roughly
1:00 PM, so about seven hours remain including deploy, a video under three minutes, and the
Kiro write-up.

The concept: a statistically honest audit of Boston 311 service-request wait times, whose
central finding is that the city's published on-time rate and closed-case median are biased
downward by right-censoring, because 7,840 cases are still open and the open ones are
disproportionately slow. Kaplan–Meier corrects it. A second, inference-free layer: about 23%
of "closed" cases were closed as `Noted` or `Transitioned` rather than resolved, and the
on-time rate counts them.

Constraints already settled: static browser-only app, no backend, no API key, React + Vite +
Tailwind + Recharts already scaffolded, deployed free. Boston is the rigorous core; Cambridge
is an optional second municipality whose closure time must be proxied by last-updated.

## What I need from you — be concrete, not strategic
I do not want more concept comparison. I want the artifact specified so precisely that a
developer could build it without asking a question.

1. **Name.** Three candidates, each with the one-sentence description that would sit under it
   on the page. Pick one and say why. Avoid "dashboard" if something truer exists.
2. **The one-sentence product definition.** What it is, for whom, and what it shows.
3. **Screen inventory.** How many screens or panels, and exactly what is on each. If it is
   one screen, say what is above the fold and what is below.
4. **The exact numbers on screen.** For every figure and stat tile, name the statistic, the
   query that produces it, and the literal label text. Use real values from the verified
   facts file where you can, and mark anything that must be recomputed at build time.
5. **The default state.** What a judge sees in the first three seconds before touching
   anything. Which service type is preselected and why that one.
6. **Interactions.** Every control, what it changes, and what happens while data loads.
   Loading and empty states included.
7. **The honesty furniture.** Where `n`, the censored count, the suppression rule, the
   confounder note and the query timestamp physically live on the page. These are graded
   under accessibility and equity considerations, so place them deliberately, not in a
   footnote nobody reads.
8. **Video beats.** A shot list for under three minutes, with the single number that is the
   emotional peak and when it lands.
9. **Build order with time boxes** against a 1:00 PM start and an 8:00 PM deadline, and an
   explicit cut list in the order things get dropped.
10. **The spec skeleton.** The requirement headings you would put in
    `.kiro/specs/<name>/requirements.md`, as testable statements.

## Discipline
No causal claims. The income-gradient story is specifically disproven in the verified facts
file — do not reintroduce it. Distinguish "closed" from "resolved" in every sentence. Prefer
one small complete thing. Do not write application code in this reply; specify it.
