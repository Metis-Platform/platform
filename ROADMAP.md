# Metis Platform — Build Roadmap

> **Last Updated:** 2026-05-29
> **Status:** Phase 1D — Alerts, CSV Import, Document Upload (next up)
> **Source of Truth:** This file (phase-level) + GitHub Issues (task-level backlog and bugs)
> **Backlog:** https://github.com/Metis-Platform/platform/issues
> **Milestones:** Phase 1 (#1) · Phase 2 (#2)

---

## Vision

An AI-powered, multi-tenant SaaS platform for real estate investors. A universal deal and property management engine with pluggable investment strategy modules — starting with tax liens, expanding to wholesale, fix & flip, buy & hold, land, and multifamily. The AI layer handles document extraction, deadline enforcement, deal analysis, and an in-app Deal Copilot assistant.

**Tagline:** *The AI-powered real estate investment command center.*

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
    ├── API Routes (tRPC or REST endpoints)
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
| `Deal_TaxLien` | Extension: cert #, interest rate, redemption expiry |
| `Deal_FixFlip` | Extension: rehab budget, ARV, contractor |
| `Deal_Wholesale` | Extension: assignment fee, buyer CRM |
| `Event` | Rule-derived milestone (RedemptionEnd, NoticeDue, etc.) |
| `Task` | Operational action tied to Event or Deal |
| `FinancialTransaction` | Purchase cost, redemption, legal fees — ROI source |
| `Document` | File reference (R2), linked to Lien or Event |
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

**Key learnings (Prisma 7 + Next.js 16):**
- Next.js 16 uses `proxy.ts` not `middleware.ts` for Clerk
- Prisma 7 removed `url` from `schema.prisma` and zero-arg `PrismaClient()` — requires driver adapter at runtime
- Use `PrismaNeon({ connectionString })` from `@prisma/adapter-neon`
- Build script must include `prisma generate` since `app/generated/` is gitignored
- Prisma Studio has stream errors with Neon serverless adapter (cosmetic, data still accessible)
- Clerk default sign-up collects email only — enable first/last name in Clerk dashboard

**Deliverable:** ✅ Users can sign up, create their org, reach a protected dashboard. Tenant + User rows in Neon confirmed.

---

### Phase 1 — Core MVP: Tax Lien Module
**Status: 1B ✅ Complete | 1C next**

#### 1A — Data Model
**Status: ✅ Complete**
- [x] Full Prisma schema: all core entities + `DealTaxLien` extension (19 tables)
- [x] Migration applied to Neon PostgreSQL
- [x] Seed data: 5 jurisdictions (FL, NJ, IL, AZ, TX) with rules

#### 1B — Rules Engine
**Status: ✅ Complete**
- [x] Rule evaluation service: `generateEventsForDeal(dealId, tenantId) → Event[]`
- [x] Business day + holiday calendar arithmetic (US federal holidays 2024–2035)
- [x] Nightly deadline sweep via `/api/cron/deadline-sweep` (Vercel cron, 06:00 UTC)
- [x] PENDING → OVERDUE status transitions on sweep

**Key learnings (Phase 1B):**
- `PrismaNeon` (WebSocket adapter) needs `neonConfig.webSocketConstructor = ws` in Node.js seed/script contexts (not needed in Vercel runtime)
- `lib/db.ts` must call `dotenv.config()` at module init — ESM hoisting means the singleton is created before script bodies run
- Cron route API endpoints must be explicitly added to Clerk's public routes in `proxy.ts` — they use their own auth (CRON_SECRET), not Clerk sessions
- Vercel Deployment Protection blocks external curl tests of live URLs; Vercel's own cron bypasses it automatically

#### 1C — Core UI
**Status: 1C-A ✅ Complete | 1C-B ✅ Complete | 1C-C next**

**1C-A + 1C-B (Done — PRs #8, #11):**
- [x] Dashboard: portfolio stats + 3 deadline buckets (Overdue / 7-day / 30-day)
- [x] Lien list: table with APN, jurisdiction, cert #, face amount, status chip (Lead/Active/Overdue), next deadline
- [x] Lien detail: certificate info, events timeline with status dots, research links (Google Maps, Bing, NETRonline, Zillow)
- [x] Create lien form: cascading state → county picker, Lead/Active toggle, Zod validation with inline errors
- [x] Edit lien form: pre-populated, regenerates events on issue date change
- [x] Lead/watchlist workflow: pre-bid leads with auction date + max bid; "Won at Auction" converts to active
- [x] Delete lien with confirmation
- [x] 459 jurisdictions seeded: all counties for FL, NJ, IL, AZ, TX
- [x] InvestmentType: LIEN / DEED / REDEEMABLE_DEED
- [x] Nav: Dashboard / Liens links in layout

**1C-C (Done — PR #14):**
- [x] Calendar view: monthly grid, events color-coded by urgency
- [x] Task board: Open/In Progress/Completed tabs, status toggle, priority badges
- [x] Calendar + Tasks added to nav

**Known enhancements filed as backlog issues:**
- #29 Calendar month/year picker with 12-month overview
- #30 Calendar sync (Google Calendar, Outlook, iCal)
- #31 Tasks on calendar with distinct color
- #32 Full task management (create, edit, delete)
- #33 Edit jurisdiction/APN on existing lien

**Key learnings (Phase 1C):**
- Vercel Deployment Protection blocks external curl tests; Vercel's own cron bypasses it automatically
- `useActionState` (React 19) replaces `useFormState`; import from `react` not `react-dom`
- Server actions called from client components: use `.bind(null, extraArg)` to pre-fill extra arguments
- `redirect()` must be outside try/catch in server actions — it throws `NEXT_REDIRECT` internally
- Making Prisma fields nullable is a non-breaking migration (DROP NOT NULL)
- Large data generation (3000+ county names) triggers Anthropic content filter — write via file tools, not inline output
- Content filter applies to sub-agent output too; write data files directly via Write tool instead

#### 1D — Alerts, Import & Documents
**Status: Next up — Issues #19, #20, #21**
- [ ] Email alerts via Resend: daily digest + urgent same-day (#19)
- [ ] CSV import: per-jurisdiction template, server validation, bulk event generation (#20)
- [ ] Document upload: drag-and-drop to R2, linked to lien or event (#21)

**Deliverable:** Fully usable tax lien tracker. You can manage a real portfolio with it.

---

### Phase 2 — AI Layer
**Target: 4–6 weeks | Status: Not started**

#### 2A — Document Extraction (The Killer Feature)
- [ ] Upload certificate → Claude API extracts cert #, parcel, amounts, dates, jurisdiction, owner
- [ ] Auto-populates `Deal_TaxLien` fields with review + confirm step
- [ ] Extend to: purchase contracts, redemption notices, deeds, title reports, leases
- [ ] Confidence scoring per field; user can override

#### 2B — Deadline Intelligence
- [ ] Plain-English summaries of upcoming obligations per lien
- [ ] "At-risk" lien flagging with natural language reasoning
- [ ] Draft generation: AI generates required notice letters pre-populated with deal data

#### 2C — Deal Copilot (In-App Chat)
- [ ] Chat interface scoped to tenant's live data (RAG over deals + documents)
- [ ] Answers: "What's my most urgent deadline?", "Draft the foreclosure letter for lien #4521", "What's my portfolio ROI this quarter?"
- [ ] Claude API + structured deal data context

#### 2D — Automated Reports
- [ ] Portfolio summary PDF (branded, Metis header)
- [ ] Per-deal due diligence report
- [ ] ROI analysis: cost basis vs redemption vs projected
- [ ] Export-ready for attorneys, partners, lenders

**Deliverable:** Upload a certificate, have it auto-parsed. Chat with an assistant that knows your portfolio. This is a premium product.

---

### Phase 3 — SaaS Infrastructure
**Target: 4–5 weeks | Status: Not started**

#### 3A — Multi-Tenant Hardening
- [ ] Row-level tenant isolation audit (every Prisma query scoped to `tenantId`)
- [ ] Tenant onboarding flow: create org → invite teammates → assign roles
- [ ] Roles: Owner, Analyst, Attorney, Assistant, Read-Only

#### 3B — Billing (Stripe)
| Tier | Price | Limits |
|------|-------|--------|
| Starter | $39/mo | 1 user, 10 active deals, AI pay-as-you-go |
| Professional | $99/mo | 3 users, unlimited deals, AI included |
| Team | $249/mo | 10 users, automations, advanced AI |
| Enterprise | Custom | White-label, API access, bulk ingestion |

- [ ] Stripe subscriptions + webhook handlers
- [ ] Usage metering for Claude API tokens above plan limits
- [ ] 14-day free trial, no card required
- [ ] Self-serve upgrade / downgrade / cancel

#### 3C — Operations
- [ ] Super-admin dashboard (tenant health, MRR, usage)
- [ ] Feature flags per plan tier
- [ ] In-app support (Crisp — free tier)
- [ ] Sentry error monitoring
- [ ] Uptime monitoring

**Deliverable:** Production SaaS. Strangers can discover, sign up, pay, and use independently.

---

### Phase 4 — Module Expansion
**Target: Ongoing after Phase 3 | Build in priority order below**

Prerequisite before any new module: Issue #34 (module-aware dashboard architecture)

| Priority | Module | Issue | Key Differentiator | Effort |
|----------|--------|-------|-------------------|--------|
| 1 | **Tax Deed** | #37 | 80% built — same rules engine, same audience as liens | Very Low |
| 2 | **Foreclosure Auction** | #38 | Calendar + research links already built, overlaps lien audience | Low |
| 3 | **Land Investing** | #39 | Underserved market, no dedicated tools, research infra ready | Low-Med |
| 4 | **Wholesale** | #40 | High deal velocity, CRM-like pipeline, large market | Medium |
| 5 | **Fix & Flip** | #41 | Rehab budget, contractor mgmt, ARV calc, Gantt timeline | High |
| 6 | **Buy & Hold + Section 8** | #42 | Section 8 HAP/HQS tracking is unique differentiator | High |
| 7 | **Multifamily** | #43 | T12 importer, DSCR modeling, highest price point | High |

**Research Links Framework (Issue #44) — build before or alongside module expansion:**
Each deal type gets tiered research links:
- Tier 1 Universal: Google Maps, Bing, Zillow, NETRonline (already built)
- Tier 2 Strategy-specific: auction sites, comps tools, due diligence resources per strategy
- Tier 3 Jurisdiction-specific: stored in Jurisdiction.links JSON (assessor, GIS, tax collector)
- Tier 4 User-defined: custom links per deal (attorney portal, Dropbox, etc.)

---

### Phase 5 — Go-to-Market
**Starts parallel with Phase 2 — don't wait for Phase 3**

**Beta Recruitment**
- Post in BiggerPockets, Tax Lien Lady community, TaxSaleResources forums, Facebook groups
- Target: 15–25 beta users before Phase 3 is done
- Pitch: "Building an AI platform that auto-tracks lien deadlines and reads your certificates. Want free early access?"

**Build in Public**
- Document the build on LinkedIn / X
- Short demos of AI extraction and Deal Copilot — visual and shareable

**Content**
- Blog / YouTube: "How to never miss a tax lien deadline", "What PropStream doesn't tell you"
- SEO targets: tax lien tracking software, lien deadline management

**Launch**
- Product Hunt at v1.0 (after Phase 3)
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
- **You (Product Owner):** Define what the system should do. Prioritize features. Validate workflows. Own the vision. Review and approve all changes.
- **FleetView (Claude):** Strategic orchestration, architectural decisions, cross-file analysis, roadmap updates, WSL commands, web research.
- **Claude Code for VS Code:** In-context coding, terminal commands, editing while actively developing.
- **GitHub Issues:** Every feature, bug, and task tracked as an issue. This is the system of record.

### Workflow
1. Break phases into GitHub Issues (one feature per issue, clear acceptance criteria)
2. FleetView or Claude Code for VS Code implements per issue
3. You review, test, and merge
4. Close the issue, open the next one

### Principles (from Karpathy guidelines)
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
