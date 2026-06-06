-- CreateTable
CREATE TABLE "DealMultifamily" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "unitCount" INTEGER,
    "occupiedUnits" INTEGER,
    "averageMonthlyRent" DECIMAL(14,2),
    "grossScheduledIncome" DECIMAL(14,2),
    "vacancyRate" DECIMAL(5,2),
    "operatingExpenses" JSONB,
    "netOperatingIncome" DECIMAL(14,2),
    "capRate" DECIMAL(6,4),
    "dscr" DECIMAL(6,4),
    "loanAmount" DECIMAL(14,2),
    "interestRate" DECIMAL(6,4),
    "amortizationYears" INTEGER,
    "annualDebtService" DECIMAL(14,2),
    "rentRoll" JSONB,
    "t12Financials" JSONB,
    "propertyManagerName" TEXT,
    "propertyManagerPhone" TEXT,
    "propertyManagerEmail" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DealMultifamily_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DealMultifamily_dealId_key" ON "DealMultifamily"("dealId");

-- AddForeignKey
ALTER TABLE "DealMultifamily" ADD CONSTRAINT "DealMultifamily_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
