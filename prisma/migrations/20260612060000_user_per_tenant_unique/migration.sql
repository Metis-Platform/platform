-- Per-tenant User rows: a Clerk user who belongs to multiple organizations gets
-- one User row per tenant, so roles cannot carry across tenants (issue #24).
DROP INDEX "User_clerkUserId_key";

CREATE UNIQUE INDEX "User_clerkUserId_tenantId_key" ON "User"("clerkUserId", "tenantId");
