-- Add new TransactionType enum values
-- Each ADD VALUE must be a separate statement in PostgreSQL
ALTER TYPE "TransactionType" ADD VALUE IF NOT EXISTS 'SALE_PROCEEDS';
ALTER TYPE "TransactionType" ADD VALUE IF NOT EXISTS 'RENT_RECEIVED';
ALTER TYPE "TransactionType" ADD VALUE IF NOT EXISTS 'NOTE_PAYMENT_RECEIVED';
ALTER TYPE "TransactionType" ADD VALUE IF NOT EXISTS 'REHAB_COST';
ALTER TYPE "TransactionType" ADD VALUE IF NOT EXISTS 'INSURANCE';
ALTER TYPE "TransactionType" ADD VALUE IF NOT EXISTS 'PROPERTY_TAX';
ALTER TYPE "TransactionType" ADD VALUE IF NOT EXISTS 'HOA_FEE';
ALTER TYPE "TransactionType" ADD VALUE IF NOT EXISTS 'MANAGEMENT_FEE';
ALTER TYPE "TransactionType" ADD VALUE IF NOT EXISTS 'LOAN_PAYMENT';

-- Backfill REDEMPTION_RECEIVED rows from DealTaxLien.redemptionAmount
-- Only inserts where no matching row already exists (guard against re-run)
INSERT INTO "FinancialTransaction" (id, "dealId", "tenantId", type, amount, date, description, "createdAt")
SELECT
  gen_random_uuid()::text,
  d.id,
  d."tenantId",
  'REDEMPTION_RECEIVED'::"TransactionType",
  tl."redemptionAmount",
  COALESCE(tl."redemptionDate", now()),
  'Backfilled from redemptionAmount',
  now()
FROM "DealTaxLien" tl
JOIN "Deal" d ON d.id = tl."dealId"
WHERE tl."redemptionAmount" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "FinancialTransaction" ft
    WHERE ft."dealId" = d.id
      AND ft.type = 'REDEMPTION_RECEIVED'::"TransactionType"
      AND ft.description = 'Backfilled from redemptionAmount'
  );

-- Backfill SUBSEQUENT_TAX rows from DealTaxLien.subsequentTaxesPaid
INSERT INTO "FinancialTransaction" (id, "dealId", "tenantId", type, amount, date, description, "createdAt")
SELECT
  gen_random_uuid()::text,
  d.id,
  d."tenantId",
  'SUBSEQUENT_TAX'::"TransactionType",
  tl."subsequentTaxesPaid",
  now(),
  'Backfilled from subsequentTaxesPaid',
  now()
FROM "DealTaxLien" tl
JOIN "Deal" d ON d.id = tl."dealId"
WHERE tl."subsequentTaxesPaid" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "FinancialTransaction" ft
    WHERE ft."dealId" = d.id
      AND ft.type = 'SUBSEQUENT_TAX'::"TransactionType"
      AND ft.description = 'Backfilled from subsequentTaxesPaid'
  );
