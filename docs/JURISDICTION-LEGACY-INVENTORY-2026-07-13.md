# Jurisdiction Legacy Inventory — 2026-07-13

## Purpose

This read-only production inventory establishes what Metis can truthfully call researched county
coverage. It records aggregate metadata only; no tenant or credential data was read or changed.

## Result

The database contains the complete 3,143-county registry and a profile row for every county. The
profile seed is broad, but it is not evidence-backed jurisdiction intelligence:

| Measure | Count |
|---|---:|
| Jurisdictions | 3,143 |
| Available for deal creation | 21 |
| Jurisdiction profiles | 3,143 |
| Populated profile fields | 40,005 |
| Fields with a claim ID | 0 |
| Jurisdiction claims | 0 |
| Claim evidence records | 0 |
| Claim freshness records | 0 |
| Evidence snapshots | 0 |
| Source URLs | 67 |
| Verified source authorities | 0 |
| Extraction candidates | 8 |
| Pending candidates | 1 |
| Legacy strategy-data rows | 0 |

Four sections are marked published on every profile: `taxSale`, `foreclosure`, `landlordTenant`, and
`wholesale`. `marketSignals` also contains one legacy field per county even though it is not listed
as published.

## Populated fields

| Section | Profiles with data | Fields | Claim-backed | Legacy |
|---|---:|---:|---:|---:|
| taxSale | 3,143 | 22,004 | 0 | 22,004 |
| foreclosure | 3,143 | 6,286 | 0 | 6,286 |
| landlordTenant | 3,143 | 6,286 | 0 | 6,286 |
| wholesale | 3,143 | 3,143 | 0 | 3,143 |
| marketSignals | 3,143 | 3,143 | 0 | 3,143 |
| all other sections | 0 | 0 | 0 | 0 |

The seed largely repeats state-level values across counties. Most fields have citations embedded in
JSON, but a citation label is not an immutable evidence snapshot, verified authority decision, or
append-only reviewed claim. Confidence values of 1.0 therefore do not establish truth.

## Containment policy

Legacy JSON is preserved as a research lead and future migration queue. It is not deleted, silently
converted into claims, or marked verified. Investor-facing county research, deal context, and
generated due-diligence checklist interpolation retain a field only when:

1. the profile field contains a claim ID;
2. that claim exists and is not superseded; and
3. the claim belongs to the same jurisdiction section and field key.

Anything else is presented as missing and requiring manual verification. Admin workflows may still
inspect the legacy JSON to research and republish it through the existing authority, immutable
evidence, human review, freshness, and contradiction controls.

## Next slice

Build a queryable migration/coverage queue ordered by investor demand and decision risk. Each field
must be researched from authoritative sources and republished through the claim ledger. Bulk
conversion of legacy JSON is explicitly prohibited because it would fabricate provenance.
