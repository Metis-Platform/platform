import type { ChecklistTemplate } from '../types'

/**
 * Tax Deed DD checklist — pre-bid (LEAD) and post-purchase (ACTIVE)
 *
 * ⚠️  CONTENT UNDER REVIEW — drafted for user approval, not yet merged to main.
 */
export const taxDeedTemplate: ChecklistTemplate = {
  strategy: 'TAX_DEED',
  label: 'Tax Deed Due Diligence',
  items: [
    // ── Pre-bid ────────────────────────────────────────────────────────────
    {
      key: 'td-verify-parcel',
      title: 'Verify parcel & assessed value',
      description:
        'Pull county assessor record. Confirm APN, zoning, and assessed value. Note any exemptions or special-use flags.',
      taskType: 'CUSTOM',
      defaultPriority: 'HIGH',
      dueAnchor: 'auctionDate',
      dueOffsetDays: -14,
    },
    {
      key: 'td-title-quality-review',
      title: 'Title quality / cloud review',
      description:
        'Search county recorder for encumbrances (mortgages, HOA, federal tax liens, easements). Tax deed sales extinguish most but NOT federal tax liens — flag any.',
      taskType: 'ORDER_TITLE_SEARCH',
      defaultPriority: 'HIGH',
      dueAnchor: 'auctionDate',
      dueOffsetDays: -10,
    },
    {
      key: 'td-quiet-title-decision',
      title: 'Quiet title action assessment',
      description:
        'Evaluate whether a quiet title suit will be needed to make the title insurable. Note attorney cost estimate and timeline in deal notes.',
      taskType: 'CUSTOM',
      defaultPriority: 'HIGH',
      dueAnchor: 'auctionDate',
      dueOffsetDays: -7,
    },
    {
      key: 'td-occupancy-eviction',
      title: 'Occupancy & eviction assessment',
      description:
        'Drive-by: determine if occupied. If occupied, note occupant type (owner, tenant). Estimate eviction cost/timeline for your state.',
      taskType: 'CUSTOM',
      defaultPriority: 'MEDIUM',
      dueAnchor: 'auctionDate',
      dueOffsetDays: -7,
    },
    {
      key: 'td-set-max-bid',
      title: 'Set max bid',
      description:
        'Calculate max bid: ARV minus rehab, eviction costs, quiet-title costs, carrying costs, and target return. Record before auction.',
      taskType: 'CUSTOM',
      defaultPriority: 'URGENT',
      dueAnchor: 'auctionDate',
      dueOffsetDays: -1,
    },

    // ── Post-purchase ──────────────────────────────────────────────────────
    {
      key: 'td-insurance-binder',
      title: 'Secure insurance binder',
      description:
        'Obtain vacant-property or builder-risk insurance binder immediately. Tax deed properties are uninsured at purchase — exposure starts day one.',
      taskType: 'CUSTOM',
      defaultPriority: 'URGENT',
      dueAnchor: 'saleDate',
      dueOffsetDays: 3,
    },
    {
      key: 'td-record-deed',
      title: 'Confirm deed recorded',
      description:
        "Verify the county has issued and recorded the tax deed in your name. Retain certified copy. This is the chain-of-title's starting point.",
      taskType: 'RECORD_DOCUMENT',
      defaultPriority: 'HIGH',
      dueAnchor: 'saleDate',
      dueOffsetDays: 14,
    },
  ],
}
