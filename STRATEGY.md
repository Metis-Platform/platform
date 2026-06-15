# Metis Platform — Product Strategy

> Current execution queue: `ACTIVE-SPRINT.md`
> Architecture and technical decisions: `ARCHITECTURE.md`

---

## Vision

An AI-powered, multi-tenant SaaS platform for real estate investors. A universal deal and property management engine with pluggable investment strategy modules — starting with tax liens, expanding to all major REI strategies. The AI layer handles document extraction, deadline enforcement, deal analysis, exit strategy evaluation, and an in-app Deal Copilot.

**Tagline:** *The AI-powered real estate investment command center.*

---

## North Star

**Become THE definitive main hub for real estate investors — replace their spreadsheets entirely and drastically simplify their process.**

Every feature decision is tested against these goalposts:

1. **Spreadsheet-retirement test.** A module ships when an investor can retire the spreadsheet it replaces — computed economics, money ledgers, generated checklists — not when it adds data entry beside the spreadsheet.
2. **Legitimate product before premium price.** Pricing tiers unlock only when shipped capability earns them.
3. **Modular buy-in.** Investors adopt strategy by strategy; each module must be independently valuable on day one of its purchase.
4. **Data moat.** Jurisdiction/county depth and the investor's own portfolio history are the defensible assets no spreadsheet or incumbent replicates.
5. **Simplification is the metric.** Measure releases by investor process steps removed, not feature count.
6. **Platform primitives, not module one-offs.** Ledger, checklist engine, Contact CRM, GeoService: build once, every strategy benefits.

---

## Competitive Position

| Feature | PropStream | FastLien | Tax Sale Resources | Metis |
|---|---|---|---|---|
| Rule-based lifecycle tracking | No | Partial | Partial | Yes — core |
| AI document extraction | No | No | No | Yes |
| Jurisdictional deadline logic | No | Manual | Partial | Yes — automated |
| Multi-strategy (lien, flip, wholesale, etc.) | No | No | No | Yes |
| In-app AI assistant | No | No | No | Yes |
| Exit strategy engine | No | No | No | Yes |
| Multi-tenant SaaS | No | Yes | Yes | Yes |

---

## Platform Primitives

Two shared services must be built before Phase 4-full module depth. Build once; every strategy module references them.

**Contact CRM**
- Platform-wide contact record: name, role, contact info, outreach history, linked deals, pipeline stage
- Required by: Wholesale (seller pipeline), Fix & Flip (contractor bids), Buy & Hold (tenant + vendor), Land (seller outreach)

**GeoService**
- Reusable geospatial lookup layer: flood zone (FEMA), zoning, utility proximity, road frontage, soil type, comparable parcel sales
- Foundation for: Land module, Tax Sale due diligence, Parcel Intelligence (#229)
- ⚠️ `#229-P3` (PostGIS spatial join) must be designed as this reusable service from day one — not a one-off zoning lookup

---

## Module Depth Specs

Each module passes the **spreadsheet-retirement test** before shipping. Specs below define what that means per strategy.

### Land Investing (#39) — first Phase 4-full module after #229
*Retire: county GIS + Google Earth + soil maps + FEMA flood map*
- GIS overlays: flood zone, utility proximity, road frontage, soil type (GeoService)
- Water/well availability lookup
- Raw land comparable sales (not residential comps)
- AI parcel summary from all data sources
- Depends on: #229-P2 (parcel data), #229-P3 (GeoService)

### Wholesale (#40)
*Retire: seller pipeline CRM spreadsheet*
- Full seller pipeline: lead → contacted → offer sent → under contract → assigned/dead
- Mailing/outreach log per contact
- Buyer matching — surface BuyerProfiles matching deal criteria
- Assignment fee + double-close profit calc
- Depends on: Contact CRM

### Fix & Flip (#41)
*Retire: rehab budget and draw tracking spreadsheet*
- Line-item scope builder with regionalized unit costs
- Multi-contractor bid comparison for the same SOW
- Draw schedule tied to construction milestones
- ARV sourced from market data
- AI SOW extraction from contractor bids ✅ (PR #216)
- Depends on: Contact CRM

### Buy & Hold + Section 8 (#42)
*Retire: tenant and lease management spreadsheet*
- Per-unit tenant records
- Lease start/end/renewal + rent per unit
- Maintenance request log with vendor assignment
- Section 8 HAP contract + HQS inspection tracking
- Rent roll view across all properties
- Depends on: Contact CRM

### Multifamily (#43)
*Retire: deal underwriting and LP tracking spreadsheet*
- T12 importer + DSCR modeling ✅ (PR #217)
- AI offering memorandum extraction ✅
- Investor waterfall modeling (LP/GP split, preferred return, promote)
- Capital raise tracking (committed vs. funded per LP)

---

## Go-to-Market

**Target communities:** BiggerPockets, Tax Lien Lady, TaxSaleResources forums, REI Facebook groups

**Lead pitch:** "AI platform that auto-tracks lien deadlines and reads your certificates."

**Content:** "How to never miss a tax lien deadline" / "What PropStream doesn't tell you"

**Launch:** Product Hunt at v1.0 · Tax lien attorney outreach · GovEase / Bid4Assets partnerships

**Revenue targets:**

| Milestone | Paid users | Avg rev/user | MRR |
|---|---|---|---|
| Near term | 50 | $75 | ~$3,750 |
| Month 12 | 200 | $85 | ~$17,000 |
| Month 18 | 500 | $100 | ~$50,000 |
