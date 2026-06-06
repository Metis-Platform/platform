import { StrategyType } from '@/app/generated/prisma'

export type ResearchLink = {
  label: string
  href: string
  icon: string
  description?: string
}

export type ResearchLinkGroup = {
  title: string
  description: string
  links: ResearchLink[]
}

type JurisdictionLinks = Record<string, unknown>

const COUNTY_LINK_LABELS: Record<string, { label: string; icon: string }> = {
  assessorUrl: { label: 'County Assessor', icon: '🏢' },
  taxCollectorUrl: { label: 'Tax Collector', icon: '💵' },
  recorderUrl: { label: 'Recorder', icon: '📄' },
  gisUrl: { label: 'GIS / Parcel Map', icon: '🧭' },
  auctionUrl: { label: 'Auction Site', icon: '🏛️' },
  clerkUrl: { label: 'Clerk / Courts', icon: '⚖️' },
  sheriffUrl: { label: 'Sheriff Sale Portal', icon: '🚨' },
  planningUrl: { label: 'Planning / Zoning', icon: '📐' },
}

const STRATEGY_LINKS: Partial<Record<StrategyType, ResearchLink[]>> = {
  TAX_LIEN: [
    { label: 'GovEase', href: 'https://govease.com/', icon: '🏛️', description: 'Online tax lien and tax deed auctions' },
    { label: 'Bid4Assets', href: 'https://www.bid4assets.com/', icon: '🏷️', description: 'Government property auction marketplace' },
    { label: 'SRI Tax Sale Services', href: 'https://sriservices.com/', icon: '📋', description: 'Tax sale services and county auction calendars' },
  ],
  TAX_DEED: [
    { label: 'Bid4Assets', href: 'https://www.bid4assets.com/', icon: '🏷️', description: 'Government property auction marketplace' },
    { label: 'GovEase', href: 'https://govease.com/', icon: '🏛️', description: 'Online tax lien and tax deed auctions' },
    { label: 'SRI Tax Sale Services', href: 'https://sriservices.com/', icon: '📋', description: 'Tax sale services and county auction calendars' },
  ],
  FORECLOSURE: [
    { label: 'Auction.com', href: 'https://www.auction.com/', icon: '🏛️', description: 'Foreclosure and bank-owned auctions' },
    { label: 'HUD Home Store', href: 'https://www.hudhomestore.gov/Home/Index.aspx', icon: '🏠', description: 'HUD-owned home listings' },
    { label: 'HomePath', href: 'https://www.homepath.com/', icon: '🏘️', description: 'Fannie Mae foreclosure listings' },
    { label: 'HomeSteps', href: 'https://www.homesteps.com/', icon: '🏡', description: 'Freddie Mac REO listings' },
    { label: 'PACER', href: 'https://pacer.uscourts.gov/', icon: '⚖️', description: 'Federal court bankruptcy and case records' },
  ],
  LAND: [
    { label: 'Regrid', href: 'https://regrid.com/', icon: '🗺️', description: 'Parcel boundaries and ownership data' },
    { label: 'AcreValue', href: 'https://www.acrevalue.com/', icon: '🌾', description: 'Land value and soil productivity data' },
    { label: 'LandWatch', href: 'https://www.landwatch.com/', icon: '🌲', description: 'Land listing comps' },
    { label: 'FEMA Flood Maps', href: 'https://msc.fema.gov/portal/home', icon: '🌊', description: 'Flood zone research' },
    { label: 'USGS Topo Maps', href: 'https://www.usgs.gov/programs/national-geospatial-program/topographic-maps', icon: '⛰️', description: 'Topographic map research' },
    { label: 'NRCS Web Soil Survey', href: 'https://websoilsurvey.nrcs.usda.gov/', icon: '🧪', description: 'Soil and perc suitability research' },
    { label: 'BLM Land Records', href: 'https://glorecords.blm.gov/', icon: '📜', description: 'Federal land patent and status records' },
  ],
  WHOLESALE: [
    { label: 'BatchLeads', href: 'https://www.batchleads.io/', icon: '📇', description: 'Lead lists and skip tracing' },
    { label: 'DealMachine', href: 'https://www.dealmachine.com/', icon: '🚗', description: 'Driving-for-dollars and owner outreach' },
    { label: 'ListSource', href: 'https://www.listsource.com/', icon: '📋', description: 'Property owner lead lists' },
  ],
  FIX_FLIP: [
    { label: 'BuildZoom', href: 'https://www.buildzoom.com/', icon: '🛠️', description: 'Contractor licensing and permit history' },
    { label: 'HomeAdvisor', href: 'https://www.homeadvisor.com/', icon: '👷', description: 'Contractor discovery' },
    { label: 'Angi', href: 'https://www.angi.com/', icon: '🔨', description: 'Contractor discovery and reviews' },
  ],
  BUY_HOLD: [
    { label: 'Rentometer', href: 'https://www.rentometer.com/', icon: '📈', description: 'Rent comps' },
    { label: 'HUD FMR Database', href: 'https://www.huduser.gov/portal/datasets/fmr.html', icon: '🏢', description: 'Fair Market Rent limits' },
    { label: 'HUD Resource Locator', href: 'https://resources.hud.gov/', icon: '🏘️', description: 'Housing authority and HUD resources' },
  ],
  MULTIFAMILY: [
    { label: 'LoopNet', href: 'https://www.loopnet.com/', icon: '🏬', description: 'Commercial listing comps' },
    { label: 'Crexi', href: 'https://www.crexi.com/', icon: '🏢', description: 'Commercial listing comps' },
    { label: 'Freddie Mac Multifamily', href: 'https://mf.freddiemac.com/', icon: '🏦', description: 'Multifamily lending and market data' },
    { label: 'Fannie Mae Multifamily', href: 'https://multifamily.fanniemae.com/', icon: '🏦', description: 'Multifamily financing programs' },
  ],
}

function isSafeExternalUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

function countySlug(county: string) {
  return county.toLowerCase().replace(/\s+/g, '-').replace(/\./g, '')
}

function buildUniversalLinks(apn: string, address: string | null, state: string, county: string): ResearchLink[] {
  const mapQuery = encodeURIComponent(address || `${apn} ${county} County ${state}`)
  const netro = `https://publicrecords.netronline.com/state/${state}/county/${countySlug(county)}`

  return [
    { label: 'Google Maps', href: `https://www.google.com/maps/search/${mapQuery}`, icon: '🗺️' },
    { label: 'Bing Maps', href: `https://www.bing.com/maps?q=${mapQuery}`, icon: '🗺️' },
    { label: 'Zillow', href: `https://www.zillow.com/homes/${mapQuery}_rb/`, icon: '🏠' },
    { label: 'NETRonline', href: netro, icon: '🔍' },
  ]
}

function buildCountyLinks(links: unknown): ResearchLink[] {
  if (!links || typeof links !== 'object' || Array.isArray(links)) return []

  return Object.entries(links as JurisdictionLinks)
    .filter((entry): entry is [string, string] => (
      typeof entry[1] === 'string' && entry[1].trim().length > 0 && isSafeExternalUrl(entry[1])
    ))
    .map(([key, href]) => {
      const preset = COUNTY_LINK_LABELS[key]
      return {
        label: preset?.label ?? key.replace(/Url$/, '').replace(/([A-Z])/g, ' $1').trim(),
        href,
        icon: preset?.icon ?? '🔗',
      }
    })
}

export function buildResearchLinkGroups({
  apn,
  address,
  state,
  county,
  strategyType,
  jurisdictionLinks,
}: {
  apn: string
  address: string | null
  state: string
  county: string
  strategyType: StrategyType
  jurisdictionLinks: unknown
}): ResearchLinkGroup[] {
  const groups: ResearchLinkGroup[] = [
    {
      title: 'Property research',
      description: 'Universal parcel, map, public-record, and valuation lookups.',
      links: buildUniversalLinks(apn, address, state, county),
    },
  ]

  const strategyLinks = STRATEGY_LINKS[strategyType] ?? []
  if (strategyLinks.length > 0) {
    groups.push({
      title: 'Strategy resources',
      description: 'Reference sites tailored to this deal strategy.',
      links: strategyLinks,
    })
  }

  const countyLinks = buildCountyLinks(jurisdictionLinks)
  if (countyLinks.length > 0) {
    groups.push({
      title: 'County resources',
      description: 'Jurisdiction-maintained assessor, tax collector, recorder, GIS, and auction links.',
      links: countyLinks,
    })
  }

  return groups
}
