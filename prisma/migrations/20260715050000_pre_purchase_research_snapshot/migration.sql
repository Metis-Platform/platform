CREATE TABLE "PrePurchaseResearchSnapshot" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "jurisdictionId" TEXT NOT NULL,
    "apn" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "consumedDealId" TEXT,

    CONSTRAINT "PrePurchaseResearchSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PrePurchaseResearchSnapshot_tenantId_expiresAt_idx" ON "PrePurchaseResearchSnapshot"("tenantId", "expiresAt");
CREATE INDEX "PrePurchaseResearchSnapshot_tenantId_jurisdictionId_apn_idx" ON "PrePurchaseResearchSnapshot"("tenantId", "jurisdictionId", "apn");
CREATE INDEX "PrePurchaseResearchSnapshot_consumedDealId_idx" ON "PrePurchaseResearchSnapshot"("consumedDealId");

ALTER TABLE "PrePurchaseResearchSnapshot" ADD CONSTRAINT "PrePurchaseResearchSnapshot_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PrePurchaseResearchSnapshot" ADD CONSTRAINT "PrePurchaseResearchSnapshot_jurisdictionId_fkey"
  FOREIGN KEY ("jurisdictionId") REFERENCES "Jurisdiction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
