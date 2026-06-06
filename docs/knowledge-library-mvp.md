# Knowledge Library MVP

**Linear:** METIS-23<br>
**Status:** implementation planning baseline<br>
**Scope:** investor education, jurisdiction guidance, and reusable source links for tax lien, tax deed, foreclosure, and land workflows.

## Goal

Give Metis a practical knowledge layer that helps users understand what to do next, why a rule matters, and where to verify facts. The MVP should start as curated, structured content that can be linked from deals, jurisdictions, tasks, due-diligence items, and future AI answers.

## MVP product principles

1. **Curated before generated.** Ship trusted human-authored entries first; AI can summarize or retrieve later, but should not be the source of record.
2. **Source-backed guidance.** Content that describes deadlines, auction rules, notices, or risk should link to source URLs or internal jurisdiction/rule references.
3. **Strategy-aware but reusable.** One library should support tax lien, tax deed, foreclosure, and land content without duplicating generic concepts.
4. **Contextual surfaces beat a wiki island.** Users should find relevant entries from the place they are working: deal detail, jurisdiction hub, due-diligence checklist, and task context.
5. **Tenant-safe by default.** Global seed content is shared; tenant/private notes can be added later and must never leak across tenants.
6. **No secrets or legal promises.** Content should educate and cite sources, not store credentials or provide guaranteed legal advice.

## Recommended MVP data model

Add a lightweight knowledge domain beside existing jurisdictions, rules, tasks, documents, and future due-diligence models.

### `KnowledgeEntry`

Reusable content unit.

- `id`
- `tenantId` nullable for global seed entries now / tenant-owned entries later
- `slug` stable unique slug for links and seeded updates
- `title`
- `summary`
- `bodyMarkdown`
- `entryType` (`GUIDE`, `GLOSSARY`, `CHECKLIST_HELP`, `SOURCE_NOTE`, `FAQ`, `TEMPLATE`)
- `status` (`DRAFT`, `PUBLISHED`, `ARCHIVED`)
- `reviewedAt` nullable
- `reviewedByUserId` nullable
- timestamps

### `KnowledgeEntryTag`

Structured tagging for filtering and contextual lookup.

- `id`
- `entryId`
- `tagType` (`STRATEGY`, `AREA`, `JURISDICTION`, `RISK`, `WORKFLOW`, `CONTENT_TYPE`)
- `value` such as `tax-lien`, `calendar`, `FL`, `redemption`, `notice`, `glossary`

### `KnowledgeSource`

External or internal source citation.

- `id`
- `entryId`
- `title`
- `url` nullable for external source
- `jurisdictionId` nullable for county/state-specific references
- `ruleId` nullable for rule-engine references
- `sourceType` (`GOVERNMENT`, `COURT`, `STATUTE`, `COUNTY_PAGE`, `INTERNAL_RULE`, `OTHER`)
- `lastVerifiedAt` nullable
- `notes` nullable

### `KnowledgeLink`

Contextual relationship from content to product objects.

- `id`
- `entryId`
- `jurisdictionId` nullable
- `ruleId` nullable
- `dueDiligenceTemplateItemId` nullable, when the diligence engine lands
- `strategyType` nullable
- `placement` (`DEAL_DETAIL`, `JURISDICTION_HUB`, `DUE_DILIGENCE_ITEM`, `TASK_DETAIL`, `CALENDAR_EVENT`, `GLOBAL_LIBRARY`)
- timestamps

## Initial seeded entries

### Tax lien foundations

- What a tax lien certificate is
- Redemption period basics
- Interest, premium, penalty, and ROI glossary
- Common lien investor risks: senior liens, bankruptcy, bad parcel data, environmental issues
- What to verify before bidding

### Tax deed and foreclosure foundations

- Tax lien vs tax deed vs foreclosure sale
- Contest/redemption windows after sale
- Occupancy and possession risk primer
- Title and quiet-title basics
- Auction overbid and surplus concepts

### Jurisdiction research help

- How to use a county treasurer/tax collector site
- How to verify APN/parcel identity
- How to capture official source links in Metis
- How to confirm deadline calculations against local rules

### Due diligence help text

- Required vs optional evidence
- What counts as evidence for `NOT_APPLICABLE`
- When to create a follow-up task from a diligence gap
- How to document a blocker vs a concern

## MVP UI surfaces

1. **Global library page:** searchable list of published entries with filters by strategy, area, jurisdiction, and content type.
2. **Entry detail page:** title, summary, body, tags, citations, and related product links.
3. **Jurisdiction hub panel:** show entries tagged to the state/county plus general strategy guidance.
4. **Deal detail help drawer:** show strategy-specific entries and entries linked through the deal jurisdiction.
5. **Due diligence item help:** once METIS-22 is implemented, attach help entries to checklist items.
6. **Task context link:** optional “Why this matters” link for generated or rule-derived tasks.

## API / service outline

- `GET /api/knowledge` — list published entries with filters.
- `GET /api/knowledge/[slug]` — fetch one entry with tags, sources, and related links.
- `GET /api/jurisdictions/[id]/knowledge` — contextual entries for a jurisdiction.
- `GET /api/deals/[id]/knowledge` — strategy + jurisdiction entries for a deal.
- Admin-only future endpoints:
  - `POST /api/admin/knowledge`
  - `PATCH /api/admin/knowledge/[id]`
  - `POST /api/admin/knowledge/[id]/sources`

Service helpers:

- `listPublishedKnowledgeEntries(filters, tenantId?)`
- `getKnowledgeEntryBySlug(slug, tenantId?)`
- `getContextualKnowledgeForDeal(dealId, tenantId)`
- `getContextualKnowledgeForJurisdiction(jurisdictionId, strategyType?)`

Global content reads do not require tenant ownership, but any tenant-owned content must be scoped by `tenantId`.

## Implementation slices

1. **Schema + seed baseline**
   - Add Prisma knowledge models/enums.
   - Seed global tax lien glossary and jurisdiction research entries.
   - Add read-only service helpers.
2. **Global library UI**
   - Add searchable `/dashboard/knowledge` index and entry detail pages.
   - Render Markdown safely.
3. **Contextual jurisdiction/deal panels**
   - Surface relevant entries on jurisdiction detail and deal detail pages.
   - Link existing research hub content to library entries where useful.
4. **Source verification workflow**
   - Track `lastVerifiedAt` and show stale-source warnings for county/statute links.
5. **Due-diligence integration**
   - Link entries to due-diligence template items from METIS-22 implementation.

## Open decisions

1. Should tenant admins be able to create private knowledge entries in v1, or should the MVP remain global/read-only?
2. Should Markdown be enough for v1, or should entries use rich structured blocks for callouts, warnings, and source cards?
3. What review cadence should mark county/statute sources as stale: 90 days, 180 days, or annual?
4. Should legal-disclaimer text appear globally, per entry, or only on legal/rule-related content?
5. Should future AI answers cite `KnowledgeSource` records only, or can they cite arbitrary uploaded documents too?

## Verification plan for implementation PRs

Each implementation slice should run:

- `source /home/xovox/.nvm/nvm.sh && npm run lint`
- `source /home/xovox/.nvm/nvm.sh && npm run build`
- Manual check: open the library page, search/filter entries, open an entry detail page, and verify contextual links from jurisdiction/deal pages.
