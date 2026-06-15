CREATE TABLE "ParcelResearchRequest" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "dealId" TEXT NOT NULL,
  "apnNormalized" TEXT NOT NULL,
  "fipsCounty" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "priority" TEXT NOT NULL,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "adminUserId" TEXT,
  "notes" TEXT,
  "fieldsCompleted" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],

  CONSTRAINT "ParcelResearchRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ParcelResearchRequest_tenantId_status_idx" ON "ParcelResearchRequest"("tenantId", "status");
CREATE INDEX "ParcelResearchRequest_status_requestedAt_idx" ON "ParcelResearchRequest"("status", "requestedAt");

ALTER TABLE "ParcelResearchRequest" ADD CONSTRAINT "ParcelResearchRequest_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ParcelResearchRequest" ADD CONSTRAINT "ParcelResearchRequest_dealId_fkey"
  FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
