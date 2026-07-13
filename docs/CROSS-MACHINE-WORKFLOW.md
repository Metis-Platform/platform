# Cross-Machine Workflow

GitHub is the handoff point between the Windows/WSL machine and macOS. Do not synchronize the repository through OneDrive, a shared filesystem, editor state, or machine-local AI memory.

## First setup on a machine

```bash
git clone https://github.com/Metis-Platform/platform.git
cd platform
nvm install
nvm use
npm ci
gh auth status
npm run context:check
```

Configure required service credentials outside Git. Use `.env.example` as the variable-name checklist; never copy secret values through a commit or chat.

## Begin work

If starting new work:

```bash
git switch main
git fetch --prune origin
git pull --ff-only
git switch -c feature/<issue>-<description>
```

If continuing a branch created on the other machine:

```bash
git fetch --prune origin
git switch <branch>
git pull --ff-only
```

If the branch does not exist locally yet:

```bash
git fetch --prune origin
git switch --track origin/<branch>
```

Never work on the same branch from both machines at the same time. Finish and push the handoff from one machine before continuing on the other.

## Hand off to the other machine

```bash
git status
git add <intentional-files>
git commit -m "chore: checkpoint <work description>"
git push -u origin HEAD
git status
```

The final `git status` should be clean. A checkpoint commit may remain on an open feature branch; it does not need to be merged merely to move between machines.

Before leaving the machine, record changed project state in `STATUS.md`. Long-lived requirements and decisions must be placed in their canonical tracked document, not only in a commit message or AI conversation.

## Files that must remain local

- `.env`, `.env.local`, and other secret-bearing environment files
- `.next/`, generated Prisma client output, caches, logs, and test artifacts
- Browser profiles and authenticated sessions
- Machine-local AI/editor memory and worktrees

If a local file contains durable project knowledge, move the knowledge to the appropriate tracked document and keep secrets out.

## After a pull request merges

Do not reuse a squash-merged branch. On either machine:

```bash
git switch main
git fetch --prune origin
git pull --ff-only
git branch -d <merged-branch>
```

Only delete the local branch after confirming the pull request merged and the working tree is clean.

## Conflict rule

If `git pull --ff-only` fails, stop and inspect `git status`, `git log --oneline --decorate --graph -10`, and the remote branch. Do not force-push, reset, or discard files just to make the machines match. Preserve the work, then resolve the divergence deliberately.
