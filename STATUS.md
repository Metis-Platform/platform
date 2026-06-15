# STATUS.md — Current State

> Updated after every PR merge. One-stop snapshot for session start.
> Strategy: `STRATEGY.md` | Architecture: `ARCHITECTURE.md` | Sprint queue: `ACTIVE-SPRINT.md`
> Last updated: 2026-06-15

---

## Current Phase

Post-beta sprint: **#131 Jurisdiction Intelligence** + **#229 Parcel Intelligence / Exit Engine** complete. Next queue is **Initiative 3 — Module Depth** in `ACTIVE-SPRINT.md`.

---

## Open PRs

Run `gh pr list --state open` — this file does not mirror PR state.

---

## Last Session (2026-06-15)

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

---

## Next Up

| Priority | Issue | Title |
|---|---|---|
| 1 | — | Contact CRM primitive — platform-wide contact record |
| 2 | #39 | Land module depth — GIS overlays, water/well lookup, raw land comps, AI parcel summary |
| 3 | #40 | Wholesale module depth — seller pipeline, buyer matching, assignment fee calc |

---

## Key Facts (quick reference)

- **Live at:** metisplatforms.com — Vercel auto-deploys on every merge to `main`
- **AI gating:** `Tenant.anthropicApiKey IS NOT NULL` — BYOK, no platform key fallback
- **Module gating:** `hasStrategy()` / `hasTier()` in `lib/entitlements.ts`
- **Prisma client import:** `@/app/generated/prisma` — NOT `@prisma/client`
- **Clerk middleware:** `proxy.ts` at root — NOT `middleware.ts`
- **Active strategies:** TAX_LIEN · TAX_DEED · FORECLOSURE · LAND · WHOLESALE · FIX_FLIP · BUY_HOLD · MULTIFAMILY
