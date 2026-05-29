-- AlterEnum
ALTER TYPE "InvestmentType" ADD VALUE 'REDEEMABLE_DEED';

-- AlterTable
ALTER TABLE "DealTaxLien" ADD COLUMN     "auctionDate" TIMESTAMP(3),
ADD COLUMN     "maxBid" DECIMAL(14,2),
ALTER COLUMN "certificateNumber" DROP NOT NULL,
ALTER COLUMN "faceAmount" DROP NOT NULL,
ALTER COLUMN "interestRate" DROP NOT NULL,
ALTER COLUMN "issueDate" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Jurisdiction" ADD COLUMN     "links" JSONB;
