import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useTabsStore } from '~/state/tabs.store'
import { useSovereigntyStore } from '~/state/sovereignty.store'
import { OS } from '~/platform/os'
import { strings } from '@baobab/brand'
import { getCurrentWindow } from '@tauri-apps/api/window'
import type { Tab } from '@baobab/core'

const win = () => getCurrentWindow()

// Tab pills shrink with flex:1 1 0 down to TAB_MIN_WIDTH. Chrome's
// floor is ~32px (favicon-only). 60px leaves a sliver of title
// alongside the favicon; past that the strip horizontally scrolls.
const TAB_MIN_WIDTH = 60
const TAB_MAX_WIDTH = 220
const CHROME_BAR_HEIGHT = 38

// ── Window controls ──────────────────────────────────────────────────────
// macOS gets traffic-light style circles on the LEFT (red close, yellow
// minimize, green maximize). Windows/Linux get rectangular controls on
// the RIGHT. Tauri's `decorations: false` means we own this on every OS.

function MacControl({ kind, onClick }: { kind: 'close' | 'min' | 'max'; onClick: () => void }) {
  const [hover, setHover] = useState(false)
  const colors = {
    close: { bg: '#FF5F57', glyph: '#4D0000' },
    min: { bg: '#FEBC2E', glyph: '#5C3D00' },
    max: { bg: '#28C840', glyph: '#0B5D17' },
  }
  const c = colors[kind]
  return (
    <button
      type="button"
      aria-label={kind === 'close' ? 'Close' : kind === 'min' ? 'Minimize' : 'Maximize'}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: 12, height: 12, borderRadius: '50%',
        background: c.bg, border: 'none', cursor: 'pointer', padding: 0,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        color: hover ? c.glyph : 'transparent',
        transition: 'color 100ms ease',
      }}
    >
      <svg width="6.5" height="6.5" viewBox="0 0 8 8" aria-hidden>
        {kind === 'close' && <path d="M1.5 1.5 L6.5 6.5 M6.5 1.5 L1.5 6.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />}
        {kind === 'min' && <path d="M1.5 4 H6.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />}
        {kind === 'max' && <path d="M2 6 L6 2 M2 2 H6 V6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />}
      </svg>
    </button>
  )
}

const winCtrlBase: CSSProperties = {
  width: 46,
  height: CHROME_BAR_HEIGHT,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'transparent',
  border: 'none',
  color: 'var(--text-secondary)',
  cursor: 'pointer',
  outline: 'none',
  transition: 'background 120ms ease, color 120ms ease',
}

function WinControl({
  label,
  onClick,
  hoverBg = 'rgba(255,255,255,0.06)',
  hoverColor = 'var(--text-primary)',
  children,
}: {
  label: string
  onClick: () => void
  hoverBg?: string
  hoverColor?: string
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      style={winCtrlBase}
      onMouseEnter={(e) => {
        ;(e.currentTarget as HTMLButtonElement).style.background = hoverBg
        ;(e.currentTarget as HTMLButtonElement).style.color = hoverColor
      }}
      onMouseLeave={(e) => {
        ;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
        ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)'
      }}
    >
      {children}
    </button>
  )
}

// ── Residency chip — compact "Home/Roaming · Lagos" pill ─────────────────

function ResidencyChip() {
  const residency = useSovereigntyStore((s) => s.residency)
  const isHome = residency.region === 'africa'
  const label =
    residency.region === 'unknown'
      ? '—'
      : isHome
        ? strings.residency.home
        : strings.residency.roaming
  const tooltip = isHome ? strings.tooltips.home : strings.tooltips.roaming
  const dot = isHome ? 'var(--sovereignty-ok)' : 'var(--sovereignty-warn)'
  return (
    <span
      title={tooltip}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        height: 22,
        paddingInline: 10,
        borderRadius: 999,
        border: '1px solid var(--border)',
        background: 'rgba(28, 24, 20, 0.55)',
        fontSize: 11,
        color: 'var(--text-secondary)',
        whiteSpace: 'nowrap',
      }}
    >
      <span aria-hidden style={{ width: 6, height: 6, borderRadius: '50%', background: dot }} />
      <span>{label}{residency.colo !== 'unknown' && ` · ${residency.colo}`}</span>
    </span>
  )
}

// ── Tab pill ─────────────────────────────────────────────────────────────

// Mask glyph — a theatre/incognito mask. Used both in the tab pill and on the
// "New private tab" button. Real inline SVG (no emoji).
function MaskGlyph({ size = 12 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      aria-hidden
      style={{ flexShrink: 0 }}
    >
      <path
        d="M2 6 Q2 5 3 5 L13 5 Q14 5 14 6 L13.5 9 Q13 11 11 11 Q9.5 11 8.8 9.6 Q8.4 9 8 9 Q7.6 9 7.2 9.6 Q6.5 11 5 11 Q3 11 2.5 9 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <circle cx="5.2" cy="7.6" r="0.9" fill="currentColor" />
      <circle cx="10.8" cy="7.6" r="0.9" fill="currentColor" />
    </svg>
  )
}

