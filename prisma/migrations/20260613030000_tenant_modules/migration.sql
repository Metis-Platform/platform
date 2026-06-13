-- CreateEnum
CREATE TYPE "ModuleTier" AS ENUM ('STANDARD', 'PREMIUM');

-- CreateTable
CREATE TABLE "TenantModule" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "strategy" "StrategyType" NOT NULL,
    "tier" "ModuleTier" NOT NULL DEFAULT 'STANDARD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenantModule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TenantModule_tenantId_strategy_key" ON "TenantModule"("tenantId", "strategy");

-- CreateIndex
CREATE INDEX "TenantModule_tenantId_idx" ON "TenantModule"("tenantId");

-- AddForeignKey
ALTER TABLE "TenantModule" ADD CONSTRAINT "TenantModule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: grant STANDARD access to all creatable strategies for every existing tenant
INSERT INTO "TenantModule" ("id", "tenantId", "strategy", "tier", "createdAt")
SELECT
    gen_random_uuid()::text,
    t.id,
    s.strategy::"StrategyType",
    'STANDARD'::"ModuleTier",
    NOW()
FROM "Tenant" t
CROSS JOIN (
    VALUES
        ('TAX_LIEN'),
        ('TAX_DEED'),
        ('FORECLOSURE'),
        ('FIX_FLIP'),
        ('WHOLESALE'),
        ('BUY_HOLD'),
        ('LAND')
) AS s(strategy)
ON CONFLICT ("tenantId", "strategy") DO NOTHING;
