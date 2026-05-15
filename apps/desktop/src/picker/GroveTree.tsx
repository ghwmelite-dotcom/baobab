export function GroveTree({ size = 96 }: { size?: number }) {
  // Stylised baobab: trunk + ellipse canopy + three highlight fruits.
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 96 96"
      role="img"
      aria-label="Baobab tree"
      style={{ display: 'block' }}
    >
      <defs>
        <radialGradient id="canopy" cx="40%" cy="50%" r="70%">
          <stop offset="0%" stopColor="#2a5240" />
          <stop offset="70%" stopColor="#0d2418" />
          <stop offset="100%" stopColor="#0d2418" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="trunk" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#5a2814" />
          <stop offset="100%" stopColor="#2d130a" />
        </linearGradient>
      </defs>
      <ellipse cx="48" cy="42" rx="40" ry="30" fill="url(#canopy)" />
      <path d="M 38 50 Q 36 70 32 90 L 64 90 Q 60 70 58 50 Z" fill="url(#trunk)" />
      <circle cx="32" cy="36" r="3.5" fill="#c44a1f" />
      <circle cx="52" cy="30" r="3.5" fill="#c4881f" />
      <circle cx="64" cy="44" r="3.5" fill="#5a8a1f" />
    </svg>
  )
}
