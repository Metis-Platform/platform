-- CreateTable
CREATE TABLE "JurisdictionStrategyData" (
    "id" TEXT NOT NULL,
    "jurisdictionId" TEXT NOT NULL,
    "strategy" "StrategyType" NOT NULL,
    "data" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "JurisdictionStrategyData_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "JurisdictionStrategyData_jurisdictionId_strategy_key" ON "JurisdictionStrategyData"("jurisdictionId", "strategy");

-- CreateIndex
CREATE INDEX "JurisdictionStrategyData_jurisdictionId_idx" ON "JurisdictionStrategyData"("jurisdictionId");

-- AddForeignKey
ALTER TABLE "JurisdictionStrategyData" ADD CONSTRAINT "JurisdictionStrategyData_jurisdictionId_fkey" FOREIGN KEY ("jurisdictionId") REFERENCES "Jurisdiction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
