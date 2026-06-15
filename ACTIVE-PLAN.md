# ACTIVE-PLAN.md — Post-Beta Initiatives

> BETA-PLAN.md is complete (all items shipped through PR #228). This document tracks
> all post-beta initiative work. Same cross-session protocol: read this on session start,
> tick items as PRs merge. Created 2026-06-14.

## Resume protocol

1. `git fetch && git reset --hard origin/main`
2. Read ACTIVE-PLAN.md (this file) — find first unticked item in active initiative
3. `gh pr list --state open` — check if a branch is already in flight
4. `gh issue view <number>` — read the full spec before implementing
5. Work in `.claude/worktrees/<short-name>` from `origin/main`; push + PR + merge

## Initiative 1 — Jurisdiction Intelligence Layer (#131)

> Full plan and spec: [GitHub issue #131](https://github.com/Metis-Platform/platform/issues/131)
> Parent planning comment on #131 has the complete data dictionary, county sequencing,
> AI extraction pipeline spec, and technology decisions.
> Tier 1 priority: all 67 FL counties → anchor counties in TX/GA/AZ/IL/OH/TN/MD/NC/CO

- [x] **#131-P1** JurisdictionProfile schema — provenance-rich field model (issue #219)
- [ ] **#131-P2** Seed: all 3,141 counties + 50-state statutory baseline (issue #220)
- [ ] **#131-P3** Admin: AI extraction pipeline — NETROnline → Playwright → Jina → Claude Haiku → review queue (issue #221)
- [ ] **#131-P4** Admin: auction platform feeds — GovEase, RealAuction, Tax Sale Resources (issue #222)
- [ ] **#131-P5** Admin: market signals ingestion + opportunity/saturation scoring (issue #223)
- [ ] **#131-P6** Investor: jurisdiction research hub — per-strategy tabs + provenance display (issue #224)
- [ ] **#131-P7** Investor: in-deal jurisdiction surfacing — stage-aware context on deal pages (issue #225)
- [ ] **#131-P8** Investor: per-deal DD checklist generation from strategy × jurisdiction matrix (issue #226)

## Initiative 2 — Parcel Intelligence + Exit Strategy Engine (#229)

> Full plan and spec: [GitHub issue #229](https://github.com/Metis-Platform/platform/issues/229)
> Three-layer architecture: JurisdictionProfile (#131) + ParcelProfile (this APN) + Exit Engine
> → ranked viable exit strategies with financial projections and data-gap chips.
>
> Build order: P1 + P4 are independent and parallel-able. P2/P3 depend on P1.
> P5/P6 depend on P4. P7 depends on P5+P6. P8+P9 depend on P7.

- [ ] **#229-P1** Parcel profile data model + APN normalization (issue #230)
- [ ] **#229-P4** `lib/exit-engine` core — types, registry, projections, confidence scoring (issue #231)
- [ ] **#229-P2** Parcel data sourcing pipeline + ParcelDataCache schema (issue #232)
- [ ] **#229-P3** Zoning data layer + PostGIS spatial join service (issue #233) ⚠️ **Design as reusable `GeoService`** — Land module, Tax Sale DD, and future rural analysis all depend on this layer. Do not scope as a one-off zoning lookup.
- [ ] **#229-P5** Exit evaluators — all 30 exits across 8 strategy families (issue #234)
- [ ] **#229-P6** JurisdictionFacts accessor + Prisma adapter — bridge to #131 (issue #235)
- [ ] **#229-P7** Deal-page "What are my exits?" UI — Exit Options panel + data-gap chips (issue #236)
- [ ] **#229-P8** ExitEvaluation cache table + InvestorProfile persistence (issue #237)
- [ ] **#229-P9** Admin parcel research service — research-on-demand for investors (issue #238)

## Initiative 3 — Module Depth (after #131 + #229 land)

> Full specs per module: `ROADMAP.md` → Phase 4-full Module Depth Specs
> Product vision context: `PLATFORM-THOUGHTS.md`
> Two platform primitives must be built before or alongside module expansion.

- [ ] **Contact CRM primitive** — platform-wide contact record reused by Wholesale, Fix & Flip, Buy & Hold, Land
- [ ] **Land Investing module (#39)** — GIS overlays, water/well lookup, raw land comps, AI parcel summary; depends on #229-P2 + GeoService
- [ ] **Wholesale module (#40)** — seller pipeline, buyer matching, assignment fee calc; depends on Contact CRM
- [ ] **Fix & Flip depth (#41)** — cost database, multi-bid comparison, draw schedule; depends on Contact CRM
- [ ] **Buy & Hold depth (#42)** — tenant records, lease tracking, maintenance log, rent roll; depends on Contact CRM
- [ ] **Multifamily depth (#43)** — LP waterfall modeling, capital raise tracking (core AI already shipped)

## Standing rules (unchanged from BETA-PLAN)

1. Fresh branch from `origin/main` per PR; never reuse squash-merged branches
2. `npx tsc --noEmit` + `npm run lint` + `npm run build` before push
3. PR body references `Closes #<issue>`; queue `gh pr merge --auto --squash` immediately
4. Schema migrations: temp-copy method for SQL files
5. Every new query scoped to `tenantId`; SDK clients lazy-init; Claude API only
6. After each sprint: tick the boxes here
