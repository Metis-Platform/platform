-- Add trial expiry tracking to TenantModule
ALTER TABLE "TenantModule" ADD COLUMN "trialEndsAt" TIMESTAMP(3);

-- Create ModulePrice table for admin-managed pricing configuration
CREATE TABLE "ModulePrice" (
    "id" TEXT NOT NULL,
    "strategy" "StrategyType" NOT NULL,
    "tier" "ModuleTier" NOT NULL,
    "stripePriceId" TEXT,
    "displayPrice" DECIMAL(10,2),
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModulePrice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ModulePrice_strategy_tier_key" ON "ModulePrice"("strategy", "tier");
