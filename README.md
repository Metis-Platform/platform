# Metis Platform

AI-powered, multi-tenant SaaS for real estate investors. Starts as a tax lien lifecycle management tool and expands to cover all major REI strategies — wholesale, fix & flip, buy & hold, land, multifamily.

**Live at:** [metisplatforms.com](https://metisplatforms.com)

---

## What it does

- **Lifecycle tracking** — rule-based deadline enforcement per jurisdiction; nightly sweep flags overdue events
- **Strategy modules** — Tax Lien, Tax Deed, Foreclosure, Land, Wholesale, Fix & Flip, Buy & Hold, Multifamily
- **AI layer** — document extraction (certificates, deeds, SOW, offering memoranda), Deal Copilot chat, exit strategy engine
- **Due diligence** — strategy-aware checklist templates, deal-scoped instances, task generation from gaps
- **Jurisdiction intelligence** — county-level statutory data, auction feeds, provenance-rich profiles
- **Parcel intelligence** — APN normalization, parcel data pipeline, GIS/zoning, exit evaluators

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (TypeScript, App Router) |
| Database | Neon (PostgreSQL serverless) via Prisma 7 |
| Auth | Clerk v7 (multi-tenant, org-based) |
| AI | Anthropic Claude API (BYOK per tenant) |
| Storage | Cloudflare R2 |
| Email | Resend |
| Payments | Stripe |
| Deployment | Vercel (auto-deploy on merge to `main`) |

---

## Development setup

Use Node 20 (pinned in `.nvmrc`) and one of the supported hosts: native macOS/Linux,
WSL, GitHub Codespaces, or the tracked dev container. From a fresh clone:

```bash
npm run bootstrap
npm run env:check
npm run context:check
```

`bootstrap` installs the locked dependencies and creates a local `.env.local` template only
when one is absent. It never copies secrets. Provision a machine-specific, non-production
credential set through the approved secret manager, then run the verification commands below.
Do not point local development at the future customer-production environment.

```bash
npx prisma validate
npx prisma generate
npm test -- --run
npx tsc --noEmit
npm run lint
npm run build
```

The dev container supplies Node 24, Git, and the PostgreSQL client. It intentionally does not
embed credentials or a database: development must use approved isolated QA services.

## Deploy model

Every merge to `main` triggers:
1. GitHub Action runs `prisma migrate deploy` (schema changes only)
2. Vercel builds and deploys to `metisplatforms.com`

No manual deploys. Preview deployments are build/read-only proof until they are connected to the
isolated QA services required by #289; they are not a mutation test environment today.

---

## Agent / AI developer notes

Start with [`CONTEXT.md`](CONTEXT.md), which maps every kind of project information to its canonical source and defines the portable session handoff.

See [`CLAUDE.md`](CLAUDE.md) for full behavioral guidelines, architectural rules, code conventions, and session protocol.

See [`ACTIVE-SPRINT.md`](ACTIVE-SPRINT.md) for the current implementation queue.

See [`STRATEGY.md`](STRATEGY.md) for product vision and [`PHASE-HISTORY.md`](PHASE-HISTORY.md) for phase history.

See [`docs/CROSS-MACHINE-WORKFLOW.md`](docs/CROSS-MACHINE-WORKFLOW.md) when moving work between WSL and macOS.

See [`docs/PLATFORM-ASSESSMENT-2026-07-13.md`](docs/PLATFORM-ASSESSMENT-2026-07-13.md) for the evidence-backed current-state assessment and priority order.

See [`docs/RELEASE-WORKFLOW.md`](docs/RELEASE-WORKFLOW.md) for required production gates and the emergency procedure.

---

## Environment variables

Copy `.env.example` to `.env.local` and fill in values. Required variables are documented there — never commit real values.

All runtime env vars must also be set in Vercel Dashboard → Project → Settings → Environment Variables.
