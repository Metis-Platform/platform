# Production Release Workflow

Every production change reaches `main` through a pull request. GitHub requires the current branch to be up to date and requires both:

- `Type check, lint, test, and build`
- `Vercel`

Administrators follow the same protection. Force pushes, branch deletion, direct pushes, and unresolved review conversations are blocked. A squash merge to `main` triggers the production deployment.

## Normal release

1. Branch from current `origin/main`.
2. Keep implementation, tests, `ACTIVE-SPRINT.md`, and `STATUS.md` together in the PR.
3. Push the branch and open a PR linked to its issue.
4. Inspect the changed files and wait for every required check.
5. Inspect the Vercel preview for the changed surface. Do not perform writes until preview environments use isolated QA services.
6. Squash-merge only while the PR is mergeable and all required checks are green.
7. Confirm the production deployment and health endpoint.

## Emergency release

An emergency does not authorize a direct push, force push, skipped build, or untracked production change.

If a required third-party check is unavailable while an urgent production repair is needed:

1. Open an incident GitHub issue describing impact, evidence, owner, and rollback.
2. Use a minimal hotfix branch and PR; run the full local verification suite and retain its output.
3. Keep the GitHub CI build required. Temporarily remove only the unavailable third-party context from branch protection, recording the settings change in the incident issue.
4. Review the PR diff, merge through GitHub, verify production health and the repaired behavior, then immediately restore the required context.
5. Add the deployment, verification, protection restoration, and any follow-up work to the incident issue.

If CI itself is unavailable, do not change branch protection merely for speed. Restore CI or use GitHub's documented support/status path; production safety is more valuable than an unverified deployment.
