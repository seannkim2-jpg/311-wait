# Getting Kiro running on this repo

Everyone on the team needs Kiro installed, since the rules require the project to be
built with it. 15 minutes, once.

## 1. Install the IDE

Download the macOS / Windows / Linux build from <https://kiro.dev/downloads/> and run the
installer. On macOS, `brew install --cask kiro` also works. Sign in on first launch
(Google, GitHub, AWS Builder ID, or AWS IAM Identity Center); you can import your VS Code
settings and extensions or skip that step.

## 2. Install the CLI

```bash
curl -fsSL https://cli.kiro.dev/install | bash   # installs to ~/.local/bin/kiro-cli
kiro-cli login
kiro-cli doctor                                   # verifies the install
```

## 3. Open this repo

```bash
git clone https://github.com/seannkim2-jpg/kiro-hackachusetts.git
cd kiro-hackachusetts
kiro .            # IDE, or:
kiro-cli chat     # CLI in the repo root
```

Kiro picks up `.kiro/` from the workspace root automatically — the steering docs apply to
every session with no extra setup.

## What lives where

| Path | What it is |
| --- | --- |
| `.kiro/steering/` | Always-on context and project rules |
| `.kiro/specs/<feature>/` | `requirements.md`, `design.md`, `tasks.md` per feature |
| `.kiro/hooks/*.json` | Event-triggered automations |
| `.kiro/settings/mcp.json` | MCP servers for this workspace |
| `.kiro/agents/`, `.kiro/skills/` | Custom agents and skills (optional) |

## Everyday use

- **Spec first:** in the IDE, open the Kiro panel, switch to Spec mode, and describe the
  feature. Kiro writes `requirements.md` → `design.md` → `tasks.md` under
  `.kiro/specs/<feature>/`, then executes the tasks. Review each file before approving;
  that review is where the spec-driven advantage comes from.
- **Steering:** add a file to `.kiro/steering/` for anything you find yourself repeating.
  Front matter controls when it loads — `inclusion: always` (default),
  `inclusion: fileMatch` with `fileMatchPattern: "src/**/*.tsx"`, or `inclusion: manual`
  (referenced with `#file-name` in chat).
- **Hooks:** drop a JSON file in `.kiro/hooks/`, e.g.

  ```json
  {
    "version": "v1",
    "hooks": [{
      "name": "Test on save",
      "trigger": "PostFileSave",
      "matcher": "\\.(ts|tsx)$",
      "action": { "type": "command", "command": "npm test -- --run" }
    }]
  }
  ```

- **MCP:** `kiro-cli mcp` manages servers, or edit `.kiro/settings/mcp.json` directly.
- **Powers:** `kiro-cli powers` lists and installs bundled expertise packs.
- **Crew:** `kiro-cli crew` runs several agents in parallel on separate tasks.

Docs: <https://kiro.dev/docs/>
