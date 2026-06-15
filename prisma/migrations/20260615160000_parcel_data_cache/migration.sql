-- CreateTable
CREATE TABLE "ParcelDataCache" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "apnNormalized" TEXT NOT NULL,
    "fipsCounty" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "valueJson" JSONB NOT NULL,
    "normalized" JSONB,
    "retrievedAt" TIMESTAMP(3) NOT NULL,
    "ttlHours" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB,

    CONSTRAINT "ParcelDataCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ParcelDataCache_tenantId_apnNormalized_fipsCounty_source_field_key" ON "ParcelDataCache"("tenantId", "apnNormalized", "fipsCounty", "source", "field");

-- CreateIndex
CREATE INDEX "ParcelDataCache_tenantId_apnNormalized_fipsCounty_idx" ON "ParcelDataCache"("tenantId", "apnNormalized", "fipsCounty");

-- CreateIndex
CREATE INDEX "ParcelDataCache_expiresAt_idx" ON "ParcelDataCache"("expiresAt");

-- AddForeignKey
ALTER TABLE "ParcelDataCache" ADD CONSTRAINT "ParcelDataCache_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
