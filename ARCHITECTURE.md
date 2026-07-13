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

## Environment lifecycle

Metis is pre-customer. Until the production-readiness gate is completed, the current live domain and its connected services are a **shared disposable integration environment**, even though Vercel technically labels the deployment target `Production`.

| Logical environment | Purpose | Data policy |
|---|---|---|
| Local / PR Preview | Code iteration, build proof, and isolated browser tests | Synthetic data only; preview writes require integration/QA service bindings |
| Shared Integration | Current live application; end-to-end feature development and demonstrations | Disposable synthetic data; resettable across database and external services |
| Release Candidate | Temporary clean launch rehearsal from an approved commit and configuration bundle | Fresh rebuild; no copied integration transactions |
| Production | External beta/customers after the production-readiness gate | Non-disposable customer data; reset tooling permanently blocked |

The D365-style Gold equivalent is **versioned reference configuration**, not a long-lived mutable database. Migrations, jurisdiction/rule sources, checklist/workflow templates, plan/entitlement definitions, feature flags, canonical parcel fixtures, and deterministic seed manifests are reviewed in Git. Configuration created through admin screens must eventually support reviewed export/import or become code-managed.

An integration reset must verify explicit environment/service identities and reset all retained state: Neon data, tagged synthetic Clerk users/organizations, integration R2 objects, Stripe test artifacts as needed, email/cron safeguards, and deterministic fixtures. A database-only reset is not sufficient.

The reset safety boundary starts with a non-destructive preflight:

```bash
npm run integration:reset:preflight -- --confirm <METIS_ENVIRONMENT_ID>
```

It fails closed unless the logical environment is `integration`, the configured and operator-confirmed environment IDs agree, Neon/Clerk/R2 identities are explicitly allowlisted and not production-denylisted, Stripe keys are test-mode, and the declared email/cron/auction/AI policy is safe. The runtime identity variables are documented in `.env.example`; actual service IDs and secrets remain outside Git. Passing this command proves environment identity and declared policy. It never changes state or authorizes a reset.

Runtime side-effect enforcement is centralized in `lib/side-effect-policy.ts`. Integration, Preview, Release Candidate, and Test deny cron, auction, and AI work unless that class is explicitly `enabled`. Email is never generally enabled there: `sink` performs no network delivery, while `allowlist` permits only exact configured recipients. Every cron route applies the shared authenticated guard before work, all Resend delivery passes through `sendEmail`, Anthropic client construction checks AI policy, and auction writes check auction policy. Explicit Local preserves normal behavior. Production does so only when `PRODUCTION_AUTHORIZED_ENVIRONMENT_ID` matches `METIS_ENVIRONMENT_ID`; this prevents the current Vercel target name or a stale `APP_ENV` from impersonating the future clean production boundary. Hosted execution without a valid `APP_ENV` fails closed. These guards are necessary but not sufficient for reset: tagged fixtures and cross-service deletion/orchestration remain in issue #289.

Before the first external user, production is provisioned or cut over using a fresh database, clean authentication state, production-only external-service resources, the approved immutable commit, migrations, and reference configuration. Full design and acceptance criteria: issue #298.

---

## Clerk specifics

- Middleware: `proxy.ts` at project root (not `middleware.ts`)
- `auth()` and `clerkClient()` are both async — always `await` them
- Current integration environment uses a Clerk production instance and the shared integration database. This is a temporary pre-customer condition, not the target production topology; issue #298 defines the clean cutover and #289 defines isolated automated-test state.
- Requires 5 Cloudflare DNS CNAMEs pointing to Clerk services (see CLAUDE.md for values)

---

## Vercel build gotchas

- SDK clients (`Stripe`, `Resend`, `Anthropic`) must never be instantiated at module level. Next.js evaluates module-level code during build even for dynamic routes. Use lazy getters: `getStripe()`, `getResend()`, etc.
- `@sentry/nextjs` requires full setup (`withSentryConfig` + `SENTRY_AUTH_TOKEN` + `instrumentation.ts`) — half-setup silently breaks builds.
- All runtime env vars must be set in Vercel Dashboard, not just `.env.local`.
