-- CreateEnum
CREATE TYPE "LandAccess" AS ENUM ('ROAD', 'EASEMENT', 'LANDLOCKED', 'NONE', 'UNKNOWN');

-- CreateTable
CREATE TABLE "DealLand" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "zoning" TEXT,
    "access" "LandAccess",
    "utilities" JSONB,
    "floodZone" TEXT,
    "wetlandsPercent" DECIMAL(5,2),
    "hoaName" TEXT,
    "hoaFees" DECIMAL(14,2),
    "optionExpiry" TIMESTAMP(3),
    "sellerFinanceTerms" JSONB,
    "buyerFinanceTerms" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DealLand_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "DealLand_wetlandsPercent_check" CHECK ("wetlandsPercent" IS NULL OR ("wetlandsPercent" >= 0 AND "wetlandsPercent" <= 100))
);

-- CreateIndex
CREATE UNIQUE INDEX "DealLand_dealId_key" ON "DealLand"("dealId");

-- AddForeignKey
ALTER TABLE "DealLand" ADD CONSTRAINT "DealLand_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
