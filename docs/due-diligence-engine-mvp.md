# Due Diligence Engine MVP

**Linear:** METIS-22<br>
**Status:** implementation planning baseline<br>
**Scope:** strategy-aware due-diligence checklists for tax lien, tax deed, foreclosure, and land prospects/deals.

## Goal

Turn Metis from a deal tracker into an operating system for investor due diligence: every deal should expose the questions that must be answered, the evidence supporting each answer, and the operational tasks created by missing or risky items.

## MVP product principles

1. **Checklist templates are reusable.** Templates are seeded by strategy and can later be customized per tenant.
2. **Checklist instances are deal-scoped.** A deal/prospect receives a snapshot of the active template so future template edits do not rewrite historical diligence.
3. **Jurisdiction context augments, not replaces, templates.** State/county rules add requirements, warnings, and source links to specific items.
4. **Evidence is first-class.** Items should support manual notes now and document/source references later.
5. **Operational gaps create tasks.** Required unanswered or blocker items can generate follow-up tasks tied to the deal.
6. **No AI dependency for MVP.** The first version must work manually; AI extraction/copilot can populate or explain items later.

## Recommended MVP data model

Add a checklist domain beside the existing `Deal`, `Task`, `Document`, and `Jurisdiction` models.

### `DueDiligenceTemplate`

Reusable checklist definition.

- `id`
- `tenantId` nullable for global seed templates now / tenant-specific templates later
- `strategyType` (`TAX_LIEN`, `TAX_DEED`, `FORECLOSURE`, `LAND`, future strategy types)
- `name`
- `description`
- `version`
- `isActive`
- timestamps

### `DueDiligenceTemplateSection`

Ordered grouping for template items.

- `id`
- `templateId`
- `title`
- `description`
- `position`

### `DueDiligenceTemplateItem`

Reusable question/check definition.

- `id`
- `sectionId`
- `key` stable slug for seeded updates
- `prompt`
- `helpText`
- `required` boolean
- `defaultSeverity` (`INFO`, `WARNING`, `BLOCKER`)
- `expectedEvidenceType` (`NONE`, `TEXT`, `DOCUMENT`, `URL`, `DATE`, `MONEY`, `BOOLEAN`)
- `jurisdictionRuleKey` nullable, for linking to jurisdiction/rule engine knowledge
- `position`

### `DueDiligenceChecklist`

Deal-scoped template snapshot.

- `id`
- `tenantId`
- `dealId`
- `templateId`
- `templateVersion`
- `status` (`NOT_STARTED`, `IN_PROGRESS`, `READY_FOR_REVIEW`, `COMPLETE`, `BLOCKED`)
- `summaryRisk` (`UNKNOWN`, `LOW`, `MEDIUM`, `HIGH`, `BLOCKER`)
- timestamps

### `DueDiligenceChecklistItem`

Deal-specific answer and risk state.

- `id`
- `checklistId`
- `templateItemId`
- snapshot fields: `sectionTitle`, `prompt`, `helpText`, `required`, `severity`
- `status` (`UNANSWERED`, `CONFIRMED`, `CONCERN`, `BLOCKER`, `NOT_APPLICABLE`)
- `answerText`
- `evidenceDocumentId` nullable
- `sourceUrl` nullable
- `taskId` nullable, for generated follow-up work
- `completedByUserId` nullable
- `completedAt` nullable
- timestamps

## Initial status semantics

| Status | Meaning | MVP behavior |
|---|---|---|
| `UNANSWERED` | Not yet evaluated | Required items remain visible as gaps |
| `CONFIRMED` | Satisfactory answer/evidence exists | Counts toward completion |
| `CONCERN` | Issue exists but may be acceptable | Raises checklist risk |
| `BLOCKER` | Deal should not proceed without resolution | Raises checklist status/risk to blocked |
| `NOT_APPLICABLE` | Validly skipped with explanation | Counts as resolved if note is present |

## Initial seeded templates

### Tax lien certificate template

Sections and representative items:

1. **Certificate identity**
   - Certificate number recorded
   - Parcel/APN recorded
   - Face amount and premium recorded
   - Interest/redemption terms confirmed
2. **Jurisdiction and deadlines**
   - State/county matched to jurisdiction record
   - Redemption end date generated or manually confirmed
   - Notice/filing deadlines reviewed
3. **Property verification**
   - Property address/APN cross-checked with county source
   - Assessed value or rough value source captured
   - Obvious environmental/land-use red flags reviewed
4. **Owner and lien position**
   - Owner name/source captured
   - Competing liens or senior encumbrances reviewed
   - Bankruptcy/foreclosure conflict checked when relevant
5. **Exit decision**
   - Minimum acceptable ROI recorded
   - Blockers resolved or deal marked blocked

### Tax deed / foreclosure template

Focus on auction facts, redemption/contest windows, title risk, possession/occupancy, and post-sale filing requirements.

### Land template

Focus on access, zoning, utilities, flood/wetlands, title/ownership, marketability, and disposition assumptions.

## MVP UI surfaces

1. **Deal detail tab:** `Due Diligence` tab beside events/tasks/documents.
2. **Checklist panel:** sections with progress counts and required gaps.
3. **Item editor:** status selector, notes, optional document/source URL link, and “create follow-up task”.
4. **Deal list signal:** compact diligence chip (`Not started`, `3 gaps`, `Concern`, `Blocked`, `Complete`).
5. **Task integration:** generated tasks link back to the checklist item and deal.

## API / service outline

- `POST /api/deals/[id]/due-diligence/checklists` — instantiate default template for a deal.
- `GET /api/deals/[id]/due-diligence/checklists` — load checklist with sections/items.
- `PATCH /api/due-diligence/items/[id]` — update status, note, evidence/source.
- `POST /api/due-diligence/items/[id]/task` — create linked follow-up task.
- Service helpers:
  - `getDefaultDueDiligenceTemplate(strategyType, jurisdictionId?)`
  - `instantiateDueDiligenceChecklist(dealId, templateId, tenantId)`
  - `recalculateDueDiligenceSummary(checklistId, tenantId)`

All reads/writes must be tenant-scoped and follow the same isolation pattern used by existing deal/task APIs.

## Implementation slices

1. **Schema + seed baseline**
   - Add Prisma checklist models and enums.
   - Seed global tax lien template.
   - Add tenant-scoped service functions and unit-level verification where practical.
2. **Deal detail checklist UI**
   - Add read/update checklist tab to deal detail.
   - Allow manual item status and notes.
3. **Task generation**
   - Generate/link tasks for required unanswered/blocker items.
   - Surface generated tasks in existing task board/deal tasks.
4. **Jurisdiction augmentation**
   - Attach jurisdiction rule/source hints to template items.
   - Start with tax lien redemption/deadline checks.
5. **Template expansion**
   - Add tax deed/foreclosure/land seed templates.

## Open decisions

1. Should global seed templates be editable by tenant admins in v1, or copied into tenant-owned templates first?
2. Should checklist instantiation be automatic on deal creation, or user-triggered from the deal detail page?
3. Is one active checklist per deal enough for MVP, or should a deal support multiple strategy/checklist types immediately?
4. Should generated tasks be automatic for required gaps, or created only when the user clicks “create task”?
5. What minimum evidence is required for `NOT_APPLICABLE` on required items?

## Verification plan for implementation PRs

Each implementation slice should run:

- `source /home/xovox/.nvm/nvm.sh && npm run lint`
- `source /home/xovox/.nvm/nvm.sh && npm run build`
- Manual check: create/load a deal, instantiate checklist, update item statuses, and verify task linking where implemented.
