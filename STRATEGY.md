# Metis Platform — Product Strategy

> Current execution queue: `ACTIVE-SPRINT.md`
> Architecture and technical decisions: `ARCHITECTURE.md`

---

## Founding Problem

A new investor buys a vacant parcel at a tax deed auction — pays $19,300, discovers afterward that county setback rules and lot dimensions make it unbuildable for any permitted residential structure. Even Habitat for Humanity can't get approval. The information that would have prevented this was always public — it lives in county GIS databases, zoning records, and building codes. But it's scattered, inaccessible, and nobody synthesizes it before you bid. The $20k mentor calls it "an expensive boo boo."

**Metis exists to prevent that.** The primary job is to tell an investor what a parcel is worth, what they can do with it, and what the most they should pay is — before they bid. The secondary job is to manage the deal after they win.

---

## Vision

An AI-powered, multi-tenant SaaS platform for real estate investors. A universal deal and property management engine with pluggable investment strategy modules — starting with tax liens and deeds, expanding to all major REI strategies. The AI layer handles pre-purchase parcel intelligence, document extraction, deadline enforcement, deal analysis, exit strategy evaluation, and an in-app Deal Copilot.

**Tagline:** *The AI-powered real estate investment command center.*

**Business model:** SaaS. The founder's goal is to transition from active REI deal income to platform revenue — building a service that helps thousands of investors, not just a personal tool. The founder will continue investing (which validates the product) but the business exit is the platform itself.

---

## Who It's For

**Primary:** New-to-intermediate tax lien and deed investors who are still learning — motivated enough to bid but not yet experienced enough to evaluate a parcel confidently. They're making expensive, irreversible decisions with incomplete information.

**Secondary:** More experienced investors scaling up — researching more parcels per auction cycle than they can manually analyze. The platform saves time rather than mistakes.

**Secondary:** Investors expanding from liens/deeds into adjacent strategies (land, wholesale, fix & flip) who want the same decision support as they move into unfamiliar territory.

**Not for:**
- Passive investors (REITs, crowdfunding) — they don't evaluate parcels
- Residential real estate agents — wrong domain entirely
- Property managers at scale — different software category entirely
- Anyone needing audit-grade accounting or tax reporting
- Institutional buyers with in-house systems

---

## Core Product Flow

**Phase 1 — Pre-purchase research (the primary job):**
User is browsing an upcoming tax sale (realtaxdeed.com, county lists, etc.) and finds a parcel. They bring the APN or address to Metis. The platform:
1. Pulls parcel data (dimensions, zoning, setbacks, flood zone, GIS overlays)
2. Runs exit evaluators — determines every viable thing the investor could do with this property
3. Flags blocking issues (e.g., lot too small for permitted residential construction)
4. Pulls or estimates market value per viable exit (comparable land sales)
5. Calculates a MAO range (conservative / moderate / aggressive) per strategy

Output: **"Here's what this parcel is, here's what you can do with it, here's what you should pay."**

A parcel researched pre-bid becomes a deal automatically if the investor wins — no data re-entry.

**Phase 2 — Post-purchase lifecycle:**
Jurisdiction deadline tracking, checklist management, AI Copilot, exit engine re-run as conditions change.

---

## MAO Calculator Spec

| Strategy | Formula |
|---|---|
| Rural land | Market Value × 25–50% |
| Infill lots | Market Value × 40–70% |
| Fix & flip | ARV × 70% − Rehab cost |
| Wholesale | ARV × 70% − Rehab − Assignment fee |
| Tax lien | Interest rate + penalty based (separate formula) |

Output: conservative / moderate / aggressive bid ceiling with math shown — the investor learns the formula as they use it.

Market value input: user-provided initially; platform-assisted (comparable land sales from parcel pipeline) as data sources mature.

**Test parcel:** Volusia County FL — altkey `2340282` on the VCPA site (`vcpa.vcgov.org`). Unbuildable lot, no viable residential exits. This is the acceptance test for the pre-purchase analysis feature — it must surface the blocking issue and calculate a deeply discounted MAO for raw land only.

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

## National Jurisdiction Intelligence

Volusia County altkey `2340282` is a canonical acceptance case, not the geographic scope of the product. Metis must support an investor researching a parcel in any U.S. county and must state clearly what is verified, preliminary, contradictory, stale, or still unknown.

The national model has three coverage tiers:

1. **Verified priority coverage** — deeply researched counties with official sources, reviewed high-risk rules, freshness monitoring, and canonical parcel tests.
2. **National baseline coverage** — standardized parcel data plus authoritative federal/state layers and verified core jurisdiction sources where available.
3. **On-demand preliminary coverage** — when an investor selects an incomplete county, Metis discovers official sources, runs safe baseline checks, queues extracted claims for review, exposes missing evidence, and improves the shared county profile for every future investor.

Every decision-bearing fact must carry its source, authority class, geographic scope, effective/retrieved dates, evidence, extraction method, verification state, exceptions, and contradictions. AI confidence determines review priority; it is not authority. Legal, zoning, deadline, title, and buildability claims cannot become decision-grade solely because a model is confident.

Coverage is a product surface, not an internal implementation detail. Investors should see whether a conclusion is verified or preliminary, what evidence is missing, and what action would resolve it. The platform should measure verified investor-demand coverage and freshness—not merely the number of county rows in the database.

Implementation architecture and acceptance criteria are tracked in GitHub issue #296.

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
