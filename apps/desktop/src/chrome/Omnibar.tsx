import { useEffect, useRef, useState } from 'react'
import { parseOmnibarInput } from '@baobab/core'
import { useTabsStore } from '~/state/tabs.store'
import { OS } from '~/platform/os'

const SEARCH_FALLBACK_URL = 'https://duckduckgo.com/?q='

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

export function Omnibar() {
  const ref = useRef<HTMLInputElement | null>(null)
  const activeId = useTabsStore((s) => s.activeId)
  const tabs = useTabsStore((s) => s.tabs)
  const navigate = useTabsStore((s) => s.navigate)
  const openTab = useTabsStore((s) => s.openTab)

  const activeTab = tabs.find((t) => t.id === activeId)
  const [value, setValue] = useState(activeTab?.url ?? '')

  useEffect(() => {
    setValue(activeTab?.url ?? '')
  }, [activeTab?.url])

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

  const submit = () => {
    const parsed = parseOmnibarInput(value)
    if (parsed.kind === 'empty') return
    let targetUrl: string
    if (parsed.kind === 'url') {
      // Block javascript:, data:, file:, etc. — fall back to search.
      targetUrl = isNavigableUrl(parsed.url)
        ? parsed.url
        : `${SEARCH_FALLBACK_URL}${encodeURIComponent(parsed.url)}`
    } else {
      targetUrl = `${SEARCH_FALLBACK_URL}${encodeURIComponent(parsed.query)}`
    }
    if (activeId) {
      void navigate(activeId, targetUrl)
    } else {
      void openTab(targetUrl)
    }
  }

  return (
    <div
      style={{
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
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit()
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
          outline: 'none',
        }}
      />
    </div>
  )
}
