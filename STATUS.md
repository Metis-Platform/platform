# Metis Platform — Session Status

> **Lean session reference.** Full product vision: `ROADMAP.md`. Active implementation queue: `ACTIVE-PLAN.md`.
> Completed historical trackers: `BETA-PLAN.md`, `ADMIN-PLAN.md`.
> Product/project command center: Linear team `METIS` / project `Metis Platforms`.
> Last updated: 2026-06-15

---

## Current Phase
**Post-beta initiative buildout.** Beta, admin portal, Phase 2 AI, strategy modules, Phase 4 AI, entitlements, financial core, and checklist engine are complete. Current active work is tracked in `ACTIVE-PLAN.md` and Linear:

1. **#131 Jurisdiction Intelligence Layer** — county/statutory/data moat; first implementation issue is **#219 / #131-P1 JurisdictionProfile schema**.
2. **#229 Parcel Intelligence + Exit Strategy Engine** — parcel profile + exit-option reasoning; first independent issues are **#230 / #229-P1 ParcelProfile + APN normalization** and **#231 / #229-P4 exit-engine core**.

---

## Latest Repo/Tracker Cleanup (2026-06-15)

| Item | Result |
|------|--------|
| Local repo | Reset to `origin/main` at PR #239, then this cleanup branch created |
| Stale PR #178 | Closed without merging; superseded by later main commits |
| Linear | Reconciled stale completed backlog items and mirrored active GitHub issues #219–#238 |
| Open PRs | None after closing #178 |
| CI | Recent GitHub Actions runs green |

---

## Recently Completed Milestones

| Area | Evidence |
|------|----------|
| Beta plan | Complete through PR #228; `BETA-PLAN.md` now historical/archive |
| Admin portal | Complete through PRs #194–#210; `ADMIN-PLAN.md` now historical/archive |
| AI layer | #25 AI document extraction (PR #213) and #26 Deal Copilot (PR #214) complete |
| Phase 4 AI | #41-P4 Fix & Flip AI (PR #216) and #43-P4 Multifamily AI (PR #217) complete |
| Post-beta planning | `ACTIVE-PLAN.md` added for #131 + #229 in PR #239 |

---

## Next Up

| Priority | GitHub | Linear | Title | Notes |
|----------|--------|--------|-------|-------|
| 1 | #219 | METIS-44 | #131-P1 JurisdictionProfile schema | Foundation for jurisdiction intelligence |
| 2 | #230 | METIS-53 | #229-P1 ParcelProfile + APN normalization | Independent from #219; can run in parallel |
| 3 | #231 | METIS-54 | #229-P4 exit-engine core | Pure TS module; can run in parallel with #230 |

Recommended next agent wave: assign **#219** to one builder, **#230/#231** to a second builder or Codex/Hermes lane after checking schema/type overlap.

---

## Operating Model

- **Linear** = product/project command center: priority, readiness, blockers, active status.
- **GitHub** = engineering proof: branches, PRs, CI, deployment, merged code.
- **ACTIVE-PLAN.md** = repo-local active implementation queue for autonomous/agent sessions.
- **Hermes** = orchestrator/technical lead; Claude Code and Codex are delegated builders/reviewers.

---

## AI Layer — BYOK Architecture (IMPORTANT)

- `Tenant.anthropicApiKey String?` — tenant stores their own key; platform key is **never** used as fallback.
- `lib/ai.ts`: `resolveAnthropicKey(tenantId)` returns user-readable 402 when no key is configured.
- Gating: `Tenant.anthropicApiKey IS NOT NULL` — setting a key is the opt-in. No `TenantModule` needed for AI.
- Missing key returns `settingsUrl: /dashboard/settings/ai`.
- Metis-hosted AI with platform key + token metering is a separate future issue.

## AI extraction routes

| Route | DocType(s) | Target |
|-------|------------|--------|
| `POST /api/ai/extract` | LIEN_CERTIFICATE, TAX_DEED | `DealTaxLien` / `DealTaxDeed` fields |
| `POST /api/ai/extract-sow` | CONTRACTOR_BID, INVOICE | `DealFixFlip.scopeOfWork` line items |
| `POST /api/ai/extract-mf` | OFFERING_MEMORANDUM | `DealMultifamily` fields |
| `POST /api/ai/copilot` | N/A | SSE streaming chat (portfolio context) |

---

## Active Strategies (UI complete)
`TAX_LIEN` · `TAX_DEED` · `FORECLOSURE` · `LAND` · `WHOLESALE` · `FIX_FLIP` · `BUY_HOLD` · `MULTIFAMILY`

## Data Model (high-level)
`Tenant` `User` `Jurisdiction` `JurisdictionStrategyData` `RuleSet` `Rule` `TenantWorkflowRule`
`Property` `Contact` `BuyerProfile`
`Deal` + strategy extension tables for all eight strategies
`Event` `Task` `TaskComment` `FinancialTransaction` `Document` `AuditLog` `AuditEvent` `EmailEvent`
`TenantModule` `ModulePrice` `ChecklistTemplate` `Announcement`
`LandNote` `BuyerBlastSend` `FmrRate`

---

## ADRs
| # | Decision |
|---|----------|
| 001 | WSL as primary dev environment |
| 002 | Linear is product/project command center; GitHub is engineering proof/source for merged code |
| 003 | Free tiers only until customer scale demands upgrade |
| 004 | Next.js + Prisma + Neon + Clerk (not .NET/Azure) |
| 005 | Extension table pattern for strategy modules |
| 006 | Claude API for all AI features |
| 007 | Vercel Cron routes for scheduled jobs (not pg-boss — not installed as npm package) |
| 008 | BYOK for AI features — tenant supplies Anthropic key; platform key never used for tenant requests |
