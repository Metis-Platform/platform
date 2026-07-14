const REQUEST_ID_HEADER = 'x-request-id'
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export { REQUEST_ID_HEADER }

export function requestIdFromHeaders(headers: Headers) {
  return requestIdFromValue(headers.get(REQUEST_ID_HEADER))
}

export function requestIdFromValue(value: string | null | undefined) {
  const requestId = value?.trim()
  return requestId && uuidPattern.test(requestId) ? requestId : undefined
}
