-- CreateEnum
CREATE TYPE "JurisdictionClaimVolatility" AS ENUM ('UNKNOWN', 'STATIC', 'ANNUAL', 'QUARTERLY', 'PER_SALE');

-- CreateEnum
CREATE TYPE "JurisdictionClaimRisk" AS ENUM ('UNKNOWN', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "JurisdictionClaimReReviewDecision" AS ENUM ('RECONFIRMED');

-- AlterTable
ALTER TABLE "JurisdictionClaim"
ADD COLUMN "risk" "JurisdictionClaimRisk" NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN "volatility" "JurisdictionClaimVolatility" NOT NULL DEFAULT 'UNKNOWN';

-- CreateTable
CREATE TABLE "JurisdictionClaimFreshness" (
    "claimId" TEXT NOT NULL,
    "lastEvidenceSnapshotId" TEXT,
    "lastEvidenceRetrievedAt" TIMESTAMP(3) NOT NULL,
    "reviewDueAt" TIMESTAMP(3) NOT NULL,
    "staleAt" TIMESTAMP(3) NOT NULL,
    "policyVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JurisdictionClaimFreshness_pkey" PRIMARY KEY ("claimId"),
    CONSTRAINT "JurisdictionClaimFreshness_dates_check" CHECK (
        "lastEvidenceRetrievedAt" <= "reviewDueAt" AND "reviewDueAt" <= "staleAt"
    ),
    CONSTRAINT "JurisdictionClaimFreshness_policy_check" CHECK (length(btrim("policyVersion")) > 0)
);

-- CreateTable
CREATE TABLE "JurisdictionClaimReReview" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "evidenceSnapshotId" TEXT NOT NULL,
    "sourceUrlId" TEXT,
    "sourceUrl" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "retrievalAdapter" "JurisdictionEvidenceRetrievalAdapter" NOT NULL,
    "representationMediaType" TEXT NOT NULL,
    "byteLength" INTEGER NOT NULL,
    "evidenceRetrievedAt" TIMESTAMP(3) NOT NULL,
    "decision" "JurisdictionClaimReReviewDecision" NOT NULL DEFAULT 'RECONFIRMED',
    "previousReviewDueAt" TIMESTAMP(3) NOT NULL,
    "previousStaleAt" TIMESTAMP(3) NOT NULL,
    "nextReviewDueAt" TIMESTAMP(3) NOT NULL,
    "nextStaleAt" TIMESTAMP(3) NOT NULL,
    "policyVersion" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedBy" TEXT NOT NULL,

    CONSTRAINT "JurisdictionClaimReReview_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "JurisdictionClaimReReview_contentHash_check" CHECK ("contentHash" ~ '^[0-9a-f]{64}$'),
    CONSTRAINT "JurisdictionClaimReReview_byteLength_check" CHECK ("byteLength" > 0),
    CONSTRAINT "JurisdictionClaimReReview_storageKey_check" CHECK (
        "storageKey" = 'jurisdiction-evidence/sha256/' || substring("contentHash" from 1 for 2) || '/' || "contentHash" || '.md'
    ),
    CONSTRAINT "JurisdictionClaimReReview_dates_check" CHECK (
        "previousReviewDueAt" <= "previousStaleAt"
        AND "evidenceRetrievedAt" <= "nextReviewDueAt"
        AND "nextReviewDueAt" <= "nextStaleAt"
        AND "evidenceRetrievedAt" <= "reviewedAt"
    ),
    CONSTRAINT "JurisdictionClaimReReview_explanation_check" CHECK (length(btrim("explanation")) >= 10),
    CONSTRAINT "JurisdictionClaimReReview_reviewer_check" CHECK (length(btrim("reviewedBy")) > 0),
    CONSTRAINT "JurisdictionClaimReReview_policy_check" CHECK (length(btrim("policyVersion")) > 0)
);

-- Existing claims predate the versioned policy. Mark them immediately stale instead
-- of fabricating a review interval or evidence classification.
INSERT INTO "JurisdictionClaimFreshness" (
    "claimId",
    "lastEvidenceSnapshotId",
    "lastEvidenceRetrievedAt",
    "reviewDueAt",
    "staleAt",
    "policyVersion",
    "createdAt",
    "updatedAt"
)
SELECT
    "id",
    NULL,
    "reviewedAt",
    "reviewedAt",
    "reviewedAt",
    'legacy-unclassified.v1',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "JurisdictionClaim";

-- CreateIndex
CREATE INDEX "JurisdictionClaimFreshness_reviewDueAt_idx" ON "JurisdictionClaimFreshness"("reviewDueAt");

-- CreateIndex
CREATE INDEX "JurisdictionClaimFreshness_staleAt_idx" ON "JurisdictionClaimFreshness"("staleAt");

-- CreateIndex
CREATE INDEX "JurisdictionClaimReReview_claimId_reviewedAt_idx" ON "JurisdictionClaimReReview"("claimId", "reviewedAt");

-- CreateIndex
CREATE INDEX "JurisdictionClaimReReview_evidenceSnapshotId_idx" ON "JurisdictionClaimReReview"("evidenceSnapshotId");

-- CreateIndex
CREATE INDEX "JurisdictionClaimReReview_sourceUrlId_idx" ON "JurisdictionClaimReReview"("sourceUrlId");

-- AddForeignKey
ALTER TABLE "JurisdictionClaimFreshness" ADD CONSTRAINT "JurisdictionClaimFreshness_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "JurisdictionClaim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JurisdictionClaimFreshness" ADD CONSTRAINT "JurisdictionClaimFreshness_lastEvidenceSnapshotId_fkey" FOREIGN KEY ("lastEvidenceSnapshotId") REFERENCES "JurisdictionEvidenceSnapshot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JurisdictionClaimReReview" ADD CONSTRAINT "JurisdictionClaimReReview_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "JurisdictionClaim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JurisdictionClaimReReview" ADD CONSTRAINT "JurisdictionClaimReReview_evidenceSnapshotId_fkey" FOREIGN KEY ("evidenceSnapshotId") REFERENCES "JurisdictionEvidenceSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JurisdictionClaimReReview" ADD CONSTRAINT "JurisdictionClaimReReview_sourceUrlId_fkey" FOREIGN KEY ("sourceUrlId") REFERENCES "JurisdictionSourceUrl"("id") ON DELETE SET NULL ON UPDATE CASCADE;
