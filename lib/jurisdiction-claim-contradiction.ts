type JsonLike = null | boolean | number | string | JsonLike[] | { [key: string]: JsonLike }

function canonicalize(value: unknown): JsonLike {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return value
  if (typeof value === 'number') return Number.isFinite(value) ? value : String(value)
  if (Array.isArray(value)) return value.map(canonicalize)
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)]),
    )
  }
  return String(value)
}

function normalizedUnit(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim().toLowerCase() : null
}

export function extractedClaimValue(extractedValue: unknown): {
  value: unknown
  normalizedUnit: string | null
} {
  if (!extractedValue || typeof extractedValue !== 'object' || Array.isArray(extractedValue)) {
    return { value: extractedValue, normalizedUnit: null }
  }
  const record = extractedValue as Record<string, unknown>
  return {
    value: Object.hasOwn(record, 'value') ? record.value : extractedValue,
    normalizedUnit: normalizedUnit(record.normalizedUnit),
  }
}

export function canonicalClaimValue(input: {
  value: unknown
  normalizedUnit?: unknown
}): string {
  return JSON.stringify({
    normalizedUnit: normalizedUnit(input.normalizedUnit),
    value: canonicalize(input.value),
  })
}

export function claimValuesConflict(
  existing: { value: unknown; normalizedUnit?: unknown },
  proposed: { value: unknown; normalizedUnit?: unknown },
): boolean {
  return canonicalClaimValue(existing) !== canonicalClaimValue(proposed)
}
