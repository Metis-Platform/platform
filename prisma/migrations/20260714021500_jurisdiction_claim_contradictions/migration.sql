-- CreateEnum
CREATE TYPE "JurisdictionClaimContradictionDecision" AS ENUM ('REPLACED_CURRENT', 'REJECTED_CHALLENGE', 'NOT_COMPARABLE');

-- CreateTable
CREATE TABLE "JurisdictionClaimContradictionReview" (
    "id" TEXT NOT NULL,
    "jurisdictionId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "questionSchemaVersion" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "fieldKey" TEXT NOT NULL,
    "existingClaimId" TEXT NOT NULL,
    "replacementClaimId" TEXT,
    "candidateId" TEXT,
    "candidateReferenceId" TEXT NOT NULL,
    "candidateUpdatedAt" TIMESTAMP(3) NOT NULL,
    "evidenceSnapshotId" TEXT,
    "evidenceSnapshotReferenceId" TEXT NOT NULL,
    "sourceUrlId" TEXT,
    "existingValue" JSONB NOT NULL,
    "proposedValue" JSONB NOT NULL,
    "existingNormalizedUnit" TEXT,
    "proposedNormalizedUnit" TEXT,
    "sourceUrl" TEXT NOT NULL,
    "sourceSnippet" TEXT NOT NULL,
    "evidenceRetrievedAt" TIMESTAMP(3) NOT NULL,
    "contentHash" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "retrievalAdapter" "JurisdictionEvidenceRetrievalAdapter" NOT NULL,
    "representationMediaType" TEXT NOT NULL,
    "byteLength" INTEGER NOT NULL,
    "modelUsed" TEXT NOT NULL,
    "decision" "JurisdictionClaimContradictionDecision" NOT NULL,
    "explanation" TEXT NOT NULL,
    "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JurisdictionClaimContradictionReview_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "JurisdictionClaimContradictionReview_identity_check" CHECK (
        length(btrim("questionId")) > 0
        AND length(btrim("questionSchemaVersion")) > 0
        AND length(btrim("section")) > 0
        AND length(btrim("fieldKey")) > 0
        AND length(btrim("candidateReferenceId")) > 0
        AND length(btrim("evidenceSnapshotReferenceId")) > 0
    ),
    CONSTRAINT "JurisdictionClaimContradictionReview_evidence_check" CHECK (
        "contentHash" ~ '^[0-9a-f]{64}$'
        AND "storageKey" = 'jurisdiction-evidence/sha256/' || substring("contentHash" from 1 for 2) || '/' || "contentHash" || '.md'
        AND "byteLength" > 0
        AND length(btrim("sourceUrl")) > 0
        AND length(btrim("representationMediaType")) > 0
        AND length(btrim("modelUsed")) > 0
    ),
    CONSTRAINT "JurisdictionClaimContradictionReview_review_check" CHECK (
        length(btrim("explanation")) >= 10
        AND length(btrim("reviewedBy")) > 0
        AND "evidenceRetrievedAt" <= "reviewedAt"
        AND "candidateUpdatedAt" <= "reviewedAt"
    ),
    CONSTRAINT "JurisdictionClaimContradictionReview_decision_check" CHECK (
        ("decision" = 'REPLACED_CURRENT' AND "replacementClaimId" IS NOT NULL AND "replacementClaimId" <> "existingClaimId")
        OR ("decision" <> 'REPLACED_CURRENT' AND "replacementClaimId" IS NULL)
    )
);

-- CreateIndex
CREATE INDEX "JurisdictionClaimContradictionReview_jurisdictionId_section_idx" ON "JurisdictionClaimContradictionReview"("jurisdictionId", "section", "fieldKey", "reviewedAt");

-- CreateIndex
CREATE INDEX "JurisdictionClaimContradictionReview_existingClaimId_review_idx" ON "JurisdictionClaimContradictionReview"("existingClaimId", "reviewedAt");

-- CreateIndex
CREATE INDEX "JurisdictionClaimContradictionReview_replacementClaimId_idx" ON "JurisdictionClaimContradictionReview"("replacementClaimId");

-- CreateIndex
CREATE INDEX "JurisdictionClaimContradictionReview_candidateId_idx" ON "JurisdictionClaimContradictionReview"("candidateId");

-- CreateIndex
CREATE INDEX "JurisdictionClaimContradictionReview_evidenceSnapshotId_idx" ON "JurisdictionClaimContradictionReview"("evidenceSnapshotId");

-- AddForeignKey
ALTER TABLE "JurisdictionClaimContradictionReview" ADD CONSTRAINT "JurisdictionClaimContradictionReview_jurisdictionId_fkey" FOREIGN KEY ("jurisdictionId") REFERENCES "Jurisdiction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JurisdictionClaimContradictionReview" ADD CONSTRAINT "JurisdictionClaimContradictionReview_existingClaimId_fkey" FOREIGN KEY ("existingClaimId") REFERENCES "JurisdictionClaim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JurisdictionClaimContradictionReview" ADD CONSTRAINT "JurisdictionClaimContradictionReview_replacementClaimId_fkey" FOREIGN KEY ("replacementClaimId") REFERENCES "JurisdictionClaim"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JurisdictionClaimContradictionReview" ADD CONSTRAINT "JurisdictionClaimContradictionReview_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "ExtractionCandidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JurisdictionClaimContradictionReview" ADD CONSTRAINT "JurisdictionClaimContradictionReview_evidenceSnapshotId_fkey" FOREIGN KEY ("evidenceSnapshotId") REFERENCES "JurisdictionEvidenceSnapshot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JurisdictionClaimContradictionReview" ADD CONSTRAINT "JurisdictionClaimContradictionReview_sourceUrlId_fkey" FOREIGN KEY ("sourceUrlId") REFERENCES "JurisdictionSourceUrl"("id") ON DELETE SET NULL ON UPDATE CASCADE;
