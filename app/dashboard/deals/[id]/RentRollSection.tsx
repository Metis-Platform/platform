'use client'

import { useState, useActionState } from 'react'
import { saveRentRoll, type RentRollState } from '@/lib/actions/multifamily-rentroll'
import { computeRentRollMetrics, type RentRollUnit, type RentRoll } from '@/lib/multifamily-schemas'

const STATUSES = ['OCCUPIED', 'VACANT', 'NOTICE'] as const
type UnitStatus = typeof STATUSES[number]

const STATUS_LABELS: Record<UnitStatus, string> = {
  OCCUPIED: 'Occupied',
  VACANT:   'Vacant',
  NOTICE:   'Notice',
}

const STATUS_COLORS: Record<UnitStatus, string> = {
  OCCUPIED: 'bg-emerald-100 text-emerald-800',
  VACANT:   'bg-zinc-100 text-zinc-600',
  NOTICE:   'bg-amber-100 text-amber-800',
}

function fmt$(v: number) {
  return `$${v.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function emptyUnit(): RentRollUnit {
  return {
    unitNum: '', bedrooms: 1, sqft: null,
    currentRent: 0, marketRent: null, leaseEnd: null, status: 'OCCUPIED',
  }
}

export default function RentRollSection({
  dealId,
  initialRoll,
}: {
  dealId: string
  initialRoll: RentRoll | null
}) {
  const [units, setUnits] = useState<RentRollUnit[]>(initialRoll?.units ?? [])
  const [isEditing, setIsEditing] = useState(false)

  const boundAction = saveRentRoll.bind(null, dealId)
  const [state, formAction, pending] = useActionState(boundAction, {} as RentRollState)

  const roll: RentRoll = { units }
  const metrics = computeRentRollMetrics(roll)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData()
    fd.set('rentRoll', JSON.stringify(roll))
    formAction(fd)
    setIsEditing(false)
  }

  function updateUnit(i: number, field: keyof RentRollUnit, value: string | number | null) {
    setUnits(prev => prev.map((u, idx) => idx === i ? { ...u, [field]: value } : u))
  }

  function addUnit() {
    setUnits(prev => [...prev, emptyUnit()])
  }

  function removeUnit(i: number) {
    setUnits(prev => prev.filter((_, idx) => idx !== i))
  }

  return (
    <div className="bg-white rounded-xl border border-zinc-200 p-6 mt-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-zinc-900">Rent Roll</h2>
        <div className="flex items-center gap-2">
          {!isEditing ? (
            <button onClick={() => setIsEditing(true)}
              className="text-xs text-zinc-500 hover:text-zinc-900 transition-colors">
              Edit
            </button>
          ) : null}
        </div>
      </div>

      {state.error && (
        <div className="mb-4 text-sm text-red-700 bg-red-50 rounded-lg px-4 py-2">{state.error}</div>
      )}

      {/* Summary metrics */}
      {units.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4 rounded-lg border border-zinc-100 bg-zinc-50 p-4">
          <div>
            <div className="text-xs text-zinc-500 mb-0.5">Units</div>
            <div className="text-base font-bold text-zinc-800">
              {metrics.total} <span className="text-sm font-normal text-zinc-500">({metrics.occupied} occ.)</span>
            </div>
          </div>
          <div>
            <div className="text-xs text-zinc-500 mb-0.5">GSI</div>
            <div className="text-base font-bold text-emerald-700">{fmt$(metrics.gsi)}</div>
          </div>
          <div>
            <div className="text-xs text-zinc-500 mb-0.5">Occupancy</div>
            <div className={`text-base font-bold ${1 - metrics.vacancyRate >= 0.9 ? 'text-emerald-700' : 'text-amber-600'}`}>
              {((1 - metrics.vacancyRate) * 100).toFixed(0)}%
            </div>
          </div>
          {metrics.lossToLease !== 0 && (
            <div>
              <div className="text-xs text-zinc-500 mb-0.5">Loss-to-Lease</div>
              <div className="text-base font-bold text-amber-600">{fmt$(metrics.lossToLease)}/yr</div>
            </div>
          )}
        </div>
      )}

      {/* Table */}
      {(units.length > 0 || isEditing) && (
        <form onSubmit={handleSubmit}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-zinc-500 border-b border-zinc-100">
                  <th className="pb-2 font-medium pr-3">Unit</th>
                  <th className="pb-2 font-medium pr-3">Bed</th>
                  <th className="pb-2 font-medium pr-3">Sqft</th>
                  <th className="pb-2 font-medium pr-3">Rent</th>
                  <th className="pb-2 font-medium pr-3">Market</th>
                  <th className="pb-2 font-medium pr-3">Lease End</th>
                  <th className="pb-2 font-medium pr-3">Status</th>
                  {isEditing && <th className="pb-2" />}
                </tr>
              </thead>
              <tbody>
                {units.map((unit, i) => (
                  <tr key={i} className="border-b border-zinc-50">
                    <td className="py-2 pr-3">
                      {isEditing ? (
                        <input value={unit.unitNum} onChange={e => updateUnit(i, 'unitNum', e.target.value)}
                          className="w-16 border border-zinc-200 rounded px-2 py-1 text-xs font-mono" placeholder="101" />
                      ) : (
                        <span className="font-mono font-medium">{unit.unitNum}</span>
                      )}
                    </td>
                    <td className="py-2 pr-3">
                      {isEditing ? (
                        <input type="number" value={unit.bedrooms} min={0} max={10}
                          onChange={e => updateUnit(i, 'bedrooms', parseInt(e.target.value) || 0)}
                          className="w-12 border border-zinc-200 rounded px-2 py-1 text-xs" />
                      ) : (
                        <span>{unit.bedrooms === 0 ? 'Studio' : `${unit.bedrooms}BR`}</span>
                      )}
                    </td>
                    <td className="py-2 pr-3">
                      {isEditing ? (
                        <input type="number" value={unit.sqft ?? ''} min={0}
                          onChange={e => updateUnit(i, 'sqft', e.target.value ? parseFloat(e.target.value) : null)}
                          className="w-16 border border-zinc-200 rounded px-2 py-1 text-xs" placeholder="850" />
                      ) : (
                        <span className="text-zinc-500">{unit.sqft ? `${unit.sqft.toLocaleString()}` : '—'}</span>
                      )}
                    </td>
                    <td className="py-2 pr-3">
                      {isEditing ? (
                        <input type="number" value={unit.currentRent} min={0}
                          onChange={e => updateUnit(i, 'currentRent', parseFloat(e.target.value) || 0)}
                          className="w-20 border border-zinc-200 rounded px-2 py-1 text-xs" />
                      ) : (
                        <span className="font-medium">{fmt$(unit.currentRent)}</span>
                      )}
                    </td>
                    <td className="py-2 pr-3">
                      {isEditing ? (
                        <input type="number" value={unit.marketRent ?? ''} min={0}
                          onChange={e => updateUnit(i, 'marketRent', e.target.value ? parseFloat(e.target.value) : null)}
                          className="w-20 border border-zinc-200 rounded px-2 py-1 text-xs" />
                      ) : (
                        <span className="text-zinc-500">{unit.marketRent ? fmt$(unit.marketRent) : '—'}</span>
                      )}
                    </td>
                    <td className="py-2 pr-3">
                      {isEditing ? (
                        <input type="date" value={unit.leaseEnd ?? ''}
                          onChange={e => updateUnit(i, 'leaseEnd', e.target.value || null)}
                          className="border border-zinc-200 rounded px-2 py-1 text-xs" />
                      ) : (
                        <span className="text-zinc-500">
                          {unit.leaseEnd ? new Date(unit.leaseEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }) : '—'}
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-3">
                      {isEditing ? (
                        <select value={unit.status}
                          onChange={e => updateUnit(i, 'status', e.target.value as UnitStatus)}
                          className="border border-zinc-200 rounded px-2 py-1 text-xs">
                          {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                        </select>
                      ) : (
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[unit.status as UnitStatus]}`}>
                          {STATUS_LABELS[unit.status as UnitStatus]}
                        </span>
                      )}
                    </td>
                    {isEditing && (
                      <td className="py-2">
                        <button type="button" onClick={() => removeUnit(i)}
                          className="text-zinc-400 hover:text-red-600 text-xs px-1">✕</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              {/* Totals row */}
              {units.length > 0 && (
                <tfoot>
                  <tr className="border-t border-zinc-200 text-xs font-semibold text-zinc-700">
                    <td className="pt-2 pr-3" colSpan={3}>Total ({metrics.total} units)</td>
                    <td className="pt-2 pr-3">{fmt$(metrics.gsi / 12)}/mo</td>
                    <td className="pt-2 pr-3">
                      {units.some(u => u.marketRent) ? fmt$(units.reduce((s, u) => s + (u.marketRent ?? u.currentRent), 0)) + '/mo' : ''}
                    </td>
                    <td colSpan={isEditing ? 3 : 2} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {isEditing && (
            <div className="mt-4 flex items-center gap-3">
              <button type="button" onClick={addUnit}
                className="text-xs text-blue-600 hover:text-blue-800">+ Add Unit</button>
              <div className="ml-auto flex items-center gap-2">
                <button type="button" onClick={() => { setUnits(initialRoll?.units ?? []); setIsEditing(false) }}
                  className="px-3 py-1.5 text-xs text-zinc-500 hover:text-zinc-700">Cancel</button>
                <button type="submit" disabled={pending}
                  className="px-4 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">
                  {pending ? 'Saving…' : 'Save Rent Roll'}
                </button>
              </div>
            </div>
          )}
        </form>
      )}

      {units.length === 0 && !isEditing && (
        <div className="text-center py-8">
          <p className="text-sm text-zinc-400 mb-3">No units added yet.</p>
          <button onClick={() => { setUnits([emptyUnit()]); setIsEditing(true) }}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">
            Add Units
          </button>
        </div>
      )}
    </div>
  )
}
