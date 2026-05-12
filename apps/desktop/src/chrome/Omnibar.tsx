import { useEffect, useRef, useState } from 'react'
import { parseOmnibarInput } from '@baobab/core'
import { IconButton } from '@baobab/ui'
import type { HistoryItem } from '@baobab/cloud-client'
import { useTabsStore } from '~/state/tabs.store'
import { OS } from '~/platform/os'
import { aiClient } from '~/ai/api'
import { useAiStore } from '~/ai/ai.store'
import { useReaderStore } from '~/reader/reader.store'
import { suggest } from '~/history/omnibar-autocomplete'
import { BookmarkButton } from '~/bookmarks/BookmarkButton'

// Carry-over from Task 5/6 code review: parseOmnibarInput accepts ANY scheme,
// including `javascript:`, `data:`, `file:`. The omnibar must NOT navigate
// to those — they are XSS / local-FS exfiltration vectors. Allowlist only
// http(s) + about: schemes for omnibar-initiated navigation.
const NAVIGATION_SCHEME_ALLOWLIST = new Set(['http:', 'https:', 'about:'])

function isNavigableUrl(url: string): boolean {
  try {
    const u = new URL(url)
    return NAVIGATION_SCHEME_ALLOWLIST.has(u.protocol)
  } catch {
    return false
  }
}

function newMsgId(): string {
  return `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

export function Omnibar() {
  const ref = useRef<HTMLInputElement | null>(null)
  const activeId = useTabsStore((s) => s.activeId)
  const tabs = useTabsStore((s) => s.tabs)
  const navigate = useTabsStore((s) => s.navigate)
  const openTab = useTabsStore((s) => s.openTab)
  const setActive = useAiStore((s) => s.setActive)
  const pushMessage = useAiStore((s) => s.pushMessage)
  const openReader = useReaderStore((s) => s.openFor)

  const activeTab = tabs.find((t) => t.id === activeId)
  const [value, setValue] = useState(activeTab?.url ?? '')
  const [suggestions, setSuggestions] = useState<HistoryItem[]>([])
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    setValue(activeTab?.url ?? '')
  }, [activeTab?.url])

  useEffect(() => {
    if (!focused) { setSuggestions([]); return }
    const t = setTimeout(() => { void suggest(value, 5).then(setSuggestions) }, 150)
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
    // Ensure sidebar is open
    if (!useAiStore.getState().sidebarOpen) useAiStore.getState().toggleSidebar()
    const convId = `c${Date.now().toString(36)}`
    setActive(convId)
    const userMsgId = newMsgId()
    const asstMsgId = newMsgId()
    pushMessage(convId, { id: userMsgId, role: 'user', content: query })
    pushMessage(convId, { id: asstMsgId, role: 'assistant', content: 'Reaching across the continent…' })
    try {
      const r = await aiClient.search({ query })
      const list = r.results.map((x) => `• [${x.title}](${x.url})`).join('\n')
      // Replace the placeholder assistant message — easiest path: push a new one.
      // For v0.1.0 simplicity we push a new assistant message and leave the placeholder; user sees both.
      pushMessage(convId, { id: newMsgId(), role: 'assistant', content: `${r.answer}\n\n${list}` })
    } catch (e) {
      pushMessage(convId, {
        id: newMsgId(),
        role: 'assistant',
        content: `Search failed: ${e instanceof Error ? e.message : 'unknown'}`,
      })
    }
  }

  const submit = async () => {
    const parsed = parseOmnibarInput(value)
    if (parsed.kind === 'empty') return
    if (parsed.kind === 'url') {
      if (!isNavigableUrl(parsed.url)) {
        // Blocked scheme — fall through to AI search using the raw input
        await runAiSearch(value)
        return
      }
      if (activeId) void navigate(activeId, parsed.url)
      else void openTab(parsed.url)
      return
    }
    // search branch
    await runAiSearch(parsed.query)
  }

  return (
    <div
      style={{
        position: 'relative',
        height: 56,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        paddingInline: 12,
        background: 'var(--surface-1)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <input
        ref={ref}
        className="baobab-input"
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
        placeholder="Search or type a URL"
        aria-label="Address and search bar"
        style={{
          flex: 1,
          height: 40,
          paddingInline: 14,
          borderRadius: 999,
          border: '1px solid var(--border)',
          background: 'var(--canvas)',
          color: 'var(--text-primary)',
          fontFamily: '"JetBrains Mono", Menlo, monospace',
          fontSize: 13,
        }}
      />
      <IconButton
        aria-label="Open Reader Mode"
        onClick={() => activeTab?.url && activeTab.url !== 'about:blank' && void openReader(activeTab.url)}
        disabled={!activeTab?.url || activeTab.url === 'about:blank'}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M2 3 H14 V13 H2 Z M4 5 H12 M4 8 H12 M4 11 H8" stroke="currentColor" strokeWidth="1.2" fill="none" />
        </svg>
      </IconButton>
      <BookmarkButton />
      {focused && suggestions.length > 0 && (
        <ul
          role="listbox"
          aria-label="History suggestions"
          style={{
            position: 'absolute',
            top: 56,
            left: 12,
            right: 12,
            background: 'var(--surface-1)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            listStyle: 'none',
            padding: 4,
            margin: 0,
            maxHeight: 240,
            overflow: 'auto',
            zIndex: 30,
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
                  padding: '8px 10px', background: 'transparent',
                  color: 'var(--text-primary)', border: 'none', cursor: 'pointer',
                  fontSize: 12, borderRadius: 6,
                }}
              >
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title ?? s.url}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.url}</div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
