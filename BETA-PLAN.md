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

### Sprint 1 — Task UX cluster (same components, do together)
- [ ] #84 Bug: assignee blank after task creation (optimistic update hardcodes null; API create response missing assignee relation)
- [ ] #85 UX: replace cycling status circle with labelled next-action button (Start / Complete / Reopen); backward moves stay in detail panel
- [ ] #86 Feature: Tasks section on deal detail page (open/in-progress list, inline advance, + Add Task pre-filled, completed collapsed)

### Sprint 2 — Import cluster (same files, do together)
- [ ] #64 XLS/XLSX import via SheetJS (`xlsx` npm pkg) — same row pipeline as CSV
- [ ] #65 Optional `status` column — import liens at any lifecycle stage; deadlines only for ACTIVE; infer LEAD/ACTIVE when column absent

### Sprint 3 — Calendar cluster (same component, do together)
- [ ] #31 Tasks on calendar with distinct color (purple/teal — not the event red/yellow/blue)
- [ ] #29 Clickable month/year picker — 12-month grid, per-month urgency dots

### Sprint 4 — Security (before beta invites)
- [ ] #24 Row-level tenant isolation audit — review every Prisma query for `tenantId` scoping; fix any leaks; document findings in the issue

### Sprint 5 — Phase 1 leftovers
- [ ] #17 Task comments — `TaskComment` migration (taskId, userId, body, createdAt) + thread UI in task detail panel
- [ ] #18 Jurisdiction detail page — research hub at `/dashboard/jurisdictions/[id]` (close #10 as duplicate of #18)

### Sprint 6 — Phase 2 AI
- [ ] #25 AI document extraction — upload cert PDF/image → Claude extracts fields → review/confirm UI with per-field confidence
- [ ] #26 Deal Copilot — chat at `/dashboard/copilot`, Claude API over structured tenant deal data

### Post-beta (not in this plan)
#39 Land · #40 Wholesale · #41 Fix & Flip · #42 Buy & Hold · #43 Multifamily — full module UIs

## Standing rules for every sprint

1. Fresh branch from `origin/main` per PR; never reuse squash-merged branches
2. `npx tsc --noEmit` + `npm run lint` + `npm run build` before push
3. PR body references `Closes #<issue>`; queue `gh pr merge --auto --squash` immediately
4. Schema migrations: temp-copy method for SQL files; remind user to run `npx prisma generate` after merge
5. Every new query scoped to `tenantId`; SDK clients lazy-init; Claude API only
6. After each sprint: tick the boxes here, update STATUS.md
