# CLAUDE.md — Metis Platform

Behavioral guidelines for all AI agents (FleetView, Claude Code for VS Code) working in this repository. Merge these rules with any task-specific instructions.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

---

## Project Context

**Metis Platform** is an AI-powered, multi-tenant SaaS for real estate investors. It starts as a tax lien lifecycle management tool and expands to cover all major REI strategies (wholesale, fix & flip, buy & hold, land, multifamily).

- **Stack:** Next.js 16 (TypeScript), Prisma 7, Neon (PostgreSQL), Clerk v7 (auth), Anthropic Claude API, Cloudflare R2, Resend, Stripe, Vercel
- **Repo:** Metis Platform GitHub org → `platform` repository
- **Roadmap:** See `ROADMAP.md` in this repo root
- **Current Phase:** Phase 2 (AI Layer) — Phase 3 and Phase 4-partial are complete
- **System of Record:** GitHub Issues — every task is an Issue with acceptance criteria

---

## New Session Checklist

> ⚠️ STOP — READ THIS FIRST BEFORE DOING ANYTHING ELSE

**Step 1 — Read files via WSL. Not Windows. WSL.**
```bash
wsl bash -c "cat /home/xovox/dev/metis-platform/CLAUDE.md"
wsl bash -c "cat /home/xovox/dev/metis-platform/ROADMAP.md"
wsl bash -c "cd /home/xovox/dev/metis-platform && git log --oneline -5"
```
Do NOT attempt to read these as Windows paths. The repo is in WSL, not on the Windows filesystem.

