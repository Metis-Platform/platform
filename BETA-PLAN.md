# BETA-PLAN.md — Path to Beta-Complete

> Working plan to drive the open backlog to zero and deliver the complete platform
> live on metisplatforms.com. Every sprint ships as merged PRs (auto-deploy on merge).
> Created 2026-06-11. Update the checkboxes as PRs merge — this file is the
> cross-session execution state.

## Definition of done

All open GitHub issues below closed via merged PRs, `npx tsc --noEmit` + build clean
on every PR, production verified at metisplatforms.com. Module deep-dives (#39–43)
are explicitly out of scope for beta — their schemas and deal-list columns already
shipped (PRs #111–121); full module UIs are post-beta.

## Sprint order

> 2026-06-12 audit: Sprints 1, 2, 3, and 5 were found ALREADY IMPLEMENTED in the
> codebase — the issues were stale and were closed with verification comments.
> No code was written for them.

### Sprint 1 — Task UX cluster — ✅ done (closed 2026-06-12, already implemented)
- [x] #84 Bug: assignee blank after task creation — fix verified in `app/api/tasks/route.ts` + `TaskBoard.tsx`
- [x] #85 UX: labelled next-action button (Start / Complete / Reopen) — verified in `TaskBoard.tsx`
- [x] #86 Tasks section on deal detail page — verified in `DealTaskSection.tsx`

### Sprint 2 — Import cluster — ✅ done (closed 2026-06-12, already implemented)
- [x] #64 XLS/XLSX import via SheetJS — verified in `app/api/liens/import/route.ts`
- [x] #65 Optional `status` column — verified (`validateStatusFields`, ACTIVE-only deadlines)

### Sprint 3 — Calendar cluster — ✅ done (closed 2026-06-12, already implemented)
- [x] #31 Tasks on calendar — teal `TaskChip` verified in `CalendarClient.tsx`
- [x] #29 Month/year picker — verified in `CalendarClient.tsx`

### Sprint 4 — Security (before beta invites)
- [x] #24 Row-level tenant isolation audit — DONE 2026-06-12. Findings: cross-tenant
      role carry-over via unscoped User lookup (fixed: per-tenant User rows,
      `@@unique([clerkUserId, tenantId])`); all new users created as OWNER (fixed:
      role derived from Clerk org role — org:admin → OWNER, else READ_ONLY);
      cron auth fail-open when CRON_SECRET unset (fixed); admin pages gated only
      by layout (fixed: inline `isSuperAdmin()` per page). Full report on issue #24.

### Sprint 5 — Phase 1 leftovers — ✅ done (closed 2026-06-12, already implemented)
- [x] #17 Task comments — `TaskComment` model + API + thread UI verified
- [x] #18 Jurisdiction detail page — verified at `app/dashboard/jurisdictions/[id]` (#10 closed as duplicate)

### Sprint 6 — Phase 2 AI — ⏸ ON HOLD (user decision 2026-06-12)
- [ ] #25 AI document extraction — upload cert PDF/image → Claude extracts fields → review/confirm UI with per-field confidence
- [ ] #26 Deal Copilot — chat at `/dashboard/copilot`, Claude API over structured tenant deal data

### Post-beta program (spec'd 2026-06-12, ready to implement — goalposts in ROADMAP.md "North Star")
All issues below are implementation-grade 3-phase plans. Build order honors shared primitives:

1. **#132 Financial core** — unified ledger + computed-economics library + realized/unrealized
   P&L; retrofit to live lien/deed/foreclosure first (answers "what did I earn?")
2. **#133 Checklist engine** — DD templates → Tasks; serves live strategies + every module
3. **#39 Land** → **#40 Wholesale** (activates Contact CRM) → **#41 Fix & Flip** / **#42 Buy & Hold**
   (parallel-able) → **#43 Multifamily** (premium tier gated: pricing earned by Phase 4, not market sizing)
4. **#130 Entitlements** — per-strategy purchase + in-module tiers (Stripe products per (strategy, tier))
5. **#131 Jurisdiction data program** — county-depth moat; feeds #42 FMR, #43 market data, #133 templates

Sprint 6 AI (#25/#26) is load-bearing for #43 Phase 4 — revisit the hold near MF Phase 3.

## Standing rules for every sprint

1. Fresh branch from `origin/main` per PR; never reuse squash-merged branches
2. `npx tsc --noEmit` + `npm run lint` + `npm run build` before push
3. PR body references `Closes #<issue>`; queue `gh pr merge --auto --squash` immediately
4. Schema migrations: temp-copy method for SQL files; remind user to run `npx prisma generate` after merge
5. Every new query scoped to `tenantId`; SDK clients lazy-init; Claude API only
6. After each sprint: tick the boxes here, update STATUS.md
