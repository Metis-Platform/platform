import type { ParcelProfile } from '@/lib/exit-engine/types'
import { LandAccess } from '@/app/generated/prisma'

export interface LandSyncCurrent {
  zoning: string | null
  floodZone: string | null
  access: LandAccess | null
  wetlandsPercent: number | null
}

export interface LandSyncUpdate {
  zoning?: string
  floodZone?: string
  access?: LandAccess
  wetlandsPercent?: number
}

/** Fills DealLand fields from research data — never overwrites a value the investor already entered. */
export function deriveLandSyncFields(
  profile: ParcelProfile,
  current: LandSyncCurrent,
  acres: number | null,
): LandSyncUpdate {
  const update: LandSyncUpdate = {}

  if (!current.zoning && profile.zoning) update.zoning = profile.zoning
  if (!current.floodZone && profile.floodZone) update.floodZone = profile.floodZone

  if (!current.access) {
    const access = mapRoadFrontageToAccess(profile.roadFrontage)
    if (access) update.access = access
  }

  if (current.wetlandsPercent == null && profile.wetlandsAcres != null && acres != null && acres > 0) {
    update.wetlandsPercent = Math.min(100, Math.max(0, (profile.wetlandsAcres / acres) * 100))
  }

  return update
}

function mapRoadFrontageToAccess(roadFrontage: ParcelProfile['roadFrontage']): LandAccess | undefined {
  switch (roadFrontage) {
    case 'paved':
    case 'unpaved':
      return LandAccess.ROAD
    case 'easement_only':
      return LandAccess.EASEMENT
    case 'landlocked':
      return LandAccess.LANDLOCKED
    default:
      return undefined
  }
}
