# Hackachusetts entry

> **Track:** Civic Action
>
> **Project:** Wait Audit

## What it does

Boston publishes an on-time rate for 311 service requests, but it is computed only over
**closed** cases — so the 7,876 requests still sitting open, which are disproportionately the
slow ones, are left out of the city's own measure of its performance.

Wait Audit puts them back in. It queries Boston's live open-data endpoint from the browser with
no API key and no backend, then applies survival analysis: Kaplan–Meier for time-to-closure
with censored cases included, and Aalen–Johansen competing-risks incidence to separate requests
that were genuinely resolved from those merely closed.

The gap is large and specific. Street light outages show a 4.7-day median by the city's method
and **14.7 days** once open cases are counted. Sidewalk repairs have **no median at all**,
because 70% have never closed — only 17.7% were actually resolved. Across the cohort, **23.9%**
of "closed" cases were filed as `Noted` or `Transitioned` rather than fixed.

It makes no causal claim about why. It audits the measurement, shows its sample sizes,
censoring counts and confidence intervals, and says where the data cannot answer.

- [`docs/ANALYSIS.md`](docs/ANALYSIS.md) — method, results, limitations
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — status and what to build on
- [`docs/UI-DESIGN.md`](docs/UI-DESIGN.md) — interface brief
- [`docs/PLAN.md`](docs/PLAN.md) — schedule and agent boundaries
- [`docs/research/`](docs/research/) — how the concept was chosen, checked, and corrected

## Working on this in Kiro

```bash
git clone https://github.com/seannkim2-jpg/kiro-hackachusetts.git
cd kiro-hackachusetts && npm install
kiro .            # IDE, or:
kiro-cli chat     # CLI from the repo root
```

Kiro picks up `.kiro/steering/` automatically. Two files load in every session:
`hackathon.md` carries the rules and judging criteria, and `data-facts.md` carries the
verified figures and the claims the data cannot support. Start from
[`.kiro/specs/service-wait-audit/tasks.md`](.kiro/specs/service-wait-audit/tasks.md).

## Verifying the statistics

The estimators were implemented three times independently and agree to six decimal places.

```bash
npm install && npm test                            # 17 tests, incl. 12 fast-check properties
./scripts/fetch_cohort_cases.sh                    # rebuild fixtures from live data, no key
python3 -m pip install lifelines
python3 scripts/validate_against_lifelines.py      # third opinion vs the standard library
```

## Running it

No account, API key or backend. The page queries Boston's open-data API from the browser, and
the map's basemap, boundaries and fonts are committed as static files in `public/map/`.

```bash
git clone https://github.com/seannkim2-jpg/kiro-hackachusetts.git
cd kiro-hackachusetts
npm install
npm run build && npm run preview   # production build at http://localhost:4173
# or: npm run dev                  # development server
```

`./scripts/build_map_assets.sh` rebuilds `public/map/` from the city's boundary file and a
Protomaps build of OpenStreetMap (it needs the free `pmtiles` CLI).

## Built with Kiro

This project is built with [Kiro](https://kiro.dev). Team setup instructions are in
[`docs/kiro-setup.md`](docs/kiro-setup.md); the submission write-up on how Kiro was used
is in [`docs/KIRO-USAGE.md`](docs/KIRO-USAGE.md).

`/.kiro` at the repo root is required evidence for judging and must never be added to
`.gitignore`.

## Submission checklist

- [ ] Repo is **public**
- [ ] `/.kiro` committed at the root, with real specs, steering, and hooks in it
- [ ] Challenge track identified above
- [ ] Text description of features and functionality
- [ ] Demo video under 3 minutes, public on YouTube/Vimeo/Facebook/Youku, no third-party
      trademarks or copyrighted music
- [ ] Live demo, test build, or hosted URL a judge can reach free of charge
- [ ] Testing instructions, including credentials if anything is gated
- [ ] `docs/KIRO-USAGE.md` write-up complete
- [ ] All team members added on the hackathon site (max 4)