**Critical environment facts (do not rediscover these):**
- Repo is in WSL at: `/home/xovox/dev/metis-platform/`
- This is NOT a Windows path — do not look for it under C:\ or OneDrive
- The ONLY way to reach it from FleetView is via `wsl bash -c "..."`
- FleetView runs in Git Bash (MSYS2) on Windows — NOT in WSL. Every `wsl bash -c` call is a one-shot subprocess; processes started this way die when the call ends. Never try to keep a dev server running from FleetView.
- Always source nvm before any Node/npm/npx command: `source /home/xovox/.nvm/nvm.sh && <your command>`
- Write/Edit files via UNC path: `\\wsl.localhost\Ubuntu\home\xovox\dev\metis-platform\<file>`
- Windows machine username: `aswit` | WSL username: `xovox`
- Windows temp path: `C:\Users\aswit\AppData\Local\Temp\`
- WSL sees Windows C: drive at: `/mnt/c/`

**Step 2 — After reading ROADMAP.md, sync to main and check open PRs:**
```bash
wsl bash -c "cd /home/xovox/dev/metis-platform && git fetch origin && git reset --hard origin/main"
wsl bash -c "cd /home/xovox/dev/metis-platform && gh pr list --state open"
```
Use `git reset --hard origin/main` (not `git pull`) — local branch tracking gets corrupted across sessions when feature branches are squash-merged.

**Step 3 — After every `gh pr create`, immediately queue auto-merge:**
```bash
gh pr merge <number> --auto --squash
```

**Step 4 — Schema changes require `prisma generate` in the user's WSL terminal.**
If a PR includes a migration, tell the user to run `npx prisma generate` in their WSL terminal before using the app. Do NOT try to run this yourself and tell them to restart — just tell them the command.

**File writing — use UNC path to write directly to WSL:**
`\\\\wsl.localhost\\Ubuntu\\home\\xovox\\dev\\metis-platform\\<file>`

---

## Core Behavioral Rules

### 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it — don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

Every changed line should trace directly to the current task.

### 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"

For multi-step tasks, state a brief plan before starting:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

---

## Project-Specific Rules

### Data & Security
- Every database query MUST be scoped to `tenantId`. No cross-tenant data leakage.
- Never log or expose API keys, tokens, or secrets.
- Never commit `.env` or `.env.local` files.
- Use `.env.example` to document required variables (no real values).
- Clerk session/org context is the source of `tenantId` — always resolve it from the auth context, never from user input.

### Architecture
- Follow the **extension table pattern**: core `Deal` table + `DealTaxLien`, `DealTaxDeed`, `DealForeclosure`, etc. Never add strategy-specific columns to the core `Deal` table.
- Background jobs run via **pg-boss** inside the existing Neon PostgreSQL instance. No Redis, no separate job service.
- AI features use the **Anthropic Claude API** only. No OpenAI, no other LLM providers.
- File uploads go to **Cloudflare R2**. Never store binary files in the database.
- Strategy switching is done via `?strategy=TAX_LIEN|TAX_DEED|FORECLOSURE` URL param. The `StrategyNav` client component handles this. All deal pages live at `/dashboard/deals/`.

### Code Conventions
- TypeScript strict mode. No `any` types without a comment explaining why.
- Prisma for all database access. No raw SQL except where Prisma cannot express the query (document the reason).
- Zod for all input validation at API boundaries.
- Use Next.js App Router patterns (Server Components by default, `"use client"` only when necessary).
- Tailwind for all styling. No CSS modules, no styled-components.
- Error messages must be user-readable. No raw stack traces exposed to the browser.
- **Never initialize third-party SDK clients at module level** when they require env vars — use a lazy getter. See `lib/stripe.ts` for the pattern.

### Vercel Build Rules — CRITICAL

These will break Vercel builds silently. Don't repeat them.

- **Never instantiate SDK clients at module level** when they require env vars (e.g. `new Stripe(process.env.KEY!)`). Next.js evaluates module-level code during the "Collecting page data" phase of `next build`, even for dynamic API routes. If the env var is missing on Vercel, the build crashes with a cryptic error. Use lazy getters: `getStripe()`, `getResend()`, etc.
- **Never add `@sentry/nextjs` without full setup.** The package requires `withSentryConfig` in `next.config.ts`, a `SENTRY_AUTH_TOKEN`, and an `instrumentation.ts`. Half-setup breaks Vercel builds. Either do it completely or skip it.
- **All new env vars used at runtime must be added to Vercel** (Dashboard → Project → Settings → Environment Variables). The `.env.local` file is not deployed.
- **Test builds without env vars** when adding new SDK dependencies: `DATABASE_URL='' CLERK_SECRET_KEY='' npm run build` — if it fails, fix before merging.

### Prisma 7 + Next.js 16 Breaking Changes (Lessons Learned)

**Prisma 7:**
- `schema.prisma` datasource block has NO `url` property. The connection string is passed via driver adapter at runtime.
- Generator must use `provider = "prisma-client-js"`.
- `new PrismaClient()` with zero args throws. Always pass `{ adapter }`.
- Driver adapter: `import { PrismaNeon } from '@prisma/adapter-neon'` then `new PrismaNeon({ connectionString: process.env.DATABASE_URL! })`.
- Import path for the generated client is `@/app/generated/prisma`. Do NOT import from `@prisma/client`.
- `app/generated/` is gitignored — build script MUST run `prisma generate` before `next build`.
- CLI configuration lives in `prisma.config.ts`. The `datasource.url` for migrations is set there.
- `prisma migrate dev` requires an interactive terminal — use `prisma migrate deploy` in scripts or create migration SQL manually then run `migrate deploy`.
- After any migration PR merges, the user must run `npx prisma generate` in their WSL terminal.

**Clerk v7 + Next.js 16:**
- Middleware file is `proxy.ts` at the project root, NOT `middleware.ts`.
- `auth()` is async — always `await auth()`.
- `clerkClient()` is async — always `const client = await clerkClient()`.
- `<UserButton>` no longer accepts `afterSignOutUrl` prop.

**Turbopack (dev server):**
- After renaming a directory (e.g. `liens/` → `deals/`), Turbopack's cache holds stale route references. Run `rm -rf .next` before `npm run dev` or the server will FATAL crash referencing the old path.
- The dev server must be run by the user in their own WSL terminal — not started from FleetView. Any process FleetView starts dies when the command ends.

### File Writing in WSL — CRITICAL

The `Write` and `Edit` tools are Windows-native. They **cannot** use Linux paths.

**The correct pattern:**
```
Write  → \\wsl.localhost\Ubuntu\home\xovox\dev\metis-platform\<relative\path\to\file.tsx>
Edit   → \\wsl.localhost\Ubuntu\home\xovox\dev\metis-platform\<relative\path\to\file.tsx>
Read   → \\wsl.localhost\Ubuntu\home\xovox\dev\metis-platform\<relative\path\to\file.tsx>
```

**Fallback for complex content (heredocs, escaping issues):**
1. Write a Python script to: `C:\Users\aswit\AppData\Local\Temp\script.py`
2. Execute: `wsl bash -c "cp '/mnt/c/Users/aswit/AppData/Local/Temp/script.py' /tmp/s.py && python3 /tmp/s.py"`

**PR bodies with special characters:** Write to a temp `.md` file and pass `--body-file /mnt/c/Users/aswit/AppData/Local/Temp/pr-body.md` to `gh pr create`. Heredocs in `wsl bash -c` are unreliable.

### Git & GitHub
- Branch naming: `feature/<issue-number>-short-description`, `fix/<issue-number>-short-description`
- Every PR references the GitHub Issue it closes (`Closes #<number>` in the PR body).
- Never force-push to `main`.
- **After every `gh pr create`, immediately queue auto-merge:**
  ```bash
  gh pr merge <number> --auto --squash
  ```
