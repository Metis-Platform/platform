export interface GeoPoint {
  lat: number
  lon: number
}

export interface GeoJsonFeature {
  type: 'Feature'
  properties?: Record<string, unknown> | null
  geometry?: GeoJsonGeometry | null
}

export interface GeoJsonFeatureCollection {
  type: 'FeatureCollection'
  features: GeoJsonFeature[]
}

export type GeoJsonGeometry =
  | { type: 'Polygon'; coordinates: unknown[] }
  | { type: 'MultiPolygon'; coordinates: unknown[] }

export function isFeatureCollection(value: unknown): value is GeoJsonFeatureCollection {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) return false
  const record = value as Record<string, unknown>
  return record.type === 'FeatureCollection' && Array.isArray(record.features)
}

export function isPolygonGeometry(value: unknown): value is GeoJsonGeometry {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) return false
  const record = value as Record<string, unknown>
  return (record.type === 'Polygon' || record.type === 'MultiPolygon') && Array.isArray(record.coordinates)
}
