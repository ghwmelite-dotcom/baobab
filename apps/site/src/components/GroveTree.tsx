/**
 * Hero baobab illustration. Painterly canopy, flared trunk with bark
 * texture hint, glowing fruits, and a ground shadow under the base.
 */
export function GroveTree({ size = 108 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      role="img"
      aria-label="Baobab tree"
      style={{ display: 'block', filter: 'drop-shadow(0 6px 14px rgba(60,20,10,0.25))' }}
    >
      <style>{`
        @keyframes bb-fruit-glow-a { 0%, 100% { opacity: 0.18; } 50% { opacity: 0.55; } }
        @keyframes bb-fruit-glow-b { 0%, 100% { opacity: 0.16; } 50% { opacity: 0.48; } }
        @keyframes bb-fruit-glow-c { 0%, 100% { opacity: 0.20; } 50% { opacity: 0.50; } }
        @keyframes bb-fleck-twinkle { 0%, 100% { opacity: 0.20; } 50% { opacity: 0.65; } }
        .bb-glow-a   { animation: bb-fruit-glow-a 2.6s ease-in-out infinite; transform-origin: center; transform-box: fill-box; }
        .bb-glow-b   { animation: bb-fruit-glow-b 3.2s ease-in-out -1.1s infinite; transform-origin: center; transform-box: fill-box; }
        .bb-glow-c   { animation: bb-fruit-glow-c 2.9s ease-in-out -0.6s infinite; transform-origin: center; transform-box: fill-box; }
        .bb-fleck-1  { animation: bb-fleck-twinkle 2.2s ease-in-out infinite; }
        .bb-fleck-2  { animation: bb-fleck-twinkle 3.4s ease-in-out -1.4s infinite; }
        .bb-fleck-3  { animation: bb-fleck-twinkle 2.7s ease-in-out -0.8s infinite; }
        .bb-fleck-4  { animation: bb-fleck-twinkle 3.0s ease-in-out -2.0s infinite; }
        .bb-fleck-5  { animation: bb-fleck-twinkle 2.4s ease-in-out -0.4s infinite; }
        @media (prefers-reduced-motion: reduce) {
          .bb-glow-a, .bb-glow-b, .bb-glow-c, .bb-fleck-1, .bb-fleck-2, .bb-fleck-3, .bb-fleck-4, .bb-fleck-5 {
            animation: none !important;
          }
        }
      `}</style>
      <defs>
        <radialGradient id="bb-canopy" cx="38%" cy="42%" r="68%">
          <stop offset="0%" stopColor="#3d6b50" />
          <stop offset="55%" stopColor="#1a3a2a" />
          <stop offset="100%" stopColor="#0a1d14" />
        </radialGradient>
        <radialGradient id="bb-canopy-edge" cx="50%" cy="55%" r="60%">
          <stop offset="60%" stopColor="#1a3a2a" stopOpacity="0" />
          <stop offset="100%" stopColor="#0a1d14" stopOpacity="0.6" />
        </radialGradient>
        <linearGradient id="bb-trunk" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6a3219" />
          <stop offset="55%" stopColor="#4a2310" />
          <stop offset="100%" stopColor="#1f0d05" />
        </linearGradient>
        <radialGradient id="bb-fruit-orange" cx="35%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#ffb47a" />
          <stop offset="60%" stopColor="#d4541f" />
          <stop offset="100%" stopColor="#8a2a0f" />
        </radialGradient>
        <radialGradient id="bb-fruit-yellow" cx="35%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#ffe8a8" />
          <stop offset="60%" stopColor="#d49a1f" />
          <stop offset="100%" stopColor="#8a601f" />
        </radialGradient>
        <radialGradient id="bb-fruit-green" cx="35%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#c8e078" />
          <stop offset="60%" stopColor="#7a9b1f" />
          <stop offset="100%" stopColor="#3a5a0f" />
        </radialGradient>
        <radialGradient id="bb-ground" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#3c1810" stopOpacity="0.5" />
          <stop offset="80%" stopColor="#3c1810" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Ground shadow */}
      <ellipse cx="60" cy="111" rx="40" ry="5" fill="url(#bb-ground)" />

      {/* Canopy — soft outer halo */}
      <ellipse cx="58" cy="44" rx="50" ry="36" fill="url(#bb-canopy-edge)" />

      {/* Canopy — main painterly mass */}
      <path
        d="M 60 8
           C 86 8, 108 24, 106 44
           C 110 56, 96 68, 78 70
           C 76 74, 66 76, 60 74
           C 54 76, 44 74, 42 70
           C 24 68, 10 56, 14 44
           C 12 24, 34 8, 60 8 Z"
        fill="url(#bb-canopy)"
      />

      {/* Subtle leaf flecks on canopy — twinkle on independent rhythms */}
      <g>
        <circle className="bb-fleck-1" cx="36" cy="36" r="2.5" fill="#4d8060" />
        <circle className="bb-fleck-2" cx="74" cy="32" r="2"   fill="#4d8060" />
        <circle className="bb-fleck-3" cx="88" cy="50" r="2.5" fill="#4d8060" />
        <circle className="bb-fleck-4" cx="48" cy="56" r="2"   fill="#4d8060" />
        <circle className="bb-fleck-5" cx="22" cy="48" r="1.8" fill="#4d8060" />
      </g>

      {/* Trunk — flared baobab silhouette */}
      <path
        d="M 50 64
           C 49 70, 47 78, 44 86
           C 42 94, 41 102, 42 112
           L 78 112
           C 79 102, 78 94, 76 86
           C 73 78, 71 70, 70 64
           Z"
        fill="url(#bb-trunk)"
      />

      {/* Bark texture hint — vertical lines */}
      <g stroke="#1f0d05" strokeOpacity="0.45" strokeWidth="0.6" strokeLinecap="round" fill="none">
        <path d="M 50 70 C 48 84, 46 98, 46 110" />
        <path d="M 60 68 V 110" />
        <path d="M 70 70 C 72 84, 74 98, 74 110" />
      </g>

      {/* Glowing fruits on canopy — halos pulse on their own rhythms */}
      <g>
        <circle cx="34" cy="44" r="4.5" fill="url(#bb-fruit-orange)" />
        <circle className="bb-glow-a" cx="34" cy="44" r="6"   fill="#ff8a5b" />
        <circle cx="58" cy="22" r="4"   fill="url(#bb-fruit-yellow)" />
        <circle className="bb-glow-c" cx="58" cy="22" r="5.5" fill="#ffd86f" />
        <circle cx="82" cy="38" r="4.5" fill="url(#bb-fruit-green)" />
        <circle className="bb-glow-b" cx="82" cy="38" r="6"   fill="#b8d96f" />
        <circle cx="72" cy="58" r="3.5" fill="url(#bb-fruit-orange)" />
        <circle cx="44" cy="62" r="3.5" fill="url(#bb-fruit-yellow)" />
      </g>
    </svg>
  )
}
