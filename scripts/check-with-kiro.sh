#!/usr/bin/env bash
set -uo pipefail

if ! command -v kiro-cli >/dev/null; then
  echo "kiro-cli is required; run kiro-cli login first" >&2
  exit 1
fi

if (($# == 0)); then
  set -- .
fi

overall=0
for path in "$@"; do
  if ! root=$(git -C "$path" rev-parse --show-toplevel); then
    overall=1
    continue
  fi

  echo "Checking $root"
  (
    cd "$root" || exit 1
    failed=()

    if ! git fetch --quiet origin main; then
      echo "Could not fetch origin/main from GitHub" >&2
      exit 1
    fi
    if ! git rev-parse --verify --quiet refs/remotes/origin/main >/dev/null; then
      echo "origin/main is unavailable after fetching" >&2
      exit 1
    fi
    for diff in origin/main...HEAD --cached; do
      if ! git diff --check "$diff"; then
        failed+=("git diff --check $diff")
      fi
    done
    if ! git diff --check; then
      failed+=("git diff --check (working tree)")
    fi

    if [[ -f package.json ]]; then
      if ! command -v node >/dev/null || ! command -v npm >/dev/null; then
        echo "node and npm are required for package.json checks" >&2
        exit 1
      fi
      for task in test lint build; do
        if node -e 'process.exit(require("./package.json").scripts?.[process.argv[1]] ? 0 : 1)' "$task"; then
          if ! npm run "$task"; then
            failed+=("npm run $task")
          fi
        fi
      done
    fi

    {
      printf 'Review this Git repository using Kiro credits. Read repository files relevant to correctness, performance, and the current changes. Include callers, tests, and config. Do not edit files or run commands. Report only concrete findings with file:line and impact; if none, say so. GitHub base is origin/main.\n\n'
      printf 'Repository files (including untracked files, excluding ignored files):\n'
      git ls-files --cached --others --exclude-standard
      printf '\nChanges from GitHub main and local worktree:\n'
      git diff --name-only origin/main...HEAD
      git status --short
      printf '\nFailed deterministic checks: '
      if ((${#failed[@]})); then
        printf '%s; ' "${failed[@]}"
      else
        printf 'none'
      fi
      printf '\n'
    } | kiro-cli chat --v3 --no-interactive --trust-tools=read_file,grep_search
    kiro_status=$?
    if ((kiro_status != 0 || ${#failed[@]} != 0)); then
      exit 1
    fi
  ) || overall=1
done

exit "$overall"
