# Metis Platform — Session Status

> **This is the lean session reference.** Full roadmap, vision, and phase history: see `ROADMAP.md`.
> Execution plan for beta: see `BETA-PLAN.md`.
> Last updated: 2026-06-13

---

## Current Phase
**Multifamily complete (P1–P3).** #132, #133 (P1+P2), full #39–#43 modules (P1–P3), and #130 Entitlements all shipped. All remaining BETA-PLAN items are gated: premium tier features (#42-P3/#39-P4/#40-P4) need Stripe PREMIUM module purchase flow; #41-P4/#43-P4 need AI (#25/#26 ON HOLD); #131 needs user input.

---

## Last Session — What Was Done (2026-06-13, continued)

| PR | Description | Status |
|----|-------------|--------|
| #174 | feat(#42-P3): Section 8 premium — HAP/HQS/FMR tracking, rent-increase windows, HQS events | ✅ merged |
| #175 | feat(#39-P4): Land note servicing — amortization schedule, payoff quotes, late notices, portfolio dashboard | ✅ merged |
| #176 | chore: tick #42-P3 and #39-P4 in BETA-PLAN | ✅ merged |
| #177 | feat(#40-P4): Wholesale premium — buyer blast campaigns, assignment packet, pipeline analytics | ✅ merged |
| #178 | chore: tick #40-P4 in BETA-PLAN | ✅ merged |

## Previous Session (2026-06-13)

| PR | Description | Status |
|----|-------------|--------|
| #121 | feat: show land access in deal list | ✅ merged |
| #122 | chore: BETA-PLAN.md + STATUS.md refresh | ✅ merged |
| #123 | fix: tenant isolation audit findings — per-tenant User rows (`@@unique([clerkUserId, tenantId])`), role from Clerk org role, cron fail-closed, admin pages gated inline | ✅ merged |
| #124 | fix: package-lock.json sync (xlsx) — migrate Action's npm ci had failed on every run | ✅ merged |
| #125 | ci: workflow_dispatch trigger for migrate workflow | ✅ merged |
| #128 | feat: portfolio hub dashboard (#127) — cross-strategy default view, Your Strategies table, unified deadlines, module discovery cards, Portfolio nav pill, per-strategy value labels | ✅ merged |
| #136 | feat(#132-P1): financial ledger — TransactionType additions, GET/POST/DELETE transactions API, TransactionSection UI, lien retrofit + backfill migration | ✅ merged |
| #137 | feat(#132-P2): economics lib — pure functions (accrued interest, ROI, P&L, cost basis) + vitest + CI workflow | ✅ merged |
| #138 | feat(#132-P3): surface P&L on deal page and portfolio hub Returns column | ✅ merged |
| #139 | fix(tests): use UTC dates in economics tests to fix CI failure | ✅ merged |
| #140 | chore: update BETA-PLAN.md — #132-P3 shipped | ✅ merged |
| #141 | feat(#133-P1): checklist engine — types, registry, idempotent instantiation, progress chip, Generate Checklist button, `Task.checklistKey` migration | ✅ merged |
| #146 | feat(#39-P2): Land seller-finance notes — LandNote model, amortization, PAYMENT_LATE events | ✅ merged |
| #148 | feat(#39-P3): Land disposition funnel — LandDispositionStatus, re-list loop, defaultLandNote | ✅ merged |
| #150 | feat(#40-P1): Wholesale MVP — create/edit flow, WholesaleSection pipeline, INSPECTION_END/CLOSING_DUE events | ✅ merged |
| #152 | feat(#40-P2): Buyer CRM — BuyerProfile, buyer list/add/edit pages, buy-box matching + link/unlink on WholesaleSection | ✅ merged |
| #154 | feat(#40-P3): MAO calculator (collapsible, pre-fills from deal) + wholesale pipeline board (5-column Kanban) | ✅ merged |
| #156 | feat(#41-P1): Fix & Flip MVP — create/edit flow, FixFlipSection detail, REHAB_DUE/LISTING_TARGET/CLOSING_DUE events | ✅ merged |
| #157 | feat(#41-P2): Rehab line-item budget tracker — ScopeOfWork JSON, saveScopeOfWork action, RehabBudgetSection UI | ✅ merged |
| #159 | feat(#41-P3): Fix & Flip economics — flipPnl/flipRoi/holdDays functions + 12 tests + Realized/Projected Returns panel | ✅ merged |
| #161 | feat(#42-P1): Buy & Hold MVP — create/edit flow, BuyHoldSection, LEASE_EXPIRY event | ✅ merged |
| #162 | feat(#42-P2): Rental economics — NOI, cap rate, operating expenses editor (7 categories) | ✅ merged |
| #143 | feat(#133-P2): live strategy checklist templates — tax lien (8 items), tax deed (7 items), foreclosure (6 items) | ✅ merged |
| #164 | feat(#130): entitlements — TenantModule strategy gating, server enforcement, filtered StrategyNav, admin toggle, billing module list | ✅ merged |

