# Metis Platform — Session Status

> **This is the lean session reference.** Full roadmap, vision, and phase history: see `ROADMAP.md`.
> Execution plan for beta: see `BETA-PLAN.md`.
> Last updated: 2026-06-12

---

## Current Phase
**Beta backlog: nearly clear.** Sprints 1–5 of BETA-PLAN.md are done (most were found
already implemented; ten stale GitHub issues closed 2026-06-12). Security audit (#24)
complete and fixed. Remaining: Sprint 6 AI features (#25/#26, ON HOLD per user) and
post-beta module UIs (#39–43).

---

## Last Session — What Was Done (2026-06-12)

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

**Infra fixed (not in code):**
- `DATABASE_URL` GitHub Actions secret was NEVER set — created it 2026-06-12.
- Issue triage: #84 #85 #86 #64 #65 #31 #29 #17 #18 #10 closed as already-implemented.

---

## Next Up — see BETA-PLAN.md for full detail

1. **#133-P2** — live strategy templates (tax lien / deed / foreclosure). Template content requires user review before merge — auto-mode will draft, push-notify, and wait.
2. **#39-P1** Land MVP (after #133 complete)
3. **Sprint 6 — AI (ON HOLD, await user go-ahead):** #25 document extraction · #26 Deal Copilot
4. **Post-beta:** module UIs #40–43

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
