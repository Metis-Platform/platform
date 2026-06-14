-- CreateTable
CREATE TABLE "TenantWorkflowRule" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "strategy" "StrategyType" NOT NULL,
    "name" TEXT NOT NULL,
    "triggerEvent" TEXT NOT NULL,
    "offsetDays" INTEGER NOT NULL DEFAULT 0,
    "action" TEXT NOT NULL DEFAULT 'CREATE_TASK',
    "actionConfig" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantWorkflowRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TenantWorkflowRule_tenantId_strategy_idx" ON "TenantWorkflowRule"("tenantId", "strategy");

-- AddForeignKey
ALTER TABLE "TenantWorkflowRule" ADD CONSTRAINT "TenantWorkflowRule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
