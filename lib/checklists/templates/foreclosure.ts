import type { ChecklistTemplate } from '../types'

/**
 * Foreclosure auction checklist — pre-bid (LEAD) workflow around statutory deadlines.
 * The statutory deadlines themselves (NOD, publication, auction) are in the rules engine;
 * this checklist covers the diligence and operational tasks around them.
 *
 * ⚠️  CONTENT UNDER REVIEW — drafted for user approval, not yet merged to main.
 */
export const foreclosureTemplate: ChecklistTemplate = {
  strategy: 'FORECLOSURE',
  label: 'Foreclosure Auction Due Diligence',
  items: [
    {
      key: 'fc-attorney-engaged',
      title: 'Attorney engaged',
      description:
        'Confirm foreclosure attorney retained (or confirm you are self-represented where allowed). Get fee estimate and timeline. Attorney handles statutory notice requirements.',
      taskType: 'CUSTOM',
      defaultPriority: 'URGENT',
      dueAnchor: 'auctionDate',
      dueOffsetDays: -60,
    },
    {
      key: 'fc-verify-parcel',
      title: 'Verify parcel, liens & title position',
      description:
        'Full title search: confirm lien position, outstanding senior liens (tax liens, HOA, federal), legal description. Senior liens survive foreclosure.',
      taskType: 'ORDER_TITLE_SEARCH',
      defaultPriority: 'HIGH',
      dueAnchor: 'auctionDate',
      dueOffsetDays: -30,
    },
    {
      key: 'fc-notice-prerequisites',
      title: 'Confirm notice prerequisites gathered',
      description:
        'With attorney: confirm all required statutory notices have been or will be served (borrower, junior lienholders, IRS if applicable). Retain proof of service.',
      taskType: 'SEND_NOTICE',
      defaultPriority: 'HIGH',
      dueAnchor: 'auctionDate',
      dueOffsetDays: -21,
    },
    {
      key: 'fc-publication-evidence',
      title: 'Publication evidence filed',
      description:
        'Obtain and file publisher affidavit or proof of legal notice publication as required by state law. Defective publication can void the sale.',
      taskType: 'FILE_SUIT',
      defaultPriority: 'HIGH',
      dueAnchor: 'auctionDate',
      dueOffsetDays: -7,
    },
    {
      key: 'fc-occupancy-check',
      title: 'Occupancy & condition check',
      description:
        'Drive-by before auction: occupancy status, visible condition, access points. Estimate eviction and rehab costs for your max-bid calc.',
      taskType: 'CUSTOM',
      defaultPriority: 'MEDIUM',
      dueAnchor: 'auctionDate',
      dueOffsetDays: -7,
    },
    {
      key: 'fc-set-max-bid',
      title: 'Set max bid',
      description:
        'Calculate opening bid, estimate competition, set walk-away max. Account for senior liens, eviction, title cure, carrying costs, and target return.',
      taskType: 'CUSTOM',
      defaultPriority: 'URGENT',
      dueAnchor: 'auctionDate',
      dueOffsetDays: -1,
    },
  ],
}
