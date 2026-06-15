# STATUS.md — Current State

> Updated after every PR merge. One-stop snapshot for session start.
> Strategy: `STRATEGY.md` | Architecture: `ARCHITECTURE.md` | Sprint queue: `ACTIVE-SPRINT.md`
> Last updated: 2026-06-15

---

## Current Phase

Post-beta sprint: **#131 Jurisdiction Intelligence** + **#229 Parcel Intelligence / Exit Engine** in parallel. See `ACTIVE-SPRINT.md` for ordered queue.

---

## Open PRs

Run `gh pr list --state open` — this file does not mirror PR state.

---

## Last Session (2026-06-15)

| Work | Result |
|---|---|
| #229-P2 Parcel data sourcing pipeline + ParcelDataCache schema | Merged — PR #265 |
| #229-P1 Parcel profile data model + APN normalization | Merged — PR #262 |
| #131-P8 Per-deal DD checklist generation from strategy × jurisdiction matrix | Merged — PR #260 |

---

## Pending Actions

> Items requiring human input. Agents: add a row here when a PR ships something that needs a human step. Clear the row when done.

| Action | Blocking? | Added | Notes |
|---|---|---|---|
| ~~Add `ANTHROPIC_API_KEY` (platform key) to Vercel env vars~~ | ~~No~~ | 2026-06-15 | ✅ Done 2026-06-15 |
| Run NETROnline seed for FL counties manually | No — only needed once after #131-P3 deploy | 2026-06-15 | `source /home/xovox/.nvm/nvm.sh && npx tsx prisma/seeds/seed-netronline.ts` — seeds FL county profile data from NETROnline scrape. Ready to run. |

---

## Next Up

| Priority | Issue | Title |
|---|---|---|
| 1 | #233 | #229-P3 Zoning data layer + PostGIS spatial join service |
| 2 | #234 | #229-P5 Exit evaluators — all 30 exits across 8 strategy families |
| 3 | #235 | #229-P6 JurisdictionFacts accessor + Prisma adapter |

---

## Key Facts (quick reference)

- **Live at:** metisplatforms.com — Vercel auto-deploys on every merge to `main`
- **AI gating:** `Tenant.anthropicApiKey IS NOT NULL` — BYOK, no platform key fallback
- **Module gating:** `hasStrategy()` / `hasTier()` in `lib/entitlements.ts`
- **Prisma client import:** `@/app/generated/prisma` — NOT `@prisma/client`
- **Clerk middleware:** `proxy.ts` at root — NOT `middleware.ts`
- **Active strategies:** TAX_LIEN · TAX_DEED · FORECLOSURE · LAND · WHOLESALE · FIX_FLIP · BUY_HOLD · MULTIFAMILY
