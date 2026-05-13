import { useState } from 'react'

// AfricaMap — a deliberately editorial, hand-drawn-looking continent
// outline with the ten Cloudflare African POPs plotted on top. We use
// approximate lat/long → SVG-coordinate math (an equirectangular
// projection over the viewBox 0..800 × 0..800) rather than embedding a
// precise GeoJSON shape, because:
//   1) bundle size — a real Africa GeoJSON is ~300KB; this is ~1KB,
//   2) aesthetic — Baobab's design language is editorial, not cartographic,
//   3) the dot positions are what matters here, not the coastline detail.
//
// Each POP is rendered as a 12px circle. The one whose three-letter code
// matches the `highlight` prop is filled with --accent and gets the
// `baobab-leaf-pulse` keyframes; the rest stay subdued.

// Approximate longitude span: -20°W to 52°E. Latitude span: 38°N to -36°S.
// We pad the projection slightly inside the viewBox so coastal cities
// don't clip the visible glyph rectangle.
const VIEW = 800
const LON_MIN = -20
const LON_MAX = 52
const LAT_MIN = -36 // bottom of viewBox
const LAT_MAX = 38  // top of viewBox

function project(lat: number, lon: number): { x: number; y: number } {
  const x = ((lon - LON_MIN) / (LON_MAX - LON_MIN)) * VIEW
  const y = ((LAT_MAX - lat) / (LAT_MAX - LAT_MIN)) * VIEW
  return { x, y }
}

// IATA-ish three-letter colo codes Cloudflare assigns to its African POPs.
// We expose more than the prompt asked for (Khartoum has KRT) because the
// residency probe can legitimately surface any of them; the highlight prop
// only lights up if the code matches.
export interface Pop {
  code: string
  city: string
  country: string
  lat: number
  lon: number
}

export const AFRICAN_POPS: readonly Pop[] = [
  { code: 'LOS', city: 'Lagos',        country: 'Nigeria',      lat: 6.5,   lon: 3.4   },
  { code: 'ACC', city: 'Accra',        country: 'Ghana',        lat: 5.6,   lon: -0.2  },
  { code: 'DKR', city: 'Dakar',        country: 'Senegal',      lat: 14.7,  lon: -17.4 },
  { code: 'CMN', city: 'Casablanca',   country: 'Morocco',      lat: 33.6,  lon: -7.6  },
  { code: 'CAI', city: 'Cairo',        country: 'Egypt',        lat: 30.0,  lon: 31.2  },
  { code: 'KRT', city: 'Khartoum',     country: 'Sudan',        lat: 15.5,  lon: 32.6  },
  { code: 'NBO', city: 'Nairobi',      country: 'Kenya',        lat: -1.3,  lon: 36.8  },
  { code: 'KGL', city: 'Kigali',       country: 'Rwanda',       lat: -1.9,  lon: 30.0  },
  { code: 'JNB', city: 'Johannesburg', country: 'South Africa', lat: -26.2, lon: 28.0  },
  { code: 'CPT', city: 'Cape Town',    country: 'South Africa', lat: -33.9, lon: 18.4  },
] as const

// A simplified Africa outline. The path was drawn by tracing major
// inflection points (Cape, Horn, Mediterranean coast, West Africa bulge,
// Gulf of Guinea, Mozambique channel) on the projection above and joining
// them with quadratic curves so the silhouette reads as Africa without
// resembling any specific vector dataset. It's intentionally hand-feeling.
const AFRICA_PATH = [
  'M 270 80',                          // start near Casablanca / NW corner
  'Q 310 70 360 75',                   // top to Algeria
  'Q 430 65 510 70',                   // Libya north coast
  'Q 580 80 610 100',                  // Egypt north coast
  'Q 640 130 615 175',                 // Egypt east, Red Sea
  'Q 600 220 620 260',                 // Sudan / Eritrea
  'Q 680 280 695 320',                 // Horn of Africa bulge
  'Q 700 350 670 365',                 // Somali tip
  'Q 640 380 610 390',                 // pulls back inland
  'Q 580 415 560 460',                 // east coast Kenya / Tanzania
  'Q 555 510 555 560',                 // Mozambique
  'Q 545 610 510 650',                 // Mozambique south
  'Q 470 695 410 720',                 // approach Cape
  'Q 360 730 320 715',                 // Cape Peninsula
  'Q 285 700 260 670',                 // West side South Africa
  'Q 240 625 230 575',                 // Namibia
  'Q 220 525 230 470',                 // Angola
  'Q 240 425 215 395',                 // Congo coast bend
  'Q 195 380 175 365',                 // Gabon
  'Q 160 350 150 320',                 // Gulf of Guinea inlet
  'Q 145 295 165 280',                 // bulge inward (Niger delta side)
  'Q 195 270 195 245',                 // step up
  'Q 195 220 170 210',                 // back inland (Bight of Benin)
  'Q 140 205 115 195',                 // West Africa coast
  'Q 80 175 75 145',                   // Senegal bulge
  'Q 75 115 105 105',                  // Mauritania north
  'Q 150 90 200 85',                   // back toward Morocco
  'Q 240 80 270 80',                   // close
  'Z',
].join(' ')

