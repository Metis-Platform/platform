-- CreateTable
CREATE TABLE "ChecklistTemplate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "strategy" "StrategyType" NOT NULL,
    "name" TEXT NOT NULL,
    "items" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChecklistTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: unique for tenant overrides (tenantId is not null)
CREATE UNIQUE INDEX "ChecklistTemplate_tenantId_strategy_key"
  ON "ChecklistTemplate"("tenantId", "strategy")
  WHERE "tenantId" IS NOT NULL;

-- CreateIndex: unique for system templates (tenantId is null)
CREATE UNIQUE INDEX "ChecklistTemplate_system_strategy_key"
  ON "ChecklistTemplate"("strategy")
  WHERE "tenantId" IS NULL;

-- CreateIndex
CREATE INDEX "ChecklistTemplate_strategy_idx" ON "ChecklistTemplate"("strategy");
