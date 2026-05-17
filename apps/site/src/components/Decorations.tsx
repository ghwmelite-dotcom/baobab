/**
 * Slim subset of the desktop picker's decorations. Used as ambient
 * accents around the hero's GroveTree — NOT the picker's full
 * 8-element maximalist scatter.
 *
 * Each component:
 * - Renders pure SVG with aria-hidden="true" (decorative only)
 * - Honours prefers-reduced-motion via the same media query the picker uses
 * - Accepts an optional `style` prop for positioning by the caller
 */
import type { CSSProperties } from 'react'

interface DecorationProps {
  style?: CSSProperties
}

/** Shared keyframe block — inlined into each component so it is self-contained. */
const SHARED_KEYFRAMES = `
  .bb-anim { transform-origin: 50% 50%; transform-box: fill-box; will-change: transform, opacity; }

  @keyframes bb-spin-ccw { to { transform: rotate(-360deg); } }
  @keyframes bb-pulse {
    0%, 100% { transform: scale(1); }
    50%      { transform: scale(1.08); }
  }
  @keyframes bb-leaf-sway {
    0%, 100% { transform: rotate(-28deg); }
    50%      { transform: rotate(-16deg); }
  }
  @keyframes bb-float {
    0%, 100% { transform: translateY(0); }
    50%      { transform: translateY(-7px); }
  }

  @media (prefers-reduced-motion: reduce) {
    .bb-anim { animation: none !important; }
  }
`

/**
 * SunDisc — counter-clockwise spinning sun with radiating rays.
 * Upstream: `Sun` in PickerDecorations.tsx.
 * Default animation: bb-spin-ccw 22s linear infinite, opacity 0.35.
 */
export function SunDisc({ style }: DecorationProps) {
  return (
    <svg
      className="bb-anim"
      aria-hidden="true"
      style={{
        position: 'absolute',
        color: '#c4881f',
        width: 56,
        height: 56,
        opacity: 0.35,
        animation: 'bb-spin-ccw 22s linear infinite',
        ...style,
      }}
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <style>{SHARED_KEYFRAMES}</style>
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

/**
 * Leaf — tear-drop leaf shape with a central vein, gentle sway animation.
 * Upstream: `Leaf` in PickerDecorations.tsx (name unchanged).
 * Default animation: bb-leaf-sway 3.2s ease-in-out infinite, opacity 0.30.
 */
export function Leaf({ style }: DecorationProps) {
  return (
    <svg
      className="bb-anim"
      aria-hidden="true"
      style={{
        position: 'absolute',
        color: '#5a7a2f',
        width: 42,
        height: 64,
        opacity: 0.30,
        animation: 'bb-leaf-sway 3.2s ease-in-out infinite',
        ...style,
      }}
      viewBox="0 0 42 64"
      fill="none"
    >
      <style>{SHARED_KEYFRAMES}</style>
      <path d="M21 2 C8 14 4 36 21 62 C38 36 34 14 21 2 Z" fill="currentColor" fillOpacity="0.7" />
      <path d="M21 6 V60" stroke="currentColor" strokeOpacity="0.45" strokeWidth="1.5" />
    </svg>
  )
}

/**
 * Hexagon — six-sided polygon, supports filled or outline variant.
 * Upstream: `Hex` in PickerDecorations.tsx.
 * Default animation: bb-float 2.8s ease-in-out infinite, opacity 0.34.
 * Pass `filled` via style override or use the `filled` prop to fill solid.
 */
export function Hexagon({ style, filled }: DecorationProps & { filled?: boolean }) {
  return (
    <svg
      className="bb-anim"
      aria-hidden="true"
      style={{
        position: 'absolute',
        color: '#c4881f',
        width: 36,
        height: 36,
        opacity: 0.34,
        animation: 'bb-float 2.8s ease-in-out infinite',
        ...style,
      }}
      viewBox="0 0 36 36"
      fill="none"
    >
      <style>{SHARED_KEYFRAMES}</style>
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

/**
 * DotPair — two circles side by side, pulsing in sync.
 * Upstream: `Dots` in PickerDecorations.tsx.
 * Default animation: bb-pulse 2.0s ease-in-out -0.4s infinite, opacity 0.34.
 */
export function DotPair({ style }: DecorationProps) {
  return (
    <svg
      className="bb-anim"
      aria-hidden="true"
      style={{
        position: 'absolute',
        color: '#5a8a3a',
        width: 56,
        height: 26,
        opacity: 0.34,
        animation: 'bb-pulse 2.0s ease-in-out -0.4s infinite',
        ...style,
      }}
      viewBox="0 0 56 26"
      fill="currentColor"
    >
      <style>{SHARED_KEYFRAMES}</style>
      <circle cx="13" cy="13" r="10" />
      <circle cx="43" cy="13" r="10" />
    </svg>
  )
}
