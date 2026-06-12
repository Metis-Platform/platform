import type { ChecklistTemplate } from '../types'

/**
 * Land investing DD checklist — static template for Phase 1.
 * Phase 3 (#131) will make this jurisdiction-aware.
 */
export const landTemplate: ChecklistTemplate = {
  strategy: 'LAND',
  label: 'Land Due Diligence',
  items: [
    {
      key: 'land-zoning-confirmed',
      title: 'Confirm zoning and permitted uses',
      description:
        'Pull county zoning map. Confirm current zone, setback requirements, and whether intended use (residential, agricultural, recreational) is permitted or requires variance.',
      taskType: 'CUSTOM',
      defaultPriority: 'HIGH',
      dueAnchor: 'optionExpiry',
      dueOffsetDays: -21,
    },
    {
      key: 'land-legal-access',
      title: 'Verify legal access to parcel',
      description:
        'Confirm recorded easement or road frontage. Landlocked parcels require a recorded access easement before purchase — verbal agreements are not sufficient.',
      taskType: 'CUSTOM',
      defaultPriority: 'HIGH',
      dueAnchor: 'optionExpiry',
      dueOffsetDays: -14,
    },
    {
      key: 'land-utilities-assessed',
      title: 'Assess utilities availability',
      description:
        'Determine: water (public, well, or none), sewer (public, septic-feasible, or none), electric (on parcel, nearby, or none), gas (if relevant). Note in deal utilities section.',
      taskType: 'CUSTOM',
      defaultPriority: 'MEDIUM',
      dueAnchor: 'optionExpiry',
      dueOffsetDays: -14,
    },
    {
      key: 'land-flood-wetlands',
      title: 'Flood zone and wetlands check',
      description:
        'Check FEMA flood map (msc.fema.gov) and NRCS Web Soil Survey for wetlands designation. High flood zone or significant wetlands materially limits buildability and buyer pool.',
      taskType: 'CUSTOM',
      defaultPriority: 'MEDIUM',
      dueAnchor: 'optionExpiry',
      dueOffsetDays: -14,
    },
    {
      key: 'land-back-taxes',
      title: 'Quantify back taxes owed',
      description:
        'Pull delinquent tax amount from county tax collector. Back taxes must be paid at closing or negotiated — know the total before finalizing your offer.',
      taskType: 'CUSTOM',
      defaultPriority: 'HIGH',
      dueAnchor: 'optionExpiry',
      dueOffsetDays: -7,
    },
    {
      key: 'land-hoa-poa',
      title: 'Confirm HOA / POA dues and restrictions',
      description:
        'If HOA or POA exists: confirm annual dues, transfer fees, and any deed restrictions that limit use or resale. Some rural POAs have restrictions buyers dislike.',
      taskType: 'CUSTOM',
      defaultPriority: 'MEDIUM',
      dueAnchor: 'optionExpiry',
      dueOffsetDays: -7,
    },
    {
      key: 'land-perc-test',
      title: 'Perc test (if septic required)',
      description:
        'If public sewer is unavailable and the parcel may need a septic system, schedule a percolation test. Failed perc = unbuildable for most residential buyers.',
      taskType: 'CUSTOM',
      defaultPriority: 'MEDIUM',
    },
    {
      key: 'land-title-review',
      title: 'Title review',
      description:
        'Order or review title search. Confirm chain of title, identify any liens, easements, or encumbrances. Ensure deed can be conveyed cleanly.',
      taskType: 'ORDER_TITLE_SEARCH',
      defaultPriority: 'HIGH',
      dueAnchor: 'optionExpiry',
      dueOffsetDays: -10,
    },
  ],
}
