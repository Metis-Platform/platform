-- CreateEnum
CREATE TYPE "JurisdictionEvidenceRetrievalAdapter" AS ENUM ('JINA_READER');

-- AlterTable
ALTER TABLE "ExtractionCandidate" ADD COLUMN     "evidenceSnapshotId" TEXT;

-- AlterTable
ALTER TABLE "JurisdictionClaimEvidence" ADD COLUMN     "byteLength" INTEGER,
ADD COLUMN     "evidenceSnapshotId" TEXT,
ADD COLUMN     "representationMediaType" TEXT,
ADD COLUMN     "retrievalAdapter" "JurisdictionEvidenceRetrievalAdapter",
ADD COLUMN     "storageKey" TEXT;

-- CreateTable
CREATE TABLE "JurisdictionEvidenceSnapshot" (
    "id" TEXT NOT NULL,
    "jurisdictionId" TEXT NOT NULL,
    "sourceUrlId" TEXT,
    "sourceUrl" TEXT NOT NULL,
    "retrievedAt" TIMESTAMP(3) NOT NULL,
    "retrievalAdapter" "JurisdictionEvidenceRetrievalAdapter" NOT NULL,
    "representationMediaType" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "byteLength" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JurisdictionEvidenceSnapshot_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "JurisdictionEvidenceSnapshot_contentHash_check" CHECK ("contentHash" ~ '^[0-9a-f]{64}$'),
    CONSTRAINT "JurisdictionEvidenceSnapshot_byteLength_check" CHECK ("byteLength" > 0),
    CONSTRAINT "JurisdictionEvidenceSnapshot_sourceUrl_check" CHECK (length(btrim("sourceUrl")) > 0),
    CONSTRAINT "JurisdictionEvidenceSnapshot_mediaType_check" CHECK (length(btrim("representationMediaType")) > 0),
    CONSTRAINT "JurisdictionEvidenceSnapshot_storageKey_check" CHECK (
        "storageKey" = 'jurisdiction-evidence/sha256/' || substring("contentHash" from 1 for 2) || '/' || "contentHash" || '.md'
    )
);

-- Snapshot-backed claim evidence must retain a complete copied integrity envelope.
ALTER TABLE "JurisdictionClaimEvidence"
ADD CONSTRAINT "JurisdictionClaimEvidence_snapshotMetadata_check" CHECK (
    "evidenceSnapshotId" IS NULL OR (
        "contentHash" IS NOT NULL
        AND "storageKey" IS NOT NULL
        AND "retrievalAdapter" IS NOT NULL
        AND "representationMediaType" IS NOT NULL
        AND "byteLength" IS NOT NULL
        AND "byteLength" > 0
    )
);

-- CreateIndex
CREATE INDEX "JurisdictionEvidenceSnapshot_jurisdictionId_retrievedAt_idx" ON "JurisdictionEvidenceSnapshot"("jurisdictionId", "retrievedAt");

-- CreateIndex
CREATE INDEX "JurisdictionEvidenceSnapshot_sourceUrlId_retrievedAt_idx" ON "JurisdictionEvidenceSnapshot"("sourceUrlId", "retrievedAt");

-- CreateIndex
CREATE INDEX "JurisdictionEvidenceSnapshot_contentHash_idx" ON "JurisdictionEvidenceSnapshot"("contentHash");

-- CreateIndex
CREATE INDEX "JurisdictionEvidenceSnapshot_storageKey_idx" ON "JurisdictionEvidenceSnapshot"("storageKey");

-- CreateIndex
CREATE INDEX "JurisdictionClaimEvidence_evidenceSnapshotId_idx" ON "JurisdictionClaimEvidence"("evidenceSnapshotId");

-- AddForeignKey
ALTER TABLE "JurisdictionEvidenceSnapshot" ADD CONSTRAINT "JurisdictionEvidenceSnapshot_jurisdictionId_fkey" FOREIGN KEY ("jurisdictionId") REFERENCES "Jurisdiction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JurisdictionEvidenceSnapshot" ADD CONSTRAINT "JurisdictionEvidenceSnapshot_sourceUrlId_fkey" FOREIGN KEY ("sourceUrlId") REFERENCES "JurisdictionSourceUrl"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtractionCandidate" ADD CONSTRAINT "ExtractionCandidate_evidenceSnapshotId_fkey" FOREIGN KEY ("evidenceSnapshotId") REFERENCES "JurisdictionEvidenceSnapshot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JurisdictionClaimEvidence" ADD CONSTRAINT "JurisdictionClaimEvidence_evidenceSnapshotId_fkey" FOREIGN KEY ("evidenceSnapshotId") REFERENCES "JurisdictionEvidenceSnapshot"("id") ON DELETE SET NULL ON UPDATE CASCADE;
