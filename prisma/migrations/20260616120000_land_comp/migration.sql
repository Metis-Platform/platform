-- Create LandComp table
CREATE TABLE IF NOT EXISTS "LandComp" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "address" TEXT,
    "apn" TEXT,
    "acres" DECIMAL(10,4) NOT NULL,
    "salePrice" DECIMAL(14,2) NOT NULL,
    "saleDate" TIMESTAMP(3) NOT NULL,
    "sourceUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LandComp_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX IF NOT EXISTS "LandComp_dealId_idx" ON "LandComp"("dealId");
CREATE INDEX IF NOT EXISTS "LandComp_tenantId_idx" ON "LandComp"("tenantId");

-- Foreign key
ALTER TABLE "LandComp" ADD CONSTRAINT "LandComp_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
