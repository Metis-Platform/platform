'use client'

import { useState } from 'react'
import { ComposableMap, Geographies, Geography, ZoomableGroup, type Geography as Geo } from 'react-simple-maps'
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

type Position = { coordinates: [number, number]; zoom: number }
type Tooltip  = { x: number; y: number; text: string }

export function USStateMap({
  selectedState,
  onStateClick,
}: {
  selectedState: string
  onStateClick: (abbr: string) => void
}) {
  const [position, setPosition] = useState<Position>({ coordinates: [-97, 38], zoom: 1 })
  const [tooltip, setTooltip]   = useState<Tooltip | null>(null)

  function fill(abbr: string)      { return FILL[STATE_INFO[abbr]?.investmentType  ?? 'NOT_ACTIVE'] }
  function fillHover(abbr: string) { return FILL_HOVER[STATE_INFO[abbr]?.investmentType ?? 'NOT_ACTIVE'] }

  return (
    <div className="relative select-none">
      <ComposableMap projection="geoAlbersUsa" style={{ width: '100%', height: 'auto' }}>
        <ZoomableGroup
          zoom={position.zoom}
          center={position.coordinates}
          onMoveEnd={(pos: { coordinates: [number, number]; zoom: number }) => setPosition(pos)}
          minZoom={1}
          maxZoom={8}
        >
          <Geographies geography={statesJson}>
            {({ geographies }: { geographies: Geo[] }) =>
              geographies.map((geo: Geo) => {
                const abbr = FIPS[String(geo.id).padStart(2, '0')]
                if (!abbr) return null
                const selected = selectedState === abbr

                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    onClick={() => onStateClick(abbr)}
                    onMouseEnter={(e: React.MouseEvent) => {
                      const info = STATE_INFO[abbr]
                      setTooltip({
                        x: e.clientX,
                        y: e.clientY,
                        text: `${info?.stateName ?? abbr} — ${info?.investmentLabel ?? 'N/A'}${info?.interestRate ? ` · ${info.interestRate}` : ''}`,
                      })
                    }}
                    onMouseMove={(e: React.MouseEvent) => {
                      setTooltip(t => t ? { ...t, x: e.clientX, y: e.clientY } : null)
                    }}
                    onMouseLeave={() => setTooltip(null)}
                    style={{
                      default: {
                        fill: fill(abbr),
                        stroke: selected ? '#1e293b' : '#ffffff',
                        strokeWidth: selected ? 1.5 / position.zoom : 0.5 / position.zoom,
                        outline: 'none',
                        cursor: 'pointer',
                      },
                      hover: {
                        fill: fillHover(abbr),
                        stroke: selected ? '#1e293b' : '#94a3b8',
                        strokeWidth: selected ? 1.5 / position.zoom : 0.75 / position.zoom,
                        outline: 'none',
                        cursor: 'pointer',
                      },
                      pressed: { fill: fillHover(abbr), outline: 'none' },
                    }}
                  />
                )
              })
            }
          </Geographies>
        </ZoomableGroup>
      </ComposableMap>

      {/* Zoom controls */}
      <div className="absolute bottom-3 right-3 flex flex-col gap-1">
        {[
          { label: '+', action: () => setPosition(p => ({ ...p, zoom: Math.min(p.zoom * 1.5, 8) })) },
          { label: '−', action: () => setPosition(p => ({ ...p, zoom: Math.max(p.zoom / 1.5, 1) })) },
          { label: '↺', action: () => setPosition({ coordinates: [-97, 38], zoom: 1 }), title: 'Reset' },
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
