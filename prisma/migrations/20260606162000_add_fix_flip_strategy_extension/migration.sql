-- CreateTable
CREATE TABLE "DealFixFlip" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "arv" DECIMAL(14,2),
    "rehabBudget" DECIMAL(14,2),
    "rehabActualCost" DECIMAL(14,2),
    "contractorName" TEXT,
    "contractorPhone" TEXT,
    "contractorEmail" TEXT,
    "permitStatus" TEXT,
    "rehabStartDate" TIMESTAMP(3),
    "rehabTargetCompletion" TIMESTAMP(3),
    "rehabCompletedDate" TIMESTAMP(3),
    "listingDate" TIMESTAMP(3),
    "listingPrice" DECIMAL(14,2),
    "acceptedOfferDate" TIMESTAMP(3),
    "acceptedOfferPrice" DECIMAL(14,2),
    "closingDate" TIMESTAMP(3),
    "holdingCostEstimate" DECIMAL(14,2),
    "scopeOfWork" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DealFixFlip_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DealFixFlip_dealId_key" ON "DealFixFlip"("dealId");

-- AddForeignKey
ALTER TABLE "DealFixFlip" ADD CONSTRAINT "DealFixFlip_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
