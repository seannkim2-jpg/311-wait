# Hackachusetts entry

> **Track:** Civic Action
>
> **Project:** Wait Audit

## What it does

When you file a 311 request in Boston, how long will you wait? Taking the median of closed
cases gives a quick answer, but it leaves out the 7,876 requests still open, and those are
disproportionately the slow ones.

Wait Audit puts them back in. It queries Boston's live open-data endpoint from the browser with
no API key and no backend, then applies survival analysis: Kaplan–Meier for time-to-closure
with open cases included, and Aalen–Johansen competing-risks incidence to separate cases closed
as resolved from cases closed as `Noted` ("no action is required") or `Transitioned`
("reassigned to another agency"), in the city data dictionary's words.

The gap is large and specific. For street light outages the median among closed cases is
4.7 days; the estimate including open cases is **14.5 days**, right at the city's 14-day
target. Sidewalk repairs have a one-day target, yet 70% are still open, so **no median exists
at all**: fewer than half have ever closed. Across the cohort, 6,624 open cases are already past
their target date, and **23.9%** of closed cases were closed as `Noted` or `Transitioned` rather
than `Resolved`.

It makes no causal claim about why. It audits the measurement, shows its sample sizes,
censoring counts and confidence intervals, and says where the data cannot answer.

- [`docs/ANALYSIS.md`](docs/ANALYSIS.md) — method, results, limitations
- [`docs/research/NUMBERS.md`](docs/research/NUMBERS.md) / [`data/numbers.json`](data/numbers.json) — every current figure, generated
- [`docs/research/claim-check.md`](docs/research/claim-check.md) — what the city does and doesn't document
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
python3 -m pip install lifelines
python3 scripts/refresh_numbers.py                 # re-pull every figure, self-check, lint the docs' claims
npm install && npm test                            # 18 tests, incl. 12 fast-check properties
./scripts/fetch_cohort_cases.sh                    # rebuild fixtures from live data, no key
python3 scripts/validate_against_lifelines.py      # third opinion vs the standard library
```

## Checking this repository with Kiro CLI

Run from this checkout after signing in with `kiro-cli login`:

```bash
./scripts/check-with-kiro.sh
```

The script checks this checkout against the linked GitHub repository's `main` branch. It
fetches `origin/main`, runs the npm test, lint, and build scripts, and asks Kiro CLI to review
repository files and local changes. It does not commit or push. If you later want to check
another Git checkout too, pass both paths: `./scripts/check-with-kiro.sh . /path/to/repo`.

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

[OpenAI Codex](https://openai.com/codex/) contributed repository review and build, lint,
and clean-checkout test fixes ([PR #5](https://github.com/seannkim2-jpg/kiro-hackachusetts/pull/5),
[PR #6](https://github.com/seannkim2-jpg/kiro-hackachusetts/pull/6)).

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
