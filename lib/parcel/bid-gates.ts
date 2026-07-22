import type { ParcelProfile } from '@/lib/exit-engine/types'

export type BidGateStatus = 'REVIEW_REQUIRED' | 'FLAGGED'

export interface BidGate {
  key: 'ZONING_BUILD' | 'FLOOD_WETLANDS' | 'ACCESS_UTILITIES' | 'HOA_POA' | 'TITLE_TAX_DEED' | 'ECONOMICS'
  label: string
  status: BidGateStatus
  evidence: string
  nextStep: string
}

export function buildBidGates(
  parcel: ParcelProfile,
  landUseAuthorityStatus: 'VERIFIED' | 'UNRESOLVED',
): BidGate[] {
  const floodFlagged = ['AE', 'VE'].includes(parcel.floodZone ?? '') && parcel.wetlandsPresent === true
  const dimensions = parcel.frontageLinearFt != null && parcel.lotDepthFt != null

  return [
    {
      key: 'ZONING_BUILD',
      label: 'Zoning and buildability',
      status: landUseAuthorityStatus === 'VERIFIED' ? 'REVIEW_REQUIRED' : 'REVIEW_REQUIRED',
      evidence: parcel.zoning
        ? `Zoning shown as ${parcel.zoning}${parcel.zoningDescription ? ` — ${parcel.zoningDescription}` : ''}.`
        : 'No zoning code was returned.',
      nextStep: landUseAuthorityStatus === 'VERIFIED'
        ? 'Confirm permitted dwelling use, density, setbacks, overlays, and permits for the proposed home.'
        : 'Verify the governing planning/zoning authority, then confirm permitted dwelling use, density, setbacks, overlays, and permits.',
    },
    {
      key: 'FLOOD_WETLANDS',
      label: 'Flood and wetlands',
      status: floodFlagged ? 'FLAGGED' : 'REVIEW_REQUIRED',
      evidence: parcel.floodZone
        ? `FEMA returned flood zone ${parcel.floodZone} at the research point${parcel.wetlandsNwiStatus ? `; NWI ${parcel.wetlandsNwiStatus === 'MAPPED_FEATURE' ? 'mapped a feature' : 'returned no mapped feature'}` : ''}.`
        : 'No FEMA flood-zone result was returned.',
      nextStep: 'Review the full parcel against FEMA and wetlands layers; obtain elevation, drainage, and environmental/permit determinations before relying on a build plan.',
    },
    {
      key: 'ACCESS_UTILITIES',
      label: 'Access and utilities',
      status: parcel.roadFrontage === 'landlocked' ? 'FLAGGED' : 'REVIEW_REQUIRED',
      evidence: dimensions
        ? `Assessor dimensions show ${parcel.frontageLinearFt} ft frontage by ${parcel.lotDepthFt} ft depth.`
        : 'Parcel dimensions are incomplete.',
      nextStep: 'Confirm recorded legal access, road maintenance, water, sewer or septic feasibility, electric service, and all connection/impact costs.',
    },
    {
      key: 'HOA_POA',
      label: 'HOA / POA restrictions',
      status: parcel.hoa?.present ? 'FLAGGED' : 'REVIEW_REQUIRED',
      evidence: parcel.hoa?.present ? 'An HOA/POA is recorded in the parcel profile.' : 'No recorded declaration or estoppel review has been provided.',
      nextStep: 'Search recorded declarations, plats, amendments, estoppel requirements, and transfer/arrearage obligations.',
    },
    {
      key: 'TITLE_TAX_DEED',
      label: 'Title and tax-deed risk',
      status: parcel.bankruptcyStay || parcel.irsLienPresent ? 'FLAGGED' : 'REVIEW_REQUIRED',
      evidence: parcel.bankruptcyStay ? 'A bankruptcy stay is recorded.' : parcel.irsLienPresent ? 'An IRS lien is recorded.' : 'No title commitment, clerk case review, or lien-survival determination is present.',
      nextStep: 'Review the tax-deed case, title commitment, recorded instruments, redemption/survival rules, and quiet-title path with qualified counsel/title professionals.',
    },
    {
      key: 'ECONOMICS',
      label: 'Economics and comparable sales',
      status: parcel.comps?.length ? 'REVIEW_REQUIRED' : 'REVIEW_REQUIRED',
      evidence: parcel.comps?.length
        ? `${parcel.comps.length} parcel comps are attached.`
        : 'No raw-land or completed-home comparable dataset is attached to this research record.',
      nextStep: 'Separate raw-land value from finished-home sales, then model entitlement, site, construction, carrying, and resale costs before setting a bid ceiling.',
    },
  ]
}