- **If `git pull` fails** with "no such ref was fetched" or "divergent branches": the local branch is tracking a deleted feature branch. Fix with:
  ```bash
  git branch --set-upstream-to=origin/main main
  git fetch origin && git reset --hard origin/main
  ```

### Production Environment

**The app is live at `https://metisplatforms.com`.**

| Layer | Production value |
|-------|----------------|
| Domain | `metisplatforms.com` (Cloudflare registrar, DNS-only → Vercel) |
| Hosting | Vercel — auto-deploys on every merge to `main` |
| Database | Neon PostgreSQL — same DB used by production and local dev |
| Auth | Clerk **Production** instance (`pk_live_` / `sk_live_` keys) |
| Email | Resend — `metisplatforms.com` verified, sends from `noreply@metisplatforms.com` |
| Storage | Cloudflare R2 bucket `metis-documents` |

**Clerk has two completely separate instances:**
- **Development** (`pk_test_` keys) — used by `localhost:3000`, `.env.local`
- **Production** (`pk_live_` keys) — used by `metisplatforms.com`, Vercel env vars

Dev accounts do not exist in production and vice versa. To access the production app, sign up fresh at `metisplatforms.com/sign-up`.

**The `ADMIN_USER_IDS` Vercel env var** holds the Clerk production user ID for the super-admin dashboard (`/admin`). Get it from Clerk Dashboard → Production → Users after signing up on the live site.

### Dev → Production Workflow

```
Local WSL (localhost:3000)
  → git push → open PR on GitHub
  → Vercel creates a Preview deployment (uses production env vars, production Clerk)
  → Merge PR to main
  → GitHub Action runs prisma migrate deploy (if schema changed)
  → Vercel auto-deploys to metisplatforms.com (~2 min)
```

**Never manually deploy.** Every merge to `main` is automatic.

**Preview deployments** use the production Clerk instance and production DB — they are real tests, not sandboxes. Don't create test data on a preview URL.

### Schema Migrations — Fully Automated

A GitHub Action (`.github/workflows/migrate.yml`) runs `prisma migrate deploy` automatically on every merge to `main` when `prisma/schema.prisma` or `prisma/migrations/**` changes.

- The Action uses the `DATABASE_URL` GitHub repository secret (set in GitHub → Settings → Secrets → Actions)
- It runs **before** Vercel picks up the deploy, so the schema is always updated first
- **You never need to remember to run migrations manually** — just merge the PR

If you add a new migration locally:
1. Run `npx prisma migrate dev --name <description>` in WSL to create the migration file
2. Commit the new file in `prisma/migrations/`
3. Open and merge a PR — the Action handles the rest

**The `DATABASE_URL` GitHub secret** must be kept in sync with `.env.local` if the Neon connection string ever rotates.

### Cost Awareness
- This project runs on free tiers. Before adding any new dependency or service, confirm it has a usable free tier and note it in the PR.
- Claude API calls should be designed to minimize token usage. Cache extracted document data — never re-extract what's already stored.
- Background jobs that call the Claude API should be batched where possible.

---

## Domain Glossary

| Term | Definition |
|------|-----------|
| Lien | A tax lien certificate — the core investment instrument in Tax Lien module |
| Parcel / APN | Assessor's Parcel Number — unique property identifier assigned by county |
| Redemption | When the property owner pays back the lien/deed (investor gets principal + interest) |
| Redemption Period | The legally mandated window during which the owner can redeem |
| Foreclosure | Process investor initiates if the owner doesn't redeem before deadline |
| Jurisdiction | A specific county + state combination with its own rules |
| RuleSet | The set of deadline rules for a given Jurisdiction |
| Event | A system-generated milestone derived from rules (e.g., RedemptionEnd, NoticeDue) |
| Task | An operational action assigned to a user, tied to an Event or Deal |
| Deal | Universal container for any investment (StrategyType determines which extension table applies) |
| Strategy | The investment type: TAX_LIEN, TAX_DEED, FORECLOSURE, FIX_FLIP, WHOLESALE, etc. |
| Tenant | A customer account — all data is isolated per tenant |
| Deal Copilot | The in-app AI chat assistant scoped to the tenant's live deal data |

---

## Final Report Format

After completing any non-trivial task, provide:

```
## Task: [Issue or task name]
**Status:** Done / Blocked / Partial
**Files changed:** [list]
**What was done:** [2–3 sentences]
**Verification:** [how to confirm it works]
**Side effects / notes:** [anything the user should know]
```
