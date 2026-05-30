# CLAUDE.md — Metis Platform

Behavioral guidelines for all AI agents (FleetView, Claude Code for VS Code) working in this repository. Merge these rules with any task-specific instructions.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

---

## Project Context

**Metis Platform** is an AI-powered, multi-tenant SaaS for real estate investors. It starts as a tax lien lifecycle management tool and expands to cover all major REI strategies (wholesale, fix & flip, buy & hold, land, multifamily).

- **Stack:** Next.js 14+ (TypeScript), Prisma, Neon (PostgreSQL), Clerk (auth), Anthropic Claude API, Cloudflare R2, Resend, Stripe, Vercel
- **Repo:** Metis Platform GitHub org → `platform` repository
- **Roadmap:** See `ROADMAP.md` in this repo root
- **Current Phase:** See ROADMAP.md Phase status
- **System of Record:** GitHub Issues — every task is an Issue with acceptance criteria

---

## New Session Checklist

**Read these before touching any code:**
1. This file (CLAUDE.md) — you are here
2. `ROADMAP.md` in this same repo — current phase status and what's next
3. `git log --oneline -5` — see what was last merged

**Critical environment facts (do not rediscover these):**
- Repo lives in WSL at: `/home/xovox/dev/metis-platform/`
- This is NOT under the Windows filesystem — it is a native WSL2 Ubuntu path
- Always source nvm before any Node/npm/npx command:
  `source /home/xovox/.nvm/nvm.sh && <your command>`
