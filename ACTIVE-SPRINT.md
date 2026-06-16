# ACTIVE-SPRINT.md — Current Sprint

> This file is the committed work queue for the current sprint.
> Tick items as PRs merge. Update STATUS.md + memory after every merge.
> Backlog lives in GitHub Issues — only committed work belongs here.

## Resume protocol

1. `git fetch && git reset --hard origin/main`
2. Read this file — find the first unticked item in the active initiative
3. `gh pr list --state open` — check if a branch is already in flight
4. `gh issue view <number>` — read the full spec before implementing
5. Branch from `origin/main`; push + PR + auto-squash merge

---

## Initiative 3 — Module Depth (#131 + #229 complete; specs in STRATEGY.md)

> Revised build order (2026-06-15 spec session): Pre-purchase parcel research + MAO calculator first — this is the founding problem and uses infrastructure already built. Then Land (most directly tied to deed investing). Then remaining modules.

- [x] **Contact CRM primitive** — platform-wide contact record (Wholesale, Fix & Flip, Buy & Hold, Land) — PRs #275 #277
- [ ] **Pre-purchase Parcel Research + MAO Calculator** — standalone "should I bid?" tool: APN/address in → exit analysis + MAO out (conservative/moderate/aggressive). Surfaces the existing exit engine + parcel intelligence as a pre-bid research flow. Acceptance test: Volusia County altkey 2340282 surfaces no viable residential exits + raw-land-only MAO.
- [ ] **Land module (#39)** — GIS overlays, water/well lookup, raw land comps, AI parcel summary
- [ ] **Wholesale module (#40)** — seller pipeline, buyer matching, assignment fee calc
- [ ] **Fix & Flip depth (#41)** — cost database, multi-bid comparison, draw schedule
- [ ] **Buy & Hold depth (#42)** — tenant records, lease tracking, maintenance log, rent roll
- [x] **Multifamily depth (#43)** — LP waterfall modeling, capital raise tracking — PR #279

---

## Standing rules

1. Fresh branch from `origin/main` per PR; never reuse squash-merged branches
2. `npx tsc --noEmit` + `npm run lint` + `npm run build` before push
3. PR body includes `Closes #<issue>`; queue `gh pr merge --auto --squash` immediately
4. **After every merge: tick this file + update STATUS.md + update memory**
5. Schema migrations: temp-copy method for SQL files (see CLAUDE.md)
6. Every query scoped to `tenantId`; SDK clients lazy-init; Claude API only
