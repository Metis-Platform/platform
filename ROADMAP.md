# Metis Platform — Build Roadmap

> **Last Updated:** 2026-06-15
> **Status:** Beta/Admin/AI/strategy modules complete — post-beta initiatives #131 and #229 active
> **Current execution:** `ACTIVE-PLAN.md` + Linear METIS project
> **Product/project source of truth:** Linear (METIS / Metis Platforms)
> **Engineering proof:** GitHub PRs, CI, deployments, merged code
> **Historical trackers:** `BETA-PLAN.md` and `ADMIN-PLAN.md` are complete/archive docs

---

## Active Post-Beta Initiatives

The historical phase roadmap below remains useful for context, but active execution has moved to:

1. **#131 Jurisdiction Intelligence Layer** — county/statutory/data moat, provenance-rich profiles, admin extraction/review, investor jurisdiction surfaces, checklist generation.
2. **#229 Parcel Intelligence + Exit Strategy Engine** — parcel profile, APN normalization, zoning/parcel data, exit evaluators, data-gap chips, and investor-facing exit-option guidance.

Use `ACTIVE-PLAN.md` for the ordered PR-sized queue. Use Linear for product status and GitHub for implementation evidence.

---

## Vision

An AI-powered, multi-tenant SaaS platform for real estate investors. A universal deal and property management engine with pluggable investment strategy modules — starting with tax liens, expanding to wholesale, fix & flip, buy & hold, land, and multifamily. The AI layer handles document extraction, deadline enforcement, deal analysis, and an in-app Deal Copilot assistant.

**Tagline:** *The AI-powered real estate investment command center.*

---

## North Star & Goalposts

**Ultimate goal: become THE definitive main hub for real estate investors — replace their
spreadsheets entirely and drastically simplify the process they deal with.** The platform
will be lucrative only on the back of legitimate products; revenue follows capability,
never precedes it. Every roadmap decision is tested against these goalposts:

