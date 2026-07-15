const MAX_APN_LENGTH = 60

export function researchDealHref(jurisdictionId: string, apn: string, snapshotId?: string) {
  const params = new URLSearchParams({ jid: jurisdictionId, apn })
  if (snapshotId) params.set('research', snapshotId)
  return `/dashboard/deals/new?${params.toString()}`
}

export function prefilledResearchApn(value: string | undefined) {
  const apn = value?.trim()
  return apn && apn.length <= MAX_APN_LENGTH ? apn : undefined
}

export function prefilledResearchSnapshotId(value: string | undefined) {
  return value && /^c[a-z0-9]{24}$/i.test(value) ? value : undefined
}
