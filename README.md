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

## Deploy model

Every merge to `main` triggers:
1. GitHub Action runs `prisma migrate deploy` (schema changes only)
2. Vercel builds and deploys to `metisplatforms.com`

No manual deploys. Vercel preview deployments are the test environment.

---

## Agent / AI developer notes

See [`CLAUDE.md`](CLAUDE.md) for full behavioral guidelines, architectural rules, code conventions, and session protocol.

See [`ACTIVE-SPRINT.md`](ACTIVE-SPRINT.md) for the current implementation queue.

See [`PHASE-HISTORY.md`](PHASE-HISTORY.md) for full product vision and phase history.

---

## Environment variables

Copy `.env.example` to `.env.local` and fill in values. Required variables are documented there — never commit real values.

All runtime env vars must also be set in Vercel Dashboard → Project → Settings → Environment Variables.