1. **Spreadsheet-replacement test.** A module ships when an investor can retire the
   spreadsheet it replaces — computed-not-typed economics, money ledgers, generated
   checklists — not when it offers data entry *beside* the spreadsheet. (#132 financial
   core, #43 Phase 1 calc engine are the pattern.)
2. **Legitimate product before premium price.** Pricing tiers unlock only when shipped
   capability earns them — the spec, not market sizing, earns the price point. Concrete
   instance: MF premium ($500–2000/mo) is gated on #43 Phase 4 legs 1–2 shipping
   (market data + AI underwriting). Generalize this gate to every module tier (#130).
3. **Modular buy-in.** Investors adopt strategy by strategy (#130 entitlements); each
   module must be independently valuable on day one of its purchase.
4. **Data moat.** Jurisdiction/county depth (#131) and the investor's own portfolio
   history (ledger, outcomes, realized returns) are the defensible assets no
   spreadsheet or incumbent replicates.
5. **Simplification is the metric.** Measure releases by investor process steps removed
   (deadlines auto-tracked, DD auto-checklisted from #133, documents auto-extracted,
   reports auto-generated) — not by feature count.
6. **Platform primitives, not module one-offs.** Ledger (#132), checklist engine (#133),
   Contact CRM, import pipeline, computed-economics library: build once, every strategy
   benefits — including retrofits to the live lien/deed/foreclosure modules.

---

## What Makes This Different

| Feature | PropStream | FastLien | Tax Sale Resources | Metis |
|---------|-----------|---------|-------------------|-------|
| Rule-based lifecycle tracking | No | Partial | Partial | Yes — core |
| AI document extraction | No | No | No | Yes |
| Jurisdictional deadline logic | No | Manual | Partial | Yes — automated |
| Foreclosure workflow | No | No | No | Yes |
| Multi-strategy (lien, flip, wholesale, etc.) | No | No | No | Yes |
| In-app AI assistant | No | No | No | Yes |
| Multi-tenant SaaS | No | Yes | Yes | Yes |

---

## Tech Stack (Free / Zero-Cost to Launch)

All services below have generous free tiers. Migration to paid tiers only when customer scale demands it.

| Layer | Service | Free Tier Limit | Upgrade Path |
|-------|---------|----------------|-------------|
| Framework | Next.js 14+ (TypeScript) | Free / OSS | N/A |
| Database | **Neon** (PostgreSQL, serverless) | 0.5 GB, unlimited branches | Neon paid ~$19/mo |
| ORM | **Prisma** | Free / OSS | N/A |
| Auth | **Clerk** | 10,000 MAU free | Clerk Pro ~$25/mo |
| AI | **Anthropic Claude API** | Pay-per-use (~$0.003/1K tokens) | Volume discounts at scale |
| Background Jobs | **pg-boss** (runs in Postgres) | Free — no extra service | N/A |
| File Storage | **Cloudflare R2** | 10 GB, 1M ops/mo | $0.015/GB/mo |
| Email / Alerts | **Resend** | 3,000 emails/mo | Resend Pro ~$20/mo |
| Payments | **Stripe** | Free to set up (2.9% + $0.30/txn) | N/A |
| Deployment | **Vercel** (Hobby tier) | Free, 100 GB bandwidth | Vercel Pro $20/mo |
| Monitoring | **Sentry** | 5,000 errors/mo free | Sentry Team ~$26/mo |
| Repo / CI | **GitHub** (org already set up) | Free for public, Actions 2K min/mo | GitHub Team $4/user/mo |
| Local Dev DB | **Docker** (PostgreSQL in WSL) | Free | N/A |

**Total launch cost: ~$0** (only Claude API usage billed as users interact with AI features)

---

## Platform Architecture

```
Browser (Next.js App Router)
    │
    ├── App Routes (pages, layouts, UI components)
    │
    ├── API Routes (REST endpoints)
    │        │
    │        ├── Core Services (deal, property, contact, document)
    │        ├── Rules Engine (deadline calculation per jurisdiction)
    │        ├── AI Service (Claude API: extraction, copilot, reports)
    │        └── Auth Middleware (Clerk — tenant-scoped)
    │
    ├── Background Jobs (pg-boss in Neon PostgreSQL)
    │        ├── Nightly deadline evaluator
    │        ├── Alert dispatcher (Resend)
    │        └── ETL importers (county data feeds)
    │
    └── Storage
             ├── Neon PostgreSQL (relational data)
             └── Cloudflare R2 (documents, uploads)
```

---

## Core Data Model (Summary)

Extension table pattern — each strategy adds its own table extending the core `Deal`.

| Entity | Purpose |
|--------|---------|
| `Tenant` | Account boundary for multi-tenant isolation |
| `User` | Belongs to Tenant, has Role |
| `Jurisdiction` | State + County, timezone, lien vs deed flag |
| `RuleSet / Rule` | Deadline logic per jurisdiction |
| `Property` | Address, APN, attributes |
| `Contact` | Owner, attorney, agent |
| `Deal` | Universal container: StrategyType, Status, dates, financials |
| `DealTaxLien` | Extension: cert #, interest rate, redemption expiry |
| `DealTaxDeed` | Extension: sale date, winning bid, redemption deadline |
| `DealForeclosure` | Extension: foreclosure type, auction date, bids, redemption deadline |
| `Deal_FixFlip` | Extension: rehab budget, ARV, contractor (Phase 4) |
| `Deal_Wholesale` | Extension: assignment fee, buyer CRM (Phase 4) |
| `Event` | Rule-derived milestone (RedemptionEnd, NoticeDue, etc.) |
| `Task` | Operational action tied to Event or Deal |
| `FinancialTransaction` | Purchase cost, redemption, legal fees — ROI source |
| `Document` | File reference (R2), linked to Deal or Event |
| `AuditLog` | Every state change, timestamps, user |

---

## Phase Roadmap

### Phase 0 — Foundation
**Status: ✅ Complete**

- [x] WSL dev environment: nvm → Node.js 20+
- [x] GitHub: `platform` repo live under Metis-Platform org (public)
- [x] Scaffold: Next.js 16.2.6, React 19, Tailwind v4, TypeScript, App Router
- [x] Prisma 7 + Neon PostgreSQL (serverless adapter — PrismaNeon)
- [x] Clerk v7 auth (sign up, sign in, org creation, protected routes)
- [x] Neon connected, initial migration applied (19 tables)
- [x] Vercel connected to `main` branch (auto-deploy on merge)
- [x] CLAUDE.md + AGENTS.md live in repo
- [x] `proxy.ts` Clerk middleware (Next.js 16 pattern)
- [x] Tenant + User sync on first dashboard visit

---

### Phase 1 — Core MVP: Tax Lien Module
**Status: ✅ Complete — PRs #8, #11, #14, #49, #51, #52, #54**

#### 1A — Data Model ✅
- [x] Full Prisma schema: all core entities + `DealTaxLien` extension (19 tables)
- [x] Migration applied to Neon PostgreSQL
- [x] Seed data: 5 jurisdictions (FL, NJ, IL, AZ, TX) with rules

#### 1B — Rules Engine ✅
- [x] Rule evaluation service: `generateEventsForDeal(dealId, tenantId) → Event[]`
- [x] Business day + holiday calendar arithmetic (US federal holidays 2024–2035)
- [x] Nightly deadline sweep via `/api/cron/deadline-sweep` (Vercel cron, 06:00 UTC)
- [x] PENDING → OVERDUE status transitions on sweep

#### 1C — Core UI ✅
- [x] Dashboard: portfolio stats + 3 deadline buckets (Overdue / 7-day / 30-day)
- [x] Deal list: table with APN, jurisdiction, cert #, face amount, status chip, next deadline
- [x] Deal detail: certificate info, events timeline with status dots, research links
- [x] Create deal form: cascading state → county picker, Lead/Active toggle, Zod validation
- [x] Edit deal form: pre-populated, regenerates events on issue date change
- [x] Lead/watchlist workflow: pre-bid leads with auction date + max bid; "Won" converts to active
- [x] Delete deal with confirmation
- [x] 459 jurisdictions seeded: all counties for FL, NJ, IL, AZ, TX
- [x] Calendar view: monthly grid, events color-coded by urgency
- [x] Task board: Open/In Progress/Completed tabs, status toggle, priority badges

#### 1D — Alerts, Import & Documents ✅
- [x] Deal list filtering and sorting: search, status tabs, state dropdown, sortable headers
- [x] Document upload: drag-and-drop to Cloudflare R2, presigned URLs, delete
- [x] CSV import: template download, two-step preview+confirm, per-row validation, bulk event gen
- [x] Email alerts via Resend: daily digest (07:00 UTC cron) per tenant

**Backlog issues (Phase 1D follow-up):**
- #60 ✅ Bug: New Lien form broken (force-dynamic fix — PR #66)
- #61 Feature: Lead-first creation — enforce lifecycle, remove Active toggle from new form
- #62 Feature: NOT_WON status — track auction losses for future revisit
- #63 Feature: Import error download report — CSV of failed rows
- #64 Feature: XLS/XLSX import support (SheetJS)
- #65 Feature: Import accepts optional status column

**Deliverable:** ✅ Fully usable tax lien tracker. Manage a real portfolio with it.

---

### Phase 2 — AI Layer
**Target: After Phase 4-partial | Status: Deliberately deferred — now unblocked**

**Why deferred:** AI features require paying users and real portfolio data to deliver value.
Billing now exists (Phase 3). Phase 4-partial is complete. This is the next major phase.

**GitHub Issues:** #25 (document extraction), #26 (Deal Copilot)

#### 2A — Document Extraction
- [ ] Upload certificate → Claude API extracts cert #, parcel, amounts, dates, jurisdiction, owner
- [ ] Auto-populates deal fields with review + confirm step
- [ ] Extend to: purchase contracts, redemption notices, deeds, title reports, leases
- [ ] Confidence scoring per field; user can override

#### 2B — Due Diligence + Deadline Intelligence
- [ ] Due Diligence Engine MVP defined in [docs/due-diligence-engine-mvp.md](docs/due-diligence-engine-mvp.md)
- [ ] Knowledge Library MVP defined in [docs/knowledge-library-mvp.md](docs/knowledge-library-mvp.md)
- [ ] Strategy-aware checklist templates for tax lien, tax deed, foreclosure, and land deals
- [ ] Deal-scoped checklist instances with required gaps, concerns, blockers, and task generation
- [ ] Source-backed guidance surfaced from the knowledge library on deals, jurisdictions, and diligence items
- [ ] Plain-English summaries of upcoming obligations per deal
- [ ] "At-risk" deal flagging with natural language reasoning
- [ ] Draft generation: AI generates required notice letters pre-populated with deal data

#### 2C — Deal Copilot (In-App Chat)
- [ ] Chat interface scoped to tenant's live data (RAG over deals + documents)
- [ ] Answers: "What's my most urgent deadline?", "Draft the foreclosure letter for deal #4521", "What's my portfolio ROI this quarter?"
- [ ] Claude API + structured deal data context

#### 2D — Automated Reports
- [ ] Portfolio summary PDF (branded, Metis header)
- [ ] Per-deal due diligence report
- [ ] ROI analysis: cost basis vs redemption vs projected
- [ ] Export-ready for attorneys, partners, lenders

**Deliverable:** Premium upsell to existing paying customers. Upload a certificate, have it auto-parsed. Chat with an assistant that knows your portfolio.

---

### Phase 3 — SaaS Infrastructure
**Status: ✅ Complete — PRs #57, #58, #59, #70**

#### 3A — Multi-Tenant Hardening ✅ (PR #58)
- [x] Row-level tenant isolation audit (every Prisma query confirmed scoped to `tenantId`)
- [x] Roles: Owner, Analyst, Attorney, Assistant, Read-Only
- [x] Role enforcement: `lib/auth.ts` — `getCurrentUser()`, `hasRole()` hierarchy
- [x] Invite by email via Clerk org invitations
- [x] `/dashboard/settings/team`: member list, role selector (owners only), invite form
- [x] Destructive actions (delete deal) require ANALYST or above

#### 3B — Billing (Stripe) ✅ (PR #57, #74)
| Tier | Price | Limits |
|------|-------|--------|
| Starter | $39/mo | 1 user, 10 active deals, AI pay-as-you-go |
| Professional | $99/mo | 3 users, unlimited deals, AI included |
| Team | $249/mo | 10 users, automations, advanced AI |
| Enterprise | Custom | White-label, API access, bulk ingestion |

- [x] Stripe subscriptions + webhook handlers
- [x] 14-day free trial, no card required
- [x] Self-serve upgrade / downgrade / cancel via Stripe billing portal
- [x] `/dashboard/billing`: plan cards + manage subscription link
- [x] Webhook syncs plan tier back to `Tenant.plan` on subscription events
- [x] Schema: `stripeCustomerId`, `stripeSubscriptionId`, `stripeSubscriptionStatus`, `trialEndsAt`, `currentPeriodEnd` on Tenant

#### 3C — Operations ✅ (PR #59, #70)
- [x] Super-admin dashboard at `/admin`: tenant list, MRR/ARR, plan override
- [x] `SUPER_ADMIN_EMAILS` env var gates access
- [x] `GET /api/health`: DB ping for uptime monitors
- [ ] Feature flags per plan tier (deferred — not yet implemented)
- [ ] In-app support (Crisp — deferred)
- [ ] Sentry error monitoring (deferred — initial attempt broke builds; needs proper setup with `withSentryConfig`)

**Key learnings (Phase 3):**
- `new Stripe(key)` at module level crashes Vercel build when `STRIPE_SECRET_KEY` is missing — Next.js evaluates module-level code during "Collecting page data" phase even for dynamic routes. Always use a lazy getter: `getStripe()`.
- `@sentry/nextjs` without `withSentryConfig` in `next.config.ts` breaks Vercel builds. Add it properly or skip it entirely — half-setup is worse than no setup.
- After adding Stripe to the codebase, `STRIPE_SECRET_KEY` (and price IDs) must be set in Vercel env vars or the build will fail.
- PR body heredocs don't work in `wsl bash -c` — write to a temp file and pass `--body-file`.

**Deliverable:** ✅ Production SaaS. Users can sign up, pay, and use independently.

---

### Phase 4 — Module Expansion
**Target: Ongoing | Phase 4-partial ✅ Complete**

**Phase 4-partial (Tax Deed + Foreclosure) is done. Next: Phase 2 (AI), then Phase 4-full.**

#### Phase 4-partial ✅ Complete

- [x] **#34 Module-aware dashboard** (PR #67) — `StrategyNav` switcher, `?strategy=` URL param, all pages filter by active module
- [x] **#37 Tax Deed module** (PR #67) — `DealTaxDeed` schema + migration, GA jurisdictions seeded, create/detail UI, `createDeed` server action
- [x] **#38 Foreclosure Auction module** (PR #68) — `DealForeclosure` schema + migration, `createForeclosure` server action, research links (Auction.com, RealtyTrac, HUD)
- [x] **#32 Full task management** (PR #69) — create, edit, delete from task board; deal picker; task type selector
- [x] **URL restructure** (PR #73) — all deal pages moved from `/dashboard/liens/` to `/dashboard/deals/`; strategy-agnostic path

**Module switcher strategies:** Tax Liens | Tax Deeds | Foreclosures
**Deal routes:** `/dashboard/deals?strategy=TAX_LIEN|TAX_DEED|FORECLOSURE`

#### Phase 4-full (After Phase 2)

| Priority | Module | Issue | Key Differentiator | Effort |
|----------|--------|-------|-------------------|--------|
| 3 | **Land Investing** | #39 | Underserved market, no dedicated tools | Low-Med |
| 4 | **Wholesale** | #40 | High deal velocity, CRM-like pipeline | Medium |
| 5 | **Fix & Flip** | #41 | Rehab budget, contractor mgmt, ARV calc | High |
| 6 | **Buy & Hold + Section 8** | #42 | Section 8 HAP/HQS tracking | High |
| 7 | **Multifamily** | #43 | T12 importer, DSCR modeling | High |

**Remaining backlog issues:**
- #33 Edit jurisdiction/APN on existing deal
- #29 Calendar month/year picker
- #30 Calendar sync (Google Calendar, Outlook, iCal)
- #31 Tasks on calendar with distinct color
- #44 Research links framework — tiered system

---

### Phase 5 — Go-to-Market
**Starts parallel with Phase 2 — don't wait**

**Beta Recruitment**
- Post in BiggerPockets, Tax Lien Lady community, TaxSaleResources forums, Facebook groups
- Target: 15–25 beta users
- Pitch: "Building an AI platform that auto-tracks lien deadlines and reads your certificates. Want free early access?"

**Build in Public**
- Document the build on LinkedIn / X
- Short demos of AI extraction and Deal Copilot — visual and shareable

**Content**
- Blog / YouTube: "How to never miss a tax lien deadline", "What PropStream doesn't tell you"
- SEO targets: tax lien tracking software, lien deadline management

**Launch**
- Product Hunt at v1.0 (after Phase 3 — now ready)
- Direct outreach to tax lien attorneys (they have portfolio clients)
- Integration partnerships: GovEase, Bid4Assets

**Revenue Targets**

| Milestone | Users | Avg Rev/User | MRR |
|-----------|-------|-------------|-----|
| Month 7 (Phase 3 done) | 50 paid | $75 | ~$3,750 |
| Month 12 | 200 paid | $85 | ~$17,000 |
| Month 18 | 500 paid | $100 | ~$50,000 |

---

## Operating Model

### Roles
- **You (Product Owner):** Define what the system should do. Prioritize features. Validate workflows. Own the vision.
- **FleetView (Claude):** Strategic orchestration, architectural decisions, cross-file analysis, roadmap updates, WSL commands.
- **Claude Code for VS Code:** In-context coding, terminal commands, editing while actively developing.
- **GitHub Issues:** Every feature, bug, and task tracked as an issue. System of record.

### Workflow
1. Break phases into GitHub Issues (one feature per issue, clear acceptance criteria)
2. FleetView or Claude Code implements per issue
3. Review, test, merge
4. Close the issue, open the next one

### Principles
1. **Think before coding** — surface assumptions and tradeoffs before implementing
2. **Simplicity first** — minimum code that solves the problem, nothing speculative
3. **Surgical changes** — touch only what the issue requires
4. **Goal-driven execution** — define verifiable success criteria, loop until met

---

## Key Decisions (ADRs)

| ADR | Decision | Rationale |
|-----|---------|-----------|
| 001 | Local WSL as primary dev environment | Faster feedback, zero cost, full control |
| 002 | GitHub as system of record | Protects against tool/platform churn |
| 003 | Free-tier services only until customer scale demands upgrade | Keep burn at $0 until MRR justifies it |
| 004 | Next.js + Prisma + Neon + Clerk (not .NET/Azure) | WSL-native, Claude Code optimized, faster to ship |
| 005 | Extension table pattern for strategy modules | Clean domain model, no bloat, easy to add modules |
| 006 | Claude API for all AI features | Best-in-class extraction + reasoning, pay-per-use cost model |
| 007 | `/dashboard/deals` as strategy-agnostic deal route | Tax Liens, Deeds, and Foreclosures are all "deals" — path reflects this |
| 008 | Stripe client lazy-initialized via `getStripe()` | Module-level `new Stripe()` crashes Vercel build when env var is absent |
