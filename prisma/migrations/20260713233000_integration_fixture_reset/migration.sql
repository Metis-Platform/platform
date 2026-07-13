-- Explicitly tag the one replaceable integration tenant. Null always means non-fixture data.
ALTER TABLE "Tenant" ADD COLUMN "fixtureSet" TEXT;

-- Remove historical tenant-template orphans before enforcing ownership.
DELETE FROM "ChecklistTemplate" AS template
WHERE template."tenantId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "Tenant" AS tenant WHERE tenant."id" = template."tenantId"
  );

-- A reset audit record deliberately lives outside the fixture tenant so it survives replacement.
CREATE TABLE "IntegrationResetRun" (
    "id" TEXT NOT NULL,
    "environmentId" TEXT NOT NULL,
    "fixtureSet" TEXT NOT NULL,
    "fixtureVersion" TEXT NOT NULL,
    "gitCommit" TEXT NOT NULL,
    "requiredMigration" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "summary" JSONB,
    "errorCode" TEXT,

    CONSTRAINT "IntegrationResetRun_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Tenant_fixtureSet_key" ON "Tenant"("fixtureSet");
CREATE INDEX "IntegrationResetRun_environmentId_startedAt_idx"
  ON "IntegrationResetRun"("environmentId", "startedAt");
CREATE INDEX "IntegrationResetRun_fixtureSet_startedAt_idx"
  ON "IntegrationResetRun"("fixtureSet", "startedAt");

-- Tenant-owned audit and checklist rows must not block or outlive fixture replacement.
ALTER TABLE "AuditLog" DROP CONSTRAINT "AuditLog_tenantId_fkey";
ALTER TABLE "AuditLog"
  ADD CONSTRAINT "AuditLog_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChecklistTemplate"
  ADD CONSTRAINT "ChecklistTemplate_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
