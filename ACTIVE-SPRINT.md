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
- [x] **Pre-purchase Parcel Research + MAO Calculator** — standalone "should I bid?" tool: APN/address in → exit analysis + MAO out (conservative/moderate/aggressive). Surfaces the existing exit engine + parcel intelligence as a pre-bid research flow. Acceptance test: Volusia County altkey 2340282 surfaces no viable residential exits + raw-land-only MAO. — PRs #284 + adaa9a3
- [x] **Land module (#39)** — full lifecycle (P1-P4) shipped weeks ago (#144 #146 #148 #175); depth gap (sync from research, raw land comps, AI parcel summary) closed by PR #286. Skipped "water/well lookup" — no real data source exists; manual `utilities.water` field covers it.
- [x] **Wholesale module (#40)** — full lifecycle shipped (#150 #152 #154 #177): pipeline funnel, buyer CRM + buy-box matching, MAO calculator, premium analytics. **Remaining gap**: Contact CRM outreach log not wired into Wholesale deals (it is wired into Fix & Flip/Buy & Hold/Multifamily/Land Note — commit 0eeefbf — but not Wholesale).
- [x] **Fix & Flip depth (#41)** — full lifecycle shipped (#156 #157 #159 #216): rehab line-item budget, P&L/ROI economics, AI bid extraction + draw package. **Remaining gap**: no multi-contractor bid comparison UI, no milestone-tied draw schedule (draw package PR generates a document, not a tracked schedule).
- [x] **Buy & Hold depth (#42)** — full lifecycle shipped (#161 #162 #174): rental economics (NOI/cap rate), Section 8 compliance (HAP/HQS/FMR). **Remaining gap**: no per-unit tenant records, lease tracking, maintenance log, or rent roll (Buy & Hold is single-unit economics today; rent roll exists only for Multifamily).
- [x] **Multifamily depth (#43)** — LP waterfall modeling, capital raise tracking — PR #279 (migration initially failed CI silently; fixed + applied by PR #285 on 2026-06-16)

> Note (2026-06-16): this file previously listed #39-#42 as unbuilt — they were not. The GitHub issues tracked the full module lifecycle (create flow → economics → disposition), which shipped under "Phase 4-full" weeks before this Initiative 3 entry was written. Initiative 3 only covers the narrower "depth" layer from STRATEGY.md. Land's depth gap is now closed; Wholesale/Fix & Flip/Buy & Hold each have one real, scoped gap remaining (above) — not full rebuilds.

---

## Standing rules

1. Fresh branch from `origin/main` per PR; never reuse squash-merged branches
2. `npx tsc --noEmit` + `npm run lint` + `npm run build` before push
3. PR body includes `Closes #<issue>`; queue `gh pr merge --auto --squash` immediately
4. **After every merge: tick this file + update STATUS.md + update memory**
5. Schema migrations: temp-copy method for SQL files (see CLAUDE.md)
6. Every query scoped to `tenantId`; SDK clients lazy-init; Claude API only
