-- Add NOT_WON to DealStatus enum (non-breaking — adds new value)
ALTER TYPE "DealStatus" ADD VALUE IF NOT EXISTS 'NOT_WON';

-- Change Deal.status default from ACTIVE to LEAD (non-breaking — only affects new rows)
ALTER TABLE "Deal" ALTER COLUMN "status" SET DEFAULT 'LEAD';
