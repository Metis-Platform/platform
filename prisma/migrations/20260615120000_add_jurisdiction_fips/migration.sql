-- Add nullable FIPS so existing jurisdiction rows can be backfilled idempotently.
ALTER TABLE "Jurisdiction" ADD COLUMN "fips" TEXT;

CREATE UNIQUE INDEX "Jurisdiction_fips_key" ON "Jurisdiction"("fips");
