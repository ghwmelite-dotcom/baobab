import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { parseOmnibarInput } from '@baobab/core'
import type { HistoryItem } from '@baobab/cloud-client'
import { useTabsStore } from '~/state/tabs.store'
import { OS } from '~/platform/os'
import { aiClient } from '~/ai/api'
import { useAiStore } from '~/ai/ai.store'
import { useReaderStore } from '~/reader/reader.store'
import { useHistoryStore } from '~/history/history.store'
import { useOfflineStore } from '~/offline/offline.store'
import { useBookmarksStore } from '~/bookmarks/bookmarks.store'
import { useDownloadsStore } from '~/downloads/downloads.store'
import { suggest } from '~/history/omnibar-autocomplete'
import { BookmarkButton } from '~/bookmarks/BookmarkButton'
import { useAuthStore } from '~/auth/auth.store'

// XSS / local-FS exfiltration guard for omnibar-initiated navigation.
const NAVIGATION_SCHEME_ALLOWLIST = new Set(['http:', 'https:', 'about:'])

function isNavigableUrl(url: string): boolean {
  try {
    return NAVIGATION_SCHEME_ALLOWLIST.has(new URL(url).protocol)
  } catch {
    return false
  }
}

function newMsgId(): string {
  return `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

// ── Generic icon button used in the address bar action area ──────────────

function NavBtn({ label, onClick, disabled, active, children, danger, badge }: {
  label: string
  onClick: () => void
  disabled?: boolean
  active?: boolean
  danger?: boolean
  badge?: boolean
  children: ReactNode
}) {
  const [hover, setHover] = useState(false)
  const baseColor: string = active ? 'var(--accent-light)' : 'var(--text-secondary)'
  const hoverColor: string = danger ? '#fff' : 'var(--text-primary)'
  const bg: string = disabled
    ? 'transparent'
    : active
      ? 'var(--accent-dim)'
      : hover
        ? (danger ? 'rgba(185, 28, 28, 0.85)' : 'rgba(255,255,255,0.06)')
        : 'transparent'
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      title={label}
      onClick={disabled ? undefined : onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      disabled={disabled}
      style={{
        position: 'relative',
        width: 32,
        height: 32,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: bg,
        border: 'none',
        borderRadius: 8,
        color: disabled ? 'var(--text-muted)' : (hover ? hoverColor : baseColor),
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        transition: 'background 140ms ease, color 140ms ease',
      }}
    >
      {children}
      {badge && (
        <span
          aria-hidden
          style={{
            position: 'absolute',
            top: 6,
            right: 6,
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: 'var(--accent)',
            boxShadow: '0 0 0 2px var(--surface-1)',
          }}
        />
      )}
    </button>
  )
}

// ── Address bar ──────────────────────────────────────────────────────────

export function Omnibar() {
  const { t } = useTranslation()
  const ref = useRef<HTMLInputElement | null>(null)
  const activeId = useTabsStore((s) => s.activeId)
  const tabs = useTabsStore((s) => s.tabs)
  const navigate = useTabsStore((s) => s.navigate)
  const openTab = useTabsStore((s) => s.openTab)
  const goBack = useTabsStore((s) => s.goBack)
  const goForward = useTabsStore((s) => s.goForward)
  const historyCursor = useTabsStore((s) => (s.activeId ? s.history[s.activeId] : undefined))
  const canGoBack = (historyCursor?.depth ?? 0) > 0
  const canGoForward = !!historyCursor && historyCursor.depth < historyCursor.max
  const setActive = useAiStore((s) => s.setActive)
  const pushMessage = useAiStore((s) => s.pushMessage)
  const sidebarOpen = useAiStore((s) => s.sidebarOpen)
  const toggleSidebar = useAiStore((s) => s.toggleSidebar)
  const openReader = useReaderStore((s) => s.openFor)
  const toggleHistory = useHistoryStore((s) => s.toggle)
  const toggleSaved = useOfflineStore((s) => s.toggle)
  const toggleBookmarks = useBookmarksStore((s) => s.toggle)
  const toggleDownloads = useDownloadsStore((s) => s.toggle)
  const activeDownloads = useDownloadsStore(
    (s) => s.downloads.filter((d) => d.status === 'in-progress').length,
  )

  const activeTab = tabs.find((t) => t.id === activeId)
  const [value, setValue] = useState(activeTab?.url ?? '')
  const [suggestions, setSuggestions] = useState<HistoryItem[]>([])
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    setValue(activeTab?.url === 'about:blank' ? '' : (activeTab?.url ?? ''))
  }, [activeTab?.url])

  useEffect(() => {
    if (!focused) { setSuggestions([]); return }
    const t = setTimeout(() => { void suggest(value, 6).then(setSuggestions) }, 150)
    return () => clearTimeout(t)
  }, [value, focused])

  // Ctrl/Cmd + L focuses
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = OS === 'macos' ? e.metaKey : e.ctrlKey
      if (mod && e.key.toLowerCase() === 'l') {
        e.preventDefault()
        ref.current?.focus()
        ref.current?.select()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const runAiSearch = async (query: string) => {
    if (!useAuthStore.getState().user) {
      useAuthStore.getState().openSignIn()
      return
    }
    if (!useAiStore.getState().sidebarOpen) useAiStore.getState().toggleSidebar()
    const convId = `c${Date.now().toString(36)}`
    setActive(convId)
    pushMessage(convId, { id: newMsgId(), role: 'user', content: query })
    pushMessage(convId, { id: newMsgId(), role: 'assistant', content: t('omnibar.searchingContinent') })
    try {
      const r = await aiClient.search({ query })
      const list = r.results.map((x) => `• [${x.title}](${x.url})`).join('\n')
      pushMessage(convId, { id: newMsgId(), role: 'assistant', content: `${r.answer}\n\n${list}` })
    } catch (e) {
      pushMessage(convId, {
        id: newMsgId(),
        role: 'assistant',
        content: t('omnibar.searchFailed', { error: e instanceof Error ? e.message : 'unknown' }),
      })
    }
  }

  const submit = async () => {
    const parsed = parseOmnibarInput(value)
    if (parsed.kind === 'empty') return
    if (parsed.kind === 'url') {
      if (!isNavigableUrl(parsed.url)) {
        await runAiSearch(value)
        return
      }
      if (activeId) void navigate(activeId, parsed.url)
      else void openTab(parsed.url)
      return
    }
    await runAiSearch(parsed.query)
  }

  const reload = () => {
    if (activeId && activeTab?.url && activeTab.url !== 'about:blank') {
      void navigate(activeId, activeTab.url)
    }
  }

  const isSecure = activeTab?.url?.startsWith('https://') ?? false
  const showSecurityGlyph = activeTab?.url && activeTab.url !== 'about:blank'
  const omnibarBg: CSSProperties['background'] = focused
    ? 'var(--canvas)'
    : 'rgba(255,255,255,0.04)'
  const omnibarBorder: CSSProperties['border'] = focused
    ? '1px solid var(--accent)'
    : '1px solid var(--border)'

  return (
    <div
      style={{
        position: 'relative',
        height: 48,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        paddingInline: 12,
        background: 'var(--surface-1)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      {/* Navigation cluster (left) */}
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
        <NavBtn
          label={t('omnibar.back')}
          disabled={!activeId || !canGoBack}
          onClick={() => { if (activeId) void goBack(activeId) }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
            <path d="M10 3 L5 8 L10 13" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </NavBtn>
        <NavBtn
          label={t('omnibar.forward')}
          disabled={!activeId || !canGoForward}
          onClick={() => { if (activeId) void goForward(activeId) }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
            <path d="M6 3 L11 8 L6 13" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </NavBtn>
        <NavBtn label={t('omnibar.reload')} onClick={reload} disabled={!activeTab?.url || activeTab.url === 'about:blank'}>
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
            <path d="M13 4 V8 H9 M13 8 A5 5 0 1 1 11 4" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </NavBtn>
      </div>

      {/* Omnibar pill — centered, max-width 720px */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          justifyContent: 'center',
          paddingInline: 4,
        }}
      >
        <div
          style={{
            position: 'relative',
            width: '100%',
            maxWidth: 760,
            height: 34,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            paddingInline: 12,
            borderRadius: 999,
            background: omnibarBg,
            border: omnibarBorder,
            transition: 'background 140ms ease, border-color 140ms ease, box-shadow 140ms ease',
            boxShadow: focused ? '0 0 0 3px rgba(217, 119, 6, 0.12)' : 'none',
          }}
        >
          {/* Security / origin glyph */}
          {showSecurityGlyph && (
            <span
              role="img"
              aria-label={isSecure ? t('omnibar.secure') : t('omnibar.notSecure')}
              title={isSecure ? t('omnibar.secureTitle') : t('omnibar.notSecureTitle')}
              style={{
                display: 'inline-flex',
                color: isSecure ? 'var(--sovereignty-ok)' : 'var(--sovereignty-warn)',
              }}
            >
              {isSecure ? (
                <svg width="13" height="13" viewBox="0 0 13 13" aria-hidden>
                  <path d="M3.5 6 V4.5 A3 3 0 0 1 9.5 4.5 V6 M2.5 6 H10.5 V11 H2.5 Z" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                <svg width="13" height="13" viewBox="0 0 13 13" aria-hidden>
                  <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.2" fill="none" />
                  <path d="M6.5 4 V7 M6.5 9 V9.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
              )}
            </span>
          )}

          {!showSecurityGlyph && (
            <span style={{ display: 'inline-flex', color: 'var(--text-muted)' }} aria-hidden>
              <svg width="13" height="13" viewBox="0 0 13 13">
                <circle cx="5.5" cy="5.5" r="3.5" stroke="currentColor" strokeWidth="1.2" fill="none" />
                <path d="M8 8 L11 11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
            </span>
          )}

          <input
            ref={ref}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 100)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void submit()
              }
              if (e.key === 'Escape') (e.target as HTMLInputElement).blur()
            }}
            spellCheck={false}
            autoComplete="off"
            placeholder={t('omnibar.placeholder')}
            aria-label={t('omnibar.ariaLabel')}
            style={{
              flex: 1,
              height: '100%',
              padding: 0,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-default)',
              fontSize: 13.5,
              letterSpacing: '0.005em',
            }}
          />

          {/* AI hint glyph on the right of the pill */}
          <span
            aria-hidden
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              color: 'var(--text-muted)',
              fontSize: 10,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}
          >
            <svg width="11" height="11" viewBox="0 0 11 11" aria-hidden>
              <path d="M5.5 1 L6.7 4.3 L10 5.5 L6.7 6.7 L5.5 10 L4.3 6.7 L1 5.5 L4.3 4.3 Z" fill="currentColor" opacity="0.6" />
            </svg>
            {OS === 'macos' ? '⌘L' : 'Ctrl+L'}
          </span>

          {/* Suggestions dropdown */}
          {focused && suggestions.length > 0 && (
            <ul
              role="listbox"
              aria-label="History suggestions"
              style={{
                position: 'absolute',
                top: 40,
                left: 0,
                right: 0,
                background: 'var(--surface-1)',
                border: '1px solid var(--border)',
                borderRadius: 14,
                listStyle: 'none',
                padding: 6,
                margin: 0,
                maxHeight: 280,
                overflow: 'auto',
                zIndex: 30,
                boxShadow: '0 12px 32px -8px rgba(0, 0, 0, 0.4)',
              }}
            >
              {suggestions.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault()
                      if (activeId) void navigate(activeId, s.url)
                      else void openTab(s.url)
                      setSuggestions([])
                      setFocused(false)
                    }}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left',
                      padding: '8px 12px', background: 'transparent',
                      color: 'var(--text-primary)', border: 'none', cursor: 'pointer',
                      fontSize: 12.5, borderRadius: 8,
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)' }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
                  >
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title ?? s.url}</div>
                    <div style={{ fontSize: 10.5, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2, fontFamily: 'var(--font-mono)' }}>{s.url}</div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Right-side action cluster */}
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
        <NavBtn
          label={t('omnibar.readerMode')}
          onClick={() => activeTab?.url && activeTab.url !== 'about:blank' && void openReader(activeTab.url)}
          disabled={!activeTab?.url || activeTab.url === 'about:blank'}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
            <path d="M2 3 H14 V13 H2 Z M4 5 H12 M4 8 H12 M4 11 H8" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </NavBtn>

        <NavBtn label={t('omnibar.downloads')} onClick={toggleDownloads} badge={activeDownloads > 0}>
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
            <path d="M8 2 V10 M5 7 L8 10 L11 7" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M3 13 H13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </NavBtn>

        <BookmarkButton />

        <NavBtn label={t('omnibar.bookmarks')} onClick={toggleBookmarks}>
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
            <path d="M3 5 H13 M3 8 H13 M3 11 H10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </NavBtn>

        <NavBtn label={t('omnibar.history')} onClick={toggleHistory}>
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
            <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.4" fill="none" />
            <path d="M8 5 V8 L10 9.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
        </NavBtn>

        <NavBtn label={t('omnibar.saved')} onClick={toggleSaved}>
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
            <path d="M4 2 H12 V14 L8 11 L4 14 Z" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinejoin="round" />
          </svg>
        </NavBtn>

        <NavBtn label={sidebarOpen ? t('omnibar.hideSidebar') : t('omnibar.openSidebar')} active={sidebarOpen} onClick={toggleSidebar}>
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
            <path d="M8 2 L9.6 5.6 L13 6.5 L9.6 7.4 L8 11 L6.4 7.4 L3 6.5 L6.4 5.6 Z" fill="currentColor" />
            <path d="M11.5 11 L12 12.5 L13.5 13 L12 13.5 L11.5 15 L11 13.5 L9.5 13 L11 12.5 Z" fill="currentColor" opacity="0.7" />
          </svg>
        </NavBtn>
      </div>
    </div>
  )
}
