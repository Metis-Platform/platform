-- Contact FK columns on DealFixFlip
ALTER TABLE "DealFixFlip" ADD COLUMN IF NOT EXISTS "contractorContactId" TEXT;
ALTER TABLE "DealFixFlip"
  ADD CONSTRAINT IF NOT EXISTS "DealFixFlip_contractorContactId_fkey"
  FOREIGN KEY ("contractorContactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS "DealFixFlip_contractorContactId_idx" ON "DealFixFlip"("contractorContactId");

-- Contact FK columns on DealBuyHold
ALTER TABLE "DealBuyHold" ADD COLUMN IF NOT EXISTS "tenantContactId" TEXT;
ALTER TABLE "DealBuyHold"
  ADD CONSTRAINT IF NOT EXISTS "DealBuyHold_tenantContactId_fkey"
  FOREIGN KEY ("tenantContactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS "DealBuyHold_tenantContactId_idx" ON "DealBuyHold"("tenantContactId");

ALTER TABLE "DealBuyHold" ADD COLUMN IF NOT EXISTS "propertyManagerContactId" TEXT;
ALTER TABLE "DealBuyHold"
  ADD CONSTRAINT IF NOT EXISTS "DealBuyHold_propertyManagerContactId_fkey"
  FOREIGN KEY ("propertyManagerContactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS "DealBuyHold_propertyManagerContactId_idx" ON "DealBuyHold"("propertyManagerContactId");

-- Contact FK column on DealMultifamily
ALTER TABLE "DealMultifamily" ADD COLUMN IF NOT EXISTS "propertyManagerContactId" TEXT;
ALTER TABLE "DealMultifamily"
  ADD CONSTRAINT IF NOT EXISTS "DealMultifamily_propertyManagerContactId_fkey"
  FOREIGN KEY ("propertyManagerContactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS "DealMultifamily_propertyManagerContactId_idx" ON "DealMultifamily"("propertyManagerContactId");

-- Contact FK column on LandNote
ALTER TABLE "LandNote" ADD COLUMN IF NOT EXISTS "buyerContactId" TEXT;
ALTER TABLE "LandNote"
  ADD CONSTRAINT IF NOT EXISTS "LandNote_buyerContactId_fkey"
  FOREIGN KEY ("buyerContactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS "LandNote_buyerContactId_idx" ON "LandNote"("buyerContactId");

-- LP investor table for multifamily syndications
CREATE TABLE IF NOT EXISTS "DealMfLpInvestor" (
  "id"              TEXT NOT NULL,
  "dealId"          TEXT NOT NULL,
  "tenantId"        TEXT NOT NULL,
  "contactId"       TEXT,
  "name"            TEXT NOT NULL,
  "email"           TEXT,
  "phone"           TEXT,
  "committedAmount" DECIMAL(14,2) NOT NULL,
  "fundedAmount"    DECIMAL(14,2) NOT NULL DEFAULT 0,
  "equityPct"       DECIMAL(6,4),
  "notes"           TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DealMfLpInvestor_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DealMfLpInvestor_dealId_fkey"
    FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "DealMfLpInvestor_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "DealMfLpInvestor_contactId_fkey"
    FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "DealMfLpInvestor_dealId_idx" ON "DealMfLpInvestor"("dealId");
CREATE INDEX IF NOT EXISTS "DealMfLpInvestor_tenantId_idx" ON "DealMfLpInvestor"("tenantId");

-- Waterfall parameters table
CREATE TABLE IF NOT EXISTS "DealMfWaterfall" (
  "id"                  TEXT NOT NULL,
  "dealId"              TEXT NOT NULL,
  "tenantId"            TEXT NOT NULL,
  "preferredReturnRate" DECIMAL(6,4) NOT NULL,
  "lpSplit"             DECIMAL(5,4) NOT NULL,
  "gpSplit"             DECIMAL(5,4) NOT NULL,
  "promoteHurdle"       DECIMAL(6,4),
  "promoteCarry"        DECIMAL(5,4),
  "raisedDate"          TIMESTAMP(3),
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DealMfWaterfall_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DealMfWaterfall_dealId_key" UNIQUE ("dealId"),
  CONSTRAINT "DealMfWaterfall_dealId_fkey"
    FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "DealMfWaterfall_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "DealMfWaterfall_tenantId_idx" ON "DealMfWaterfall"("tenantId");
