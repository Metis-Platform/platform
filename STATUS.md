# Metis Platform — Session Status

> **This is the lean session reference.** Full roadmap, vision, and phase history: see `ROADMAP.md`.
> Execution plan for beta: see `BETA-PLAN.md`.
> Last updated: 2026-06-11

---

## Current Phase
**Phase 4 module groundwork: complete.** Extension schemas + deal-list columns shipped for all
6 strategies (PRs #111–#121). Now executing `BETA-PLAN.md` — driving the open backlog to zero
for beta launch.

---

## Last Session — What Was Done

| PR | Description | Status |
|----|-------------|--------|
| #111–#120 | Module expansion: Buy & Hold, Multifamily, Wholesale, Land, Fix & Flip schemas + deal-list columns + strategy metadata catalog | ✅ merged |
| #121 | feat: show land access in deal list | ✅ merged |

---

## Next Up — see BETA-PLAN.md for full detail

1. **Sprint 1 — Task UX:** #84 assignee bug · #85 next-action button · #86 tasks on deal detail
2. **Sprint 2 — Import:** #64 XLS/XLSX · #65 optional status column
3. **Sprint 3 — Calendar:** #31 tasks on calendar · #29 month/year picker
4. **Sprint 4 — Security:** #24 tenant isolation audit (pre-beta gate)
5. **Sprint 5:** #17 task comments (schema) · #18 jurisdiction detail page (#10 = dup)
6. **Sprint 6 — AI:** #25 document extraction · #26 Deal Copilot

---

## Active Strategies (UI complete)
`TAX_LIEN` · `TAX_DEED` · `FORECLOSURE`
(Land, Wholesale, Fix & Flip, Buy & Hold, Multifamily: schema + list columns only)

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
