CREATE TYPE "JurisdictionSourceDiscoveryStatus" AS ENUM ('PENDING_REVIEW', 'REJECTED', 'PROMOTED');

CREATE TABLE "JurisdictionSourceDiscoveryLead" (
  "id" TEXT NOT NULL,
  "jurisdictionId" TEXT NOT NULL,
  "adapterId" TEXT NOT NULL,
  "officeType" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "authorityOwner" TEXT,
  "authorityRationale" TEXT NOT NULL,
  "status" "JurisdictionSourceDiscoveryStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
  "discoveredAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "JurisdictionSourceDiscoveryLead_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "JurisdictionSourceDiscoveryLead_jurisdictionId_adapterId_officeType_url_key"
  ON "JurisdictionSourceDiscoveryLead"("jurisdictionId", "adapterId", "officeType", "url");
CREATE INDEX "JurisdictionSourceDiscoveryLead_jurisdictionId_status_idx"
  ON "JurisdictionSourceDiscoveryLead"("jurisdictionId", "status");

ALTER TABLE "JurisdictionSourceDiscoveryLead"
  ADD CONSTRAINT "JurisdictionSourceDiscoveryLead_jurisdictionId_fkey"
  FOREIGN KEY ("jurisdictionId") REFERENCES "Jurisdiction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
