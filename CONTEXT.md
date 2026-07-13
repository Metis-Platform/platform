# Metis Platform — Context Manifest

This repository is the canonical, portable source of all non-secret Metis project context. A fresh clone on WSL, macOS, or another machine must be enough for an agent or developer to understand the product, current state, architecture, and working rules.

Machine-local AI memory, editor state, shell history, and local worktrees are convenience caches only. They must never contain the only copy of a decision, requirement, handoff, or backlog item.

## Sources of truth

| Information | Canonical source |
|---|---|
| Product mission, customer, priorities, module definitions | `STRATEGY.md` |
| Architecture and technical decisions | `ARCHITECTURE.md` |
| Current project state, pending human actions, next decision | `STATUS.md` |
| Work explicitly committed for the current sprint | `ACTIVE-SPRINT.md` |
| Completed initiatives | `PHASE-HISTORY.md` |
| Implementation-ready backlog | GitHub Issues |
| Code, migrations, CI, and engineering proof | Git history, pull requests, and GitHub Actions |
| Agent workflow and repository rules | `AGENTS.md` and `CLAUDE.md` |
| Domain research and source material | `docs/` |
| Cross-machine handoff procedure | `docs/CROSS-MACHINE-WORKFLOW.md` |

## Not stored in Git

Secret values, customer data, production database contents, and authenticated service sessions do not belong in the repository. Store secret values in the appropriate GitHub, Vercel, Clerk, Neon, Stripe, Resend, Cloudflare, or local secret store. Document required variable names in `.env.example` only.

## Start of every session

1. Run `npm run context:check` from the repository root.
2. Read `STATUS.md`, `ACTIVE-SPRINT.md`, and the latest Git history.
3. Read `STRATEGY.md` or `ARCHITECTURE.md` when the task touches product direction or architecture.
4. Check open pull requests and the relevant GitHub issue before implementation.
5. If tracked context disagrees with merged code, reconcile the tracked files before starting feature work.

## End of every session

1. Commit every intentional non-secret source, test, migration, and context change to the active branch.
2. Do not commit `.env*`, build output, generated caches, browser profiles, or credentials.
3. Update `STATUS.md` and `ACTIVE-SPRINT.md` when project state changed.
4. Push the branch to GitHub and confirm the remote branch contains the final commit.
5. Leave the working tree clean, or document any intentionally retained local-only file in the handoff.
