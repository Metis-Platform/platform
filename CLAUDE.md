# CLAUDE.md — Metis Platform

Behavioral guidelines for Claude Code and any AI agent working in this repository. Merge these rules with any task-specific instructions.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

---

## Project Context

**Metis Platform** is an AI-powered, multi-tenant SaaS for real estate investors. It starts as a tax lien lifecycle management tool and expands to cover all major REI strategies (wholesale, fix & flip, buy & hold, land, multifamily).

- **Stack:** Next.js 16 (TypeScript), Prisma 7, Neon (PostgreSQL), Clerk v7 (auth), Anthropic Claude API, Cloudflare R2, Resend, Stripe, Vercel
- **Repo:** Metis Platform GitHub org → `platform` repository
- **Strategy:** `STRATEGY.md` (vision, module specs) | **Sprint:** `ACTIVE-SPRINT.md` (current queue) | **History:** `PHASE-HISTORY.md` (completed phases)
- **Current Phase:** Post-beta initiatives — #131 Jurisdiction Intelligence and #229 Parcel Intelligence / Exit Strategy Engine
- **System of Record:** Linear METIS is product/project command center; GitHub PRs/CI/merged code are engineering proof

### North Star (test every feature decision against this — full goalposts in STRATEGY.md)

**Become THE definitive main hub for real estate investors: replace their spreadsheets,
drastically simplify their process.** Revenue follows capability — legitimate products
before premium pricing, always. In practice:
- A module ships when it can **retire the spreadsheet it replaces** (computed-not-typed
  economics, ledgers, generated checklists) — not when it adds data entry beside one.
