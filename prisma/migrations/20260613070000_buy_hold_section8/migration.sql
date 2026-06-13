-- Section 8 premium fields on DealBuyHold
ALTER TABLE "DealBuyHold"
  ADD COLUMN "hapContractNumber"      TEXT,
  ADD COLUMN "hapMonthlyAmount"       DECIMAL(14,2),
  ADD COLUMN "tenantPortion"          DECIMAL(14,2),
  ADD COLUMN "hapAnniversary"         TIMESTAMP(3),
  ADD COLUMN "nextHqsDate"            TIMESTAMP(3),
  ADD COLUMN "hqsResult"              TEXT,
  ADD COLUMN "fmrBedrooms"            INTEGER,
  ADD COLUMN "rentIncreaseNoticeDays" INTEGER DEFAULT 60;

-- New EventType values (additive only)
ALTER TYPE "EventType" ADD VALUE 'HQS_INSPECTION';
ALTER TYPE "EventType" ADD VALUE 'RENT_INCREASE_WINDOW';

-- New ContactType value
ALTER TYPE "ContactType" ADD VALUE 'AGENCY';

-- FMR reference table
CREATE TABLE "FmrRate" (
  "id"       TEXT NOT NULL,
  "state"    TEXT NOT NULL,
  "county"   TEXT NOT NULL,
  "year"     INTEGER NOT NULL,
  "bedrooms" INTEGER NOT NULL,
  "amount"   DECIMAL(10,2) NOT NULL,
  CONSTRAINT "FmrRate_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FmrRate_state_county_year_bedrooms_key" ON "FmrRate"("state", "county", "year", "bedrooms");
CREATE INDEX "FmrRate_state_county_idx" ON "FmrRate"("state", "county");
