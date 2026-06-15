# Metis Platform — Architecture

Decisions are locked. This document describes what was built, not what was considered.

---

## Request flow

```
Browser (Next.js App Router)
  │
  ├── Server Components (default) — data fetching, page rendering
  ├── Client Components ("use client") — interactive UI only
  │
  └── API Routes (/app/api/**)
           │
           ├── Auth middleware (proxy.ts — Clerk v7)
           ├── Tenant isolation (every query scoped to tenantId)
           ├── Zod validation (all input at API boundary)
           │
           ├── Prisma → Neon PostgreSQL (via PrismaNeon driver adapter)
           ├── Claude API → AI extraction, copilot, exit engine
           ├── Cloudflare R2 → document storage (presigned URLs)
           ├── Stripe → subscription + module checkout webhooks
           └── Resend → email alerts and digests
```

---

## Data model pattern

**Extension table pattern** — core `Deal` table + per-strategy extension tables. Never add strategy-specific columns to `Deal`.

```
Deal (universal container: tenantId, strategyType, status, dates, financials)
  ├── DealTaxLien      (cert #, interest rate, redemption expiry)
  ├── DealTaxDeed      (sale date, winning bid, redemption deadline)
  ├── DealForeclosure  (foreclosure type, auction date, bids)
  ├── Deal_FixFlip     (rehab budget, ARV, scope of work)
  ├── Deal_Wholesale   (assignment fee, buyer CRM)
  ├── Deal_BuyHold     (rent roll, Section 8)
  └── Deal_Multifamily (T12, DSCR, sensitivity model)
```

Other core entities: `Tenant`, `User`, `Jurisdiction`, `JurisdictionProfile`, `RuleSet`, `Rule`, `Property`, `Contact`, `Event`, `Task`, `FinancialTransaction`, `Document`, `ChecklistTemplate`, `TenantModule`

---

## Multi-tenancy

- `tenantId` is on every table. Every Prisma query is scoped to it — no exceptions.
- Resolved from Clerk org context in `lib/auth.ts` — never from user input.
- Module access gated by `TenantModule` rows via `lib/entitlements.ts` (`hasStrategy()`, `hasTier()`).

---

## AI layer

- **BYOK** — tenant supplies their Anthropic API key; platform key is never used for tenant requests.
- `resolveAnthropicKey(tenantId)` returns 402 if no key is configured; directs user to `/dashboard/settings/ai`.
- Extraction results cached in `Document.extractedData` — never re-extracted on second call.
- Copilot is session-only (no DB persistence); structured JSON system prompt with deal context.

---

## Background jobs

Vercel Cron routes (API routes on a schedule). No Redis, no pg-boss, no external job service.

| Cron | Route | Schedule |
|---|---|---|
| Deadline sweep | `/api/cron/deadline-sweep` | Daily 06:00 UTC |
| Daily digest email | `/api/cron/digest` | Daily 07:00 UTC |
| Expire module trials | `/api/cron/expire-trials` | Daily 08:00 UTC |

Auth: `Authorization: Bearer $CRON_SECRET`

---

## Schema migrations

GitHub Action (`.github/workflows/migrate.yml`) runs `prisma migrate deploy` automatically on merge to `main` when schema files change — before Vercel picks up the deploy.

- Migration SQL files must be created with correct WSL file ownership (see CLAUDE.md — writing via UNC path breaks `git reset --hard`).
- `app/generated/` is gitignored; Vercel build script runs `prisma generate` before `next build`.

---

## Clerk specifics

- Middleware: `proxy.ts` at project root (not `middleware.ts`)
- `auth()` and `clerkClient()` are both async — always `await` them
- Two separate instances: `pk_test_` for dev, `pk_live_` for production — accounts do not cross over
- Requires 5 Cloudflare DNS CNAMEs pointing to Clerk services (see CLAUDE.md for values)

---

## Vercel build gotchas

- SDK clients (`Stripe`, `Resend`, `Anthropic`) must never be instantiated at module level. Next.js evaluates module-level code during build even for dynamic routes. Use lazy getters: `getStripe()`, `getResend()`, etc.
- `@sentry/nextjs` requires full setup (`withSentryConfig` + `SENTRY_AUTH_TOKEN` + `instrumentation.ts`) — half-setup silently breaks builds.
- All runtime env vars must be set in Vercel Dashboard, not just `.env.local`.
