import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { strings } from '@baobab/brand'
import { useSovereigntyStore } from '~/state/sovereignty.store'
import { useAuthStore } from '~/auth/auth.store'
import { useAiStore } from '~/ai/ai.store'
import { useTabsStore } from '~/state/tabs.store'

// ── Time-aware greeting ───────────────────────────────────────────────────

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 5)  return 'Late night reading'
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  if (h < 21) return 'Good evening'
  return 'Reading by lamplight'
}

// ── Baobab tree silhouette (hand-drawn line art) ──────────────────────────
// Stylized "tree that grew upside down" — broad trunk, wide bare crown.
// Single-stroke composition, organic curves. Bottom-right of NTP, breathes.

function BaobabTree() {
  return (
    <svg
      viewBox="0 0 600 720"
      preserveAspectRatio="xMaxYMax meet"
      aria-hidden
      style={{
        position: 'absolute',
        right: '-8%',
        bottom: '-6%',
        height: '92%',
        width: 'auto',
        color: 'var(--accent)',
        opacity: 0.18,
        pointerEvents: 'none',
        transformOrigin: '70% 80%',
        animation: 'baobab-tree-breathe 9s ease-in-out infinite',
      }}
    >
      {/* Earth horizon — barely there */}
      <line x1="0" y1="700" x2="600" y2="700" stroke="currentColor" strokeWidth="1" opacity="0.5" />

      {/* Trunk — swollen baobab body */}
      <path
        d="M 250 700 C 240 620, 220 540, 215 460
           C 212 400, 218 360, 230 320
           C 245 280, 270 260, 300 260
           C 332 260, 358 282, 372 320
           C 384 360, 388 400, 384 460
           C 380 540, 360 620, 350 700 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />

      {/* Inner trunk fissures */}
      <path d="M 270 660 C 268 580, 270 500, 278 430" fill="none" stroke="currentColor" strokeWidth="1.1" opacity="0.6" />
      <path d="M 326 660 C 328 580, 326 500, 320 430" fill="none" stroke="currentColor" strokeWidth="1.1" opacity="0.6" />

      {/* Crown branches — sparse, fractal, upside-down reach */}
      <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <path d="M 270 270 C 240 240, 200 220, 150 210" />
        <path d="M 150 210 C 130 205, 105 205, 80 215" />
        <path d="M 110 208 C 95 195, 82 188, 68 188" />
        <path d="M 130 210 C 122 195, 118 185, 116 175" />
        <path d="M 90 210 C 85 200, 82 192, 78 184" />

        <path d="M 285 268 C 270 232, 252 198, 232 168" />
        <path d="M 232 168 C 222 158, 210 152, 198 152" />
        <path d="M 250 168 C 245 158, 240 150, 232 144" />
        <path d="M 220 158 C 215 150, 210 144, 204 140" />

        <path d="M 300 260 C 300 220, 298 180, 296 142" />
        <path d="M 296 142 C 292 132, 286 124, 280 120" />
        <path d="M 296 142 C 300 132, 306 124, 312 120" />

        <path d="M 318 268 C 332 232, 350 198, 372 168" />
        <path d="M 372 168 C 384 158, 396 152, 408 152" />
        <path d="M 354 168 C 360 158, 366 150, 374 144" />
        <path d="M 384 158 C 390 150, 396 144, 402 140" />

        <path d="M 332 270 C 364 240, 408 222, 460 214" />
        <path d="M 460 214 C 484 210, 510 212, 532 220" />
        <path d="M 500 216 C 514 204, 528 196, 542 194" />
        <path d="M 478 213 C 488 200, 494 190, 498 180" />
        <path d="M 520 220 C 526 210, 532 202, 538 196" />
      </g>
    </svg>
  )
}

// ── Custom 24×24 line-art icons ───────────────────────────────────────────

function IconSummarize() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden>
      <path d="M5 5 H19 M5 9 H19 M5 13 H14 M5 17 H11" />
    </svg>
  )
}
function IconTranslate() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 7 H12 M8 4 V7 M5 11 C5 11, 6 16, 8 16 S11 11, 11 11 M14 19 L17 11 L20 19 M15.2 16 H18.8" />
    </svg>
  )
}
function IconResearch() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden>
      <circle cx="10.5" cy="10.5" r="5.5" />
      <path d="M14.5 14.5 L20 20" />
      <path d="M8 10.5 H13" />
    </svg>
  )
}
function IconCompare() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="5" width="7" height="14" rx="1" />
      <rect x="14" y="5" width="7" height="14" rx="1" />
      <path d="M6 9 H8 M6 12 H8 M17 9 H19 M17 12 H19 M17 15 H19" />
    </svg>
  )
}
function IconCode() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M8 7 L3 12 L8 17 M16 7 L21 12 L16 17 M13.5 6 L10.5 18" />
    </svg>
  )
}
function IconCivic() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3 L4 7 V12 C4 16, 8 19, 12 21 C16 19, 20 16, 20 12 V7 Z" />
      <path d="M9 12 L11.5 14.5 L15.5 10.5" />
    </svg>
  )
}