function TabPill({ tab, active, onSelect, onClose }: {
  tab: Tab
  active: boolean
  onSelect: () => void
  onClose: () => void
}) {
  const [hover, setHover] = useState(false)
  const incognito = tab.incognito === true
  const inactiveBg = incognito
    ? (hover ? 'rgba(0, 0, 0, 0.22)' : 'rgba(0, 0, 0, 0.15)')
    : (hover ? 'rgba(255,255,255,0.04)' : 'transparent')
  const inactiveColor = incognito ? 'var(--text-muted)' : 'var(--text-secondary)'
  const label = tab.title || (tab.url === 'about:blank' ? 'New Tab' : tab.url)
  // Browser tabs are NOT WAI-ARIA tabs (they don't switch panels within the
  // page) — they're a list of switchable presentations. Modelling them as
  // <button> children of a <div role="list"> avoids the nested-interactive
  // violation that the previous role="tab"/role="tablist" structure caused
  // (close button nested inside a focusable role="tab" container).
  return (
    <div
      role="listitem"
      data-tab-id={tab.id}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        height: 30,
        minWidth: TAB_MIN_WIDTH,
        maxWidth: TAB_MAX_WIDTH,
        flex: '1 1 0',
        display: 'flex',
        alignItems: 'center',
        gap: 0,
        background: active
          ? (incognito ? 'rgba(0, 0, 0, 0.28)' : 'var(--canvas)')
          : inactiveBg,
        borderTop: active ? '2px solid var(--accent)' : '2px solid transparent',
        borderRadius: '8px 8px 4px 4px',
        color: active ? 'var(--text-primary)' : inactiveColor,
        fontSize: 12,
        userSelect: 'none',
        overflow: 'hidden',
        position: 'relative',
        transition: 'background 140ms ease, color 140ms ease',
      }}
      title={incognito ? `${tab.url} — private` : tab.url}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-label={`Switch to tab: ${label}${incognito ? ' (private)' : ''}`}
        aria-current={active ? 'page' : undefined}
        style={{
          flex: 1,
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          paddingInline: '12px 6px',
          background: 'transparent',
          border: 'none',
          color: 'inherit',
          cursor: 'pointer',
          font: 'inherit',
          textAlign: 'left',
          overflow: 'hidden',
        }}
      >
        {incognito && (
          <span
            aria-hidden
            style={{
              display: 'inline-flex',
              color: 'var(--text-muted)',
              flexShrink: 0,
            }}
          >
            <MaskGlyph size={12} />
          </span>
        )}
        {tab.pinned && <span aria-hidden style={{ color: 'var(--accent)', fontSize: 8 }}>●</span>}
        {/* Favicon — render only for real navigations. about:blank tabs
            keep their "New Tab" label and skip the icon entirely. Engines
            return a stale or 404 image for ~5% of hosts, so onError hides
            the broken-image glyph rather than letting it bleed through. */}
        {tab.faviconUrl && tab.url !== 'about:blank' && (
          <img
            src={tab.faviconUrl}
            alt=""
            width={16}
            height={16}
            loading="lazy"
            decoding="async"
            onError={(e) => {
              ;(e.currentTarget as HTMLImageElement).style.display = 'none'
            }}
            style={{
              width: 16,
              height: 16,
              flexShrink: 0,
              borderRadius: 2,
              objectFit: 'contain',
            }}
          />
        )}
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
          {label}
        </span>
      </button>
      <button
        type="button"
        aria-label={`Close tab: ${label}`}
        onClick={(e) => { e.stopPropagation(); onClose() }}
        style={{
          marginRight: 6,
          background: 'transparent',
          border: 'none',
          color: 'inherit',
          cursor: 'pointer',
          opacity: hover || active ? 0.7 : 0,
          transition: 'opacity 120ms ease, background 120ms ease',
          padding: 2,
          lineHeight: 1,
          borderRadius: 4,
          width: 16,
          height: 16,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.1)' }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
      >
        <svg width="9" height="9" viewBox="0 0 9 9" aria-hidden>
          <path d="M1.5 1.5 L7.5 7.5 M7.5 1.5 L1.5 7.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  )
}

// ── Tab bar (chrome bar) ─────────────────────────────────────────────────

