import type { ParcelProfile } from '@/lib/exit-engine/types'

export type ParcelSourceName =
  | 'fl_dor'
  | 'volusia_property_appraiser'
  | 'regrid'
  | 'fema_nfhl'
  | 'fws_nwi'
  | 'usda_ssurgo'
  | 'usgs_3dep'
  | 'usgs_3dhp'
  | 'epa_echo'
  | 'census_acs'
  | 'walk_score'
  | 'hifld'
  | 'postgis_zoning'

export interface ParcelSourcePayload {
  source: ParcelSourceName
  ttlHours: number
  profile: Partial<ParcelProfile>
  raw: Record<string, unknown>
  metadata?: Record<string, unknown>
}

export const SOURCE_TTL_HOURS: Record<ParcelSourceName, number> = {
  fl_dor: 24 * 180,
  volusia_property_appraiser: 24 * 180,
  regrid: 24 * 180,
  fema_nfhl: 24 * 365,
  fws_nwi: 24 * 365,
  usda_ssurgo: 24 * 365,
  usgs_3dep: 24 * 365,
  usgs_3dhp: 24 * 365,
  epa_echo: 24 * 90,
  census_acs: 24 * 365,
  walk_score: 24 * 90,
  hifld: 24 * 365,
  postgis_zoning: 24 * 365,
}

export async function fetchJson(
  url: string,
  init?: RequestInit,
  fetchImpl: typeof fetch = fetch,
): Promise<unknown> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10_000)

  try {
    const response = await fetchImpl(url, { ...init, signal: controller.signal })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return response.json()
  } finally {
    clearTimeout(timeout)
  }
}

export function numberFromUnknown(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value !== 'string' || value.trim() === '') return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

export function booleanFromUnknown(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value
  if (typeof value !== 'string') return undefined
  const normalized = value.trim().toLowerCase()
  if (['true', 'yes', 'y', '1'].includes(normalized)) return true
  if (['false', 'no', 'n', '0'].includes(normalized)) return false
  return undefined
}

export function objectRecord(value: unknown): Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}
