# ADMIN-PLAN.md — Admin Portal Rollout

> Structured rollout plan for the Metis admin portal, building from foundation fixes
> to a full founder-grade business management tool. Every sprint ships as merged PRs.
> Created 2026-06-13. Tick checkboxes as PRs merge.

## Context

The current admin portal at `/admin` exists but has three categories of problems:
1. **Broken basics** — MULTIFAMILY missing from module grants, PREMIUM tier not grantable via UI, billing page buttons 404
2. **Missing visibility** — no platform health, no tenant activity, no support context
3. **No business operations tooling** — no comms, no pricing control, no trial management

This plan fixes them in priority order: unblock immediate admin operations first (P1),
then surface data that's already in the system (P2), then add operational intelligence (P3),
then add proactive tools (P4), then monetization plumbing (P5).

---

## Phase 1 — Foundation fixes (unblocks day-to-day admin operations)

These are breakages. Implement immediately — they cost hours of admin time as manual workarounds.

- [x] **#179** Admin P1A: Fix module management — add MULTIFAMILY to CREATABLE_STRATEGIES, add PREMIUM tier toggle to grant UI (PR #194)
- [x] **#180** Admin P1B: Tenant detail page at `/admin/tenants/[id]` — account info, module panel, users list, deal counts, admin notes field (PR #196)
- [x] **#181** Admin P1C: Fix billing page — remove broken plan grid, replace with owned modules + available modules + "Contact us" CTA (PR #195)

### P1 acceptance gate
Admin can: grant MULTIFAMILY (any tier), grant PREMIUM to any strategy, view a tenant's full context, and point users to a working billing page.

---

## Phase 2 — Data surfacing (uses data already in the system)

- [ ] **#182** Admin P2A: Jurisdiction table filtering — column sort, state dropdown, county text search, completeness badges
- [ ] **#183** Admin P2B: Jurisdiction data model expansion — per-strategy jurisdiction fields (deed, foreclosure, wholesale, buy & hold, land, MF)
- [ ] **#184** Admin P2C: Surface jurisdiction data on deal pages — collapsible "Jurisdiction Guide" card, strategy-scoped, read-only for users
- [ ] **#185** Admin P2D: Tenant-configurable workflow rules — `TenantWorkflowRule` model, `/dashboard/settings/workflow` CRUD, rule evaluation on deal create

### P2 acceptance gate
Jurisdiction data is visible to users on deal pages. Tenants can configure their own deadline rules. Admin can filter the jurisdiction table like a spreadsheet.

---

## Phase 3 — Operational intelligence (new signals, new models)

- [ ] **#186** Admin P3A: Platform health dashboard — pg-boss job state counts, failed job list with retry, email bounce tracking via Resend webhook, churn signals (last login, zero deals)
- [ ] **#187** Admin P3B: Tenant activity log + admin support notes — `AuditEvent` model, per-tenant timeline, autosave admin notes

### P3 acceptance gate
Admin can spot a failed job before a user reports it. Admin can review a tenant's full activity before a support call. Support notes persist across sessions.

---

## Phase 4 — Proactive operations tooling

- [ ] **#188** Admin P4A: Communications center — per-tenant email, broadcast to all tenants, optional in-app announcement banner
- [ ] **#189** Admin P4B: Checklist template editor — `ChecklistTemplate` DB model, seed from hardcoded data, admin editor at `/admin/templates`, tenant self-service fork

### P4 acceptance gate
Admin can send a targeted support email without leaving the app. Admin can update checklist templates without a code deploy.

---

## Phase 5 — Monetization plumbing

- [ ] **#190** Admin P5A: Stripe module purchase flow — Stripe webhook, `TenantModule` upsert on checkout, billing page with real purchase buttons, no more broken plan grid
- [ ] **#191** Admin P5B: Pricing configuration and trial management — `ModulePrice` table, admin `/admin/pricing` CRUD, `TenantModule.trialEndsAt`, daily pg-boss trial expiry job, 3-day warning email

### P5 acceptance gate
A tenant can purchase module access without admin intervention. Admin can offer a free trial with an expiry date. Pricing can be updated without a code deploy.

---

## Implementation order notes

- P1 items can be done in parallel (no dependencies between them)
- P2A and P2B can be done in parallel; P2C depends on P2B; P2D is independent
- P3A and P3B can be done in parallel
- P4A depends on P3B (AuditEvent for logging sends); P4B is independent
- P5A depends on P1C (billing page cleanup); P5B depends on P5A (Stripe must exist first)

## Resume protocol

On session start: read this file, check `gh pr list --state open` for in-flight work,
continue from the first unticked item. Update checkboxes immediately after each PR merges.

## Standing rules (same as BETA-PLAN)

1. Fresh branch from `origin/main` per PR; never reuse squash-merged branches
2. `npx tsc --noEmit` + `npm run lint` + `npm run build` before push
3. PR body references `Closes #<issue>`; do NOT queue `--auto` — wait for checks then merge manually
4. Schema migrations: standard worktree method; run `npx prisma generate` yourself after merge
5. All queries scoped to `tenantId`; SDK clients lazy-init
6. After each phase: tick boxes here, update STATUS.md
