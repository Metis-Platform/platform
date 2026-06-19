-- AI parcel summary fields on DealLand
ALTER TABLE "DealLand" ADD COLUMN IF NOT EXISTS "aiSummary" TEXT;
ALTER TABLE "DealLand" ADD COLUMN IF NOT EXISTS "aiSummaryGeneratedAt" TIMESTAMP(3);
