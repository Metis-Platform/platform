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

### Jurisdiction intelligence publication boundary

Jurisdiction extraction is a proposal pipeline, not a truth pipeline. Every current research and
extraction field resolves through the versioned question library in
`lib/jurisdiction-question-library.ts`; an unknown section/field pair fails closed. The library
assigns a stable question ID, risk level, volatility class, expected authority class, required
evidence, and batch review eligibility. Volatility is server-owned policy input; AI and client
payloads cannot choose or extend a claim's review interval.

AI confidence controls review priority only. Extraction cron jobs may create or refresh `PENDING`
candidates, but may not write `JurisdictionProfile` or mark candidates approved. All forward
publication paths use `lib/jurisdiction-publication-policy.ts` and require a source URL, quoted
source evidence, and an authenticated reviewer. High- and critical-risk facts require individual
review; only low- and medium-risk facts may use the human batch-review path. The server owns the
review timestamp and reviewer ID and stamps the question schema version and authority class.

`REVIEWED` means a human accepted the sourced claim; it does not mean the source has yet been
independently validated as authoritative. `JurisdictionSourceUrl` persists actual authority class,
owner, status, verifier, and verification time separately from the authority a question expects. A
source can produce `VERIFIED` only when that persisted verification is complete and its class
matches the question.

Every new human publication atomically creates an append-only `JurisdictionClaim`, copies its URL,
quoted evidence, retrieval time, content hash, and model/candidate links into
`JurisdictionClaimEvidence`, and updates `JurisdictionProfile` as the current read projection with
the durable claim ID. Replacing a field creates a new claim linked to the prior claim; it does not
overwrite history. Source authority is re-read and candidate version is checked inside the same
transaction, preventing stale review races. Legacy profile JSON is not assigned fabricated claims
and the county UI labels it `Legacy — provenance unavailable` rather than verified.

The extraction pipeline archives the exact UTF-8 Markdown representation supplied by Jina Reader
and reviewed by the model. It does not mislabel that transformed representation as the original
county HTML or document. Bytes are stored in R2 under a SHA-256 content-addressed key using a
non-overwriting conditional write; a `JurisdictionEvidenceSnapshot` row records every successful
retrieval event, including unchanged content, with adapter, media type, hash, byte length, copied
URL, and retrieval time. R2 integrity is confirmed before database metadata may commit. Because R2
and PostgreSQL cannot share a transaction, a failed database write can leave an unreferenced
deduplicated object, but a database snapshot cannot point to a missing or mismatched object.

New AI candidates must reference the exact snapshot used for extraction. Claim publication
re-reads that pending candidate and snapshot inside the claim transaction and copies the integrity
envelope into `JurisdictionClaimEvidence`; route-supplied snapshot provenance is ignored. Legacy AI
candidates without snapshots fail closed. Direct manual citations remain snapshot-less and
`REVIEWED`.

Every new claim also receives a mutable `JurisdictionClaimFreshness` scheduling projection derived
from the evidence retrieval time, question volatility/risk, and a versioned server policy. The
investor UI fails closed when these dates are absent or stale. Freshness is an operational prompt
to investigate again; it is not evidence that a legal fact is still true. A super-admin may
reconfirm only against a newer snapshot from the same source whose full content hash is unchanged.
That transaction uses an exact freshness version, appends an immutable `JurisdictionClaimReReview`
with copied evidence and authenticated reviewer/time, and advances only the scheduling projection.
Changed evidence must become a replacement or contradiction review. Claims snapshot both risk and
volatility so later question-catalog versions cannot change their schedule. Pre-policy claims are
classified `UNKNOWN`, immediately stale, and cannot be reconfirmed until researched and republished;
the migration does not fabricate evidence or validity. Contradiction handling, researched legacy
migration, and coverage workflows remain part of initiative #296.

Source authority decisions are made only through the super-admin review workflow. Each verify,
reject, or reset action atomically appends a `JurisdictionSourceAuthorityReview` containing the
source URL, office type, content hash, exact source version, evidence URL/explanation, authenticated
reviewer, and server timestamp, then updates `JurisdictionSourceUrl` as the current projection. The
review requires an exact `updatedAt` match so a crawler refresh or concurrent decision forces a new
review. Verification requires an allowed authority class, named owner, and HTTP(S) authority
evidence; discovery method, hostname, office type, AI output, and model confidence never verify a
source. Changing source authority affects future claim reviews only and never rewrites existing
claims.

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

The deterministic database baseline is versioned at `prisma/fixtures/integration-v1.ts`. It owns exactly one tenant through the unique `Tenant.fixtureSet` marker and uses stable IDs for its owner, Volusia parcel/property, tax-lien deal, module, investor profile, event, and task. Null `fixtureSet` always means non-fixture/customer data. Planning is read-only:

```bash
npm run integration:fixtures:plan -- --confirm-environment <METIS_ENVIRONMENT_ID>
```

Database replacement additionally requires the exact fixture-set confirmation:

```bash
npm run integration:fixtures:reset -- --confirm-environment <METIS_ENVIRONMENT_ID> --confirm-fixture metis-e2e-v1
```

Both commands require the full integration preflight and provisioned Clerk fixture identity. Replacement is transactional, records a durable `IntegrationResetRun`, deletes only the tagged tenant plus its explicitly owned email events, and recreates the manifest. It refuses to proceed when R2 document keys, Stripe identifiers, fixture identity drift, or stable-ID conflicts indicate that cross-service cleanup is incomplete. These are lower-level database tools; hosted operators use the cross-service commands below.

The read-only full reset plan discovers the exact deterministic Clerk organization slug, Clerk user external ID, and stable tenant R2 prefix. It returns states and counts without secrets or object keys:

```bash
npm run integration:full-reset:plan -- --confirm-environment <METIS_ENVIRONMENT_ID>
```

Execution also requires the exact fixture set and a reset-only `INTEGRATION_FIXTURE_OWNER_PASSWORD` secret:

```bash
npm run integration:full-reset -- --confirm-environment <METIS_ENVIRONMENT_ID> --confirm-fixture metis-e2e-v1
```

The Clerk Backend API secret must authenticate to an instance ID in `INTEGRATION_ALLOWED_CLERK_INSTANCE_IDS` and outside `PRODUCTION_CLERK_INSTANCE_IDS`; this authenticated check closes the gap left by validating only the publishable-key host. Clerk resources are replaceable only when backend-only metadata exactly matches `metis-fixture:metis-e2e-v1`; a deterministic-name collision without that tag is a hard blocker. The owner is recreated with a deterministic external ID and the new Clerk IDs flow directly into the database fixture, because Clerk IDs are not stable. R2 discovery and deletion are limited independently by both the adapter and orchestrator to `tenants/fixture_metis_e2e_v1_tenant/`; the prefix is re-listed and must be empty before database document rows can be removed. The database transaction also verifies that every prior document key is within that exact prefix and that the prior Clerk IDs match the inspected rotation proof. Stripe identifiers remain a blocker. Every attempt records phase-specific audit failure or one combined success summary, making retries safe after partial external cleanup.

Repository orchestration is implemented, but no hosted mutation is authorized until Vercel/Neon/Clerk administration, allowlisted identities, reset-safe modes, and fixture credentials are independently verified. The first hosted run must begin with the non-mutating plan and be treated as a controlled rehearsal.

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