- The Windows machine username is `aswit`; WSL username is `xovox`
- Windows temp path for scripts: `C:\Users\aswit\AppData\Local\Temp\`
- WSL sees Windows C: drive at: `/mnt/c/`

**File writing — use UNC path to write directly to WSL (read the section below):**
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

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

## Project-Specific Rules

### Data & Security
- Every database query MUST be scoped to `tenantId`. No cross-tenant data leakage.
- Never log or expose API keys, tokens, or secrets.
- Never commit `.env` or `.env.local` files.
- Use `.env.example` to document required variables (no real values).
- Clerk session/org context is the source of `tenantId` — always resolve it from the auth context, never from user input.

### Architecture
- Follow the **extension table pattern**: core `Deal` table + `Deal_TaxLien`, `Deal_FixFlip`, etc. for strategy-specific fields. Never add strategy-specific columns to the core `Deal` table.
- Background jobs run via **pg-boss** inside the existing Neon PostgreSQL instance. No Redis, no separate job service.
- AI features use the **Anthropic Claude API** only. No OpenAI, no other LLM providers.
- File uploads go to **Cloudflare R2**. Never store binary files in the database.

### Code Conventions
- TypeScript strict mode. No `any` types without a comment explaining why.
- Prisma for all database access. No raw SQL except where Prisma cannot express the query (document the reason).
- Zod for all input validation at API boundaries.
- Use Next.js App Router patterns (Server Components by default, `"use client"` only when necessary).
- Tailwind for all styling. No CSS modules, no styled-components.
- Error messages must be user-readable. No raw stack traces exposed to the browser.

### Prisma 7 + Next.js 16 Breaking Changes (Lessons Learned)

These breaking changes bit us during Phase 0/1A. Don't repeat them.

**Prisma 7:**
- `schema.prisma` datasource block has NO `url` property — it was removed. The datasource block is just `provider = "postgresql"` with no url line. The connection string is passed via the driver adapter at runtime.
- Generator must use `provider = "prisma-client-js"` (not `"prisma-client"` — that provider requires zero-arg constructor which Prisma 7 disallows).
- `new PrismaClient()` with zero args throws at runtime. Always pass `{ adapter }`.
- Driver adapter: `import { PrismaNeon } from '@prisma/adapter-neon'` then `new PrismaNeon({ connectionString: process.env.DATABASE_URL! })`.
- Import path for the generated client is `@/app/generated/prisma` (output configured in schema generator). Do NOT import from `@prisma/client`.
- `app/generated/` is gitignored — build script MUST run `prisma generate` before `next build`. In `package.json`: `"build": "prisma generate && next build"`.
- Prisma Studio exits with `ERR_STREAM_PREMATURE_CLOSE` when using the Neon serverless adapter. This is cosmetic — Studio still works and data is accessible. Not a blocker.
- CLI configuration lives in `prisma.config.ts` (not in `schema.prisma`). The `datasource.url` for migrations is set there via `dotenv` + `defineConfig`.

**Clerk v7 + Next.js 16:**
- Middleware file is `proxy.ts` at the project root, NOT `middleware.ts`. Next.js 16 changed the middleware entrypoint name.
- `auth()` is async — always `await auth()`.
- `clerkClient()` is async — always `const client = await clerkClient()`.
- `<UserButton>` no longer accepts `afterSignOutUrl` prop — remove it.
- Default Clerk sign-up collects email only. To collect first/last name: Clerk Dashboard → User & Authentication → Email, Phone, Username → enable First name + Last name as required fields.


### File Writing in WSL — CRITICAL

The `Write` and `Edit` tools are Windows-native. They **cannot** use Linux paths like `/home/xovox/...` directly.

**The correct pattern — use the UNC path to reach WSL directly:**

```
Write  → \\wsl.localhost\Ubuntu\home\xovox\dev\metis-platform\<relative\path\to\file.tsx>
Edit   → \\wsl.localhost\Ubuntu\home\xovox\dev\metis-platform\<relative\path\to\file.tsx>
Read   → \\wsl.localhost\Ubuntu\home\xovox\dev\metis-platform\<relative\path\to\file.tsx>
```

Example — writing a new server action:
```
Write → \\wsl.localhost\Ubuntu\home\xovox\dev\metis-platform\lib\actions\deal.ts
```

This writes directly into WSL. No temp files, no copy step needed.

**Never do this** (Linux paths are invisible to the Write/Edit tools):
- `Write → /home/xovox/dev/metis-platform/app/...`  ❌
- `Edit → /home/xovox/dev/metis-platform/lib/...`   ❌

**Fallback if UNC write fails** (e.g. complex content with escaping issues):
1. Write a Python script to Windows temp: `C:\Users\aswit\AppData\Local\Temp\script.py`
2. Execute in WSL: `wsl bash -c "cp '/mnt/c/Users/aswit/AppData/Local/Temp/script.py' /tmp/s.py && python3 /tmp/s.py"`
The Python script uses `pathlib.Path('/home/xovox/dev/metis-platform/...').write_text(...)`.

**Signs something went wrong:** New routes missing from build output, `find` shows empty directories.

### Git & GitHub
- Branch naming: `feature/<issue-number>-short-description`, `fix/<issue-number>-short-description`
- Every PR references the GitHub Issue it closes (`Closes #<number>` in the PR body).
- Commits are small and logically grouped. One concern per commit.
- Never force-push to `main`.
- Never skip pre-commit hooks.

### Cost Awareness
- This project runs on free tiers. Before adding any new dependency or service, confirm it has a usable free tier and note it in the PR.
- Claude API calls should be designed to minimize token usage. Cache extracted document data — never re-extract what's already stored.
- Background jobs that call the Claude API should be batched where possible.

---

## Domain Glossary

| Term | Definition |
|------|-----------|
| Lien | A tax lien certificate — the core investment instrument in Module 1 |
| Parcel / APN | Assessor's Parcel Number — unique property identifier assigned by county |
| Redemption | When the property owner pays back the lien (investor gets principal + interest) |
| Redemption Period | The legally mandated window during which the owner can redeem (varies by state) |
| Foreclosure | Process investor initiates if the owner doesn't redeem before deadline |
| Jurisdiction | A specific county + state combination with its own rules |
| RuleSet | The set of deadline rules for a given Jurisdiction |
| Event | A system-generated milestone derived from rules (e.g., RedemptionEnd, NoticeDue) |
| Task | An operational action assigned to a user, tied to an Event or Deal |
| Deal | Universal container for any investment (StrategyType determines which extension table applies) |
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
