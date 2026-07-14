const MAX_APN_LENGTH = 60

export function researchDealHref(jurisdictionId: string, apn: string) {
  const params = new URLSearchParams({ jid: jurisdictionId, apn })
  return `/dashboard/deals/new?${params.toString()}`
}

export function prefilledResearchApn(value: string | undefined) {
  const apn = value?.trim()
  return apn && apn.length <= MAX_APN_LENGTH ? apn : undefined
}
