-- Add FORECLOSURE to StrategyType enum
ALTER TYPE "StrategyType" ADD VALUE 'FORECLOSURE';

-- CreateTable
CREATE TABLE "DealForeclosure" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "foreclosureType" TEXT NOT NULL DEFAULT 'MORTGAGE',
    "nodFiledDate" TIMESTAMP(3),
    "lisFiledDate" TIMESTAMP(3),
    "estimatedLiens" DECIMAL(14,2),
    "auctionDate" TIMESTAMP(3),
    "maxBid" DECIMAL(14,2),
    "openingBid" DECIMAL(14,2),
    "winningBid" DECIMAL(14,2),
    "redemptionDeadline" TIMESTAMP(3),
    "titleIssues" JSONB,
    "propertyCondition" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DealForeclosure_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DealForeclosure_dealId_key" ON "DealForeclosure"("dealId");

-- AddForeignKey
ALTER TABLE "DealForeclosure" ADD CONSTRAINT "DealForeclosure_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
