import type { EvalContext, JurisdictionFacts, ParcelProfile } from '@/lib/exit-engine/types'

// Test-only fixture assembled from the official sources recorded in the
// 2026-07-13 platform assessment. It intentionally models the unresolved
// nonconforming-lot determination as a condition, not an unbuildable verdict.
export const VOLUSIA_2340282_EVIDENCE = {
  propertyAppraiser: 'https://vcpa.vcgov.org/parcel/summary/?altkey=2340282',
  zoningLayer: 'https://www.volusia.org/core/fileparse.php/6001/urlt/Zoning-Dimensional-Requirements.pdf',
  nonconformingLotGuide: 'https://www.volusia.org/core/fileparse.php/4754/urlt/Nonconforming-Lot-Letter.pdf',
} as const

const retrievedAt = new Date('2026-07-13T00:00:00.000Z')

export const VOLUSIA_2340282_PARCEL: ParcelProfile = {
  apn: '2340282',
  apnRaw: '2340282',
  fipsCounty: '12127',
  state: 'FL',
  county: 'Volusia',
  lotSizeSqFt: 5_000,
  frontageLinearFt: 50,
  lotDepthFt: 100,
  improved: false,
  zoning: 'R-4',
  dataCompleteness: 0.75,
  lastUpdated: retrievedAt,
  sources: {
    lotSizeSqFt: { provider: 'volusia_property_appraiser', retrievedAt, ttlHours: 0 },
    frontageLinearFt: { provider: 'volusia_property_appraiser', retrievedAt, ttlHours: 0 },
    lotDepthFt: { provider: 'volusia_property_appraiser', retrievedAt, ttlHours: 0 },
    zoning: { provider: 'volusia_arcgis', retrievedAt, ttlHours: 0 },
  },
}

export const VOLUSIA_R4_STANDARD_FACTS: JurisdictionFacts = {
  minLotSizeSqFt: zoning => zoning === 'R-4' ? 7_500 : undefined,
  minLotWidthFt: zoning => zoning === 'R-4' ? 75 : undefined,
  setbackFeet: zoning => zoning === 'R-4' ? { front: 25, side: 8, rear: 20 } : undefined,
  fmr: () => undefined,
}

export const VOLUSIA_2340282_CONTEXT: EvalContext = {
  parcel: VOLUSIA_2340282_PARCEL,
  jurisdiction: VOLUSIA_R4_STANDARD_FACTS,
  investor: { financing: 'CASH', improvementCapital: 300_000 },
  strategy: 'LAND',
}
