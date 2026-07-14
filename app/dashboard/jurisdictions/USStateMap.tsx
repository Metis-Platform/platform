'use client'

import { useMemo, useState } from 'react'
import { geoAlbersUsa, geoPath } from 'd3-geo'
import { feature } from 'topojson-client'
import type { FeatureCollection, Geometry, GeoJsonProperties } from 'geojson'
import { STATE_INFO } from '@/lib/state-info'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const statesJson = require('us-atlas/states-10m.json')

// FIPS code → state abbreviation
const FIPS: Record<string, string> = {
  '01': 'AL', '02': 'AK', '04': 'AZ', '05': 'AR', '06': 'CA',
  '08': 'CO', '09': 'CT', '10': 'DE', '12': 'FL', '13': 'GA',
  '15': 'HI', '16': 'ID', '17': 'IL', '18': 'IN', '19': 'IA',
  '20': 'KS', '21': 'KY', '22': 'LA', '23': 'ME', '24': 'MD',
  '25': 'MA', '26': 'MI', '27': 'MN', '28': 'MS', '29': 'MO',
  '30': 'MT', '31': 'NE', '32': 'NV', '33': 'NH', '34': 'NJ',
  '35': 'NM', '36': 'NY', '37': 'NC', '38': 'ND', '39': 'OH',
  '40': 'OK', '41': 'OR', '42': 'PA', '44': 'RI', '45': 'SC',
  '46': 'SD', '47': 'TN', '48': 'TX', '49': 'UT', '50': 'VT',
  '51': 'VA', '53': 'WA', '54': 'WV', '55': 'WI', '56': 'WY',
}

const FILL: Record<string, string> = {
  TAX_LIEN:        '#bfdbfe', // blue-200
  TAX_DEED:        '#fed7aa', // orange-200
  REDEEMABLE_DEED: '#cbd5e1', // slate-300
  HYBRID:          '#e9d5ff', // purple-200
  NOT_ACTIVE:      '#f4f4f5', // zinc-100
}

const FILL_HOVER: Record<string, string> = {
  TAX_LIEN:        '#93c5fd', // blue-300
  TAX_DEED:        '#fdba74', // orange-300
  REDEEMABLE_DEED: '#94a3b8', // slate-400
  HYBRID:          '#d8b4fe', // purple-300
  NOT_ACTIVE:      '#e4e4e7', // zinc-200
}

type Tooltip  = { x: number; y: number; text: string }
type Drag = { x: number; y: number; offsetX: number; offsetY: number }

const WIDTH = 975
const HEIGHT = 610

function stateFeatures(): FeatureCollection<Geometry, GeoJsonProperties> {
  // us-atlas is untyped JSON, so topojson-client cannot infer its object kind.
  return feature(statesJson, statesJson.objects.states) as unknown as FeatureCollection<Geometry, GeoJsonProperties>
}

export function USStateMap({
  selectedState,
  onStateClick,
}: {
  selectedState: string
  onStateClick: (abbr: string) => void
}) {
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [drag, setDrag] = useState<Drag | null>(null)
  const [tooltip, setTooltip]   = useState<Tooltip | null>(null)
  const [hoveredState, setHoveredState] = useState<string | null>(null)
  const states = useMemo(() => stateFeatures().features, [])
  const pathFor = useMemo(() => {
    const projection = geoAlbersUsa().fitSize([WIDTH, HEIGHT], stateFeatures())
    return geoPath(projection)
  }, [])

  function fill(abbr: string)      { return FILL[STATE_INFO[abbr]?.investmentType  ?? 'NOT_ACTIVE'] }
  function fillHover(abbr: string) { return FILL_HOVER[STATE_INFO[abbr]?.investmentType ?? 'NOT_ACTIVE'] }

  return (
    <div className="relative select-none">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-auto w-full touch-none"
        onWheel={event => {
          event.preventDefault()
          setZoom(current => Math.max(1, Math.min(8, current * (event.deltaY > 0 ? 0.8 : 1.25))))
        }}
        onPointerDown={event => {
          event.currentTarget.setPointerCapture(event.pointerId)
          setDrag({ x: event.clientX, y: event.clientY, offsetX: offset.x, offsetY: offset.y })
        }}
        onPointerMove={event => {
          if (!drag) return
          const bounds = event.currentTarget.getBoundingClientRect()
          setOffset({
            x: drag.offsetX + ((event.clientX - drag.x) * WIDTH) / bounds.width,
            y: drag.offsetY + ((event.clientY - drag.y) * HEIGHT) / bounds.height,
          })
        }}
        onPointerUp={() => setDrag(null)}
      >
        <g transform={`translate(${offset.x} ${offset.y}) scale(${zoom})`}>
          {states.map(geo => {
            const abbr = FIPS[String(geo.id).padStart(2, '0')]
            if (!abbr) return null
            const selected = selectedState === abbr
            const path = pathFor(geo)
            if (!path) return null
            return (
              <path
                key={String(geo.id)}
                d={path}
                fill={hoveredState === abbr ? fillHover(abbr) : fill(abbr)}
                stroke={selected ? '#1e293b' : '#ffffff'}
                strokeWidth={(selected ? 1.5 : 0.5) / zoom}
                className="cursor-pointer outline-none transition-colors"
                onClick={() => onStateClick(abbr)}
                onMouseEnter={event => {
                  setHoveredState(abbr)
                  const info = STATE_INFO[abbr]
                  setTooltip({ x: event.clientX, y: event.clientY, text: `${info?.stateName ?? abbr} — ${info?.investmentLabel ?? 'N/A'}${info?.interestRate ? ` · ${info.interestRate}` : ''}` })
                }}
                onMouseMove={event => setTooltip(current => current ? { ...current, x: event.clientX, y: event.clientY } : null)}
                onMouseLeave={() => { setHoveredState(null); setTooltip(null) }}
              />
            )
          })}
        </g>
      </svg>

      {/* Zoom controls */}
      <div className="absolute bottom-3 right-3 flex flex-col gap-1">
        {[
          { label: '+', action: () => setZoom(current => Math.min(current * 1.5, 8)) },
          { label: '−', action: () => setZoom(current => Math.max(current / 1.5, 1)) },
          { label: '↺', action: () => { setZoom(1); setOffset({ x: 0, y: 0 }) }, title: 'Reset' },
        ].map(({ label, action, title }) => (
          <button
            key={label}
            type="button"
            onClick={action}
            title={title}
            className="flex h-7 w-7 items-center justify-center rounded border border-zinc-200 bg-white text-sm font-medium text-zinc-600 shadow-sm hover:bg-zinc-50 transition-colors"
          >
            {label}
          </button>
        ))}
      </div>

      {/* Legend */}
      <div className="absolute bottom-3 left-3 flex flex-col gap-1 text-xs text-zinc-500">
        {[
          { color: '#bfdbfe', label: 'Tax Lien' },
          { color: '#fed7aa', label: 'Tax Deed' },
          { color: '#cbd5e1', label: 'Redeemable Deed' },
          { color: '#e9d5ff', label: 'Hybrid' },
        ].map(({ color, label }) => (
          <span key={label} className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-sm border border-zinc-200" style={{ background: color }} />
            {label}
          </span>
        ))}
      </div>

      {/* Hover tooltip */}
      {tooltip && (
        <div
          className="pointer-events-none fixed z-50 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs text-white shadow-lg whitespace-nowrap"
          style={{ left: tooltip.x + 14, top: tooltip.y - 10 }}
        >
          {tooltip.text}
        </div>
      )}
    </div>
  )
}
