# STATUS.md — Current State

> Updated after every PR merge. One-stop snapshot for session start.
> Strategy: `STRATEGY.md` | Architecture: `ARCHITECTURE.md` | Sprint queue: `ACTIVE-SPRINT.md`
> Last updated: 2026-07-13

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
| Founding acceptance truth check | UI and evaluator shell exist, but dimensions/setback-envelope logic, a real Florida data path, canonical fixture/test, MAO formula alignment, and no-re-entry deal creation are missing |

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
| Verify or grant Vercel, Neon, and Clerk administration for isolated QA setup | Yes — blocks automated browser tests that save data, not the repository assessment | 2026-07-13 | WSL currently has no Vercel CLI/link. Automated tests must not use the production Clerk tenant or production Neon database. |

---

## Next Up

1. Repair and automatically prove the founding Volusia parcel acceptance flow.
2. Provision isolated QA and harden the production release gate.
3. Implement Playwright trace/report verification, mutation observability, and spreadsheet import safety.

---

## Key Facts (quick reference)

- **Live at:** metisplatforms.com — Vercel auto-deploys on every merge to `main`
- **AI gating:** `Tenant.anthropicApiKey IS NOT NULL` — BYOK, no platform key fallback
- **Module gating:** `hasStrategy()` / `hasTier()` in `lib/entitlements.ts`
- **Prisma client import:** `@/app/generated/prisma` — NOT `@prisma/client`
- **Clerk middleware:** `proxy.ts` at root — NOT `middleware.ts`
- **Active strategies:** TAX_LIEN · TAX_DEED · FORECLOSURE · LAND · WHOLESALE · FIX_FLIP · BUY_HOLD · MULTIFAMILY
