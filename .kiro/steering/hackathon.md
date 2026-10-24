---
inclusion: always
---

# Hackachusetts submission constraints

This project is a Hackachusetts hackathon entry. Every decision has to survive judging,
so treat the rules below as hard constraints, not preferences.

## Hard requirements

- Kiro must be the tool that builds this project. Insufficient use of Kiro is a
  disqualification at the judges' discretion.
- `/.kiro` stays at the repo root and stays out of `.gitignore`. It is the evidence of
  Kiro usage. Never move it, never ignore it.
- The repo must be **public** and must contain all source, assets, and run instructions
  needed to make the project work from a clean clone.
- One challenge track only: Healthcare & Biotech, Robotics & Hardware, ClimaTech &
  Clean Energy, or Civic Services.
- A judge must be able to run or reach the project for free, with no restrictions. If it
  needs a login, the credentials go in the testing instructions.
- Demo video is under 3 minutes and shows the project actually running.
- Original work, owned by the team. Open source is fine when its license is respected
  and we build on top of it rather than reship it.

## Judging criteria to optimize for

1. **Potential value** — a real, clearly defined problem; a scalable, realistic solution;
   accessibility and equity considered; a pitch that shows who benefits.
2. **Implementation** — breadth and depth of Kiro usage (IDE, CLI, Web, Crew; specs,
   hooks, steering, MCP, property-based testing, powers), and a deliberate AI-development
   strategy rather than ad-hoc prompting.
3. **Quality and design** — original concept, intuitive and polished UI, interesting
   public datasets or surprising combinations of technology.

## Working rules for Kiro

- Write a spec under `.kiro/specs/<feature>/` before implementing anything non-trivial,
  and keep requirements, design, and tasks in sync with the code.
- Prefer accessible defaults (keyboard reachable, labelled controls, adequate contrast).
  Accessibility is scored.
- Log notable Kiro usage in `docs/KIRO-USAGE.md` as it happens. The write-up is a graded
  part of the submission and is painful to reconstruct afterwards.
