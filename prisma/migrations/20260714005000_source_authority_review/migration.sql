ALTER TABLE "JurisdictionSourceUrl"
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "JurisdictionSourceUrl"
  ALTER COLUMN "updatedAt" DROP DEFAULT;

CREATE TABLE "JurisdictionSourceAuthorityReview" (
  "id" TEXT NOT NULL,
  "jurisdictionId" TEXT NOT NULL,
  "sourceUrlId" TEXT,
  "sourceUrl" TEXT NOT NULL,
  "officeType" TEXT NOT NULL,
  "sourceContentHash" TEXT,
  "sourceUpdatedAt" TIMESTAMP(3) NOT NULL,
  "decision" "JurisdictionSourceAuthorityStatus" NOT NULL,
  "authorityClass" TEXT,
  "authorityOwner" TEXT,
  "evidenceUrl" TEXT,
  "explanation" TEXT NOT NULL,
  "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedBy" TEXT NOT NULL,

  CONSTRAINT "JurisdictionSourceAuthorityReview_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "JurisdictionSourceAuthorityReview_verified_evidence_check" CHECK (
    "decision" <> 'VERIFIED'
    OR (
      "authorityClass" IS NOT NULL
      AND "authorityOwner" IS NOT NULL
      AND "evidenceUrl" IS NOT NULL
    )
  )
);

CREATE INDEX "JurisdictionSourceAuthorityReview_jurisdictionId_reviewedAt_idx"
  ON "JurisdictionSourceAuthorityReview"("jurisdictionId", "reviewedAt");
CREATE INDEX "JurisdictionSourceAuthorityReview_sourceUrlId_reviewedAt_idx"
  ON "JurisdictionSourceAuthorityReview"("sourceUrlId", "reviewedAt");
CREATE INDEX "JurisdictionSourceAuthorityReview_decision_reviewedAt_idx"
  ON "JurisdictionSourceAuthorityReview"("decision", "reviewedAt");

ALTER TABLE "JurisdictionSourceAuthorityReview"
  ADD CONSTRAINT "JurisdictionSourceAuthorityReview_jurisdictionId_fkey"
  FOREIGN KEY ("jurisdictionId") REFERENCES "Jurisdiction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "JurisdictionSourceAuthorityReview"
  ADD CONSTRAINT "JurisdictionSourceAuthorityReview_sourceUrlId_fkey"
  FOREIGN KEY ("sourceUrlId") REFERENCES "JurisdictionSourceUrl"("id") ON DELETE SET NULL ON UPDATE CASCADE;
