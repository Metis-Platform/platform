-- Durable, tenant-scoped notification outbox for verified jurisdiction coverage.
CREATE TABLE "JurisdictionCoverageNotification" (
    "id" TEXT NOT NULL,
    "demandId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "jurisdictionId" TEXT NOT NULL,
    "coverageVersion" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'VERIFIED_COVERAGE',
    "recipientEmail" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attemptedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "providerMessageId" TEXT,
    "failureCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JurisdictionCoverageNotification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "JurisdictionCoverageNotification_tenantId_jurisdictionId_coverageVersion_kind_key"
ON "JurisdictionCoverageNotification"("tenantId", "jurisdictionId", "coverageVersion", "kind");
CREATE INDEX "JurisdictionCoverageNotification_status_createdAt_idx"
ON "JurisdictionCoverageNotification"("status", "createdAt");
CREATE INDEX "JurisdictionCoverageNotification_jurisdictionId_createdAt_idx"
ON "JurisdictionCoverageNotification"("jurisdictionId", "createdAt");

ALTER TABLE "JurisdictionCoverageNotification"
ADD CONSTRAINT "JurisdictionCoverageNotification_demandId_fkey"
FOREIGN KEY ("demandId") REFERENCES "JurisdictionResearchDemand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JurisdictionCoverageNotification"
ADD CONSTRAINT "JurisdictionCoverageNotification_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JurisdictionCoverageNotification"
ADD CONSTRAINT "JurisdictionCoverageNotification_jurisdictionId_fkey"
FOREIGN KEY ("jurisdictionId") REFERENCES "Jurisdiction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
