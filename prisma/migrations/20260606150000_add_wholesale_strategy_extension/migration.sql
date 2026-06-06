-- CreateTable
CREATE TABLE "DealWholesale" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "leadSource" TEXT,
    "contractDate" TIMESTAMP(3),
    "contractPrice" DECIMAL(14,2),
    "earnestMoney" DECIMAL(14,2),
    "inspectionDeadline" TIMESTAMP(3),
    "closingDeadline" TIMESTAMP(3),
    "assignmentFee" DECIMAL(14,2),
    "buyerName" TEXT,
    "buyerEmail" TEXT,
    "buyerPhone" TEXT,
    "dispositionStatus" TEXT,
    "marketingNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DealWholesale_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DealWholesale_dealId_key" ON "DealWholesale"("dealId");

-- AddForeignKey
ALTER TABLE "DealWholesale" ADD CONSTRAINT "DealWholesale_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
