-- CreateEnum
CREATE TYPE "AuctionFeedSource" AS ENUM ('GOVEASE', 'REALAUCTION_FL', 'TAX_SALE_RESOURCES');

-- AlterEnum
ALTER TYPE "EventType" ADD VALUE 'TAX_SALE';

-- CreateTable
CREATE TABLE "AuctionSaleFeed" (
    "id" TEXT NOT NULL,
    "jurisdictionId" TEXT NOT NULL,
    "source" "AuctionFeedSource" NOT NULL,
    "saleDate" TIMESTAMP(3) NOT NULL,
    "registrationDeadline" TIMESTAMP(3),
    "depositRequirementCents" INTEGER,
    "platformUrl" TEXT,
    "notes" TEXT,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuctionSaleFeed_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AuctionSaleFeed_jurisdictionId_source_saleDate_key" ON "AuctionSaleFeed"("jurisdictionId", "source", "saleDate");

-- CreateIndex
CREATE INDEX "AuctionSaleFeed_jurisdictionId_idx" ON "AuctionSaleFeed"("jurisdictionId");

-- CreateIndex
CREATE INDEX "AuctionSaleFeed_saleDate_idx" ON "AuctionSaleFeed"("saleDate");

-- CreateIndex
CREATE INDEX "AuctionSaleFeed_source_idx" ON "AuctionSaleFeed"("source");

-- AddForeignKey
ALTER TABLE "AuctionSaleFeed" ADD CONSTRAINT "AuctionSaleFeed_jurisdictionId_fkey" FOREIGN KEY ("jurisdictionId") REFERENCES "Jurisdiction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
