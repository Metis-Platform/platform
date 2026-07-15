#!/usr/bin/env bash
set -euo pipefail

root="$(git rev-parse --show-toplevel)"
cd "$root"

required_commands=(git node npm)
missing=0
for command in "${required_commands[@]}"; do
  if ! command -v "$command" >/dev/null 2>&1; then
    printf 'missing required command: %s\n' "$command" >&2
    missing=1
  fi
done

if [[ "$missing" -ne 0 ]]; then
  exit 1
fi

expected_node="$(tr -d '[:space:]' < .nvmrc)"
actual_node="$(node -p 'process.versions.node.split(".")[0]')"
if [[ "$expected_node" != "$actual_node" ]]; then
  printf 'Node %s is required by .nvmrc; found Node %s. Install/select it, then rerun.\n' "$expected_node" "$actual_node" >&2
  exit 1
fi

npm ci

if [[ ! -f .env.local ]]; then
  cp .env.example .env.local
  printf 'Created .env.local from .env.example. Provision non-production development secrets locally before running the app.\n'
fi

npx prisma generate

printf 'Bootstrap complete. Next: npm run env:check && npm run context:check && npx tsc --noEmit\n'
