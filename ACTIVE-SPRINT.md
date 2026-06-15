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

## Initiative 1 — Jurisdiction Intelligence Layer (#131)

> Spec: [GitHub issue #131](https://github.com/Metis-Platform/platform/issues/131)
> Tier 1 priority: all 67 FL counties → anchor counties in TX/GA/AZ/IL/OH/TN/MD/NC/CO

- [x] **#131-P1** JurisdictionProfile schema — provenance-rich field model (issue #219)
- [x] **#131-P2** Seed: all 3,141 counties + 50-state statutory baseline (issue #220)
- [x] **#131-P3** Admin: AI extraction pipeline — NETROnline → Playwright → Jina → Claude Haiku → review queue (issue #221)
- [x] **#131-P4** Admin: auction platform feeds — GovEase, RealAuction, Tax Sale Resources (issue #222)
- [x] **#131-P5** Admin: market signals ingestion + opportunity/saturation scoring (issue #223)
- [x] **#131-P6** Investor: jurisdiction research hub — per-strategy tabs + provenance display (issue #224)
- [x] **#131-P7** Investor: in-deal jurisdiction surfacing — stage-aware context on deal pages (issue #225)
- [x] **#131-P8** Investor: per-deal DD checklist generation from strategy × jurisdiction matrix (issue #226)

---

## Initiative 2 — Parcel Intelligence + Exit Strategy Engine (#229)

> Spec: [GitHub issue #229](https://github.com/Metis-Platform/platform/issues/229)
> Build order: P1 + P4 parallel → P2/P3 after P1 → P5/P6 after P4 → P7 after P5+P6 → P8+P9 after P7

- [x] **#229-P1** Parcel profile data model + APN normalization (issue #230)
- [x] **#229-P4** `lib/exit-engine` core — types, registry, projections, confidence scoring (issue #231)
- [x] **#229-P2** Parcel data sourcing pipeline + ParcelDataCache schema (issue #232)
- [x] **#229-P3** Zoning data layer + PostGIS spatial join service (issue #233) ⚠️ Build as reusable `GeoService` — Land module and Tax Sale DD depend on this layer
- [x] **#229-P5** Exit evaluators — all 30 exits across 8 strategy families (issue #234)
- [ ] **#229-P6** JurisdictionFacts accessor + Prisma adapter — bridge to #131 (issue #235)
- [ ] **#229-P7** Deal-page "What are my exits?" UI — Exit Options panel + data-gap chips (issue #236)
- [ ] **#229-P8** ExitEvaluation cache table + InvestorProfile persistence (issue #237)
- [ ] **#229-P9** Admin parcel research service — research-on-demand for investors (issue #238)

---

## Initiative 3 — Module Depth (after #131 + #229)

> Specs: `STRATEGY.md` — Platform Primitives + Module Depth Specs

- [ ] **Contact CRM primitive** — platform-wide contact record (Wholesale, Fix & Flip, Buy & Hold, Land)
- [ ] **Land module (#39)** — GIS overlays, water/well lookup, raw land comps, AI parcel summary
- [ ] **Wholesale module (#40)** — seller pipeline, buyer matching, assignment fee calc
- [ ] **Fix & Flip depth (#41)** — cost database, multi-bid comparison, draw schedule
- [ ] **Buy & Hold depth (#42)** — tenant records, lease tracking, maintenance log, rent roll
- [ ] **Multifamily depth (#43)** — LP waterfall modeling, capital raise tracking

---

## Standing rules

1. Fresh branch from `origin/main` per PR; never reuse squash-merged branches
2. `npx tsc --noEmit` + `npm run lint` + `npm run build` before push
3. PR body includes `Closes #<issue>`; queue `gh pr merge --auto --squash` immediately
4. **After every merge: tick this file + update STATUS.md + update memory**
5. Schema migrations: temp-copy method for SQL files (see CLAUDE.md)
6. Every query scoped to `tenantId`; SDK clients lazy-init; Claude API only
