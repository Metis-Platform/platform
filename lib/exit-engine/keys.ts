export type ExitKey =
  | 'LIEN_EARN_INTEREST'
  | 'LIEN_FORECLOSE_TO_DEED'
  | 'LIEN_ASSIGN_CERTIFICATE'
  | 'VACANT_SELL_AS_IS'
  | 'VACANT_SELL_TO_BUILDER'
  | 'VACANT_BUILD_AND_SELL'
  | 'VACANT_SUBDIVIDE_AND_SELL'
  | 'VACANT_HOLD'
  | 'VACANT_WHOLESALE'
  | 'VACANT_DONATE'
  | 'IMPROVED_SELL_AS_IS'
  | 'IMPROVED_FLIP'
  | 'IMPROVED_BUY_AND_HOLD'
  | 'IMPROVED_WHOLESALE'
  | 'LAND_SELLER_FINANCE'
  | 'LAND_TIMBER_AG'
  | 'LAND_CONSERVATION_DONATION'
  | 'WHOLESALE_ASSIGN'
  | 'WHOLESALE_DOUBLE_CLOSE'
  | 'FLIP_RENOVATE_AND_SELL'
  | 'FLIP_PIVOT_TO_RENT'
  | 'FLIP_SELL_MID_RENO'
  | 'BH_LTR'
  | 'BH_STR'
  | 'BH_SECTION8'
  | 'BH_SELL_TO_INVESTOR'
  | 'MF_HOLD_CASHFLOW'
  | 'MF_VALUE_ADD'
  | 'MF_CONDO_CONVERSION'
  | 'MF_SELL_TO_INVESTOR'

export interface ExitMeta {
  key: ExitKey
  label: string
  family: 'LIEN' | 'VACANT' | 'IMPROVED' | 'LAND' | 'WHOLESALE' | 'FLIP' | 'BH' | 'MF'
  requiresImproved: boolean
  requiresUnimproved: boolean
  capitalIntensive: boolean
}

function meta(
  key: ExitKey,
  label: string,
  family: ExitMeta['family'],
  flags: Pick<ExitMeta, 'requiresImproved' | 'requiresUnimproved' | 'capitalIntensive'>
): ExitMeta {
  return { key, label, family, ...flags }
}

const LIEN = { requiresImproved: false, requiresUnimproved: false, capitalIntensive: false }
const VACANT = { requiresImproved: false, requiresUnimproved: true, capitalIntensive: false }
const IMPROVED = { requiresImproved: true, requiresUnimproved: false, capitalIntensive: false }

export const EXIT_META: Record<ExitKey, ExitMeta> = {
  LIEN_EARN_INTEREST: meta('LIEN_EARN_INTEREST', 'Earn lien interest', 'LIEN', LIEN),
  LIEN_FORECLOSE_TO_DEED: meta('LIEN_FORECLOSE_TO_DEED', 'Foreclose to deed', 'LIEN', {
    ...LIEN,
    capitalIntensive: true,
  }),
  LIEN_ASSIGN_CERTIFICATE: meta('LIEN_ASSIGN_CERTIFICATE', 'Assign certificate', 'LIEN', LIEN),
  VACANT_SELL_AS_IS: meta('VACANT_SELL_AS_IS', 'Sell vacant parcel as-is', 'VACANT', VACANT),
  VACANT_SELL_TO_BUILDER: meta('VACANT_SELL_TO_BUILDER', 'Sell to builder', 'VACANT', VACANT),
  VACANT_BUILD_AND_SELL: meta('VACANT_BUILD_AND_SELL', 'Build and sell', 'VACANT', {
    ...VACANT,
    capitalIntensive: true,
  }),
  VACANT_SUBDIVIDE_AND_SELL: meta('VACANT_SUBDIVIDE_AND_SELL', 'Subdivide and sell', 'VACANT', {
    ...VACANT,
    capitalIntensive: true,
  }),
  VACANT_HOLD: meta('VACANT_HOLD', 'Hold vacant parcel', 'VACANT', VACANT),
  VACANT_WHOLESALE: meta('VACANT_WHOLESALE', 'Wholesale vacant parcel', 'VACANT', VACANT),
  VACANT_DONATE: meta('VACANT_DONATE', 'Donate vacant parcel', 'VACANT', VACANT),
  IMPROVED_SELL_AS_IS: meta('IMPROVED_SELL_AS_IS', 'Sell improved parcel as-is', 'IMPROVED', IMPROVED),
  IMPROVED_FLIP: meta('IMPROVED_FLIP', 'Improve and flip', 'IMPROVED', {
    ...IMPROVED,
    capitalIntensive: true,
  }),
  IMPROVED_BUY_AND_HOLD: meta('IMPROVED_BUY_AND_HOLD', 'Buy and hold', 'IMPROVED', IMPROVED),
  IMPROVED_WHOLESALE: meta('IMPROVED_WHOLESALE', 'Wholesale improved parcel', 'IMPROVED', IMPROVED),
  LAND_SELLER_FINANCE: meta('LAND_SELLER_FINANCE', 'Seller finance land', 'LAND', VACANT),
  LAND_TIMBER_AG: meta('LAND_TIMBER_AG', 'Timber or agricultural use', 'LAND', VACANT),
  LAND_CONSERVATION_DONATION: meta('LAND_CONSERVATION_DONATION', 'Conservation donation', 'LAND', VACANT),
  WHOLESALE_ASSIGN: meta('WHOLESALE_ASSIGN', 'Assign wholesale contract', 'WHOLESALE', {
    requiresImproved: false,
    requiresUnimproved: false,
    capitalIntensive: false,
  }),
  WHOLESALE_DOUBLE_CLOSE: meta('WHOLESALE_DOUBLE_CLOSE', 'Double close wholesale deal', 'WHOLESALE', {
    requiresImproved: false,
    requiresUnimproved: false,
    capitalIntensive: false,
  }),
  FLIP_RENOVATE_AND_SELL: meta('FLIP_RENOVATE_AND_SELL', 'Renovate and sell', 'FLIP', {
    ...IMPROVED,
    capitalIntensive: true,
  }),
  FLIP_PIVOT_TO_RENT: meta('FLIP_PIVOT_TO_RENT', 'Pivot flip to rental', 'FLIP', {
    ...IMPROVED,
    capitalIntensive: true,
  }),
  FLIP_SELL_MID_RENO: meta('FLIP_SELL_MID_RENO', 'Sell mid-renovation', 'FLIP', IMPROVED),
  BH_LTR: meta('BH_LTR', 'Long-term rental', 'BH', IMPROVED),
  BH_STR: meta('BH_STR', 'Short-term rental', 'BH', IMPROVED),
  BH_SECTION8: meta('BH_SECTION8', 'Section 8 rental', 'BH', IMPROVED),
  BH_SELL_TO_INVESTOR: meta('BH_SELL_TO_INVESTOR', 'Sell rental to investor', 'BH', IMPROVED),
  MF_HOLD_CASHFLOW: meta('MF_HOLD_CASHFLOW', 'Hold multifamily for cashflow', 'MF', IMPROVED),
  MF_VALUE_ADD: meta('MF_VALUE_ADD', 'Value-add multifamily', 'MF', {
    ...IMPROVED,
    capitalIntensive: true,
  }),
  MF_CONDO_CONVERSION: meta('MF_CONDO_CONVERSION', 'Condo conversion', 'MF', {
    ...IMPROVED,
    capitalIntensive: true,
  }),
  MF_SELL_TO_INVESTOR: meta('MF_SELL_TO_INVESTOR', 'Sell multifamily to investor', 'MF', IMPROVED),
}