// ── Sovereignty leaf (Home/Roaming indicator) ─────────────────────────────

function LeafGlyph({ pulsing }: { pulsing: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      aria-hidden
      style={
        pulsing
          ? { animation: 'baobab-leaf-pulse 2.4s ease-in-out infinite', color: 'var(--sovereignty-ok)' }
          : { color: 'var(--sovereignty-warn)' }
      }
    >
      <path
        d="M 6 1 C 9 2, 11 4.5, 11 7 C 11 9.5, 9 11, 6 11 C 3 11, 1 9.5, 1 7 C 1 4.5, 3 2, 6 1 Z"
        fill="currentColor"
        opacity="0.85"
      />
      <path d="M 6 2 V 10" stroke="var(--canvas)" strokeWidth="0.8" opacity="0.4" />
    </svg>
  )
}

// ── Capability card ──────────────────────────────────────────────────────

interface Capability {
  id: string
  eyebrow: string
  title: string
  body: string
  icon: ReactNode
  starter: string
}

const CAPABILITIES: Capability[] = [
  { id: 'summarize', eyebrow: 'AI · READING',  title: 'Summarize',    body: 'Give me the gist of any page.',                              icon: <IconSummarize />, starter: 'Paste a link or open a page — I\'ll give you the gist plus the points that matter.' },
  { id: 'translate', eyebrow: 'AI · LANGUAGE', title: 'Translate',    body: 'Across Yoruba, Swahili, Hausa — and growing.',               icon: <IconTranslate />, starter: 'Tell me what to translate and into which language — Yoruba, Swahili, Hausa, Amharic, and more.' },
  { id: 'research',  eyebrow: 'AI · SEARCH',   title: 'Research',     body: 'Compare sources, African ones lifted first.',                icon: <IconResearch />, starter: 'What are you researching? I\'ll cross-reference sources and lift African ones to the top.' },
  { id: 'compare',   eyebrow: 'AI · DECIDE',   title: 'Compare',      body: 'Lay options side by side.',                                  icon: <IconCompare />, starter: 'List the options you\'re weighing — I\'ll lay them side by side on the dimensions that matter.' },
  { id: 'code',      eyebrow: 'AI · MAKER',    title: 'Explain Code', body: 'Read or debug a code block out loud.',                       icon: <IconCode />, starter: 'Paste a code block — I\'ll read it out loud, explain what it does, and flag anything suspicious.' },
  { id: 'civic',     eyebrow: 'NEAR HOME',     title: 'Civic',        body: 'Bills, courts, regional policy — kept close.',               icon: <IconCivic />, starter: 'Ask about a bill, a court ruling, or regional policy — I\'ll pull it close to home.' },
]