export function TabStrip() {
  const tabs = useTabsStore((s) => s.tabs)
  const activeId = useTabsStore((s) => s.activeId)
  const setActive = useTabsStore((s) => s.setActive)
  const closeTab = useTabsStore((s) => s.closeTab)
  const openTab = useTabsStore((s) => s.openTab)
  const openIncognitoTab = useTabsStore((s) => s.openIncognitoTab)
  const incognitoShortcut = OS === 'macos' ? 'Cmd+Shift+N' : 'Ctrl+Shift+N'

  const isMac = OS === 'macos'

  // When the active tab changes (Ctrl+1..9, click on a partially-visible
  // tab, new tab created with the strip overflowed), bring it into view
  // so the user doesn't lose track of it.
  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!activeId || !scrollRef.current) return
    const el = scrollRef.current.querySelector<HTMLElement>(`[data-tab-id="${CSS.escape(activeId)}"]`)
    // jsdom doesn't implement scrollIntoView; guard so unit tests don't blow up.
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' })
    }
  }, [activeId, tabs.length])

  return (
    <header
      data-tauri-drag-region
      aria-label="Tab bar"
      style={{
        height: CHROME_BAR_HEIGHT,
        display: 'flex',
        alignItems: 'center',
        background: 'var(--surface-1)',
        borderBottom: '1px solid var(--border)',
        userSelect: 'none',
        position: 'relative',
      }}
    >
      {/* Left: drag region (or macOS traffic lights) */}
      {isMac ? (
        <div
          data-tauri-drag-region
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            paddingInline: '12px 14px',
            height: '100%',
          }}
        >
          <MacControl kind="close" onClick={() => void win().close()} />
          <MacControl kind="min" onClick={() => void win().minimize()} />
          <MacControl kind="max" onClick={() => void win().toggleMaximize()} />
        </div>
      ) : (
        <div data-tauri-drag-region style={{ width: 12, height: '100%' }} />
      )}

      {/* Tabs scroll zone — only the tab pills can scroll horizontally.
          The new-tab + private-tab buttons sit OUTSIDE so they're always
          reachable even when many tabs overflow the strip. */}
      <div
        ref={scrollRef}
        className="baobab-scroll-hidden"
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          height: '100%',
          flex: '1 1 0',
          minWidth: 0,
          paddingInline: 4,
          overflowX: 'auto',
          overflowY: 'hidden',
        }}
      >
        <div
          role="list"
          aria-label="Open tabs"
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: 2,
            height: '100%',
          }}
        >
          {tabs.map((t) => (
            <TabPill
              key={t.id}
              tab={t}
              active={t.id === activeId}
              onSelect={() => setActive(t.id)}
              onClose={() => void closeTab(t.id)}
            />
          ))}
        </div>
      </div>

      {/* Fixed-zone buttons + drag region — always visible. */}
      <div style={{ display: 'inline-flex', alignItems: 'flex-end', height: '100%', gap: 2, paddingInline: 4, flexShrink: 0 }}>
        <button
          type="button"
          onClick={() => void openTab('about:blank')}
          aria-label="New tab"
          title="New tab"
          style={{
            height: 28,
            width: 28,
            background: 'transparent',
            border: 'none',
            borderRadius: 6,
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            fontSize: 18,
            lineHeight: 1,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background 120ms ease, color 120ms ease',
          }}
          onMouseEnter={(e) => {
            ;(e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.06)'
            ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)'
          }}
          onMouseLeave={(e) => {
            ;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
            ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)'
          }}
        >
          +
        </button>
        <button
          type="button"
          onClick={() => void openIncognitoTab('about:blank')}
          aria-label="New private tab"
          title={`New private tab (${incognitoShortcut})`}
          style={{
            height: 28,
            width: 28,
            background: 'transparent',
            border: 'none',
            borderRadius: 6,
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background 120ms ease, color 120ms ease',
          }}
          onMouseEnter={(e) => {
            ;(e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.06)'
            ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)'
          }}
          onMouseLeave={(e) => {
            ;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
            ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)'
          }}
        >
          <MaskGlyph size={14} />
        </button>
      </div>
      <div data-tauri-drag-region style={{ flex: '1 0 16px', minWidth: 16, height: '100%' }} />

      {/* Right: residency chip + window controls (Windows/Linux) */}
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, paddingInline: isMac ? '0 12px' : '0 0', height: '100%' }}>
        <ResidencyChip />
        {!isMac && (
          <div style={{ display: 'inline-flex', height: '100%' }} aria-label="Window controls">
            <WinControl label="Minimize" onClick={() => void win().minimize()}>
              <svg width="11" height="11" viewBox="0 0 11 11" aria-hidden>
                <line x1="1.5" y1="5.5" x2="9.5" y2="5.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
              </svg>
            </WinControl>
            <WinControl label="Maximize" onClick={() => void win().toggleMaximize()}>
              <svg width="10" height="10" viewBox="0 0 11 11" aria-hidden>
                <rect x="1.5" y="1.5" width="8" height="8" fill="none" stroke="currentColor" strokeWidth="1.1" />
              </svg>
            </WinControl>
            <WinControl
              label="Close"
              onClick={() => void win().close()}
              hoverBg="rgba(185, 28, 28, 0.85)"
              hoverColor="#fff"
            >
              <svg width="11" height="11" viewBox="0 0 11 11" aria-hidden>
                <path d="M1.6 1.6 L9.4 9.4 M9.4 1.6 L1.6 9.4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
            </WinControl>
          </div>
        )}
      </div>
    </header>
  )
}
