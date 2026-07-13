#!/usr/bin/env bash
set -euo pipefail

root="$(git rev-parse --show-toplevel)"
cd "$root"

required=(
  CONTEXT.md
  STATUS.md
  ACTIVE-SPRINT.md
  STRATEGY.md
  ARCHITECTURE.md
  PHASE-HISTORY.md
  AGENTS.md
  CLAUDE.md
  .env.example
)

missing=0
for file in "${required[@]}"; do
  if [[ ! -f "$file" ]]; then
    printf 'missing required context file: %s\n' "$file" >&2
    missing=1
  fi
done

if [[ "$missing" -ne 0 ]]; then
  exit 1
fi

git fetch --prune origin

printf 'repository: %s\n' "$root"
printf 'branch: %s\n' "$(git branch --show-current)"
printf 'head: %s\n' "$(git rev-parse --short HEAD)"
git status --short --branch

upstream="$(git rev-parse --abbrev-ref --symbolic-full-name '@{upstream}' 2>/dev/null || true)"
if [[ -n "$upstream" ]]; then
  read -r ahead behind < <(git rev-list --left-right --count "HEAD...$upstream")
  printf 'upstream: %s (ahead %s, behind %s)\n' "$upstream" "$ahead" "$behind"
else
  printf 'upstream: none\n'
fi

if command -v gh >/dev/null 2>&1 && gh auth status --hostname github.com >/dev/null 2>&1; then
  printf '\nopen pull requests:\n'
  gh pr list --state open --limit 20
  printf '\nopen GitHub issues:\n'
  gh issue list --state open --limit 20
else
  printf '\nGitHub CLI is unavailable or not authenticated; skipped PR and issue checks.\n'
fi
