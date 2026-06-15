-- CreateEnum
CREATE TYPE "ExtractionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "JurisdictionSourceUrl" (
    "id" TEXT NOT NULL,
    "jurisdictionId" TEXT NOT NULL,
    "officeType" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "lastFetchedAt" TIMESTAMP(3),
    "lastContentHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "JurisdictionSourceUrl_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExtractionCandidate" (
    "id" TEXT NOT NULL,
    "jurisdictionId" TEXT NOT NULL,
    "sourceUrlId" TEXT,
    "section" TEXT NOT NULL,
    "fieldKey" TEXT NOT NULL,
    "extractedValue" JSONB NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "sourceSnippet" TEXT,
    "modelUsed" TEXT NOT NULL,
    "status" "ExtractionStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExtractionCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "JurisdictionSourceUrl_jurisdictionId_officeType_url_key" ON "JurisdictionSourceUrl"("jurisdictionId", "officeType", "url");
CREATE INDEX "JurisdictionSourceUrl_jurisdictionId_idx" ON "JurisdictionSourceUrl"("jurisdictionId");
CREATE INDEX "ExtractionCandidate_jurisdictionId_idx" ON "ExtractionCandidate"("jurisdictionId");
CREATE INDEX "ExtractionCandidate_status_idx" ON "ExtractionCandidate"("status");
CREATE INDEX "ExtractionCandidate_jurisdictionId_section_fieldKey_idx" ON "ExtractionCandidate"("jurisdictionId", "section", "fieldKey");

-- AddForeignKey
ALTER TABLE "JurisdictionSourceUrl" ADD CONSTRAINT "JurisdictionSourceUrl_jurisdictionId_fkey"
    FOREIGN KEY ("jurisdictionId") REFERENCES "Jurisdiction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ExtractionCandidate" ADD CONSTRAINT "ExtractionCandidate_jurisdictionId_fkey"
    FOREIGN KEY ("jurisdictionId") REFERENCES "Jurisdiction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ExtractionCandidate" ADD CONSTRAINT "ExtractionCandidate_sourceUrlId_fkey"
    FOREIGN KEY ("sourceUrlId") REFERENCES "JurisdictionSourceUrl"("id") ON DELETE SET NULL ON UPDATE CASCADE;
