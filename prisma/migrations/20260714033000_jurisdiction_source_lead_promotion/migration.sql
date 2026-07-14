ALTER TABLE "JurisdictionSourceDiscoveryLead"
  ADD COLUMN "promotedSourceUrlId" TEXT,
  ADD COLUMN "promotedAt" TIMESTAMP(3),
  ADD COLUMN "promotedBy" TEXT;

ALTER TABLE "JurisdictionSourceDiscoveryLead"
  ADD CONSTRAINT "JurisdictionSourceDiscoveryLead_promotedSourceUrlId_fkey"
  FOREIGN KEY ("promotedSourceUrlId") REFERENCES "JurisdictionSourceUrl"("id") ON DELETE SET NULL ON UPDATE CASCADE;