**Infra fixed (not in code):**
- `DATABASE_URL` GitHub Actions secret was NEVER set — created it 2026-06-12.
- Issue triage: #84 #85 #86 #64 #65 #31 #29 #17 #18 #10 closed as already-implemented.

---

## Next Up — see BETA-PLAN.md for full detail

**All non-blocked BETA-PLAN items are now complete.** Remaining items are gated:

- `#41-P4` — Fix & Flip premium — needs #25 AI (ON HOLD)
- `#43-P4` — Multifamily premium — needs #25/#26 AI (ON HOLD)
- `#131` — jurisdiction data program — needs user input on data dictionary + Tier 1 counties

Option: Start Stripe premium purchase flow (#130 checkout → PREMIUM tier) to formalize what the admin toggle already enables.

**New pages added this session:**
- `/dashboard/notes` — Land note portfolio analytics
- `/dashboard/analytics` — Wholesale pipeline analytics
- `/dashboard/deals/:id/packet` — Assignment packet export (print)

---

## Active Strategies (UI complete)
`TAX_LIEN` · `TAX_DEED` · `FORECLOSURE`
(Land: full module UI. Wholesale: full module UI including board + MAO calculator + buyer CRM. Fix & Flip: full module UI — create/edit, rehab budget, P&L + ROI. Buy & Hold: full module UI — create/edit, BuyHoldSection, rental expenses, NOI + cap rate. Multifamily: full P1–P3 — underwriting, rent roll editor, T12 CSV import, UNIT_LEASE_END events, value-add plan tracker, investor print view)

## Deal Status Flow
```
LEAD ──→ [Won at Auction] ──→ ACTIVE ──→ REDEEMED / FORECLOSURE_INITIATED / DEEDED / SOLD / CLOSED
     └──→ [Not Won]       ──→ NOT_WON ──→ [Re-list] ──→ LEAD
```

## Data Model (tables)
`Tenant` `User` `Jurisdiction` `RuleSet` `Rule`
`Property` `Contact`
`Deal` + `DealTaxLien` / `DealTaxDeed` / `DealForeclosure` / `DealLand` / `DealWholesale` / `DealFixFlip` / `DealBuyHold` / `DealMultifamily`
`Event` `Task` `FinancialTransaction` `Document` `AuditLog`
`LandNote` `FmrRate` `BuyerProfile` `BuyerBlastSend`

---

## ADRs
| # | Decision |
|---|---------|
| 001 | WSL as primary dev environment |
| 002 | GitHub as system of record |
| 003 | Free tiers only until customer scale demands upgrade |
| 004 | Next.js + Prisma + Neon + Clerk (not .NET/Azure) |
| 005 | Extension table pattern for strategy modules |
| 006 | Claude API for all AI features |
