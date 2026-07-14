CREATE TYPE "JurisdictionSourceAuthorityStatus" AS ENUM ('UNVERIFIED', 'VERIFIED', 'REJECTED');
CREATE TYPE "JurisdictionClaimVerificationState" AS ENUM ('REVIEWED', 'VERIFIED', 'STALE', 'BLOCKED', 'SUPERSEDED');

ALTER TABLE "JurisdictionSourceUrl"
  ADD COLUMN "authorityClass" TEXT,
  ADD COLUMN "authorityOwner" TEXT,
  ADD COLUMN "authorityStatus" "JurisdictionSourceAuthorityStatus" NOT NULL DEFAULT 'UNVERIFIED',
  ADD COLUMN "authorityVerifiedAt" TIMESTAMP(3),
  ADD COLUMN "authorityVerifiedBy" TEXT;

ALTER TABLE "JurisdictionSourceUrl"
  ADD CONSTRAINT "JurisdictionSourceUrl_verified_authority_check"
  CHECK (
    "authorityStatus" <> 'VERIFIED'
    OR (
      "authorityClass" IS NOT NULL
      AND "authorityOwner" IS NOT NULL
      AND "authorityVerifiedAt" IS NOT NULL
      AND "authorityVerifiedBy" IS NOT NULL
    )
  );

CREATE TABLE "JurisdictionClaim" (
  "id" TEXT NOT NULL,
  "jurisdictionId" TEXT NOT NULL,
  "questionId" TEXT NOT NULL,
  "questionSchemaVersion" TEXT NOT NULL,
  "section" TEXT NOT NULL,
  "fieldKey" TEXT NOT NULL,
  "value" JSONB NOT NULL,
  "normalizedUnit" TEXT,
  "expectedAuthorityClass" TEXT NOT NULL,
  "sourceAuthorityClass" TEXT,
  "sourceAuthorityOwner" TEXT,
  "sourceAuthorityStatus" "JurisdictionSourceAuthorityStatus" NOT NULL DEFAULT 'UNVERIFIED',
  "sourceAuthorityVerifiedAt" TIMESTAMP(3),
  "sourceAuthorityVerifiedBy" TEXT,
  "verificationState" "JurisdictionClaimVerificationState" NOT NULL DEFAULT 'REVIEWED',
  "geographicScope" TEXT,
  "effectiveAt" TIMESTAMP(3),
  "reviewedAt" TIMESTAMP(3) NOT NULL,
  "reviewedBy" TEXT NOT NULL,
  "supersedesClaimId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "JurisdictionClaim_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "JurisdictionClaimEvidence" (
  "id" TEXT NOT NULL,
  "claimId" TEXT NOT NULL,
  "sourceUrlId" TEXT,
  "candidateId" TEXT,
  "sourceUrl" TEXT NOT NULL,
  "sourceSnippet" TEXT NOT NULL,
  "retrievedAt" TIMESTAMP(3) NOT NULL,
  "contentHash" TEXT,
  "modelUsed" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "JurisdictionClaimEvidence_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "JurisdictionClaim_supersedesClaimId_key" ON "JurisdictionClaim"("supersedesClaimId");
CREATE INDEX "JurisdictionClaim_jurisdictionId_questionId_createdAt_idx" ON "JurisdictionClaim"("jurisdictionId", "questionId", "createdAt");
CREATE INDEX "JurisdictionClaim_jurisdictionId_section_fieldKey_createdAt_idx" ON "JurisdictionClaim"("jurisdictionId", "section", "fieldKey", "createdAt");
CREATE INDEX "JurisdictionClaim_verificationState_idx" ON "JurisdictionClaim"("verificationState");
CREATE INDEX "JurisdictionClaimEvidence_claimId_idx" ON "JurisdictionClaimEvidence"("claimId");
CREATE INDEX "JurisdictionClaimEvidence_sourceUrlId_idx" ON "JurisdictionClaimEvidence"("sourceUrlId");
CREATE INDEX "JurisdictionClaimEvidence_candidateId_idx" ON "JurisdictionClaimEvidence"("candidateId");

ALTER TABLE "JurisdictionClaim"
  ADD CONSTRAINT "JurisdictionClaim_jurisdictionId_fkey"
  FOREIGN KEY ("jurisdictionId") REFERENCES "Jurisdiction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "JurisdictionClaim"
  ADD CONSTRAINT "JurisdictionClaim_supersedesClaimId_fkey"
  FOREIGN KEY ("supersedesClaimId") REFERENCES "JurisdictionClaim"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "JurisdictionClaimEvidence"
  ADD CONSTRAINT "JurisdictionClaimEvidence_claimId_fkey"
  FOREIGN KEY ("claimId") REFERENCES "JurisdictionClaim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "JurisdictionClaimEvidence"
  ADD CONSTRAINT "JurisdictionClaimEvidence_sourceUrlId_fkey"
  FOREIGN KEY ("sourceUrlId") REFERENCES "JurisdictionSourceUrl"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "JurisdictionClaimEvidence"
  ADD CONSTRAINT "JurisdictionClaimEvidence_candidateId_fkey"
  FOREIGN KEY ("candidateId") REFERENCES "ExtractionCandidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
