CREATE TYPE "JurisdictionCanonicalAcceptanceResult" AS ENUM ('PASSED', 'FAILED');

CREATE TABLE "JurisdictionCanonicalAcceptance" (
  "id" TEXT NOT NULL,
  "jurisdictionId" TEXT NOT NULL,
  "contractVersion" TEXT NOT NULL,
  "caseReference" TEXT NOT NULL,
  "evidenceUrl" TEXT NOT NULL,
  "result" "JurisdictionCanonicalAcceptanceResult" NOT NULL,
  "summary" TEXT NOT NULL,
  "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedBy" TEXT NOT NULL,
  "supersedesAcceptanceId" TEXT,

  CONSTRAINT "JurisdictionCanonicalAcceptance_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "JurisdictionCanonicalAcceptance_supersedesAcceptanceId_key"
  ON "JurisdictionCanonicalAcceptance"("supersedesAcceptanceId");
CREATE INDEX "JurisdictionCanonicalAcceptance_jurisdictionId_reviewedAt_idx"
  ON "JurisdictionCanonicalAcceptance"("jurisdictionId", "reviewedAt");

ALTER TABLE "JurisdictionCanonicalAcceptance"
  ADD CONSTRAINT "JurisdictionCanonicalAcceptance_jurisdictionId_fkey"
  FOREIGN KEY ("jurisdictionId") REFERENCES "Jurisdiction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JurisdictionCanonicalAcceptance"
  ADD CONSTRAINT "JurisdictionCanonicalAcceptance_supersedesAcceptanceId_fkey"
  FOREIGN KEY ("supersedesAcceptanceId") REFERENCES "JurisdictionCanonicalAcceptance"("id") ON DELETE SET NULL ON UPDATE CASCADE;
