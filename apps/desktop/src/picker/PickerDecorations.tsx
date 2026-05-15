/**
 * Scattered African-motif SVG decorations around the picker.
 * Inspired by Adinkra symbols, sun discs, leaves, and geometric patterns.
 * Low-opacity, decorative-only; explicitly excluded from drag regions.
 */
export function PickerDecorations() {
  return (
    <div
      data-tauri-drag-region
      aria-hidden
      style={{
        position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none',
      }}
    >
      {/* Top-left: soft sun disc */}
      <Sun style={{ top: 60, left: 36, width: 56, height: 56, opacity: 0.35 }} />

      {/* Top-right: Adinkra-inspired star */}
      <Star4 style={{ top: 86, right: 64, width: 38, height: 38, opacity: 0.32, color: '#8a3a1f' }} />

      {/* Mid-left: leaf */}
      <Leaf style={{ top: 220, left: 28, width: 42, height: 64, opacity: 0.28, color: '#5a7a2f', transform: 'rotate(-22deg)' }} />

      {/* Mid-right: filled hexagon */}
      <Hex filled style={{ top: 188, right: 32, width: 36, height: 36, opacity: 0.34, color: '#c4881f' }} />

      {/* Mid-right: hollow hexagon below */}
      <Hex style={{ top: 250, right: 60, width: 22, height: 22, opacity: 0.40, color: '#8a3a1f' }} />

      {/* Left below mid: small triangle */}
      <Tri style={{ top: 360, left: 60, width: 28, height: 28, opacity: 0.28, color: '#a23a1f', transform: 'rotate(15deg)' }} />

      {/* Right below mid: paired dots */}
      <Dots style={{ top: 380, right: 28, width: 56, height: 26, opacity: 0.32, color: '#5a8a3a' }} />

      {/* Bottom-left: wavy line (horizon hint) */}
      <Wave style={{ bottom: 110, left: 40, width: 76, height: 14, opacity: 0.25, color: '#fff8ee' }} />

      {/* Bottom-right: small sankofa-ish curl */}
      <Curl style={{ bottom: 130, right: 56, width: 36, height: 36, opacity: 0.28, color: '#fff8ee' }} />

      {/* Tiny scattered specks */}
      <Speck style={{ top: 168, left: 168, width: 8, height: 8, opacity: 0.22, color: '#fff8ee' }} />
      <Speck style={{ top: 320, right: 200, width: 6, height: 6, opacity: 0.30, color: '#fff8ee' }} />
      <Speck style={{ bottom: 200, left: 220, width: 7, height: 7, opacity: 0.24, color: '#3c1810' }} />
    </div>
  )
}

type DecoStyle = React.CSSProperties & { color?: string }

function Sun({ style }: { style: DecoStyle }) {
  return (
    <svg style={{ position: 'absolute', ...style }} viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="32" cy="32" r="12" fill="currentColor" fillOpacity="0.6" stroke="none" />
      <g stroke="currentColor" strokeOpacity="0.85">
        <path d="M32 4 V14" /><path d="M32 50 V60" />
        <path d="M4 32 H14" /><path d="M50 32 H60" />
        <path d="M11 11 L18 18" /><path d="M46 46 L53 53" />
        <path d="M53 11 L46 18" /><path d="M18 46 L11 53" />
      </g>
    </svg>
  )
}

function Star4({ style }: { style: DecoStyle }) {
  return (
    <svg style={{ position: 'absolute', color: style.color, ...style }} viewBox="0 0 40 40" fill="currentColor">
      <path d="M20 2 L24 16 L38 20 L24 24 L20 38 L16 24 L2 20 L16 16 Z" />
    </svg>
  )
}

function Leaf({ style }: { style: DecoStyle }) {
  return (
    <svg style={{ position: 'absolute', color: style.color, ...style }} viewBox="0 0 42 64" fill="none">
      <path d="M21 2 C8 14 4 36 21 62 C38 36 34 14 21 2 Z" fill="currentColor" fillOpacity="0.7" />
      <path d="M21 6 V60" stroke="currentColor" strokeOpacity="0.45" strokeWidth="1.5" />
    </svg>
  )
}

function Hex({ style, filled }: { style: DecoStyle; filled?: boolean }) {
  return (
    <svg style={{ position: 'absolute', color: style.color, ...style }} viewBox="0 0 36 36" fill="none">
      <path
        d="M18 2 L32 11 L32 25 L18 34 L4 25 L4 11 Z"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function Tri({ style }: { style: DecoStyle }) {
  return (
    <svg style={{ position: 'absolute', color: style.color, ...style }} viewBox="0 0 28 28" fill="currentColor">
      <path d="M14 2 L26 24 L2 24 Z" />
    </svg>
  )
}

function Dots({ style }: { style: DecoStyle }) {
  return (
    <svg style={{ position: 'absolute', color: style.color, ...style }} viewBox="0 0 56 26" fill="currentColor">
      <circle cx="13" cy="13" r="10" />
      <circle cx="43" cy="13" r="10" />
    </svg>
  )
}

function Wave({ style }: { style: DecoStyle }) {
  return (
    <svg style={{ position: 'absolute', color: style.color, ...style }} viewBox="0 0 76 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M2 7 Q12 1 22 7 T42 7 T62 7 T82 7" />
    </svg>
  )
}

function Curl({ style }: { style: DecoStyle }) {
  return (
    <svg style={{ position: 'absolute', color: style.color, ...style }} viewBox="0 0 36 36" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M30 6 A12 12 0 1 0 18 30 L8 22" />
      <path d="M8 22 L14 26 M8 22 L8 16" />
    </svg>
  )
}

function Speck({ style }: { style: DecoStyle }) {
  return (
    <svg style={{ position: 'absolute', color: style.color, ...style }} viewBox="0 0 8 8" fill="currentColor">
      <circle cx="4" cy="4" r="4" />
    </svg>
  )
}