interface AfricaMapProps {
  highlight: string
  width?: number
  height?: number
}

export function AfricaMap({ highlight, width = 480, height = 480 }: AfricaMapProps) {
  const [hoverCode, setHoverCode] = useState<string | null>(null)
  // Madagascar — separate sub-island sketch so it doesn't have to be a
  // hole in the main path. Plotted independently from the POP list.
  const madagascarPath =
    'M 645 540 Q 660 560 660 600 Q 655 640 640 650 Q 625 645 625 615 Q 625 580 645 540 Z'

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${VIEW} ${VIEW}`}
      role="img"
      aria-label="Map of Africa showing Cloudflare points of presence"
      style={{ overflow: 'visible' }}
    >
      {/* Continent silhouette — filled subtly so dots read against it. */}
      <path
        d={AFRICA_PATH}
        fill="var(--surface-2)"
        stroke="var(--border-accent)"
        strokeWidth={1.5}
        strokeLinejoin="round"
        opacity={0.9}
      />
      <path
        d={madagascarPath}
        fill="var(--surface-2)"
        stroke="var(--border-accent)"
        strokeWidth={1.5}
        strokeLinejoin="round"
        opacity={0.9}
      />

      {/* POP dots. Highlighted dot is rendered last so its halo overlaps
          neighbouring dots cleanly. */}
      {AFRICAN_POPS.filter((p) => p.code !== highlight).map((p) => {
        const { x, y } = project(p.lat, p.lon)
        const isHover = hoverCode === p.code
        return (
          <g key={p.code}>
            <circle
              cx={x}
              cy={y}
              r={isHover ? 9 : 6}
              fill="var(--text-muted)"
              opacity={isHover ? 0.95 : 0.55}
              onMouseEnter={() => setHoverCode(p.code)}
              onMouseLeave={() => setHoverCode(null)}
              style={{ cursor: 'pointer', transition: 'r 150ms ease-out, opacity 150ms ease-out' }}
            >
              <title>{`${p.city}, ${p.country} · ${p.code}`}</title>
            </circle>
            {isHover && (
              <text
                x={x}
                y={y - 14}
                textAnchor="middle"
                fontSize={14}
                fontFamily="var(--font-default)"
                fill="var(--text-primary)"
              >
                {p.city}
              </text>
            )}
          </g>
        )
      })}

      {/* Highlighted POP (if any). Rendered last + pulsing. */}
      {AFRICAN_POPS.filter((p) => p.code === highlight).map((p) => {
        const { x, y } = project(p.lat, p.lon)
        return (
          <g key={p.code}>
            <circle
              cx={x}
              cy={y}
              r={16}
              fill="var(--accent)"
              opacity={0.18}
              style={{
                transformOrigin: `${x}px ${y}px`,
                animation: 'baobab-leaf-pulse 2.4s ease-in-out infinite',
              }}
            />
            <circle
              cx={x}
              cy={y}
              r={9}
              fill="var(--accent)"
              style={{
                transformOrigin: `${x}px ${y}px`,
                animation: 'baobab-leaf-pulse 2.4s ease-in-out infinite',
              }}
            >
              <title>{`${p.city}, ${p.country} · ${p.code}`}</title>
            </circle>
            <text
              x={x}
              y={y - 18}
              textAnchor="middle"
              fontSize={15}
              fontFamily="var(--font-default)"
              fill="var(--text-primary)"
              fontWeight={500}
            >
              {p.city}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
