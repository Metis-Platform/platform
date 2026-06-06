# METIS-5 Tenant Isolation Audit

Linear: [METIS-5](https://linear.app/fuzzy-logic-yetis/issue/METIS-5/gh-24-multi-tenant-row-level-isolation-audit)  
GitHub source issue: [#24](https://github.com/Metis-Platform/platform/issues/24)

## Scope

Audited Prisma access paths in the current Phase 1 application for row-level tenant isolation before expanding billing/multi-tenant operations.

Command used to enumerate application queries:

```bash
git grep -n -E "\b(db|tx)\.[A-Za-z]+\.(find|update|delete|create|upsert|createMany|updateMany|deleteMany)" -- "*.ts" "*.tsx"
```

## Data model notes

Tenant-scoped models with direct `tenantId`:

- `User`
- `Property`
- `Deal`
- `Task`
- `FinancialTransaction`
- `Document`
- `AuditLog`

Tenant-scoped models through a parent relation:

- `Event` through `Deal.tenantId`
- `TaskComment` through `Task.tenantId` and `User.tenantId`
- strategy extension tables (`DealTaxLien`, `DealTaxDeed`, `DealForeclosure`) through `Deal.tenantId`

Global/admin models:

- `Jurisdiction`, `RuleSet`, and `Rule` are global operating data.
- Admin routes must remain protected by admin authorization because they intentionally query global tenants/rules.

## Findings

### Fixed in this branch: task assignee tenant validation

`app/api/tasks/route.ts` and `app/api/tasks/[id]/route.ts` previously verified that the task's deal/task belonged to the current tenant, but accepted arbitrary `assignedToId` values. Because `Task.assignedToId` references `User.id` without a tenant-constrained relation, a malicious request could assign a task to a user from another tenant if that user id were known.

This branch now validates any non-null `assignedToId` against the current tenant before task creation or reassignment.

### Confirmed acceptable patterns

- Deal, property, and task dashboard queries use direct `tenantId` filters or relation filters through `deal.tenantId`.
- Calendar and task API reads scope events/tasks to the current tenant before returning data.
- Document download/delete routes check the document's `tenantId` before issuing an R2 download URL or deleting the object.
- Document upload verifies both the parent deal tenant and the `tenants/<tenantId>/` R2 key prefix before creating a `Document` row.
- Rules and jurisdiction administration are global data paths, not tenant-owned customer records.
- Stripe webhooks locate tenants by Stripe customer/subscription identifiers and are authenticated by webhook signature rather than current user context.

## Follow-up recommendations

- Add automated route-level tests for cross-tenant task assignment once the test harness is introduced.
- Consider adding compound unique constraints or helper functions for high-risk tenant-owned access patterns where Prisma cannot express `tenantId` in a unique `where` clause.
- Keep this audit updated when Phase 2/3 adds document extraction, billing flows, or additional strategy modules.
