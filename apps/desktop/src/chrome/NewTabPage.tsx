import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { strings } from '@baobab/brand'
import { useSovereigntyStore } from '~/state/sovereignty.store'
import { useAuthStore } from '~/auth/auth.store'
import { useAiStore } from '~/ai/ai.store'
import { useTabsStore } from '~/state/tabs.store'
import { useDigestStore } from '~/digest/digest.store'
import { DigestStrip } from '~/digest/DigestStrip'

// ── Time-aware greeting ───────────────────────────────────────────────────

type GreetingSlot = 'lateNight' | 'morning' | 'afternoon' | 'evening' | 'lamplight'

function getGreetingSlot(): GreetingSlot {
  const h = new Date().getHours()
  if (h < 5)  return 'lateNight'
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  if (h < 21) return 'evening'
  return 'lamplight'
}

// ── Sun-ray fan (top-right) ───────────────────────────────────────────────
// Soft painterly rays radiating from the top-right corner — adds tooth to
// the otherwise-flat sky band without making the page busy. Very low
// opacity; reads as light, not as illustration.

function SunRays() {
  return (
    <svg
      viewBox="0 0 800 500"
      preserveAspectRatio="xMaxYMin slice"
      aria-hidden
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        width: '70%',
        height: '60%',
        pointerEvents: 'none',
        opacity: 0.55,
        mixBlendMode: 'screen',
      }}
    >
      <defs>
        <radialGradient id="sun-core" cx="78%" cy="14%" r="35%">
          <stop offset="0%" stopColor="#FDE68A" stopOpacity="0.85" />
          <stop offset="20%" stopColor="#FBBF24" stopOpacity="0.45" />
          <stop offset="55%" stopColor="#D97706" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#92400E" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="ray" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FBBF24" stopOpacity="0.45" />
          <stop offset="60%" stopColor="#D97706" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#92400E" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Sun core glow */}
      <circle cx="624" cy="70" r="180" fill="url(#sun-core)" />
      {/* Sun rays — sparse, fan-shaped */}
      <g fill="url(#ray)" opacity="0.6">
        <path d="M 624 70 L 280 320 L 250 360 Z" />
        <path d="M 624 70 L 360 380 L 330 420 Z" />
        <path d="M 624 70 L 440 440 L 410 480 Z" />
        <path d="M 624 70 L 520 480 L 500 500 Z" />
        <path d="M 624 70 L 200 240 L 180 260 Z" />
        <path d="M 624 70 L 120 180 L 100 200 Z" />
      </g>
    </svg>
  )
}

// ── Sankofa watermark (Adinkra symbol) ────────────────────────────────────
// "Sankofa" — the bird that looks backward to retrieve what is good. A
// fitting watermark for "the browser that grew here." Stylized
// single-stroke composition, very low opacity, anchored mid-left so it
// balances the baobab tree on the right.

