'use client'

import { useState } from 'react'
import { isPolygonGeometry } from '@/lib/geo/types'

type EligibleClaim = {
  id: string
  sourceUrl: string
  reviewedAt: string
}

type Boundary = {
  id: string
  claimId: string
  createdAt: string
}

type Props = {
  jurisdictionId: string
  claims: EligibleClaim[]
  initialBoundaries: Boundary[]
}

export function parseAuthorityBoundaryGeometry(value: string): unknown | null {
  try {
    const geometry: unknown = JSON.parse(value)
    return isPolygonGeometry(geometry) ? geometry : null
  } catch {
    return null
  }
}

export function authorityBoundaryPayload(
  claimId: string,
  geometry: unknown,
  currentBoundaryId?: string,
) {
  return {
    claimId,
    geometry,
    ...(currentBoundaryId ? { replacesBoundaryId: currentBoundaryId } : {}),
  }
}

export default function AuthorityBoundaryClient({ jurisdictionId, claims, initialBoundaries }: Props) {
  const [claimId, setClaimId] = useState(claims[0]?.id ?? '')
  const [geometryText, setGeometryText] = useState('')
  const [boundaries, setBoundaries] = useState(initialBoundaries)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const selectedClaim = claims.find(claim => claim.id === claimId)
  const currentBoundary = boundaries.find(boundary => boundary.claimId === claimId)

  async function submit() {
    const geometry = parseAuthorityBoundaryGeometry(geometryText)
    if (!claimId || !geometry) {
      setMessage('Provide a GeoJSON Polygon or MultiPolygon before publishing.')
      return
    }
    setSaving(true)
    setMessage(null)
    try {
      const response = await fetch(`/api/admin/jurisdictions/${jurisdictionId}/authority-boundaries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authorityBoundaryPayload(claimId, geometry, currentBoundary?.id)),
      })
      const result = await response.json() as { boundaryId?: string; error?: string }
      if (!response.ok || !result.boundaryId) {
        setMessage(result.error ?? 'Boundary publication failed. Refresh and try again.')
        return
      }
      setBoundaries(previous => [
        { id: result.boundaryId!, claimId, createdAt: new Date().toISOString() },
        ...previous.filter(boundary => boundary.claimId !== claimId),
      ])
      setGeometryText('')
      setMessage('Reviewed boundary published. County rules will still require the point to fall inside it.')
    } catch {
      setMessage('Boundary publication failed. Refresh and try again.')
    } finally {
      setSaving(false)
    }
  }

  if (claims.length === 0) {
    return <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
      No current, verified unincorporated-county authority claim is available. Review the official source and publish that claim before adding any boundary.
    </p>
  }

  return (
    <div className="space-y-4">
      <p className="text-xs leading-5 text-zinc-500">
        Publish only an authoritative unincorporated-area boundary that supports the selected claim. This never overrides an incorporated-place result and replaces prior geometry through an append-only record.
      </p>
      <label className="block text-xs font-medium text-zinc-700">
        Reviewed authority claim
        <select value={claimId} onChange={event => setClaimId(event.target.value)} className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm">
          {claims.map(claim => <option key={claim.id} value={claim.id}>{claim.id}</option>)}
        </select>
      </label>
      {selectedClaim && <p className="text-xs text-zinc-500">
        Source: <a className="text-blue-700 underline" href={selectedClaim.sourceUrl} target="_blank" rel="noreferrer">reviewed authority evidence</a> · reviewed {new Date(selectedClaim.reviewedAt).toLocaleDateString()}
      </p>}
      <label className="block text-xs font-medium text-zinc-700">
        GeoJSON boundary
        <textarea value={geometryText} onChange={event => setGeometryText(event.target.value)} rows={8} placeholder='{"type":"Polygon","coordinates":[…]}' className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 font-mono text-xs" />
      </label>
      {currentBoundary && <p className="text-xs text-amber-700">Publishing replaces boundary {currentBoundary.id} from {new Date(currentBoundary.createdAt).toLocaleDateString()}.</p>}
      <button type="button" onClick={submit} disabled={saving} className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
        {saving ? 'Publishing…' : currentBoundary ? 'Replace reviewed boundary' : 'Publish reviewed boundary'}
      </button>
      {message && <p className={message.startsWith('Reviewed') ? 'text-sm text-emerald-700' : 'text-sm text-red-700'}>{message}</p>}
    </div>
  )
}
