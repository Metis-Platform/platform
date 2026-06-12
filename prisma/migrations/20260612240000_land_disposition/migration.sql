-- Create LandDispositionStatus enum
DO $$ BEGIN
  CREATE TYPE "LandDispositionStatus" AS ENUM ('LISTED', 'UNDER_CONTRACT', 'SOLD_CASH', 'SOLD_TERMS', 'RELISTED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add disposition columns to DealLand
ALTER TABLE "DealLand"
  ADD COLUMN IF NOT EXISTS "dispositionStatus" "LandDispositionStatus",
  ADD COLUMN IF NOT EXISTS "listedPrice" DECIMAL(14,2),
  ADD COLUMN IF NOT EXISTS "dispositionDate" TIMESTAMP(3);
