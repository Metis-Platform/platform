import { fetchJson, numberFromUnknown, objectRecord } from './types'

export async function fetchWalkScore(
  lat: number,
  lon: number,
  address: string,
): Promise<{
  walkScore?: number
  transitScore?: number
  bikeScore?: number
}> {
  const apiKey = process.env.WALK_SCORE_API_KEY
  if (!apiKey) return {}

  const params = new URLSearchParams({
    format: 'json',
    address,
    lat: String(lat),
    lon: String(lon),
    transit: '1',
    bike: '1',
    wsapikey: apiKey,
  })
  const json = objectRecord(await fetchJson(`https://api.walkscore.com/score?${params.toString()}`))
  const transit = objectRecord(json.transit)
  const bike = objectRecord(json.bike)

  return {
    walkScore: numberFromUnknown(json.walkscore),
    transitScore: numberFromUnknown(transit.score),
    bikeScore: numberFromUnknown(bike.score),
  }
}
