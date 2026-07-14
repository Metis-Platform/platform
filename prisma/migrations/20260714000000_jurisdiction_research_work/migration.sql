-- Shared county execution remains separate from tenant-scoped investor demand.
CREATE TYPE "JurisdictionResearchWorkStatus" AS ENUM ('DISCOVERING', 'PAUSED');

CREATE TABLE "JurisdictionResearchWork" (
  "id" TEXT NOT NULL,
  "jurisdictionId" TEXT NOT NULL,
  "status" "JurisdictionResearchWorkStatus" NOT NULL DEFAULT 'DISCOVERING',
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "startedAt" TIMESTAMP(3),
  "pausedAt" TIMESTAMP(3),
  "pausedReason" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "JurisdictionResearchWork_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "JurisdictionResearchDemand" (
  "id" TEXT NOT NULL,
  "jurisdictionId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "requestedBy" TEXT NOT NULL,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "notifiedAt" TIMESTAMP(3),
  CONSTRAINT "JurisdictionResearchDemand_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "JurisdictionResearchWork_jurisdictionId_key" ON "JurisdictionResearchWork"("jurisdictionId");
CREATE INDEX "JurisdictionResearchWork_status_requestedAt_idx" ON "JurisdictionResearchWork"("status", "requestedAt");
CREATE UNIQUE INDEX "JurisdictionResearchDemand_jurisdictionId_tenantId_key" ON "JurisdictionResearchDemand"("jurisdictionId", "tenantId");
CREATE INDEX "JurisdictionResearchDemand_tenantId_requestedAt_idx" ON "JurisdictionResearchDemand"("tenantId", "requestedAt");
CREATE INDEX "JurisdictionResearchDemand_jurisdictionId_requestedAt_idx" ON "JurisdictionResearchDemand"("jurisdictionId", "requestedAt");

ALTER TABLE "JurisdictionResearchWork" ADD CONSTRAINT "JurisdictionResearchWork_jurisdictionId_fkey"
  FOREIGN KEY ("jurisdictionId") REFERENCES "Jurisdiction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JurisdictionResearchDemand" ADD CONSTRAINT "JurisdictionResearchDemand_jurisdictionId_fkey"
  FOREIGN KEY ("jurisdictionId") REFERENCES "Jurisdiction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JurisdictionResearchDemand" ADD CONSTRAINT "JurisdictionResearchDemand_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
