import { useEffect, useRef, useState } from 'react'
import { parseOmnibarInput } from '@baobab/core'
import { useTabsStore } from '~/state/tabs.store'
import { OS } from '~/platform/os'
import { aiClient } from '~/ai/api'
import { useAiStore } from '~/ai/ai.store'

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
    </div>
  )
}
