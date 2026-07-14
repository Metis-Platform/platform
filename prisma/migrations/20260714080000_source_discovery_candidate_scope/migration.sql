CREATE TYPE "JurisdictionSourceDiscoveryCandidateScope" AS ENUM ('DISCOVERY_ENTRYPOINT', 'COUNTY_OFFICE_CANDIDATE');

ALTER TABLE "JurisdictionSourceDiscoveryLead"
ADD COLUMN "candidateScope" "JurisdictionSourceDiscoveryCandidateScope" NOT NULL DEFAULT 'DISCOVERY_ENTRYPOINT';
