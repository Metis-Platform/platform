export type FieldDef = {
  key: string
  label: string
  type: 'text' | 'number' | 'boolean' | 'textarea'
  placeholder?: string
}

export const STRATEGY_FIELDS: Record<string, FieldDef[]> = {
  TAX_DEED: [
    { key: 'redemptionDays', label: 'Redemption period (days)', type: 'number' },
    { key: 'publicationCount', label: 'Notice publications required', type: 'number' },
    { key: 'publicationIntervalDays', label: 'Publication interval (days)', type: 'number' },
    { key: 'overbidToInvestor', label: 'Investor gets overbid funds', type: 'boolean' },
    { key: 'deedRecordingDays', label: 'Deed recording timeline (days)', type: 'number' },
  ],
  FORECLOSURE: [
    { key: 'processType', label: 'Process type (judicial/non-judicial)', type: 'text', placeholder: 'judicial' },
    { key: 'timelineDays', label: 'Statutory timeline default to sale (days)', type: 'number' },
    { key: 'noticeOfDefaultDays', label: 'Notice of default before publication (days)', type: 'number' },
    { key: 'postSaleRedemptionDays', label: 'Right of redemption after sale (days, 0 if none)', type: 'number' },
  ],
  WHOLESALE: [
    { key: 'assignmentDisclosureRequired', label: 'Assignment disclosure required', type: 'boolean' },
    { key: 'doubleClosingAllowed', label: 'Double-closing allowed', type: 'boolean' },
    { key: 'daysToCloseNorm', label: 'Days-to-close norm (informational)', type: 'number' },
    { key: 'earnestMoneyPct', label: 'Earnest money norm (% of contract)', type: 'number', placeholder: '1' },
  ],
  BUY_HOLD: [
    { key: 'rentControlZone', label: 'Rent control zone', type: 'boolean' },
    { key: 'justCauseEviction', label: 'Just-cause eviction required', type: 'boolean' },
    { key: 'evictionNoticeDays', label: 'Eviction notice period (days)', type: 'number' },
    { key: 'section8Available', label: 'Active PHA / Section 8 vouchers available', type: 'boolean' },
  ],
  LAND: [
    { key: 'commonZoning', label: 'Common zoning classifications', type: 'text', placeholder: 'A-1, R-1, C-2' },
    { key: 'wetlandsBody', label: 'Wetlands regulation body', type: 'text', placeholder: 'Army Corps + State DEP' },
    { key: 'optionRecordingRequired', label: 'Option agreement recording required', type: 'boolean' },
  ],
  MULTIFAMILY: [
    { key: 'localRentOrdinance', label: 'Local rent ordinance active', type: 'boolean' },
    { key: 'aduByRight', label: 'ADU allowed by right', type: 'boolean' },
    { key: 'capRateMin', label: 'Cap rate reference range — min (%)', type: 'number', placeholder: '5' },
    { key: 'capRateMax', label: 'Cap rate reference range — max (%)', type: 'number', placeholder: '8' },
  ],
}

export const STRATEGY_LABELS: Record<string, string> = {
  TAX_DEED: 'Tax Deed',
  FORECLOSURE: 'Foreclosure',
  WHOLESALE: 'Wholesale',
  BUY_HOLD: 'Buy & Hold',
  LAND: 'Land',
  MULTIFAMILY: 'Multifamily',
}
