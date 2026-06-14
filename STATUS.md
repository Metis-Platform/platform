# Metis Platform — Session Status

> **This is the lean session reference.** Full roadmap, vision, and phase history: see `ROADMAP.md`.
> Execution plan for beta: see `BETA-PLAN.md`. Admin portal rollout: see `ADMIN-PLAN.md`.
> Last updated: 2026-06-14

---

## Current Phase
**Phase 4 AI complete.** #41-P4 and #43-P4 shipped. All AI features across Fix & Flip and Multifamily now live (BYOK-gated). Remaining AI work blocked on #131 (comps data).

---

## Last Session — What Was Done (2026-06-14)

| PR | Description | Status |
|----|-------------|--------|
| #216 | feat(#41-P4): Fix & Flip AI — contractor bid/invoice extraction, draw package | ✅ merged |
| #217 | feat(#43-P4): Multifamily AI — OM extraction, sensitivity grid, lender package | ✅ merged |

## Previous Sessions (2026-06-14)

| PR | Description | Status |
|----|-------------|--------|
| #213 | feat(#25): AI document extraction — BYOK key, extract endpoint, review modal | ✅ merged |
| #214 | feat(#26): Deal Copilot — streaming chat scoped to portfolio | ✅ merged |
| #194 | feat(#179): fix module management — MULTIFAMILY + PREMIUM tier toggle | ✅ merged |
| #195 | feat(#181): fix billing page — owned modules + available modules + Contact us CTA | ✅ merged |
| #196 | feat(#180): tenant detail page `/admin/tenants/[id]` | ✅ merged |
| #197 | feat(#182): jurisdiction table filtering — sort, state dropdown, county search, completeness badges | ✅ merged |
| #198 | feat(#183): jurisdiction strategy data expansion — per-strategy fields for all 8 strategies | ✅ merged |
| #199 | feat(#185): tenant workflow rules — TenantWorkflowRule model, settings CRUD, rule eval on deal create | ✅ merged |
| #200 | feat(#184): jurisdiction guide on deal pages — collapsible card, strategy-scoped | ✅ merged |
| #202 | feat(#187): audit event log — AuditEvent model, emitAuditEvent, per-tenant timeline on admin page | ✅ merged |
| #203 | feat(#186): platform health dashboard — pg-boss job state, email bounce tracking, churn signals | ✅ merged |
| #205 | feat(#189): checklist template editor — ChecklistTemplate DB model, admin editor, tenant fork | ✅ merged |
| #206 | feat(#188): admin communications center — per-tenant email, broadcast, in-app announcements | ✅ merged |
| #208 | feat(#190): Stripe module purchase flow — checkout, webhook handler, billing page buttons | ✅ merged |
| #209 | feat(#191): pricing configuration and trial management — ModulePrice, trialEndsAt, expire-trials cron | ✅ merged |

---

## Next Up

| Issue | Title | Status |
|-------|-------|--------|
| #131 | Jurisdiction data dictionary + Tier 1 counties | Needs owner input |
| #41-P4 comps | ARV market context on Fix & Flip underwriting | BLOCKED on #131 |
| #43-P4 comps | Rent comps, sale comps, FMR on MF underwriting | BLOCKED on #131 |

All Phase 4 AI work that depends only on #25/#26 is complete. Next meaningful work requires #131 (jurisdiction data program with comps pipeline).

## AI Layer — BYOK Architecture (IMPORTANT)

- `Tenant.anthropicApiKey String?` — tenant stores their own key; platform key is **never** used as fallback
- `lib/ai.ts`: `getAnthropic(apiKey)` throws if empty; `resolveAnthropicKey(tenantId)` throws user-readable error if null → callers return 402
- Gating: `Tenant.anthropicApiKey IS NOT NULL` — setting a key is the opt-in. No TenantModule needed for AI.
- Missing key → `{ error: '...', settingsUrl: '/dashboard/settings/ai' }` with 402
- Metis-hosted AI (platform key + token metering) is a separate future issue

## AI extraction routes (all use BYOK pattern)

| Route | DocType(s) | Target |
|-------|-----------|--------|
| `POST /api/ai/extract` | LIEN_CERTIFICATE, TAX_DEED | `DealTaxLien` / `DealTaxDeed` fields |
| `POST /api/ai/extract-sow` | CONTRACTOR_BID, INVOICE | `DealFixFlip.scopeOfWork` line items |
| `POST /api/ai/extract-mf` | OFFERING_MEMORANDUM | `DealMultifamily` fields |
| `POST /api/ai/copilot` | N/A | SSE streaming chat (portfolio context) |

## Billing model — IMPORTANT

Subscription plan tiers (STARTER/PROFESSIONAL/TEAM) are **not enforced**. `Tenant.plan` field exists but nothing reads it for feature gating. `PLAN_LIMITS.aiIncluded` in `lib/stripe.ts` is dead code. Real gate is `TenantModule` via `hasStrategy()` / `hasTier()` in `lib/entitlements.ts`.

---

## Active Strategies (UI complete)
`TAX_LIEN` · `TAX_DEED` · `FORECLOSURE` · `LAND` · `WHOLESALE` · `FIX_FLIP` · `BUY_HOLD` · `MULTIFAMILY`

## Deal Status Flow
```
LEAD ──→ [Won at Auction] ──→ ACTIVE ──→ REDEEMED / FORECLOSURE_INITIATED / DEEDED / SOLD / CLOSED
     └──→ [Not Won]       ──→ NOT_WON ──→ [Re-list] ──→ LEAD
```

## Data Model (tables)
`Tenant` `User` `Jurisdiction` `JurisdictionStrategyData` `RuleSet` `Rule` `TenantWorkflowRule`
`Property` `Contact` `BuyerProfile`
`Deal` + `DealTaxLien` / `DealTaxDeed` / `DealForeclosure` / `DealLand` / `DealWholesale` / `DealFixFlip` / `DealBuyHold` / `DealMultifamily`
`Event` `Task` `TaskComment` `FinancialTransaction` `Document` `AuditLog` `AuditEvent` `EmailEvent`
`TenantModule` `ModulePrice` `ChecklistTemplate` `Announcement`
`LandNote` `BuyerBlastSend` `FmrRate`

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
| 007 | Vercel Cron routes for scheduled jobs (not pg-boss — not installed as npm package) |
| 008 | BYOK for AI features — tenant supplies their own Anthropic key; platform key never used for tenant requests |
