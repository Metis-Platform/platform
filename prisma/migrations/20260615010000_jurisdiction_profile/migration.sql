-- CreateTable
CREATE TABLE "JurisdictionProfile" (
    "id" TEXT NOT NULL,
    "jurisdictionId" TEXT NOT NULL,
    "taxSale" JSONB NOT NULL DEFAULT '{}',
    "foreclosure" JSONB NOT NULL DEFAULT '{}',
    "recording" JSONB NOT NULL DEFAULT '{}',
    "zoning" JSONB NOT NULL DEFAULT '{}',
    "physical" JSONB NOT NULL DEFAULT '{}',
    "permits" JSONB NOT NULL DEFAULT '{}',
    "landlordTenant" JSONB NOT NULL DEFAULT '{}',
    "section8" JSONB NOT NULL DEFAULT '{}',
    "wholesale" JSONB NOT NULL DEFAULT '{}',
    "marketSignals" JSONB NOT NULL DEFAULT '{}',
    "contacts" JSONB NOT NULL DEFAULT '{}',
    "publishedSections" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JurisdictionProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "JurisdictionProfile_jurisdictionId_key" ON "JurisdictionProfile"("jurisdictionId");

-- CreateIndex
CREATE INDEX "JurisdictionProfile_jurisdictionId_idx" ON "JurisdictionProfile"("jurisdictionId");

-- AddForeignKey
ALTER TABLE "JurisdictionProfile" ADD CONSTRAINT "JurisdictionProfile_jurisdictionId_fkey" FOREIGN KEY ("jurisdictionId") REFERENCES "Jurisdiction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
