# ACTIVE-SPRINT.md — Current Sprint

> This file is the committed work queue for the current sprint.
> Tick items as PRs merge. Update STATUS.md after every merge.
> Backlog lives in GitHub Issues — only committed work belongs here.

## Resume protocol

1. Confirm the working tree is clean, then `git fetch --prune origin && git pull --ff-only`
2. Read this file — find the first unticked item in the active initiative
3. `gh pr list --state open` — check if a branch is already in flight
4. `gh issue view <number>` — read the full spec before implementing
5. Branch from `origin/main`; push + PR + auto-squash merge

---

## Initiative 3 — Module Depth (#131 + #229 complete; specs in STRATEGY.md)

> Revised build order (2026-06-15 spec session): Pre-purchase parcel research + MAO calculator first — this is the founding problem and uses infrastructure already built. Then Land (most directly tied to deed investing). Then remaining modules.

- [x] **Contact CRM primitive** — platform-wide contact record (Wholesale, Fix & Flip, Buy & Hold, Land) — PRs #275 #277
- [ ] **Pre-purchase Parcel Research + MAO Calculator — acceptance gap** — PRs #284 + adaa9a3 shipped the UI, endpoint, evaluator shell, and MAO display, but the 2026-07-13 truth check found that the canonical Volusia altkey 2340282 outcome is not implemented or automatically tested. Dimensions/setback-envelope logic, a real Florida data path, formula alignment, and no-re-entry deal creation remain P0 work. See `docs/PLATFORM-ASSESSMENT-2026-07-13.md`.
- [x] **Land module (#39)** — full lifecycle (P1-P4) shipped weeks ago (#144 #146 #148 #175); depth gap (sync from research, raw land comps, AI parcel summary) closed by PR #286. Skipped "water/well lookup" — no real data source exists; manual `utilities.water` field covers it.
- [x] **Wholesale module (#40)** — full lifecycle shipped (#150 #152 #154 #177): pipeline funnel, buyer CRM + buy-box matching, MAO calculator, premium analytics. **Remaining gap**: Contact CRM outreach log not wired into Wholesale deals (it is wired into Fix & Flip/Buy & Hold/Multifamily/Land Note — commit 0eeefbf — but not Wholesale).
- [x] **Fix & Flip depth (#41)** — full lifecycle shipped (#156 #157 #159 #216): rehab line-item budget, P&L/ROI economics, AI bid extraction + draw package. **Remaining gap**: no multi-contractor bid comparison UI, no milestone-tied draw schedule (draw package PR generates a document, not a tracked schedule).
- [x] **Buy & Hold depth (#42)** — full lifecycle shipped (#161 #162 #174): rental economics (NOI/cap rate), Section 8 compliance (HAP/HQS/FMR). **Remaining gap**: no per-unit tenant records, lease tracking, maintenance log, or rent roll (Buy & Hold is single-unit economics today; rent roll exists only for Multifamily).
- [x] **Multifamily depth (#43)** — LP waterfall modeling, capital raise tracking — PR #279 (migration initially failed CI silently; fixed + applied by PR #285 on 2026-06-16)

> Note (2026-06-16): this file previously listed #39-#42 as unbuilt — they were not. The GitHub issues tracked the full module lifecycle (create flow → economics → disposition), which shipped under "Phase 4-full" weeks before this Initiative 3 entry was written. Initiative 3 only covers the narrower "depth" layer from STRATEGY.md. Land's depth gap is now closed; Wholesale/Fix & Flip/Buy & Hold each have one real, scoped gap remaining (above) — not full rebuilds.

---

## Initiative 4 — Platform Reliability and Verification (#287)

> Approved 2026-07-13: make GitHub portable across WSL/macOS, fully assess the platform, then establish isolated browser verification with inspectable evidence for every critical user flow.

- [x] **Cross-machine context portability** — GitHub contains every non-secret handoff and requirement; safe WSL/macOS workflow and automated context check — PR #288
- [x] **Repository, product, and roadmap assessment** — evidence and prioritized queue in `docs/PLATFORM-ASSESSMENT-2026-07-13.md`
- [ ] **National jurisdiction intelligence architecture (#296)** — authority/provenance model, versioned question library, coverage tiers, source discovery, on-demand county research, review gates, freshness/contradiction handling, and coverage dashboard. Foundations shipped: #308 versioned dictionary + AI candidate-only/fail-closed review; #310 atomic claim/evidence ledger; #312 append-only source-authority review with exact-version gates and admin queue; #314 content-addressed immutable evidence representations linked through candidates to claim history; #316 server-owned freshness schedules + append-only unchanged-evidence re-review; #318 fail-closed candidate contradiction detection + append-only resolution; #320 production inventory plus fail-closed quarantine of all unclaimed legacy fields from investor decisions; #322 demand-first operational coverage/migration queue with exact active-claim metrics; #324 tenant-isolated on-demand county demand plus shared discovery work and derived investor coverage states; #332/#333 code-managed discovery capability registry plus idempotent non-authoritative review leads; #335 super-admin reviewed promotion to an unverified source; #337 Volusia county-specific official candidates; #344 admin discovery/review/promotion workflow; #345 candidate-scope enforcement prevents unchanged discovery entry points from becoming county source records; #353 automatically runs that safe preliminary check when an investor requests county research; #354 gives the investor a truthful result. National baseline adapters, notification on coverage improvement, and canonical multi-state acceptance remain open.
- [ ] **Founding parcel acceptance repair (#291)** — obtain/record the authoritative county determination and make Volusia altkey 2340282 deterministic and truthful; dimensions + exceptions + provenance + setbacks + Florida data + MAO alignment. #355 adds the canonical provenance-labeled regression fixture with the honest conditional outcome; #351 carries APN/jurisdiction into a deal but does not promote research facts into authoritative property records; #356 aligns raw-land MAO with the documented rural/infill bands and refuses to choose a band without investor input; #358 calculates/blocks zero setback envelopes; #359 makes the fact provenance visible as official, estimated, manual, unverified, or missing.
- [x] **Release protection (#292)** — CI now includes the production build; `main` requires CI + Vercel, enforces protection for admins, requires current branches/resolved conversations/linear history, and blocks force pushes/deletion; direct-main checkpoint instructions removed
- [x] **Spreadsheet import safety (#290)** — #327 removes the vulnerable `xlsx` parser and contains imports to bounded CSV; #350 aligns the upload UI, formula-safe error exports, declared-payload rejection, and tenant-safe request-correlated import audit evidence with route-level tests.
- [ ] **Environment lifecycle and reset (#298)** — current stack classification plus guarded database/Clerk/R2 orchestration shipped through #300/#302/#304/#306; remaining: hosted reset rehearsal, versioned Gold-equivalent configuration, release-candidate rebuild, and clean production cutover
- [ ] **Resettable integration test state (#289)** — deterministic tagged database/Clerk/R2 fixtures and external-service safeguards shipped through #300/#302/#304/#306; the enforced five-story mutation contract now names fixture, request-correlation, and audit evidence. Remaining: authorized hosted rehearsal, destructive-test gate, browser suite restore, and permanent clean-production boundary
- [ ] **Playwright feature verification** — read-only runner/health check foundation and #347 named blocked mutation-story shells shipped; every declared story now maps to a real spec and blocked flows identify their reset prerequisite. Remaining: authorized UI execution, traces, screenshots, console evidence, HTML reports, CI artifacts, and the reset-safe mutation suite
- [ ] **Mutation observability** — #341 establishes request-to-audit correlation for parcel/jurisdiction routes and now every existing server action that uses `emitAuditEvent`, including `DEAL_CREATED`; #357 adds super-admin tenant-scoped retrieval by response request ID. Remaining: authorized QA trace correlation.
- [x] **Production dependency security (#338)** — #339 moved Prisma CLI tooling out of runtime dependencies and patched PostCSS; #340 replaced the vulnerable `react-simple-maps` D3 chain. Combined production-only audit is clean.
- [ ] **Portable reproducible development (#295)** — one container/bootstrap contract for WSL, macOS, and an approved cloud host; remove root dependence on original WSL paths

---

## Standing rules

1. Fresh branch from `origin/main` per PR; never reuse squash-merged branches
2. `npx tsc --noEmit` + `npm run lint` + `npm run build` before push
3. PR body includes `Closes #<issue>`; queue `gh pr merge --auto --squash` immediately
4. **After every merge: tick this file + update STATUS.md**
5. Schema migrations: temp-copy method for SQL files (see CLAUDE.md)
6. Every query scoped to `tenantId`; SDK clients lazy-init; Claude API only
