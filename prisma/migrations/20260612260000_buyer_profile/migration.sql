-- BuyerProfile: buy-box criteria for wholesale buyer contacts
CREATE TABLE "BuyerProfile" (
  "id"                 TEXT NOT NULL,
  "contactId"          TEXT NOT NULL,
  "tenantId"           TEXT NOT NULL,
  "priceMin"           DECIMAL(14,2),
  "priceMax"           DECIMAL(14,2),
  "assignmentFeeMax"   DECIMAL(14,2),
  "preferredStates"    TEXT[] NOT NULL DEFAULT '{}',
  "preferredPropTypes" TEXT[] NOT NULL DEFAULT '{}',
  "isActive"           BOOLEAN NOT NULL DEFAULT true,
  "notes"              TEXT,
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BuyerProfile_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BuyerProfile_contactId_key" ON "BuyerProfile"("contactId");
CREATE INDEX "BuyerProfile_tenantId_idx" ON "BuyerProfile"("tenantId");
ALTER TABLE "BuyerProfile"
  ADD CONSTRAINT "BuyerProfile_contactId_fkey"
  FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Link a committed buyer contact to a wholesale deal
ALTER TABLE "DealWholesale" ADD COLUMN IF NOT EXISTS "buyerContactId" TEXT;
CREATE INDEX IF NOT EXISTS "DealWholesale_buyerContactId_idx" ON "DealWholesale"("buyerContactId");
ALTER TABLE "DealWholesale"
  ADD CONSTRAINT "DealWholesale_buyerContactId_fkey"
  FOREIGN KEY ("buyerContactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
