# Metis Platform — Session Status

> **This is the lean session reference.** Full roadmap, vision, and phase history: see `ROADMAP.md`.
> Execution plan for beta: see `BETA-PLAN.md`.
> Last updated: 2026-06-12

---

## Current Phase
**Post-beta module UIs in progress.** #132, #133-P1, full #39 Land, full #40 Wholesale (P1–P3), #41-P1 and #41-P2 shipped. #133-P2 (live-strategy checklist templates) open awaiting user content review. Next: #41-P3 Fix & Flip economics (ARV ROI, flip P&L, hold time), then #42 Buy & Hold.

---

## Last Session — What Was Done (2026-06-13)

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

**Infra fixed (not in code):**
- `DATABASE_URL` GitHub Actions secret was NEVER set — created it 2026-06-12.
- Issue triage: #84 #85 #86 #64 #65 #31 #29 #17 #18 #10 closed as already-implemented.

---

## Next Up — see BETA-PLAN.md for full detail

1. **#133-P2** — live strategy templates (tax lien / deed / foreclosure). Template content PR #143 open awaiting user review before merge.
2. **#41-P3** Fix & Flip economics: ARV-based ROI, flip P&L (acceptedOfferPrice − purchasePrice − actualRehab − holdingCosts), hold time
3. **#42-P1..P2** Buy & Hold standard (parallel-able with #41-P3)
4. **Sprint 6 — AI (ON HOLD, await user go-ahead):** #25 document extraction · #26 Deal Copilot

---

## Active Strategies (UI complete)
`TAX_LIEN` · `TAX_DEED` · `FORECLOSURE`
(Land: full module UI. Wholesale: full module UI including board + MAO calculator + buyer CRM. Fix & Flip: create/edit, detail section, rehab budget tracker — economics P3 pending. Buy & Hold, Multifamily: schema + list columns only)

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
