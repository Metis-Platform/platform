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

**Infra fixed this session (not in code):**
- `DATABASE_URL` GitHub Actions secret was NEVER set — created it (from .env.local). The migrate
  workflow had failed all 12 runs ever; first green run 2026-06-12 applied **8 pending migrations**
  (task comments, redeemable deed, all 5 strategy extension tables, per-tenant user unique).
- Issue triage: #84 #85 #86 #64 #65 #31 #29 #17 #18 #10 closed as already-implemented (verified in code).
- Linear (team METIS) is a mirror of GitHub; GitHub is record of truth (ADR-002). Linear key:
  `C:\Users\aswit\AppData\Local\hermes\.env`. METIS-11 (Land, In Review) can move to Done (PR #121 merged).

---

## Next Up — see BETA-PLAN.md for full detail

1. **Sprint 6 — AI (ON HOLD, await user go-ahead):** #25 document extraction · #26 Deal Copilot
2. **Post-beta:** module UIs #39–43

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
