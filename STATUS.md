# STATUS.md — Current State

> Updated after every PR merge. One-stop snapshot for session start.
> Strategy: `STRATEGY.md` | Architecture: `ARCHITECTURE.md` | Sprint queue: `ACTIVE-SPRINT.md`
> Last updated: 2026-07-14

---

## Current Phase

Post-beta initiatives produced substantial jurisdiction, parcel, exit-engine, and module breadth. The 2026-07-13 truth check found that the founding parcel acceptance case is not actually satisfied, so that work is reopened as P0 rather than described as complete. **Initiative 4 — Platform Reliability and Verification (#287)** is active.

---

## Open PRs

Run `gh pr list --state open` — this file does not mirror PR state.

---

## Current Session (2026-07-13) — Cross-machine portability and verification kickoff

| Work | Result |
|---|---|
| GitHub/WSL access audit | GitHub admin, push, workflow, issue, and PR access confirmed; WSL repo access confirmed |
| External platform access audit | Vercel CLI is not installed or linked in WSL; Neon and Clerk dashboard administration still need verification before isolated QA provisioning |
| Portable context foundation | Merged — PR #288: tracked context manifest, WSL/macOS handoff guide, Node version pin, context-check script, and removal of machine-local memory dependencies |
| Baseline verification | TypeScript passed; 106 Vitest tests passed; lint passed with 12 pre-existing warnings; production build passed |
| Reliability initiative | GitHub issue #287 created and Initiative 4 added to `ACTIVE-SPRINT.md` |
| Full platform assessment | Completed in `docs/PLATFORM-ASSESSMENT-2026-07-13.md`; founding parcel integrity, isolated QA, release protection, spreadsheet import safety, and trace-based testing are the ordered priorities |
| Founding acceptance truth check | Official data confirms 50×100 feet and R-4, which fails standard R-4 area/width; county nonconforming-lot exceptions make the definitive “unbuildable” claim itself unproven without ownership/title and permitting evidence. The app lacks dimensions/exception/provenance logic, a real Florida data path, canonical fixture/test, MAO formula alignment, and no-re-entry deal creation. |
| Production release protection | `main` now requires CI (including production build) and Vercel, enforces protection for administrators, requires up-to-date linear PR merges and resolved conversations, and blocks force pushes/deletion; emergency procedure documented |
| National county strategy | Volusia is now explicitly one acceptance case, not the product scope. Issue #296 defines verified, national-baseline, and on-demand county coverage with authority/provenance and review gates. |
| Source discovery leads | PRs #332/#333 introduce a code-managed capability registry and super-admin discovery endpoint. Adapter output is stored only as idempotent, non-authoritative review leads; PR #335 lets a super-admin promote a reviewed lead to an explicitly unverified source without verifying authority or publishing claims. PR #337 proves county-specific precedence with Volusia official candidates for the six core office types. |
| Jurisdiction publication safety | Issue #308 adds a versioned question library and fail-closed publication policy. AI extraction now produces pending candidates only; confidence cannot publish truth. Sourced human review is required, high-risk claims cannot be batch-approved, and server-owned provenance is stamped as `REVIEWED` rather than `VERIFIED`. Legacy profile JSON is intentionally not relabeled; later #296 slices now provide authority, history, snapshots, freshness, and contradiction controls. |
| Jurisdiction claim/evidence ledger | Issue #310 makes every new profile write an atomic claim + copied-evidence + read-projection operation. Source authority validation is persisted separately from expected authority, stale candidate/source review races fail closed, superseded claims remain traceable, and legacy JSON is visibly labeled as lacking provenance. Authority, snapshots, freshness, and contradiction handling shipped in #312/#314/#316/#318; researched legacy migration and coverage workflows remain in #296. |
| Source authority review workflow | Issue #312 adds a filtered super-admin source queue and append-only verify/reject/reset decisions with authority evidence, server-owned reviewer/time, exact source-version concurrency, and atomic current-state projection. Discovery/AI cannot verify sources and existing claims are never retroactively promoted. Snapshot, freshness, and contradiction operations shipped in #314/#316/#318; bulk/adapted registries, migration, and coverage workflows remain in #296. |
| Browser verification foundation | Playwright now has a guarded, executable read-only health check. It requires an explicit non-production URL and produces standard failure artifacts; state-changing stories remain blocked until the isolated QA reset rehearsal is approved. |
| Production dependency hardening | Issue #338 identified 11 production audit findings. PR #339 moves the Prisma CLI to build tooling and resolves PostCSS to 8.5.19; PR #340 replaces the vulnerable `react-simple-maps` D3 chain. The combined production-only audit reports zero findings. |
| Immutable jurisdiction evidence | Issue #314 archives the exact Jina Markdown reviewed by AI under non-overwriting SHA-256 R2 keys and records every retrieval, including unchanged content. New AI candidates and claims retain server-trusted snapshot provenance; legacy snapshot-less AI candidates fail closed. This is a transformed evidence representation, not mislabeled original county source bytes. Freshness and contradiction controls shipped in #316/#318; researched migration and coverage workflows remain in #296. |
| Jurisdiction claim freshness and re-review | Issue #316 makes volatility a versioned question-catalog policy, schedules every new claim from its evidence retrieval time, and exposes current/review-due/stale state in investor and super-admin views. Reconfirmation requires a newer unchanged snapshot from the same source, exact-version concurrency, and an append-only copied-evidence decision. Existing unclassified claims fail closed as immediately stale; contradictions, researched migration, and coverage workflows remain in #296. |
| Jurisdiction contradiction resolution | Issue #318 compares pending candidates with the claim ID in the current profile projection. Differing values/units block investor reliance and batch publication until a super-admin records an explained replace, reject-challenge, or not-comparable decision. Resolutions are append-only with copied evidence and exact candidate/claim concurrency; researched legacy migration and coverage workflows remain in #296. |
| Legacy jurisdiction containment | A read-only production inventory found 40,005 populated profile fields across all 3,143 counties but zero claims, evidence snapshots, freshness records, or verified source authorities. Issue #320 quarantines those legacy values from investor jurisdiction hubs, deal context, and checklist interpolation unless the projected claim ID resolves to the active claim for the exact field. The data remains available to admins as a researched migration queue; it was not deleted or relabeled. |
| Jurisdiction coverage operations | Issue #322 adds a read-only super-admin coverage and migration queue. It measures exact active claim projections separately from legacy/invalid JSON, catalog gaps, stale or contradicted claims, pending candidates, verified authorities, tracked properties, and parcel research requests. Demand-first ordering makes the next research investment explicit without auto-publishing legacy data. |
| On-demand county research | Issue #324 separates shared county research work from tenant-scoped demand. Investors can request an incomplete county; the request records only their tenant's demand and reuses global discovery work. The investor report exposes an honest derived coverage state, while a super-admin queue shows execution, sources, candidates, and aggregate demand. Work status cannot manually verify a county or publish claims. |
| Development portability follow-up | GitHub context is portable, but WSL-specific root instructions, local secret recreation, and the lack of a dev-container/bootstrap contract remain. Issue #295 tracks reproducible WSL/macOS/cloud development and an Ionos-vs-Codespaces evaluation. |
| Environment lifecycle decision | There are no customers or customer data. The current live URL/database/Clerk state is classified as disposable shared integration. Issue #298 defines guarded full-state reset, versioned Gold-equivalent configuration, a clean release-candidate rehearsal, and fresh production cutover before external users. |
| Environment reset safety foundation | Issue #300 adds explicit logical environment identity, an authenticated dashboard designation, and a fail-closed non-destructive reset preflight before any reset implementation or mutation browser suite is allowed. |
| Runtime side-effect enforcement | Issue #302 centralizes fail-closed cron, email, auction, and AI policy. Guarded environments require explicit enablement; email supports no-send sink or exact-recipient allowlisting. |
| Deterministic integration database baseline | Issue #304 versions one explicitly tagged fixture tenant and adds dry-run planning plus guarded transactional replacement with durable reset-run auditing. It refuses R2/Stripe orphan risk; hosted execution remains blocked pending Clerk/R2 orchestration and environment access. |
| Guarded Clerk/R2 reset orchestration | Issue #306 adds count-only cross-service planning, authenticated Clerk instance-ID allow/deny checks, backend-only fixture tags with deterministic lookup/recreation, exact-prefix R2 cleanup with post-delete verification, verified identity rotation into the database transaction, and phase-specific retryable audit outcomes. No hosted mutation has been authorized or run. |

---

## Last Session (2026-06-16) — Production migration fix + Land module depth

| Work | Result |
|---|---|
| **Production bug found & fixed**: `ADD CONSTRAINT IF NOT EXISTS` (invalid Postgres) in migration `20260615200000_contact_fks_and_mf_lp_waterfall` had been silently failing CI since 2026-06-15 — prod was missing Contact CRM FK columns and the entire `DealMfLpInvestor`/`DealMfWaterfall` tables backing the "complete" Multifamily LP waterfall feature (PR #279) | Fixed + applied to prod — PR #285 |
| Land module depth: sync from research (button fills DealLand gaps from ParcelDataCache), raw land comps (`LandComp` table + $/acre UI), AI parcel summary (BYOK Claude Haiku, cached) | Merged — PR #286 |
| Discovered ACTIVE-SPRINT.md/STATUS.md were stale: #39/#40/#41/#42 had been listed as unbuilt for weeks when their full MVP lifecycle (P1-P4) had already shipped — only a narrower "depth" layer was actually missing | Corrected in `ACTIVE-SPRINT.md` |

## Prior Session (2026-06-16) — Pre-purchase research + MAO calculator (implementation shell)

| Work | Result |
|---|---|
| Pre-purchase Parcel Research + MAO Calculator | Merged — PR #284 + adaa9a3; canonical acceptance was later found unimplemented/unproven and is reopened in Initiative 4 |
| `lib/parcel/research-profile.ts` — standalone ParcelProfile assembly without Deal | Done |
| `lib/mao/calculator.ts` — MAO formulas + MaoWarningType (unbuildable vs data_gap) | Done |
| `POST /api/parcels/pre-purchase-research` — enriches, evaluates 30 exits, computes MAO | Done |
| `/dashboard/research` — county search, manual entry, exit cards, MAO tiles, BidComparison | Done |
| Fix: wonky bid-vs-MAO logic — split unbuildable vs data-gap, conservative threshold for warned parcels | Done — adaa9a3 |

## Prior Session (2026-06-15) — Spec + Interview

| Work | Result |
|---|---|
| Founder interview — core problem, who it's for, MAO spec | Complete |
| Added verification rule to CLAUDE.md (Rule 1) | Pushed to main |
| Updated STRATEGY.md — founding problem, core flow, MAO formulas, who it's for/not for | Pushed to main |
| Updated ACTIVE-SPRINT.md — pre-purchase parcel research + MAO calculator inserted as new priority 1 | Pushed to main |
| Memory files updated with interview context and founder profile | Done |

---

## Prior Session (2026-06-15)

| Work | Result |
|---|---|
| Fix: state summary bar text wrapping on jurisdiction map page | Pushed — c55b1c4 |
| Fix: `.npmrc` legacy-peer-deps — resolved Vercel build failure (react-simple-maps + React 19) | Pushed — 53ae726 |
| #229-P9 Admin parcel research service — research-on-demand for investors | Merged — PR #273 |
| Jurisdictions: geographic SVG state map + zoom | Merged — PR #272 |
| #229-P8 ExitEvaluation cache table + InvestorProfile persistence | Merged — PR #271 |
| #229-P7 Deal-page "What are my exits?" UI | Merged — PR #270 |
| #229-P6 JurisdictionFacts accessor + Prisma adapter | Merged — PR #269 |
| Jurisdictions: replace tile grid with filterable table + US tile map + multi-strategy New Deal | Merged — PR #267 |
| Fix: new-deal form filtered by isAvailable; switched to investmentType (all FL counties now visible) | Merged — PR #264 |
| #229-P5 Exit evaluators — all 30 exits across 8 strategy families | Merged — PR #268 |
| #229-P3 Zoning data layer + PostGIS spatial join service | Merged — PR #266 |
| #229-P2 Parcel data sourcing pipeline + ParcelDataCache schema | Merged — PR #265 |
| #229-P1 Parcel profile data model + APN normalization | Merged — PR #262 |

---

## Pending Actions

> Items requiring human input. Agents: add a row here when a PR ships something that needs a human step. Clear the row when done.

| Action | Blocking? | Added | Notes |
|---|---|---|---|
| ~~Add `ANTHROPIC_API_KEY` (platform key) to Vercel env vars~~ | ~~No~~ | 2026-06-15 | ✅ Done 2026-06-15 |
| Run NETROnline seed for FL counties manually | No — only needed once after #131-P3 deploy | 2026-06-15 | Requires Playwright + browser session (uses JS rendering). Run manually in user session once Playwright is configured. |
| ~~**Acceptance test PR #284**~~ | ~~Yes~~ | 2026-06-15 | ✅ Done — PR #284 merged, wonky logic fix pushed adaa9a3 |
| **Manual click-through PR #286** — Land sync/comps/AI summary | No — build/lint/tsc all passed pre-merge | 2026-06-16 | Open a Land deal: click "Sync from research", add 2 comps, click "Generate" on AI summary (needs an Anthropic key in Settings). Not yet manually verified in the live app. |
| Verify or grant Vercel, Neon, and Clerk administration for isolated QA setup | Yes — blocks automated browser tests that save data, not repository work | 2026-07-13 | WSL currently has no Vercel CLI/link. Configure the logical integration identity, verified service allowlists, reset-safe runtime modes, and fixture credentials. #300/#302/#304/#306 provide the repository guards/orchestration; mutation tests remain blocked until the non-mutating plan and controlled hosted reset rehearsal pass. |

---

## Next Up

1. Continue the national jurisdiction intelligence/on-demand research architecture: turn the quarantined legacy inventory into an evidence-backed migration queue, then add coverage/on-demand workflows and Volusia as one canonical proof case.
2. Make development reproducible across WSL, macOS, and an approved cloud host; implement the guarded integration reset and isolated QA lifecycle.
3. Implement Playwright trace/report verification, mutation observability, spreadsheet import safety, and rehearse a clean production cutover.

---

## Key Facts (quick reference)

- **Live at:** metisplatforms.com — Vercel auto-deploys on every merge to `main`
- **AI gating:** `Tenant.anthropicApiKey IS NOT NULL` — BYOK, no platform key fallback
- **Module gating:** `hasStrategy()` / `hasTier()` in `lib/entitlements.ts`
- **Prisma client import:** `@/app/generated/prisma` — NOT `@prisma/client`
- **Clerk middleware:** `proxy.ts` at root — NOT `middleware.ts`
- **Active strategies:** TAX_LIEN · TAX_DEED · FORECLOSURE · LAND · WHOLESALE · FIX_FLIP · BUY_HOLD · MULTIFAMILY
