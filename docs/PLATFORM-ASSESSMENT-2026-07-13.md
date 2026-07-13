# Platform Assessment — 2026-07-13

This is the evidence-backed baseline for Initiative 4 (#287). It compares the product strategy and roadmap with the repository, automated tests, CI, and production deployment. GitHub Issues remain the implementation backlog; this document records why the priorities were chosen.

## Executive conclusion

Metis has broad module coverage and a healthy production deployment, but breadth has outrun proof. The founding pre-purchase workflow has a usable UI and evaluation shell, yet it cannot currently establish the specific buildability fact that the product was founded to detect. The highest-value next work is therefore product integrity, release safety, and repeatable verification—not more module surface area.

## Verified baseline

| Area | Evidence | Assessment |
|---|---|---|
| Repository | 401 tracked files; 312 TypeScript/TSX files; 66 API route files; 45 page files; 46 Prisma models | Substantial production application, not a prototype |
| Automated tests | 16 Vitest files; 106 passing tests | Logic coverage exists; no browser, route, auth, mutation, or tenant-isolation acceptance suite |
| Build quality | TypeScript, lint, Vitest, Prisma validation, and production build pass on Node 20 | Local baseline is green; lint has 12 pre-existing warnings |
| Production | `www.metisplatforms.com/api/health` reports application and database healthy; latest Vercel deployment succeeded | Production is reachable and healthy at the infrastructure level |
| GitHub portability | `CONTEXT.md`, cross-machine workflow, `.nvmrc`, and `npm run context:check` merged in PR #288 | Non-secret handoff context is now portable |
| Release governance | `main` requires PRs, but has no required status checks, zero required approvals, and administrators can bypass | A broken or unreviewed change can still reach production |
| Dependencies | `npm audit --omit=dev` reports 12 findings (7 high, 5 moderate); `xlsx@0.18.5` has known issues and no npm-registry fix | Requires focused remediation and runtime-risk calibration |

## Founding workflow truth check

The product promise in `STRATEGY.md` is: APN/address in; parcel dimensions, zoning, setbacks, flood/GIS facts, viable exits, and MAO out; a researched parcel becomes a deal without re-entry. The canonical acceptance parcel is Volusia County altkey `2340282`.

The implemented flow does not yet satisfy that acceptance contract:

1. The research form sends APN and county but no coordinates. Coordinate-dependent FEMA, EPA, Walk Score, utilities, and spatial-zoning sources therefore do not run in the normal UI path.
2. The Florida DOR adapter is normalization-only and returns no authoritative parcel characteristics. The canonical Florida path therefore lacks dimensions and other decisive facts unless a user enters partial overrides.
3. `ParcelProfile` and the manual form do not represent lot width/depth or a buildable envelope.
4. Jurisdiction setback accessors exist, but the vacant-land evaluators do not use them. Builder blockers only check minimum lot area, flood-plus-wetlands risk, and landlocked access.
5. No automated fixture or acceptance test mentions `2340282`; it appears only in strategy/status text and a UI placeholder.
6. “Create deal for this parcel” carries only the jurisdiction ID. It drops APN and research results, requiring data re-entry.
7. Raw-land MAO uses 40/60/80 percent of assessed value, while the current strategy specifies rural land at 25–50 percent and infill lots at 40–70 percent.

Conclusion: the UI/evaluator scaffolding shipped, but the canonical acceptance outcome is unproven and the roadmap's completed wording is incorrect. This is the first product workstream to fix.

### Canonical parcel evidence and verdict caution

Official sources currently establish the following:

- The [Volusia Property Appraiser record](https://vcpa.vcgov.org/parcel/summary/?altkey=2340282) identifies parcel `800401180260`, vacant residential use, no buildings, unincorporated westside tax district, 50 feet of frontage, and 100 feet of depth.
- The county's public ArcGIS `Land_Use_Zoning/MapServer/0` point query at the appraiser coordinates returns `R-4`.
- The county's [zoning dimensional requirements](https://www.volusia.org/core/fileparse.php/6001/urlt/Zoning-Dimensional-Requirements.pdf) list R-4 minimums of 7,500 square feet and 75 feet width, with 25-foot front, 20-foot rear, and 20-foot combined side yards (minimum 8 feet on either side).
- The same dimensional guide permits seven-foot side yards on certain nonconforming lots not more than 50 feet wide. The county's [nonconforming-lot guide](https://www.volusia.org/core/fileparse.php/4754/urlt/Nonconforming-Lot-Letter.pdf) says development eligibility can depend on historical ownership of adjacent/contiguous property and requires a title-company or attorney letter for a determination.

Therefore the documented “unbuildable” verdict itself needs authoritative confirmation. Metis can safely conclude that the parcel fails standard R-4 area/width rules and requires nonconforming-lot, access, survey, well/septic, and permitting diligence. It must not convert that evidence into a definitive buildability verdict without modeling exceptions and provenance. The canonical acceptance test should encode the confirmed county determination when obtained and should meanwhile expect a conditional/insufficient-data result with the exact unresolved requirements.

## Reliability and security findings

### Release path

- CI previously stopped after type check, lint, and unit tests; it did not run the production build. This assessment adds the build to CI.
- Branch protection does not require CI or Vercel checks and permits administrator bypass. Protection must require the green checks that gate production.
- The old “checkpoint directly to main” convention conflicts with the protected-branch intent and must not be used.

### Import boundary

`app/api/liens/import/route.ts` parses user-supplied XLS/XLSX data with `xlsx@0.18.5`. It applies a 500-row limit only after parsing and has no pre-parse file-size limit. Replace or isolate the parser and impose byte, row, cell, and execution limits before treating spreadsheet imports as safe.

### Environment contract

Runtime code uses environment names that were absent from `.env.example`: `RESEND_WEBHOOK_SECRET`, `SALES_CONTACT_URL`, `STRIPE_MODULE_PRICE_STANDARD_ID`, and `STRIPE_MODULE_PRICE_PREMIUM_ID`. The example also retains legacy plan price variables. The example is corrected as part of this assessment; actual secret values remain in service-specific secret stores and never in Git.

### Claimed integrations

The GovEase, RealAuction FL, and Tax Sale Resources synchronization routes contain explicit TODO/stub behavior. Status and marketing language must distinguish scaffolding from a live data integration.

## Prioritized implementation queue

### P0 — trust and production safety

1. **Founding parcel acceptance (#291):** obtain/record the authoritative buildability determination; build a deterministic `2340282` evidence fixture and acceptance test; represent dimensions, exceptions, and provenance; apply setbacks to a buildable envelope; establish a real Florida source/geocoding path; align MAO formulas; preserve research into deal creation.
2. **Isolated QA (#289):** provision a non-production Neon branch, Clerk development instance, safe external-service defaults, deterministic test tenant/users, and resettable fixtures.
3. **Release protection (#292):** require CI production build and Vercel preview checks on `main`, prevent administrator bypass, and use PRs for every production change.
4. **Spreadsheet import safety (#290):** replace/contain the vulnerable parser and add pre-parse limits plus hostile-file tests.

### P1 — proof and operability

5. **Playwright feature verification:** create a feature catalog of critical flows; capture named steps, screenshots, video/trace, console, network failures, and an HTML report; upload artifacts in GitHub Actions.
6. **Mutation observability:** issue a correlation ID from browser action through route/action, emit tenant-safe structured logs and semantic audit events, and make save failures diagnosable without exposing payload secrets.
7. **Configuration and integration truth:** validate environment contracts in CI/startup, identify service ownership, and label stub feeds accurately.
8. **Roadmap reconciliation:** close superseded planning issues or replace them with narrowly scoped implementation issues tied to acceptance evidence.

### P2 — module depth after the core is truthful

9. Wholesale Contact CRM outreach wiring.
10. Fix & Flip multi-contractor comparison and milestone draw schedule.
11. Buy & Hold tenant, lease, maintenance, and rent-roll depth.

## Verification system design

The feature-testing system should be a thin, inspectable layer around real user stories:

```text
feature catalog -> deterministic QA fixture -> Playwright named steps
                -> browser trace/screenshots/console/network
                -> correlation ID -> server log/audit event -> database assertion
                -> HTML report + GitHub Actions artifact
```

Each critical feature receives a stable ID, owner, preconditions, test data, steps, expected UI result, expected persistence result, and cleanup rule. Saves run only against QA. Failures retain a trace that can be opened and replayed click by click; successful critical-path runs retain concise evidence and timing. Production gets read-only smoke checks until a separately authorized synthetic tenant exists.

## Access required to finish Initiative 4

Repository work can continue with current access. One-time human handoff is still required for:

- Vercel project administration/linking and environment configuration;
- Neon project administration to create an isolated branch/database;
- Clerk administration to create/configure a development instance and test users;
- a signed-in QA browser session if Clerk test-token automation is not selected.

No shared secret or machine-local context should be committed. GitHub is the canonical handoff surface; service dashboards remain canonical for secrets.
