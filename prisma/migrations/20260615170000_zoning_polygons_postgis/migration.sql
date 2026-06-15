-- Enable PostGIS for parcel and zoning spatial joins.
CREATE EXTENSION IF NOT EXISTS postgis;

-- Raw zoning polygon storage. Accessed through raw SQL because Prisma does not
-- model PostGIS geometry columns.
CREATE TABLE IF NOT EXISTS zoning_polygons (
  id          BIGSERIAL PRIMARY KEY,
  fips_county TEXT NOT NULL,
  zone_code   TEXT NOT NULL,
  zone_name   TEXT,
  geom        GEOMETRY(MultiPolygon, 4326) NOT NULL,
  ingested_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS zoning_polygons_fips_idx ON zoning_polygons (fips_county);
CREATE INDEX IF NOT EXISTS zoning_polygons_geom_idx ON zoning_polygons USING GIST (geom);
