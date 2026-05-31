# Metis Platform — Session Status

> **This is the lean session reference.** Full roadmap, vision, and phase history: see `ROADMAP.md`.
> Last updated: 2026-05-31

---

## Current Phase
**Phase 1C — Core UI: complete.**
Phase 1D (Alerts/Import) partially in progress.
Phase 3 (SaaS/Billing) and Phase 4-partial (Foreclosure, Tax Deed) already shipped.

---

## Last Session — What Was Done

| PR | Description | Status |
|----|-------------|--------|
| #79 | fix: task assignee optimistic update + labeled status buttons (#76, #77) | ✅ merged |
| #80 | feat: deal tasks section on detail page (#78) | ✅ merged |
| #81 | feat: lead-first creation + NOT_WON status (#61, #62) — schema migration | ✅ merged |
| #82/#83 | chore: CLAUDE.md migration workflow + file ownership clarifications | ✅ merged |
| #87 | feat: lien edit — allow changing jurisdiction and APN (#33) | ✅ merged |

---

## Next Up (open issues, ordered by effort)

**Import cluster (do together — same file):**
- #63 — Import: downloadable CSV error report
- #65 — Import: optional status column for bulk import
- #64 — Import: XLS/XLSX support

**Calendar improvements (do together — same component):**
- #31 — Calendar: show Tasks with distinct color alongside Events
- #16 — Calendar: week view toggle
- #29 — Calendar: clickable month/year picker

**Other Phase 1:**
- #17 — Task board: add comments to tasks (schema change required)
- #24 — Multi-tenant: row-level isolation audit (security — important before beta)
- #44 — Research links: tiered framework for all strategies
- #23 — Expand county seed to all 50 states

**Phase 2 (AI):**
- #25 — AI document extraction (upload cert → auto-populate fields)
- #26 — Deal Copilot (in-app chat scoped to portfolio)

**Module expansion (Phase 4):**
- #39 Land · #40 Wholesale · #41 Fix&Flip · #42 Buy&Hold · #43 Multifamily

---

## Active Strategies (UI complete)
`TAX_LIEN` · `TAX_DEED` · `FORECLOSURE`

## Deal Status Flow
```
LEAD ──→ [Won at Auction] ──→ ACTIVE ──→ REDEEMED / FORECLOSURE_INITIATED / DEEDED / SOLD / CLOSED
     └──→ [Not Won]       ──→ NOT_WON ──→ [Re-list] ──→ LEAD
```

## Data Model (tables)
`Tenant` `User` `Jurisdiction` `RuleSet` `Rule`
`Property` `Contact`
`Deal` + `DealTaxLien` / `DealTaxDeed` / `DealForeclosure`
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
