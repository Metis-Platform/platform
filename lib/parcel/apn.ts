export type ApnFormat = 'fl_standard' | 'miami_folio' | 'lee_strap' | 'cook_pin' | 'generic'

export interface NormalizedApn {
  raw: string
  normalized: string
  format: ApnFormat
  fipsCounty: string
}

const MIAMI_DADE_FIPS = '12086'
const LEE_FIPS = '12071'
const COOK_FIPS = '17031'

export function detectApnFormat(fipsCounty: string): ApnFormat {
  if (fipsCounty === MIAMI_DADE_FIPS) return 'miami_folio'
  if (fipsCounty === LEE_FIPS) return 'lee_strap'
  if (fipsCounty === COOK_FIPS) return 'cook_pin'
  if (fipsCounty.startsWith('12')) return 'fl_standard'
  return 'generic'
}

export function normalizeApn(raw: string, fipsCounty: string): NormalizedApn {
  const trimmed = raw.trim()
  const format = detectApnFormat(fipsCounty)

  return {
    raw: trimmed,
    normalized: normalizeByFormat(trimmed, format),
    format,
    fipsCounty,
  }
}

function normalizeByFormat(raw: string, format: ApnFormat): string {
  switch (format) {
    case 'fl_standard':
      return raw.replace(/-/g, '').toUpperCase().padStart(10, '0')
    case 'miami_folio':
    case 'cook_pin':
      return raw.replace(/-/g, '').toUpperCase()
    case 'lee_strap':
      return raw.replace(/-/g, '').toUpperCase()
    case 'generic':
      return raw.toUpperCase().replace(/[^A-Z0-9-]/g, '')
  }
}
