# STATUS.md — Current State

> Updated after every PR merge. One-stop snapshot for session start.
> Strategy: `STRATEGY.md` | Architecture: `ARCHITECTURE.md` | Sprint queue: `ACTIVE-SPRINT.md`
> Last updated: 2026-07-20

---

## Current Phase

Post-beta initiatives produced substantial jurisdiction, parcel, exit-engine, and module breadth. The 2026-07-13 truth check found that the founding parcel acceptance case is not actually satisfied, so that work is reopened as P0 rather than described as complete. **Initiative 4 — Platform Reliability and Verification (#287)** is active.

---

## Current Session (2026-07-20) — Multi-state acceptance, nationwide baseline repair, and runtime parity

| Work | Result |
|---|---|
| Second-state route acceptance | PR #383 adds a Maricopa/Phoenix case that retains incorporated-area ambiguity, leaves zoning unknown, and refuses a viable conclusion. Required CI and Vercel passed. |
| FEMA national flood baseline (#384) | The live official service showed that Flood Hazard Zones layer 28 no longer exposes `FIRM_PAN`; the old adapter silently returned empty facts. The adapter now queries zone and panel from their correct layers, fails closed on service errors/conflicts, omits non-intersections, and retains a clickable official source URL through the tenant cache. |
| FWS wetlands baseline (#388) | The official National Wetlands Inventory map service is queried at the parcel research point and retained with clickable provenance. A mapped feature is preliminary evidence only; no mapped feature is explicitly not a wetlands delineation, permitting, jurisdictional, or buildability determination, and service failures remain data gaps. |
| USDA SSURGO soils baseline (#390) | The official NRCS Soil Data Access point-intersection service returns only a SSURGO map-unit key/name with clickable provenance. It is preliminary map evidence, not a site investigation, delineation, engineering report, perc test, soil-suitability, permitting, or buildability determination; empty or failed lookups remain data gaps. |
| USDA SSURGO farmland-classification context (#421) | The same official map-unit lookup now retains its returned farmland classification when available. It is preliminary map evidence, not a parcel designation, onsite determination, zoning, permitting, or buildability conclusion; an unavailable classification remains unknown. |
| EPA CWA evidence correction (#392) | The prior adapter incorrectly converted EPA ECHO CWA/NPDES facility responses into Brownfield, underground-tank, and Superfund claims. It now exposes only a source-disclosed nearby CWA facility search result; empty results are not environmental clearance, failures are data gaps, and legacy unsupported EPA cache facts are quarantined. |
| Census demographic freshness (#394) | Parcel enrichment now uses the official 2020–2024 ACS five-year dataset and retains the exact dataset URL on cached demographic context. ACS remains area-level demographic context, not parcel identity, zoning, market value, authority, or a decision-grade property conclusion. |
| Auction feed availability truth (#396) | GovEase, RealAuction FL, and Tax Sale Resources are explicitly unavailable rather than simulated as zero-result weekly syncs. Their cron routes return inspectable skipped reasons before database/event writes, and the admin calendar treats any prior rows as historical data requiring independent verification. |
| USGS 3DEP elevation baseline (#400) | Parcel research now requests the official USGS National Map Elevation Point Query Service when coordinates are available, stores only its interpolated point elevation with a clickable source, and labels it as preliminary map evidence. It does not derive slope, drainage, flood risk, engineering suitability, survey elevation, or buildability. |
| USGS 3D Hydrography baseline (#410) | Parcel research now queries the current USGS 3D Hydrography flowline and waterbody layers at its research point. It shows mapped feature categories only as preliminary map evidence; an empty response is explicitly not a water, flood, wetlands, permitting, regulatory, or buildability determination. |
| USGS PAD-US federal fee-manager baseline (#419) | Parcel research now queries USGS's authoritative PAD-US federal fee-manager layer at its research point and retains the exact source URL with the cached result. It shows only mapped federal manager names as preliminary map evidence; an empty result is explicitly not an ownership, access, restriction, jurisdiction, permitting, or buildability determination. |
| Unavailable research checks (#402) | Parcel research now names unavailable national baseline checks in the investor result without exposing raw provider errors. The warning explicitly says a failed preliminary check is a data gap, not a clearance or favorable conclusion. |
| Silent parcel-source gaps (#412) | Research now also names checks whose adapter returned no usable facts or only a partial field set. Fresh cache evidence and explicit negative map/search statuses count as evidence; only unresolved fields remain gaps, so blank provider output can no longer silently resemble a favorable result. |
| Parcel fact retrieval evidence (#406) | Research now shows the existing per-field retrieval date beside provenance and source links; manual facts are labeled recorded. It does not turn a timestamp into a freshness, authority, or buildability claim. |
| Official Volusia parcel baseline (#414) | The founding route now consumes non-owner lot area, land-use description, and improvement state from the official Volusia Property Appraiser layer with exact query provenance. Other Florida counties retain an explicit unsupported parcel-baseline gap; assessor facts do not establish frontage, zoning authority, title, permitting, or buildability. |
| Durable Node runtime contract (#418) | Node 24.x now aligns `.nvmrc`, `package.json`, the lockfile, GitHub CI, migration workflow, dev container, bootstrap, and Vercel builds/functions. Node 20 was a short compatibility bridge; the repository contract remains authoritative without a dashboard mutation. |
| Incorporated-place land-use guard (#424) | When Census resolves a research coordinate inside an incorporated place, the pre-purchase route withholds county zoning, setbacks, uses, subdivision, STR, rent-control, and local licensing fields before exit evaluation. County tax-sale facts remain available; the investor result names municipal authority as unresolved rather than applying county rules. |
| Unverified county land-use guard (#426) | The route now also rejects the inverse inference: no Census incorporated-place result is not proof of county authority. Every non-lien exit remains conditional and names the unresolved governing authority until an authority-specific source verifies it; county tax-sale facts remain separate. |
| Authority save trace coverage (#436) | Authority-scope and unincorporated-boundary publication now write tenant-scoped, request-correlated audit events inside the same transactions as their saved records. The CI-enforced feature-test catalog declares both precise super-admin click/save journeys and cleanup conditions; browser execution remains blocked on isolated QA reset approval (#289). |
| Read-only browser evidence workflow (#438) | A manually dispatched GitHub Actions workflow now accepts a supplied non-production URL, runs the guarded read-only Playwright suite, and retains HTML/test artifacts even on failure. The guard refuses the production domain; it does not authorize mutation tests. |
| Verification boundary | Adapter/cache/profile/route tests cover the repaired contract. Hosted writes and authenticated browser mutations remain blocked by #289; official FEMA and public production checks are read-only. |

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
| Canonical Volusia regression fixture | PR #355 records the assessed 50×100 / 5,000-square-foot R-4 scenario for altkey 2340282 with official-source references. #380 extends the same conditional contract through the production research route, including minimum width, setback envelope, manual provenance, MAO, and bounded handoff. Neither asserts a final county buildability determination. |
| Raw-land MAO alignment | PR #356 uses an investor-provided market estimate with an explicit rural (25–50%) or infill (40–70%) selection. A county assessment is labeled only as a proxy, and an unknown classification produces no bid ceiling. |
| Setback-constrained buildable envelope | PR #358 calculates the remaining width, depth, and area only when full jurisdiction setbacks and parcel dimensions are available. It exposes the result to the investor, preserves the Volusia nonconforming-lot determination as conditional, and blocks builder/build exits when setbacks leave no physical envelope. |
| Research fact provenance | PR #359 exposes a conservative source label beside every displayed parcel fact: official source, estimated, manually entered, source not verified, or missing. It does not promote an arbitrary provider to authoritative status. |
| Gated manual research fallback | PR #360 requires a valid evidence URL and investor acknowledgement before accepting any manually entered parcel facts. The URL is retained in the transient fact provenance; this is an explicit fallback, not a substitute for an authoritative Florida lookup. |
| Research-to-deal handoff | PR #351 carries the normalized APN and selected jurisdiction from pre-purchase research into the new tax-lien/deed form, removing re-entry while keeping query data bounded and leaving server-side validation authoritative. It deliberately does not treat research output as verified property truth. |
| Production release protection | `main` now requires CI (including production build) and Vercel, enforces protection for administrators, requires up-to-date linear PR merges and resolved conversations, and blocks force pushes/deletion; emergency procedure documented |
| National county strategy | Volusia is now explicitly one acceptance case, not the product scope. Issue #296 defines verified, national-baseline, and on-demand county coverage with authority/provenance and review gates. |
| Governing geography guard | Issue #367 resolves supplied parcel coordinates through the official Census geography service before applying a selected county. A coordinate/FIPS mismatch is blocked; incorporated-place data is scope context only, and its absence does not authorize unincorporated county rules. |
| Nationwide preliminary address location | Issue #376 accepts an optional property address, sends it only for the current request to the official Census Geocoder, and requires its county result to match the selected FIPS before spatial research. The UI exposes the matched address and source while explicitly labeling it as preliminary location evidence rather than verified parcel identity, zoning, or authority. |
| Volusia parcel location | Issue #372 resolves a Volusia alternate key or parcel ID through the official Property Appraiser GIS layer when the investor did not supply coordinates, then sends an interior parcel point through the existing Census county check and spatial research path. #374 prevents a concave parcel or interior hole from placing the safety-check point outside the parcel surface. The returned location is source-disclosed but is not a zoning, permitting, or buildability determination. #378 retains a bounded, source-labeled preliminary research snapshot through an expiring one-time handoff into auction deal creation; it does not turn those facts into verified property truth. |
| Source discovery leads | PRs #332/#333 introduce a code-managed capability registry and super-admin discovery endpoint. Adapter output is stored only as idempotent, non-authoritative review leads; PR #335 lets a super-admin promote a reviewed lead to an explicitly unverified source without verifying authority or publishing claims. PR #337 proves county-specific precedence with Volusia official candidates for the six core office types; the admin workflow can now trigger discovery and review/promote leads into the existing authority queue. |
| Cross-state discovery acceptance | PR #361 adds exact official-office discovery candidates for Maricopa County, Arizona. Its planning/building entries explicitly warn that they govern unincorporated county area only, so a parcel municipality must be resolved before reliance. Like every registry entry, these are review-only leads rather than verified sources or claims. |
| Texas discovery acceptance | PR #441 adds exact Harris County, Texas review-only candidates for appraisal, tax collection, real-property records, GIS, platting, and permits. The registry preserves the county’s explicit no-zoning condition for its unincorporated area and warns that municipal ETJ rules may apply; no lead is an authority source or a zoning conclusion. |
| Discovery promotion scope safety | Issue #345 preserves each lead's adapter-declared scope. Statewide discovery entry points cannot be promoted unchanged; a super-admin must supply a different concrete county-office URL. County-office candidates may be promoted unchanged, but every promoted source remains explicitly UNVERIFIED until the separate append-only authority review. |
| Jurisdiction publication safety | Issue #308 adds a versioned question library and fail-closed publication policy. AI extraction now produces pending candidates only; confidence cannot publish truth. Sourced human review is required, high-risk claims cannot be batch-approved, and server-owned provenance is stamped as `REVIEWED` rather than `VERIFIED`. Legacy profile JSON is intentionally not relabeled; later #296 slices now provide authority, history, snapshots, freshness, and contradiction controls. |
| Jurisdiction claim/evidence ledger | Issue #310 makes every new profile write an atomic claim + copied-evidence + read-projection operation. Source authority validation is persisted separately from expected authority, stale candidate/source review races fail closed, superseded claims remain traceable, and legacy JSON is visibly labeled as lacking provenance. Authority, snapshots, freshness, and contradiction handling shipped in #312/#314/#316/#318; researched legacy migration and coverage workflows remain in #296. |
| Source authority review workflow | Issue #312 adds a filtered super-admin source queue and append-only verify/reject/reset decisions with authority evidence, server-owned reviewer/time, exact source-version concurrency, and atomic current-state projection. Discovery/AI cannot verify sources and existing claims are never retroactively promoted. Snapshot, freshness, and contradiction operations shipped in #314/#316/#318; bulk/adapted registries, migration, and coverage workflows remain in #296. |
| Browser verification foundation | Playwright now has a guarded, executable read-only health check. It requires an explicit non-production URL and produces standard failure artifacts; state-changing stories remain blocked until the isolated QA reset rehearsal is approved. |
| Feature verification contract | Issue #347 requires every declared user story to map to a real Playwright spec. The four mutation stories are intentionally named and skipped with their exact #289 prerequisite, so coverage does not claim that blocked click/save tests already execute. |
| Mutation correlation foundation | Issue #341 adds a server-generated UUID request ID at the proxy boundary, returns it to the client, and persists it with the existing parcel-enrichment, pre-purchase research, and jurisdiction field-report audit events. It records no request body or secret and does not enable hosted mutations. |
| Server-action correlation | PR #352 extends the existing audit helper to carry the forwarded valid request ID into semantic server-action events, including all `DEAL_CREATED` actions. Invalid or unavailable IDs are omitted; audit write failures remain non-blocking. |
| Operator trace retrieval | PR #357 lets a super-admin enter a browser response request ID on a tenant page and retrieve only that tenant's matching audit events. Invalid IDs query nothing, and the event display exposes the correlated ID without request bodies or credentials. |
| Reset-safe mutation test contract | The E2E coverage manifest now requires each mutation story to name its fixture set, `x-request-id` response evidence, and expected semantic audit action. Five critical stories are defined but remain blocked until the isolated QA reset rehearsal is authorized. |
| Trace-based feature verification | Issue #365 extends every mutation-story contract with a named entry point, user action, expected request, persisted outcome, and cleanup condition. This is a bounded test-evidence ledger, not blanket clickstream tracking; real click/save execution remains blocked on isolated QA reset rehearsal. |
| Team-access trace coverage | PR #450 adds request-correlated, tenant-scoped audit events for owner invitations and role changes. Invitation metadata deliberately excludes the invitee email; role changes are atomic with their audit record. Both owner click/save journeys are now enforced in the test-evidence catalog but remain blocked from hosted execution until #289. |
| Workflow-rule trace coverage | PR #452 adds request-correlated, tenant-scoped audit events for workflow-rule creation, update, and deletion. Metadata contains only the rule identity, strategy, and safe active state—not action configuration or request payloads—and update/delete are atomic with their audit record. The three tenant-member click/save journeys are catalog-enforced but remain blocked from hosted execution until #289. |
| Workflow-rule configuration authority | PR #454 restricts workflow-rule viewing and mutations to tenant owners in both the page and API routes. Non-owners are redirected from the UI and receive a 403 before any read, mutation, or audit write. |
| AI-key configuration authority | PR #456 restricts the tenant Anthropic key page and mutations to owners. Key updates/removal atomically write a request-correlated event containing only whether a key is configured; the credential and request payload never enter the audit ledger. |
| Investor-profile trace coverage | PR #460 restricts tenant-wide investor-profile saves to owners while retaining authenticated read-only access for deal analysis. The upsert and request-correlated audit event are atomic; audit metadata contains only profile identity, never financial assumptions or licenses. |
| Deal checklist-generation trace coverage | PR #462 records each newly generated checklist batch atomically with a tenant-scoped, request-correlated audit event. Metadata contains only deal identity and created-item count, never task instructions or descriptions; idempotent repeats create neither tasks nor audit events. |
| Manual task-creation trace coverage | PR #464 records each manually created task atomically with a tenant-scoped, request-correlated audit event. Metadata contains only task and deal identity, never task content or assignment; a cross-tenant deal attempt creates neither record nor audit evidence. |
| Manual task-lifecycle trace coverage | PR #466 records task updates and deletions atomically with tenant-scoped, request-correlated audit events. Metadata contains only task identity, never task content or changed values; a task not found within the tenant writes no audit event. |
| Financial transaction trace coverage | PR #468 records financial-transaction creation and deletion atomically with tenant-scoped, request-correlated audit events. Metadata contains only transaction and deal identity, never amount, type, date, or description; a transaction not found within the tenant writes no audit event. |
| Contact CRM lifecycle trace coverage | PR #470 records contact creation, update, and deletion atomically with tenant-scoped, request-correlated audit events. Metadata contains only contact identity, never PII, contact stage/type, or notes; a contact not found within the tenant writes no audit event. |
| Contact CRM activity trace coverage | PR #472 records contact-activity creation and deletion atomically with tenant-scoped, request-correlated audit events. Metadata contains only contact/activity identity, never activity type, notes, or timestamps; an activity not found within the tenant contact writes no audit event. |
| HIFLD electric retail territory baseline | PR #458 queries the official HIFLD retail-service-territory layer at the research point and records returned utility territory names/types or an explicit no-territory result with source provenance. This is preliminary map evidence only; it never asserts a service drop, capacity, cost, connection, utility approval, or buildability. |
| Production dependency hardening | Issue #338 identified 11 production audit findings. PR #339 moves the Prisma CLI to build tooling and resolves PostCSS to 8.5.19; PR #340 replaces the vulnerable `react-simple-maps` D3 chain. The combined production-only audit reports zero findings. |
| Development dependency audit maintenance (#408) | Non-breaking audit remediation updates transitive esbuild, Hono, and JS-YAML lockfile entries. `npm audit --omit=dev` remains zero findings. The full audit retains three moderate findings only through Prisma 7's `@prisma/dev` → `@hono/node-server` development-server chain; npm offers only a breaking Prisma 6 downgrade, so it was not applied. |
| Spreadsheet import containment | Issue #290 removes the vulnerable XLS/XLSX parser and retains only bounded CSV input. PR #349 aligns the file picker, formula-safe error exports, and declared-payload rejection; #350 adds tenant-safe request-correlated import audit evidence and route-level proof that oversized requests do not reach multipart parsing. |
| Immutable jurisdiction evidence | Issue #314 archives the exact Jina Markdown reviewed by AI under non-overwriting SHA-256 R2 keys and records every retrieval, including unchanged content. New AI candidates and claims retain server-trusted snapshot provenance; legacy snapshot-less AI candidates fail closed. This is a transformed evidence representation, not mislabeled original county source bytes. Freshness and contradiction controls shipped in #316/#318; researched migration and coverage workflows remain in #296. |
| Jurisdiction claim freshness and re-review | Issue #316 makes volatility a versioned question-catalog policy, schedules every new claim from its evidence retrieval time, and exposes current/review-due/stale state in investor and super-admin views. Reconfirmation requires a newer unchanged snapshot from the same source, exact-version concurrency, and an append-only copied-evidence decision. Existing unclassified claims fail closed as immediately stale; contradictions, researched migration, and coverage workflows remain in #296. |
| Jurisdiction contradiction resolution | Issue #318 compares pending candidates with the claim ID in the current profile projection. Differing values/units block investor reliance and batch publication until a super-admin records an explained replace, reject-challenge, or not-comparable decision. Resolutions are append-only with copied evidence and exact candidate/claim concurrency; researched legacy migration and coverage workflows remain in #296. |
| Legacy jurisdiction containment | A read-only production inventory found 40,005 populated profile fields across all 3,143 counties but zero claims, evidence snapshots, freshness records, or verified source authorities. Issue #320 quarantines those legacy values from investor jurisdiction hubs, deal context, and checklist interpolation unless the projected claim ID resolves to the active claim for the exact field. The data remains available to admins as a researched migration queue; it was not deleted or relabeled. |
| Jurisdiction coverage operations | Issue #322 adds a read-only super-admin coverage and migration queue. It measures exact active claim projections separately from legacy/invalid JSON, catalog gaps, stale or contradicted claims, pending candidates, verified authorities, tracked properties, and parcel research requests. Demand-first ordering makes the next research investment explicit without auto-publishing legacy data. |
| On-demand county research | Issue #324 separates shared county research work from tenant-scoped demand. Investors can request an incomplete county; the request records only their tenant's demand and reuses global discovery work. The investor report exposes an honest derived coverage state, while a super-admin queue shows execution, sources, candidates, and aggregate demand. Work status cannot manually verify a county or publish claims. |
| On-demand preliminary discovery | PR #353 makes each investor research request run the code-managed preliminary source check. Supported counties queue idempotent review-only leads; unsupported counties return `DISCOVERY_NEEDED`. This does not create an authority source, verify a URL, or publish a claim. |
| Investor discovery feedback | PR #354 shows the returned preliminary-discovery result in the research hub: leads queued, already pending review, or discovery needed. The wording explicitly says that leads are not verified. |
| County land-use authority bridge | Issue #428 defines one current, individually reviewed authority-scope claim with copied evidence and a source that is still verified as the local official authority. `COUNTY_WIDE` can apply county rules directly; #430 adds append-only reviewed `UNINCORPORATED_COUNTY` polygons, which must cover the research coordinate and cannot override a positive incorporated-place result. All other, stale/review-due, revoked-source, missing-boundary, or conflicting cases remain conditional. |
| Authority-boundary operations | Issue #432 makes the #430 control usable by super-admins in the county rules console: it lists only eligible claims, links the reviewed evidence, shows the current replacement target, and submits Polygon/MultiPolygon GeoJSON through the protected authority-boundary endpoint. |
| Authority-scope operations | Issue #434 completes the operator chain by publishing the authority scope itself from a verified LOCAL_OFFICIAL source and its immutable snapshot, with a human authority citation, through the same append-only claim ledger used by all jurisdiction facts. |
| Evidence-gated county coverage notification | Issue #363 adds a durable, tenant-scoped outbox only when the exact current claim projection reaches fully verified/current coverage. Discovery, pending candidates, stale/blocked claims, and unverified authority cannot queue a message. A policy-gated scheduled delivery uses an idempotency key and exposes aggregate delivery state to super-admin operators. Hosted delivery remains unproven until the isolated QA reset/access gate is cleared. |
| Development portability verification | PR #288 shipped a platform-neutral bootstrap, context/env checks, and dev-container contract. The bootstrap now also generates Prisma’s ignored client, so a fresh clone can proceed directly to TypeScript verification. Issue #295 remains open because macOS and approved remote-Linux acceptance runs have not yet been evidenced; each host must use its own revocable non-production secrets and must not mutate shared integration or production. |
| macOS fresh-clone verification | PR #443 adds a manually dispatched macOS GitHub runner for the tracked bootstrap, context, type, test, and production-build contract. It uses no secrets and performs no hosted mutation; a completed run supplies repeatable macOS acceptance evidence for #295. |
| Remote Linux container verification | PR #445 adds a manually dispatched Ubuntu runner that builds `.devcontainer/Dockerfile` and executes the same bootstrap, context, type, test, and production-build contract inside the container. It uses no secrets and performs no hosted mutation; corrected run `29780265511` passed the full contract, supplying repeatable remote-Linux evidence for #295. |
| Remote Linux container defect resolved | Initial run `29779985759` correctly failed before project bootstrap because the tracked Dockerfile referenced the non-existent `javascript-node:1-24-bookworm` image. PR #447 switches to the published `24-bookworm` tag; the corrected container run passed and the initial failure remains retained diagnostic evidence. |
| Container bootstrap parity (#404) | The devcontainer now invokes `npm run bootstrap` rather than dependency installation alone, so container hosts use the same Node-20-pinned setup that installs dependencies, creates an ignored local environment template when needed, and generates Prisma. Native bootstrap, context check, type check, lint, tests, and production build passed on WSL; macOS/remote acceptance remains pending. |
| Environment lifecycle decision | There are no customers or customer data. The current live URL/database/Clerk state is classified as disposable shared integration. Issue #298 defines guarded full-state reset, versioned Gold-equivalent configuration, a clean release-candidate rehearsal, and fresh production cutover before external users. |
| Environment reset safety foundation | Issue #300 adds explicit logical environment identity, an authenticated dashboard designation, and a fail-closed non-destructive reset preflight before any reset implementation or mutation browser suite is allowed. |
| Local QA operator configuration | Issue #370 gives all guarded reset operator scripts one local `.env.local` loader that preserves shell/CI precedence. The preflight now evaluates provisioned QA identities without manual exports; it remains non-mutating and retains every existing refusal gate. |
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
| Verify or grant Vercel, Neon, and Clerk administration for isolated QA setup | Yes — blocks automated browser tests that save data, not repository work | 2026-07-13 | Vercel deployment read access is verified, but QA administration and the required Neon/Clerk identities are not. Configure the logical integration identity, verified service allowlists, reset-safe runtime modes, and fixture credentials. #300/#302/#304/#306 provide the repository guards/orchestration; mutation tests remain blocked until the non-mutating plan and controlled hosted reset rehearsal pass. |

---

## Next Up

1. Finish the founding Volusia acceptance evidence: authoritative frontage/depth, governing zoning scope, and the county/title/permitting nonconforming-lot determination remain unresolved.
2. Continue demand-driven national and county parcel-source coverage; unsupported Florida counties still have no configured official or commercial parcel baseline.
3. Complete #295 with fresh-clone macOS and approved remote-Linux acceptance evidence, while owner-authorized QA provisioning remains the blocker for mutation/browser proof.

---

## Key Facts (quick reference)

- **Live at:** metisplatforms.com — Vercel auto-deploys on every merge to `main`
- **AI gating:** `Tenant.anthropicApiKey IS NOT NULL` — BYOK, no platform key fallback
- **Module gating:** `hasStrategy()` / `hasTier()` in `lib/entitlements.ts`
- **Prisma client import:** `@/app/generated/prisma` — NOT `@prisma/client`
- **Clerk middleware:** `proxy.ts` at root — NOT `middleware.ts`
- **Active strategies:** TAX_LIEN · TAX_DEED · FORECLOSURE · LAND · WHOLESALE · FIX_FLIP · BUY_HOLD · MULTIFAMILY
