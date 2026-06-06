-- CreateTable
CREATE TABLE "DealBuyHold" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "rentalStrategy" TEXT,
    "targetMonthlyRent" DECIMAL(14,2),
    "actualMonthlyRent" DECIMAL(14,2),
    "securityDeposit" DECIMAL(14,2),
    "leaseStartDate" TIMESTAMP(3),
    "leaseEndDate" TIMESTAMP(3),
    "tenantName" TEXT,
    "tenantPhone" TEXT,
    "tenantEmail" TEXT,
    "propertyManagerName" TEXT,
    "propertyManagerPhone" TEXT,
    "propertyManagerEmail" TEXT,
    "section8VoucherAmount" DECIMAL(14,2),
    "housingAuthorityName" TEXT,
    "inspectionStatus" TEXT,
    "operatingExpenses" JSONB,
    "maintenanceReserve" DECIMAL(14,2),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DealBuyHold_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DealBuyHold_dealId_key" ON "DealBuyHold"("dealId");

-- AddForeignKey
ALTER TABLE "DealBuyHold" ADD CONSTRAINT "DealBuyHold_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
