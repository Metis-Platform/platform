-- CreateTable
CREATE TABLE "DealTaxDeed" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "saleDate" TIMESTAMP(3),
    "openingBid" DECIMAL(14,2),
    "winningBid" DECIMAL(14,2),
    "auctionDate" TIMESTAMP(3),
    "maxBid" DECIMAL(14,2),
    "redemptionPeriodDays" INTEGER,
    "redemptionDeadline" TIMESTAMP(3),
    "isRedeemed" BOOLEAN NOT NULL DEFAULT false,
    "redemptionAmount" DECIMAL(14,2),
    "redemptionDate" TIMESTAMP(3),
    "deedRecordedDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DealTaxDeed_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DealTaxDeed_dealId_key" ON "DealTaxDeed"("dealId");

-- AddForeignKey
ALTER TABLE "DealTaxDeed" ADD CONSTRAINT "DealTaxDeed_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
