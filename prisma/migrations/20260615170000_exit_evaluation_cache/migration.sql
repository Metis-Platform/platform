-- Exit evaluation cache and tenant-level investor defaults.
CREATE TABLE "InvestorProfile" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "maxPurchasePrice" DOUBLE PRECISION,
  "improvementCapital" DOUBLE PRECISION,
  "holdMonthsTolerance" INTEGER,
  "targetRoi" DOUBLE PRECISION,
  "financing" TEXT NOT NULL,
  "licenseTypes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "InvestorProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExitEvaluation" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "dealId" TEXT NOT NULL,
  "investorProfile" JSONB NOT NULL,
  "results" JSONB NOT NULL,
  "parcelSnapshot" JSONB NOT NULL,
  "evaluatedAt" TIMESTAMP(3) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "version" TEXT NOT NULL,

  CONSTRAINT "ExitEvaluation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InvestorProfile_tenantId_key" ON "InvestorProfile"("tenantId");
CREATE INDEX "InvestorProfile_tenantId_idx" ON "InvestorProfile"("tenantId");
CREATE INDEX "ExitEvaluation_tenantId_dealId_idx" ON "ExitEvaluation"("tenantId", "dealId");
CREATE INDEX "ExitEvaluation_expiresAt_idx" ON "ExitEvaluation"("expiresAt");

ALTER TABLE "InvestorProfile" ADD CONSTRAINT "InvestorProfile_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ExitEvaluation" ADD CONSTRAINT "ExitEvaluation_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ExitEvaluation" ADD CONSTRAINT "ExitEvaluation_dealId_fkey"
  FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