function SankofaWatermark() {
  return (
    <svg
      viewBox="0 0 200 200"
      aria-hidden
      style={{
        position: 'absolute',
        left: '-6%',
        top: '24%',
        height: '54%',
        width: 'auto',
        pointerEvents: 'none',
        opacity: 0.06,
        color: 'var(--accent-light)',
      }}
    >
      {/* Stylized Sankofa: a bird with its head turned 180° backward,
          holding an egg in its beak. Drawn as a single continuous shape
          to read as a glyph rather than an illustration. */}
      <path
        d="M 100 30
           C 130 30, 160 50, 165 85
           C 168 105, 160 125, 145 140
           L 155 150
           C 165 158, 170 170, 168 180
           L 155 178
           C 145 170, 135 162, 125 158
           C 115 155, 105 156, 100 160
           C 95 164, 95 172, 100 178
           C 105 184, 115 186, 125 184
           L 122 195
           C 110 198, 95 196, 85 188
           C 75 180, 70 168, 72 156
           C 75 138, 88 124, 105 118
           C 92 115, 80 105, 76 90
           C 72 70, 78 50, 92 38
           C 94 35, 97 32, 100 30 Z
           M 102 78
           C 110 78, 116 84, 116 92
           C 116 100, 110 106, 102 106
           C 94 106, 88 100, 88 92
           C 88 84, 94 78, 102 78 Z"
        fill="currentColor"
      />
    </svg>
  )
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
        opacity: 0.28,
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

type CapabilityId = 'summarize' | 'translate' | 'research' | 'compare' | 'code' | 'civic'

interface Capability {
  id: CapabilityId
  icon: ReactNode
}

const CAPABILITIES: Capability[] = [
  { id: 'summarize', icon: <IconSummarize /> },
  { id: 'translate', icon: <IconTranslate /> },
  { id: 'research',  icon: <IconResearch /> },
  { id: 'compare',   icon: <IconCompare /> },
  { id: 'code',      icon: <IconCode /> },
  { id: 'civic',     icon: <IconCivic /> },
]

function newMsgId(): string {
  return `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

function CapabilityCard({ c, index, t }: { c: Capability; index: number; t: TFunction }) {
  const [hover, setHover] = useState(false)
  const toggleSidebar = useAiStore((s) => s.toggleSidebar)
  const sidebarOpen = useAiStore((s) => s.sidebarOpen)
  const setActive = useAiStore((s) => s.setActive)
  const pushMessage = useAiStore((s) => s.pushMessage)

  const eyebrow = t(`ntp.capabilities.${c.id}.eyebrow`)
  const title = t(`ntp.capabilities.${c.id}.title`)
  const body = t(`ntp.capabilities.${c.id}.body`)
  const starter = t(`ntp.capabilities.${c.id}.starter`)

  const onActivate = () => {
    if (!sidebarOpen) toggleSidebar()
    const convId = `c${Date.now().toString(36)}`
    setActive(convId)
    pushMessage(convId, { id: newMsgId(), role: 'assistant', content: starter })
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
        {eyebrow}
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
        {title}
      </div>

      {/* Body */}
      <div style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--text-secondary)' }}>
        {body}
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
  const { t } = useTranslation()
  const greetingSlot = useMemo(getGreetingSlot, [])
  const residency = useSovereigntyStore((s) => s.residency)
  const user = useAuthStore((s) => s.user)
  const tabs = useTabsStore((s) => s.tabs)
  const activeId = useTabsStore((s) => s.activeId)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Refresh greeting once a minute (in case user lingers past the hour).
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 60_000)
    return () => clearInterval(id)
  }, [])

  // Defensive: reset scroll on every tab switch. The container has
  // overflowX:hidden which usually prevents horizontal scroll, but Edge/
  // WebView2 can carry a stale scrollLeft across remounts when the
  // active tab swaps. A stale scrollLeft would visually shift every
  // child to the left — exactly the symptom we hit when switching
  // between two about:blank tabs.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollLeft = 0
    el.scrollTop = 0
  }, [activeId])

  // Tree-walk diagnostic — climb up from the NewTabPage outer div and
  // print every ancestor's bounding rect + scrollLeft + transform. The
  // earlier readout showed the OFFSET was -380 at every NTP layer, so
  // the source is somewhere above NTP. This badge will reveal at which
  // ancestor `left` becomes -380.
  const [diag, setDiag] = useState<string>('')
  useEffect(() => {
    if (!import.meta.env.DEV) return
    function measure() {
      const ntp = scrollRef.current?.parentElement
      if (!ntp) return
      const lines: string[] = []
      lines.push(`window.scrollX=${Math.round(window.scrollX)} bodySL=${document.body.scrollLeft} htmlSL=${document.documentElement.scrollLeft}`)
      let el: HTMLElement | null = ntp
      let depth = 0
      while (el && depth < 12) {
        const r = el.getBoundingClientRect()
        const cs = getComputedStyle(el)
        const tag = el.tagName.toLowerCase()
        const cls = (el.className || '').toString().slice(0, 22)
        const tf = cs.transform === 'none' ? '' : ` tf:${cs.transform.slice(0, 32)}`
        lines.push(
          `${depth} ${tag}.${cls} ${Math.round(r.left)},${Math.round(r.top)} ` +
          `${Math.round(r.width)}x${Math.round(r.height)} sL=${el.scrollLeft}${tf}`,
        )
        el = el.parentElement
        depth++
      }
      setDiag(lines.join('\n'))
    }
    measure()
    const t = setTimeout(measure, 300)
    return () => clearTimeout(t)
  }, [activeId])


  // Kick off the Continent Today digest fetch on first mount. The store
  // guards against re-fetching once `loaded` is set, so re-mounts are cheap.
  useEffect(() => {
    const s = useDigestStore.getState()
    if (!s.loaded && !s.loading) void s.fetch()
  }, [])

  const greetingWord = t(`ntp.greeting.${greetingSlot}`)
  const isHome = residency.region === 'africa'
  const residencyLabel =
    residency.region === 'unknown'
      ? t('ntp.residency.reaching')
      : t('ntp.residency.served', {
          colo: residency.colo,
          label: isHome ? strings.residency.home : strings.residency.roaming,
        })

  const greetingFull = user?.display_name
    ? t('ntp.greetingFull', { greeting: greetingWord, name: user.display_name })
    : t('ntp.greetingAnon', { greeting: greetingWord })

  // Editorial signature
  const issueNumber = String(Math.max(1, tabs.length || 1)).padStart(3, '0')
  const issueLocation = residency.colo === 'unknown' ? t('ntp.issueLocationFallback') : residency.colo

  return (
    <div
      style={{
        // Absolute + inset:0 anchors the page to the canvas div's exact
        // bounds. Earlier we used position:relative; width:100%; height:100%,
        // which relied on the canvas div's content sizing being well-defined
        // for the block layout to fill it. On some renderings — switching
        // between two about:blank tabs in particular — that produced a
        // mysterious left shift. Pinning to absolute makes the placement
        // fully geometric and removes the ambiguity.
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        color: 'var(--text-primary)',
        // Sahel sunrise — warm throughout, not just at the top. The
        // previous gradient hit near-black by 70% and read as "thin
        // amber strip on a void." This redo keeps the whole canvas
        // saturated in dusk tones.
        background:
          // Sun halo (top-right) — bright amber
          'radial-gradient(70% 60% at 88% 10%, rgba(251, 191, 36, 0.45) 0%, rgba(217, 119, 6, 0.28) 22%, rgba(180, 83, 9, 0.12) 50%, rgba(0,0,0,0) 78%), ' +
          // Mid-canvas amber wash — warms the body
          'radial-gradient(140% 110% at 50% 55%, rgba(180, 83, 9, 0.32) 0%, rgba(140, 60, 20, 0.20) 30%, rgba(76, 29, 49, 0.08) 60%, rgba(0,0,0,0) 85%), ' +
          // Lower-left plum anchor — depth, not darkness
          'radial-gradient(90% 90% at 12% 88%, rgba(120, 35, 60, 0.42) 0%, rgba(76, 29, 49, 0.28) 35%, rgba(50, 22, 35, 0.10) 65%, rgba(0,0,0,0) 90%), ' +
          // Vertical base — warm coffee top, warm umber bottom (no near-black)
          'linear-gradient(180deg, #3A2614 0%, #4A2F18 22%, #3D2614 50%, #2E1C0F 78%, #251612 100%)',
      }}
    >
      {/* Sun-ray fan — soft painterly rays from the top-right corner.
          SVG with radial light cones at low opacity; gives the sky tooth. */}
      <SunRays />

      {/* Adinkra Sankofa watermark — "return and get it." The mythical
          backward-looking bird, fitting for "the browser that grew here."
          Very low opacity, large, anchored on the left to balance the
          baobab tree on the right. */}
      <SankofaWatermark />

      {/* Horizon band — a warm earth strip across the bottom,
          evoking the line where savannah meets sky at sunrise. */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: 96,
          pointerEvents: 'none',
          background:
            'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(120, 53, 15, 0.28) 40%, rgba(160, 70, 28, 0.42) 80%, rgba(180, 83, 9, 0.48) 100%)',
        }}
      />

      {/* Film-grain noise — gives the canvas tooth */}
      <div
        aria-hidden
        style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          opacity: 0.08, mixBlendMode: 'overlay',
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
        ref={scrollRef}
        className="baobab-scroll-hidden"
        style={{
          position: 'absolute',
          inset: 0,
          overflowY: 'auto',
          // `clip` (not `hidden`) prevents both manual AND programmatic
          // scrolling on the x-axis. With `hidden`, WebView2 can carry a
          // non-zero scrollLeft across remounts which visually shifts the
          // whole content stack to the left.
          overflowX: 'clip',
        }}
      >
        {/* Content stack */}
        <div
          style={{
            position: 'relative',
            minHeight: '100%',
            width: '100%',
            padding: '56px clamp(40px, 6vw, 88px) 88px',
            display: 'flex',
            flexDirection: 'column',
            maxWidth: 1200,
            margin: 0,
            transform: 'translate(0, 0)',
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
          {t('ntp.wordmark')}
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
          <Trans
            i18nKey="ntp.tagline"
            defaults="<0>The browser that </0><1>grew here.</1>"
            components={[
              <span key="prefix" />,
              <span key="accent" style={{ color: 'var(--accent-light)', fontStyle: 'normal' }} />,
            ]}
          />
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
            <CapabilityCard key={c.id} c={c} index={i} t={t} />
          ))}
        </div>

        {/* Continent Today digest — daily AI-summarized headlines from a
            curated set of African outlets. Renders below the capability grid
            so the hero+actions remain the focal point above the fold. */}
        <DigestStrip />
        </div>
      </div>

      {/* DEV tree-walk diagnostic — reveals which ancestor introduces the
          -380 offset. Click-through transparent. */}
      {import.meta.env.DEV && diag && (
        <pre
          aria-hidden
          style={{
            position: 'fixed',
            left: 8,
            bottom: 8,
            zIndex: 9999,
            margin: 0,
            padding: '6px 8px',
            background: 'rgba(0,0,0,0.78)',
            color: '#9be7a0',
            fontSize: 10,
            fontFamily: 'ui-monospace, Consolas, monospace',
            lineHeight: 1.35,
            borderRadius: 4,
            whiteSpace: 'pre',
            pointerEvents: 'none',
            maxWidth: '90vw',
            overflow: 'hidden',
          }}
        >{diag}</pre>
      )}

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
        {t('ntp.issue', { number: issueNumber, location: issueLocation })}
      </div>
    </div>
  )
}
