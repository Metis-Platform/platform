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
| #131-P3 Admin AI extraction pipeline | Merged — PR #246 |
| #131-P2 Seed 3,143 counties + 50-state statutory baseline | Merged — PR #244 (6 bugs fixed post-review) |
| Doc/process cleanup (PR template, issue standard, archive BETA/ADMIN-PLAN) | PRs #242 #243 #245 |

---

## Next Up

| Priority | Issue | Title |
|---|---|---|
| 1 | #222 | #131-P4 Auction platform feeds — GovEase, RealAuction, Tax Sale Resources |
| 2 | #230 | #229-P1 ParcelProfile + APN normalization |
| 3 | #231 | #229-P4 exit-engine core |

---

## Key Facts (quick reference)

- **Live at:** metisplatforms.com — Vercel auto-deploys on every merge to `main`
- **AI gating:** `Tenant.anthropicApiKey IS NOT NULL` — BYOK, no platform key fallback
- **Module gating:** `hasStrategy()` / `hasTier()` in `lib/entitlements.ts`
- **Prisma client import:** `@/app/generated/prisma` — NOT `@prisma/client`
- **Clerk middleware:** `proxy.ts` at root — NOT `middleware.ts`
- **Active strategies:** TAX_LIEN · TAX_DEED · FORECLOSURE · LAND · WHOLESALE · FIX_FLIP · BUY_HOLD · MULTIFAMILY