- **Pricing is earned by shipped capability**, never by market sizing (e.g. MF premium is
  gated on #43 Phase 4; generalize via #130 tiers).
- Prefer **platform primitives** (#132 ledger, #133 checklists, Contact CRM, import
  pipeline) over module one-offs — and retrofit them to live modules.
- Judge releases by **investor process steps removed**, not features added.

---

## New Session Checklist

> ⚠️ STOP — READ THIS FIRST BEFORE DOING ANYTHING ELSE

**Step 1 — Orient from these files:**
- `STATUS.md` — current state snapshot: last session, next up, key facts
- `ACTIVE-SPRINT.md` — current sprint queue (read when implementing)
- `git log --oneline -5` — recent commits

**If `git log` shows merges not reflected in memory or STATUS.md** (i.e. another agent ran since last session), reconcile before doing anything else:
- Update memory "Last session completed" and "Next up" to match git state
- Tick any completed items in `ACTIVE-SPRINT.md`
- Update STATUS.md Last Session and Next Up rows

Read on demand only (not every session):
- `STRATEGY.md` — product vision, north star, module specs
- `ARCHITECTURE.md` — infra decisions, data model, ADRs
- `PHASE-HISTORY.md` — completed phase archive

**Environment:**
- Repo: `/home/xovox/dev/metis-platform/` (WSL, Ubuntu)
- Node: source nvm before any npm/npx command: `source /home/xovox/.nvm/nvm.sh && <command>`
- Windows temp (for migration SQL): `C:\Users\aswit\AppData\Local\Temp\` (WSL path: `/mnt/c/Users/aswit/AppData/Local/Temp/`)

**Step 2 — Sync to main and check open PRs:**
```bash
git fetch origin && git reset --hard origin/main
gh pr list --state open
```
Use `git reset --hard origin/main` (not `git pull`) — local branch tracking gets corrupted across sessions when feature branches are squash-merged.

> **Windows Claude app only:** prefix these with `wsl bash -c "cd /home/xovox/dev/metis-platform && ..."` since it runs in Git Bash, not WSL.

**Step 3 — After every `gh pr create`, immediately queue auto-merge:**
```bash
gh pr merge <number> --auto --squash
```

**Step 4 — After every PR merge AND at session end: checkpoint state.**

Do this after every merge (not just at session end — protects against abrupt session loss):

**A) Tick `ACTIVE-SPRINT.md`** — mark the completed item

**B) Update `STATUS.md`** — update Last Session row + Next Up table

**C) Update memory** at `/home/xovox/.claude/projects/-home-xovox-dev-metis-platform/memory/project-metis-platform.md`:
- Update "Last session completed" with PR numbers
- Update "Next up" with the top 3 remaining issues
- Memory auto-loads before the first user message next session — keeping it current means instant orientation

**Information contract — one home per content type, no duplication:**

| Content | Single home | Updated when |
|---|---|---|
| Individual bugs and features | GitHub Issues | Created per issue, closed on merge |
| Current sprint queue | `ACTIVE-SPRINT.md` | After every PR merge (tick item) |
| Session snapshot (last work, next up) | `STATUS.md` | After every PR merge |
| Cross-session fast orient | memory `project-metis-platform.md` | After every PR merge |
| Behavior/workflow rules | memory `feedback-session-rules.md` | When a preference changes |
| Product vision + module specs | `STRATEGY.md` | When strategy changes |
| Architecture decisions + ADRs | `ARCHITECTURE.md` | When architecture changes |
| Completed phase history | `PHASE-HISTORY.md` | Append-only as phases complete |
| Coding rules + constraints | `CLAUDE.md` | When rules change |

**Never duplicate content across files — link instead. Backlog items live only in GitHub Issues.**

**Rot prevention:** When you encounter a stale reference, wrong filename, or inaccurate content in any project doc, fix it in-place as part of your current work — don't note it for later. At the end of each initiative (when all ACTIVE-SPRINT.md items for an initiative check off), do a quick read of the file map to catch anything missed opportunistically.

**File writing — use Linux paths (VS Code extension and WSL CLI):**
```
Read/Write/Edit → /home/xovox/dev/metis-platform/<path/to/file>
```

**Windows Claude app:** tools are Windows-native and cannot use Linux paths directly.
```
Read/Write/Edit → \\wsl.localhost\Ubuntu\home\xovox\dev\metis-platform\<path\to\file>
```
⚠️ **Migration SQL files must never be written via UNC path** — UNC-written files get Windows/root ownership in WSL and break `git reset --hard`. Use the temp-copy method instead (see Schema Migrations section).

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
- Background jobs run via **Vercel Cron routes** (API routes called on schedule). No Redis, no separate job service, no pg-boss.
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
- `prisma migrate dev` requires an interactive terminal — run it manually in WSL if needed. See **Schema Migrations** section below for the agent workflow.

**Clerk v7 + Next.js 16:**
- Middleware file is `proxy.ts` at the project root, NOT `middleware.ts`.
- `auth()` is async — always `await auth()`.
- `clerkClient()` is async — always `const client = await clerkClient()`.
- `<UserButton>` no longer accepts `afterSignOutUrl` prop.

**Turbopack (if dev server is ever run locally):**
- After renaming a directory (e.g. `liens/` → `deals/`), Turbopack cache holds stale route references. Run `rm -rf .next` before `npm run dev` or it will FATAL crash on the old path.

### File Paths by Agent Context

| Context | Read / Write / Edit paths | Bash commands |
|---|---|---|
| VS Code extension (WSL) | Linux: `/home/xovox/dev/metis-platform/…` | Direct |
| WSL CLI | Linux: `/home/xovox/dev/metis-platform/…` | Direct |
| Windows Claude app | UNC: `\\wsl.localhost\Ubuntu\home\xovox\dev\metis-platform\…` | `wsl bash -c "…"` |

**Windows app — PR bodies with special characters:** write body to `C:\Users\aswit\AppData\Local\Temp\pr-body.md` and pass `--body-file /mnt/c/Users/aswit/AppData/Local/Temp/pr-body.md` to `gh pr create`. Heredocs in `wsl bash -c` are unreliable.

### Issue authoring

When creating or expanding GitHub issues, write at implementation depth. The test: could an agent open this issue cold and ship it in one session without asking questions?

In practice this means including whatever the implementer actually needs — Prisma models, TypeScript signatures, SQL, API routes, architecture diagrams, data sources — not descriptions of them. State the why behind any non-obvious design choice. End with checkboxed acceptance criteria so done is unambiguous.

The shape varies by issue: a schema change leads with the model; a spatial query leads with the architecture flow and SQL; a seed task leads with the data source and the idempotency approach. Follow the shape of the work, not a fixed template.

---

### Git & GitHub
- Branch naming: `feature/<issue-number>-short-description`, `fix/<issue-number>-short-description`
- Never force-push to `main`.

**PR body template** — use this structure for every non-trivial PR:

```markdown
## What shipped
[2–3 sentences. What the PR does and any non-obvious decisions made.]

## Verification
[How to confirm it works — Vercel preview URL, specific page/action to check, expected outcome.]

## Sprint notes
[Forward context for the next PR in this initiative. Decisions this PR locked in, dependencies
it creates, gotchas the next agent should know before starting. Omit if nothing carries forward.]

Closes #<number>
```

The **Sprint notes** field is the most important — it turns each PR into an instruction for whatever picks up the next piece, whether that's a future Claude session, Hermes, or Codex. Write it assuming the next agent has no memory of this session.
- **After every `gh pr create`, immediately queue auto-merge:**
  ```bash
  gh pr merge <number> --auto --squash
  ```
- **Never reuse a branch after it has been squash-merged.** Squash merge creates a new commit on `main` with a different hash, orphaning the branch's original commits. Any follow-up commit on that branch will conflict. For fixes to a merged PR, always create a fresh branch from `origin/main`:
  ```bash
  git checkout -b fix/<description> origin/main
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

**Clerk is production-only** (`pk_live_` keys in both `.env.local` and Vercel). There is no separate dev Clerk instance. All local testing uses the production Clerk instance and production database.

**Clerk production requires 5 CNAME records in Cloudflare DNS** (all DNS only, not proxied):
| Name | Points to |
|------|-----------|
| `clerk` | `frontend-api.clerk.services` |
| `accounts` | `accounts.clerk.services` |
| `clkmail` | `mail.<instance>.clerk.services` |
| `clk._domainkey` | `dkim1.<instance>.clerk.services` |
| `clk2._domainkey` | `dkim2.<instance>.clerk.services` |
Get exact values from Clerk Dashboard → Production → Configure → Domains → Primary. Without these, the sign-in page is a blank screen.

**Clerk sends its own verification emails** (sign-in codes, magic links) through `clkmail.metisplatforms.com` — this is separate from Resend. New domains may land in spam until sending reputation builds. Resend is only used for the app's own digest emails.

**The `SUPER_ADMIN_EMAILS` Vercel env var** controls access to the super-admin dashboard (`/admin`). Set it to the email address the admin user signs in with (e.g. `you@gmail.com`). It is checked by `lib/admin-auth.ts` — it is an email address, NOT a Clerk user ID. Multiple admins: comma-separated.

### Dev → Production Workflow

```
git push → open PR on GitHub
  → Vercel creates a Preview deployment (uses production env vars, production Clerk)
  → Merge PR to main
  → GitHub Action runs prisma migrate deploy (if schema changed)
  → Vercel auto-deploys to metisplatforms.com (~2 min)
```

**Never manually deploy.** Every merge to `main` is automatic. **Vercel preview deployments are the test environment** — there is no separate local dev site. Test against the preview URL or production.

**Preview deployments** use the production Clerk instance and production DB — they are real, not sandboxes. Don't create test data on a preview URL.

### Schema Migrations — Fully Automated

A GitHub Action (`.github/workflows/migrate.yml`) runs `prisma migrate deploy` automatically on every merge to `main` when `prisma/schema.prisma` or `prisma/migrations/**` changes.

- The Action uses the `DATABASE_URL` GitHub repository secret (set in GitHub → Settings → Secrets → Actions)
- It runs **before** Vercel picks up the deploy, so the schema is always updated first
- **You never need to remember to run migrations manually** — just merge the PR

**Agent workflow for schema changes:**
1. Update `prisma/schema.prisma`
2. Write the migration SQL to a temp file, then copy into WSL — do NOT write directly via UNC path. UNC-written files get Windows/root ownership in WSL, which breaks `git reset --hard`.
   ```
   Write → C:\Users\aswit\AppData\Local\Temp\migration.sql
   wsl bash -c "mkdir -p /home/xovox/dev/metis-platform/prisma/migrations/<timestamp>_<name> && cp /mnt/c/Users/aswit/AppData\Local\Temp\migration.sql /home/xovox/dev/metis-platform/prisma/migrations/<timestamp>_<name>/migration.sql"
   ```
3. Commit both files in the PR — the GitHub Action handles `migrate deploy` on merge

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
