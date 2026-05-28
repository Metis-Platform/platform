# CLAUDE.md — Metis Platform

Behavioral guidelines for all AI agents (FleetView, Claude Code for VS Code) working in this repository. Merge these rules with any task-specific instructions.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

---

## Project Context

**Metis Platform** is an AI-powered, multi-tenant SaaS for real estate investors. It starts as a tax lien lifecycle management tool and expands to cover all major REI strategies (wholesale, fix & flip, buy & hold, land, multifamily).

- **Stack:** Next.js 14+ (TypeScript), Prisma, Neon (PostgreSQL), Clerk (auth), Anthropic Claude API, Cloudflare R2, Resend, Stripe, Vercel
- **Repo:** Metis Platform GitHub org → `platform` repository
- **Roadmap:** See `../ROADMAP.md` (one level up from this repo)
- **Current Phase:** See ROADMAP.md Phase status
- **System of Record:** GitHub Issues — every task is an Issue with acceptance criteria

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
