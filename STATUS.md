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
| #131-P7 In-deal jurisdiction surfacing — stage-aware context on deal pages | Merged — PR #258 |
| #131-P6 Jurisdiction research hub — per-strategy tabs + provenance display | Merged — PR #256 |
| #131-P5 Market signals ingestion + opportunity/saturation scoring | Merged — PR #254 |

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
| 1 | #226 | #131-P8 Per-deal DD checklist generation from strategy × jurisdiction matrix |
| 2 | #230 | #229-P1 ParcelProfile + APN normalization |
| 3 | #234 | #229-P5 Exit evaluators — all 30 exits across 8 strategy families |

---

## Key Facts (quick reference)

- **Live at:** metisplatforms.com — Vercel auto-deploys on every merge to `main`
- **AI gating:** `Tenant.anthropicApiKey IS NOT NULL` — BYOK, no platform key fallback
- **Module gating:** `hasStrategy()` / `hasTier()` in `lib/entitlements.ts`
- **Prisma client import:** `@/app/generated/prisma` — NOT `@prisma/client`
- **Clerk middleware:** `proxy.ts` at root — NOT `middleware.ts`
- **Active strategies:** TAX_LIEN · TAX_DEED · FORECLOSURE · LAND · WHOLESALE · FIX_FLIP · BUY_HOLD · MULTIFAMILY