function newMsgId(): string {
  return `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

function CapabilityCard({ c, index }: { c: Capability; index: number }) {
  const [hover, setHover] = useState(false)
  const toggleSidebar = useAiStore((s) => s.toggleSidebar)
  const sidebarOpen = useAiStore((s) => s.sidebarOpen)
  const setActive = useAiStore((s) => s.setActive)
  const pushMessage = useAiStore((s) => s.pushMessage)

  const onActivate = () => {
    if (!sidebarOpen) toggleSidebar()
    const convId = `c${Date.now().toString(36)}`
    setActive(convId)
    pushMessage(convId, { id: newMsgId(), role: 'assistant', content: c.starter })
  }

  return (
    <button
      type="button"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
      onClick={onActivate}
      style={{
        position: 'relative',
        textAlign: 'left',
        padding: '20px 22px',
        background: 'rgba(28, 24, 20, 0.55)',
        border: '1px solid var(--border)',
        borderTopColor: hover ? 'var(--accent-light)' : 'var(--border)',
        borderLeftColor: hover ? 'var(--accent-light)' : 'var(--border)',
        borderRadius: 14,
        color: 'var(--text-primary)',
        cursor: 'pointer',
        transition:
          'transform 220ms cubic-bezier(0.16, 1, 0.3, 1), border-color 220ms ease, ' +
          'box-shadow 220ms ease, background 220ms ease',
        transform: hover ? 'translateY(-2px)' : 'translateY(0)',
        boxShadow: hover
          ? '0 12px 32px -16px rgba(217, 119, 6, 0.4), 0 1px 0 rgba(255,255,255,0.05) inset'
          : '0 1px 0 rgba(255,255,255,0.03) inset',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        overflow: 'hidden',
        opacity: 0,
        animation: 'baobab-fade-in-up 520ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
        animationDelay: `${640 + index * 70}ms`,
      }}
    >
      {/* Icon container */}
      <div
        style={{
          width: 40, height: 40, borderRadius: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: hover ? 'var(--accent-dim)' : 'var(--surface-2)',
          color: hover ? 'var(--accent-light)' : 'var(--text-secondary)',
          transition: 'background 220ms ease, color 220ms ease',
          marginBottom: 14,
        }}
      >
        {c.icon}
      </div>

      {/* Eyebrow — editorial italic all-caps */}
      <div
        style={{
          fontFamily: 'var(--font-default)',
          fontStyle: 'italic',
          fontSize: 10,
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color: 'var(--text-muted)',
          marginBottom: 6,
        }}
      >
        {c.eyebrow}
      </div>

      {/* Title — Fraunces serif, characterful */}
      <div
        style={{
          fontFamily: 'var(--font-default)',
          fontVariationSettings: '"SOFT" 50, "opsz" 32, "wght" 500',
          fontSize: 22,
          lineHeight: 1.1,
          letterSpacing: '-0.01em',
          color: 'var(--text-primary)',
          marginBottom: 6,
        }}
      >
        {c.title}
      </div>

      {/* Body */}
      <div style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--text-secondary)' }}>
        {c.body}
      </div>

      {/* Hover arrow */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          right: 16,
          bottom: 14,
          color: 'var(--accent-light)',
          opacity: hover ? 1 : 0,
          transform: hover ? 'translateX(0)' : 'translateX(-6px)',
          transition: 'opacity 220ms ease, transform 220ms ease',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <path d="M3 8 H13 M9 4 L13 8 L9 12" />
        </svg>
      </div>
    </button>
  )
}

// ── Main NTP component ────────────────────────────────────────────────────

export function NewTabPage() {
  const greeting = useMemo(getGreeting, [])
  const residency = useSovereigntyStore((s) => s.residency)
  const user = useAuthStore((s) => s.user)
  const tabs = useTabsStore((s) => s.tabs)

  // Refresh greeting once a minute (in case user lingers past the hour).
  const [, setTick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 60_000)
    return () => clearInterval(t)
  }, [])

  const isHome = residency.region === 'africa'
  const residencyLabel =
    residency.region === 'unknown'
      ? 'Reaching the edge…'
      : isHome
        ? `Served from ${residency.colo} · ${strings.residency.home}`
        : `Served from ${residency.colo} · ${strings.residency.roaming}`

  const greetingFull = user?.display_name
    ? `${greeting}, ${user.display_name}.`
    : `${greeting}, friend.`

  // Editorial signature
  const issueNumber = String(Math.max(1, tabs.length || 1)).padStart(3, '0')
  const issueLocation = residency.colo === 'unknown' ? 'The Edge' : residency.colo

  return (
    <div
      style={{
        position: 'relative',
        height: '100%',
        width: '100%',
        overflow: 'hidden',
        color: 'var(--text-primary)',
        background:
          'radial-gradient(120% 80% at 88% 18%, rgba(217, 119, 6, 0.12) 0%, rgba(217, 119, 6, 0.04) 28%, rgba(0,0,0,0) 65%), ' +
          'radial-gradient(80% 60% at 10% 92%, rgba(20, 14, 8, 0.55) 0%, rgba(0,0,0,0) 60%), ' +
          'linear-gradient(180deg, var(--canvas) 0%, #110d09 100%)',
      }}
    >
      {/* Film-grain noise — gives the canvas tooth */}
      <div
        aria-hidden
        style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          opacity: 0.06, mixBlendMode: 'overlay',
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.5 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
        }}
      />

      {/* Baobab tree silhouette — bottom-right, breathing.
          Pinned outside the scroll container so it doesn't drift away
          when the user scrolls. */}
      <BaobabTree />

      {/* Scroll container — content scrolls inside this layer while the
          gradient, grain, and tree above remain fixed to the viewport. */}
      <div
        className="baobab-scroll"
        style={{
          position: 'absolute',
          inset: 0,
          overflowY: 'auto',
          overflowX: 'hidden',
        }}
      >
        {/* Content stack */}
        <div
          style={{
            position: 'relative',
            minHeight: '100%',
            padding: '56px clamp(40px, 6vw, 88px) 88px',
            display: 'flex',
            flexDirection: 'column',
            maxWidth: 1200,
            boxSizing: 'border-box',
          }}
        >
        {/* Greeting */}
        <div
          style={{
            fontFamily: 'var(--font-default)',
            fontStyle: 'italic',
            fontVariationSettings: '"SOFT" 40, "opsz" 9, "wght" 400',
            fontSize: 13,
            letterSpacing: '0.24em',
            textTransform: 'uppercase',
            color: 'var(--text-muted)',
            opacity: 0,
            animation: 'baobab-fade-in 600ms ease forwards',
            animationDelay: '60ms',
          }}
        >
          {greetingFull}
        </div>

        {/* Hero wordmark — Fraunces variable-axes serif with gradient sweep.
            Kept on Fraunces only because the gradient relies on the SOFT
            and opsz axes; the rest of the UI is Bookman by default. */}
        <h1
          style={{
            margin: '14px 0 0 0',
            fontFamily: 'var(--font-display)',
            fontVariationSettings: '"SOFT" 100, "opsz" 144, "wght" 600',
            fontSize: 'clamp(72px, 11vw, 156px)',
            lineHeight: 0.92,
            letterSpacing: '-0.045em',
            backgroundImage:
              'linear-gradient(108deg, var(--text-primary) 0%, var(--text-primary) 55%, var(--accent-light) 92%)',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            color: 'transparent',
            opacity: 0,
            animation: 'baobab-fade-in-up 760ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
            animationDelay: '140ms',
          }}
        >
          Baobab
        </h1>

        {/* Tagline — editorial italic */}
        <p
          style={{
            margin: '12px 0 0 0',
            fontFamily: 'var(--font-default)',
            fontStyle: 'italic',
            fontVariationSettings: '"SOFT" 60, "opsz" 18, "wght" 400',
            fontSize: 'clamp(16px, 1.55vw, 22px)',
            letterSpacing: '0.005em',
            color: 'var(--text-secondary)',
            maxWidth: 540,
            opacity: 0,
            animation: 'baobab-fade-in-up 700ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
            animationDelay: '300ms',
          }}
        >
          The browser that{' '}
          <span style={{ color: 'var(--accent-light)', fontStyle: 'normal' }}>grew here.</span>
        </p>

        {/* Hairline rule — draws in from left */}
        <div
          aria-hidden
          style={{
            margin: '34px 0 22px 0',
            height: 1,
            width: '100%',
            maxWidth: 740,
            background:
              'linear-gradient(90deg, var(--border-accent) 0%, var(--border) 65%, transparent 100%)',
            transformOrigin: 'left center',
            transform: 'scaleX(0)',
            animation: 'baobab-draw-rule 820ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
            animationDelay: '480ms',
          }}
        />

        {/* Residency badge */}
        <div
          style={{
            display: 'inline-flex',
            alignSelf: 'flex-start',
            alignItems: 'center',
            gap: 8,
            padding: '6px 12px 6px 10px',
            borderRadius: 999,
            border: '1px solid var(--border)',
            background: 'rgba(28, 24, 20, 0.6)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            color: 'var(--text-secondary)',
            fontSize: 11.5,
            letterSpacing: '0.04em',
            opacity: 0,
            animation: 'baobab-fade-in 600ms ease forwards',
            animationDelay: '540ms',
          }}
        >
          <LeafGlyph pulsing={isHome} />
          <span style={{ fontFamily: 'var(--font-default)' }}>{residencyLabel}</span>
        </div>

        {/* Spacer pushes cards toward middle/bottom */}
        <div style={{ flex: '1 0 24px' }} />

        {/* Capability grid — magazine layout */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
            gap: 14,
            maxWidth: 1000,
          }}
        >
          {CAPABILITIES.map((c, i) => (
            <CapabilityCard key={c.id} c={c} index={i} />
          ))}
        </div>
        </div>
      </div>

      {/* Editorial signature — pinned to viewport, outside scroll layer. */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          right: 'clamp(40px, 6vw, 88px)',
          bottom: 22,
          fontFamily: '"Fraunces", serif',
          fontStyle: 'italic',
          fontSize: 10.5,
          letterSpacing: '0.32em',
          textTransform: 'uppercase',
          color: 'var(--text-muted)',
          opacity: 0,
          animation: 'baobab-fade-in 700ms ease forwards',
          animationDelay: '900ms',
          pointerEvents: 'none',
        }}
      >
        Issue {issueNumber} · {issueLocation}
      </div>
    </div>
  )
}
