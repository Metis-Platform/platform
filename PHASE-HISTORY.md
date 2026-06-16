# PHASE-HISTORY.md — Completed Phases

> This file is a historical record of completed phases.
> Current sprint: `ACTIVE-SPRINT.md` | Product strategy: `STRATEGY.md` | Architecture: `ARCHITECTURE.md`

---

## Phase 0 — Foundation ✅ (complete)
Next.js 16, Prisma 7, Neon, Clerk v7, Vercel, Cloudflare R2, Resend, Stripe scaffold. 19-table initial schema. Tenant + User sync on first dashboard visit.

## Phase 1 — Tax Lien Module ✅ (PRs #8, #11, #14, #49, #51, #52, #54, #66)
Full tax lien deal tracker: rules engine, deadline sweep, events timeline, task board, calendar, CSV/XLS import, document upload, email alerts, lead/watchlist workflow, 459 jurisdictions seeded (FL, NJ, IL, AZ, TX).

## Phase 2 — AI Layer ✅ (PRs #213, #214 + checklist engine #133)
Document extraction (lien certs, deeds, SOW, offering memoranda), Deal Copilot chat (RAG over tenant deals), strategy-aware DD checklist engine.

## Phase 3 — SaaS Infrastructure ✅ (PRs #57, #58, #59, #70)
Multi-tenant hardening, role enforcement, Stripe subscriptions (Starter/Pro/Team/Enterprise), 14-day free trial, super-admin dashboard, health endpoint.

## Phase 4-partial — Module Expansion ✅ (PRs #67, #68, #69, #73, #216, #217)
Tax Deed module, Foreclosure module, full task management, strategy-agnostic `/dashboard/deals` route, Fix & Flip AI (SOW extraction + draw package), Multifamily AI (T12, DSCR, sensitivity model, offering memorandum extraction).

## Admin Portal ✅ (PRs #194–#209)
Full founder-grade admin tooling: tenant management + module grants, jurisdiction filtering, platform health dashboard, tenant activity log, communications center (per-tenant email + broadcast + in-app banners), checklist template editor, Stripe module purchase flow, pricing configuration, trial management with daily expiry cron.

## Phase 4-full — Module Depth (Initiative 3, planned after #131 + #229)
Module MVPs shipped across PRs #136–#217: financial ledger (#132), checklist engine (#133), Land (#39), Wholesale (#40), Fix & Flip (#41), Buy & Hold (#42), Multifamily (#43), entitlements (#130). Depth features (Contact CRM, GIS overlays, LP waterfall, unit-level tenant records) are Initiative 3 in `ACTIVE-SPRINT.md`. Specs in `STRATEGY.md`.

## Post-Beta Initiative 1 — Jurisdiction Intelligence Layer ✅ (#131, PRs #262–#267, #272)
All 8 parts complete: JurisdictionProfile schema, 3,141-county seed, NETROnline AI extraction pipeline, auction platform feeds, market signals + scoring, investor research hub, in-deal jurisdiction surfacing, per-deal DD checklist generation. Geographic SVG map (clickable, zoomable, choropleth by investment type) shipped as follow-on UX improvement.

## Post-Beta Initiative 2 — Parcel Intelligence + Exit Strategy Engine ✅ (#229, PRs #262, #265–#266, #268–#271, #273)
All 9 parts complete: parcel profile data model + APN normalization, parcel data sourcing pipeline, zoning data layer + PostGIS GeoService, exit engine core (types/registry/projections/confidence), all 30 exit evaluators across 8 strategy families, JurisdictionFacts Prisma adapter, deal-page Exit Options panel, ExitEvaluation cache + InvestorProfile persistence, admin parcel research service (research-on-demand).

## Initiative 3 — Module Depth (active)
Contact CRM primitive, Land (#39), Wholesale (#40), Fix & Flip (#41), Buy & Hold (#42), Multifamily (#43) depth features. Queue in `ACTIVE-SPRINT.md`.
