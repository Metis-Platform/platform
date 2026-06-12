import type { ChecklistTemplate } from '../types'

/**
 * Tax Lien DD checklist — pre-bid (LEAD) and post-purchase (ACTIVE) phases
 * merged into a single template. Items are designed to be generated once;
 * the generate-checklist button is idempotent so re-running after conversion
 * from LEAD → ACTIVE fills in the post-purchase items.
 *
 * ⚠️  CONTENT UNDER REVIEW — drafted for user approval, not yet merged to main.
 */
export const taxLienTemplate: ChecklistTemplate = {
  strategy: 'TAX_LIEN',
  label: 'Tax Lien Due Diligence',
  items: [
    // ── Pre-bid (LEAD) ─────────────────────────────────────────────────────
    {
      key: 'tl-verify-parcel',
      title: 'Verify parcel & assessed value',
      description:
        'Pull county assessor record. Confirm APN matches, check assessed value vs. tax amount owed. Flag any discrepancies before bidding.',
      taskType: 'CUSTOM',
      defaultPriority: 'HIGH',
      dueAnchor: 'auctionDate',
      dueOffsetDays: -14,
    },
    {
      key: 'tl-occupancy-check',
      title: 'Occupancy & structure check',
      description:
        'Drive-by or Google Street View. Note occupancy status (owner, tenant, vacant, abandoned), structure condition, and any visible hazards.',
      taskType: 'CUSTOM',
      defaultPriority: 'HIGH',
      dueAnchor: 'auctionDate',
      dueOffsetDays: -7,
    },
    {
      key: 'tl-env-senior-lien-scan',
      title: 'Environmental & senior-lien scan',
      description:
        'Check EPA/state brownfields registry for environmental flags. Search county recorder for senior liens (mortgages, federal tax liens, HOA liens) that survive redemption.',
      taskType: 'ORDER_TITLE_SEARCH',
      defaultPriority: 'HIGH',
      dueAnchor: 'auctionDate',
      dueOffsetDays: -7,
    },
    {
      key: 'tl-confirm-sale-terms',
      title: 'Confirm taxes owed & sale terms',
      description:
        'Verify exact amount owed from county collector. Confirm interest rate, penalty rate, and any bid-down-interest / premium rules for this jurisdiction.',
      taskType: 'CUSTOM',
      defaultPriority: 'MEDIUM',
      dueAnchor: 'auctionDate',
      dueOffsetDays: -3,
    },
    {
      key: 'tl-set-max-bid',
      title: 'Set max bid',
      description:
        'Calculate max bid based on property value, senior liens, holding costs, and target yield. Record in deal notes before auction.',
      taskType: 'CUSTOM',
      defaultPriority: 'URGENT',
      dueAnchor: 'auctionDate',
      dueOffsetDays: -1,
    },

    // ── Post-purchase (ACTIVE) ──────────────────────────────────────────────
    {
      key: 'tl-record-certificate',
      title: 'Record certificate with county',
      description:
        'File or confirm filing of the tax lien certificate with the county recorder. Retain recording receipt.',
      taskType: 'RECORD_DOCUMENT',
      defaultPriority: 'HIGH',
      dueAnchor: 'issueDate',
      dueOffsetDays: 30,
    },
    {
      key: 'tl-calendar-redemption',
      title: 'Confirm redemption deadline on calendar',
      description:
        'Verify the statutory redemption deadline (set by rules engine) is on your calendar with a 30-day-out reminder. Ensure Event is PENDING.',
      taskType: 'REVIEW_REDEMPTION',
      defaultPriority: 'HIGH',
      dueAnchor: 'issueDate',
      dueOffsetDays: 14,
    },
    {
      key: 'tl-title-search-decision',
      title: 'Title search decision point',
      description:
        'At ~75% of redemption period: decide if property is likely to not redeem. If so, order full title search now so you are ready to foreclose without delay.',
      taskType: 'ORDER_TITLE_SEARCH',
      defaultPriority: 'MEDIUM',
      dueAnchor: 'redemptionDeadline',
      dueOffsetDays: -90,
    },
  ],
}
