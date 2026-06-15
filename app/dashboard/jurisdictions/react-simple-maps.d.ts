declare module 'react-simple-maps' {
  import { ReactNode, CSSProperties, MouseEvent } from 'react'

  export interface GeographyProps {
    key?: string
    geography: Geography
    onClick?: (event: MouseEvent<SVGPathElement>) => void
    onMouseEnter?: (event: MouseEvent<SVGPathElement>) => void
    onMouseMove?: (event: MouseEvent<SVGPathElement>) => void
    onMouseLeave?: (event: MouseEvent<SVGPathElement>) => void
    style?: { default?: CSSProperties; hover?: CSSProperties; pressed?: CSSProperties }
  }

  export interface Geography {
    rsmKey: string
    id: string | number
    properties: Record<string, unknown>
  }

  export interface GeographiesProps {
    geography: object | string
    children: (props: { geographies: Geography[] }) => ReactNode
  }

  export interface ZoomableGroupProps {
    zoom?: number
    center?: [number, number]
    minZoom?: number
    maxZoom?: number
    onMoveEnd?: (position: { coordinates: [number, number]; zoom: number }) => void
    children?: ReactNode
  }

  export interface ComposableMapProps {
    projection?: string
    style?: CSSProperties
    children?: ReactNode
  }

  export function ComposableMap(props: ComposableMapProps): JSX.Element
  export function ZoomableGroup(props: ZoomableGroupProps): JSX.Element
  export function Geographies(props: GeographiesProps): JSX.Element
  export function Geography(props: GeographyProps): JSX.Element
}
