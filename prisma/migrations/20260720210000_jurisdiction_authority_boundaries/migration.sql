-- Reviewed authority scope is stored in the claim ledger; this append-only
-- spatial evidence binds an unincorporated-county declaration to a parcel point.
CREATE TABLE jurisdiction_authority_boundaries (
  id               TEXT PRIMARY KEY,
  jurisdiction_id  TEXT NOT NULL REFERENCES "Jurisdiction"(id) ON DELETE CASCADE,
  claim_id         TEXT NOT NULL REFERENCES "JurisdictionClaim"(id) ON DELETE CASCADE,
  scope            TEXT NOT NULL CHECK (scope = 'UNINCORPORATED_COUNTY'),
  geom             GEOMETRY(MultiPolygon, 4326) NOT NULL,
  created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
  created_by       TEXT NOT NULL,
  supersedes_boundary_id TEXT UNIQUE REFERENCES jurisdiction_authority_boundaries(id) ON DELETE SET NULL,
  superseded_by_id       TEXT UNIQUE REFERENCES jurisdiction_authority_boundaries(id) ON DELETE SET NULL
);

CREATE INDEX jurisdiction_authority_boundaries_current_claim_idx
  ON jurisdiction_authority_boundaries (jurisdiction_id, claim_id)
  WHERE superseded_by_id IS NULL;
CREATE INDEX jurisdiction_authority_boundaries_geom_idx
  ON jurisdiction_authority_boundaries USING GIST (geom)
  WHERE superseded_by_id IS NULL;
