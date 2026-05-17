# Baobab Search Portal v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the omnibar's "search query → AI sidebar chat" flow with a dedicated, brand-rooted search results page that opens in the active tab and uses the existing `/api/ai/search` worker.

**Architecture:** New Vite multi-page entry `search.html` (parallel to `picker.html`). Omnibar's `submit()` for search inputs navigates the active tab to `tauri://localhost/search.html?q=<encoded>`. The page reads `?q=` from `location.search`, calls the existing `aiClient.search`, and renders a brand-rooted layout: sticky search header, "From the grove" AI answer card, list of result entries. Omnibar's input display is taught to decode the search-page URL back into the user's query so they can refine in place.

**Tech Stack:** Vite multi-page build, React 18, Zustand (existing pattern), `@baobab/cloud-client` (existing `aiClient`), Tauri 2 (existing webview model — no Rust changes), Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-05-16-search-portal-design.md`

---

## File Structure

### New frontend files
- `apps/desktop/search.html` — Vite multi-page entry HTML
- `apps/desktop/src/search.tsx` — React entry that mounts `<SearchApp />`
- `apps/desktop/src/search/SearchApp.tsx` — Top-level page; reads `?q=`, owns layout
- `apps/desktop/src/search/SearchHeader.tsx` — Sticky header: logo + refine-able input
- `apps/desktop/src/search/AnswerCard.tsx` — "From the grove" AI answer block
- `apps/desktop/src/search/ResultList.tsx` — Wraps result entries; renders empty slot if list is empty
- `apps/desktop/src/search/ResultEntry.tsx` — One result: URL above title link
- `apps/desktop/src/search/EmptyState.tsx` — "No grove results" with tree SVG
- `apps/desktop/src/search/ErrorState.tsx` — Auth-required + unavailable variants
- `apps/desktop/src/search/LoadingState.tsx` — Pulse-animated placeholder
- `apps/desktop/src/search/useSearchData.ts` — Zustand store: status, answer, results, error, requestId, `runSearch(query)`

### Modified frontend files
- `apps/desktop/vite.config.ts` — extend `rollupOptions.input` with `search` entry
- `apps/desktop/src/chrome/Omnibar.tsx` — delete `runAiSearch`; route search to new page; teach value-effect to decode search URL

### New test files
- `apps/desktop/tests/search.store.test.ts` — `useSearchData` happy/error/stale paths (5 tests)
- `apps/desktop/tests/search.header.test.tsx` — refine input behaviour (2 tests)
- `apps/desktop/tests/search.app.test.tsx` — full page wiring (3 tests)
- `apps/desktop/tests/omnibar.search.test.tsx` — submit + display transforms (3 tests)

---

## Phase 1 — Vite multi-entry + skeleton

### Task 1: `search.html` entry + `SearchApp` stub + Vite config

**Files:**
- Create: `apps/desktop/search.html`
- Create: `apps/desktop/src/search.tsx`
- Create: `apps/desktop/src/search/SearchApp.tsx` (stub)
- Modify: `apps/desktop/vite.config.ts`

- [ ] **Step 1: Create `apps/desktop/search.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Baobab Search</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>
      html, body, #root { height: 100%; margin: 0; }
      body { background: #fde7c4; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; }
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/search.tsx"></script>
  </body>
</html>
```

- [ ] **Step 2: Create `apps/desktop/src/search.tsx`**

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { SearchApp } from './search/SearchApp'

const root = document.getElementById('root')
if (!root) throw new Error('#root not found')

createRoot(root).render(
  <StrictMode>
    <SearchApp />
  </StrictMode>,
)
```

- [ ] **Step 3: Create stub `SearchApp.tsx`**

```tsx
export function SearchApp() {
  return <div style={{ padding: 24, color: '#3c1810' }}>Search stub</div>
}
```

- [ ] **Step 4: Extend Vite multi-page config**

Open `apps/desktop/vite.config.ts`. The existing `build.rollupOptions.input` has `main` + `picker` entries. Add `search`:

```ts
build: {
  rollupOptions: {
    input: {
      main: path.resolve(__dirname, 'index.html'),
      picker: path.resolve(__dirname, 'picker.html'),
      search: path.resolve(__dirname, 'search.html'),
    },
  },
},
```

- [ ] **Step 5: Verify build produces `dist/search.html`**

```bash
cd C:\dev\baobab\apps\desktop && npm run build
ls dist/search.html
```

Expected: `dist/search.html` exists alongside `dist/index.html` and `dist/picker.html`.

- [ ] **Step 6: Commit**

```bash
cd C:\dev\baobab
git add apps/desktop/search.html apps/desktop/src/search.tsx apps/desktop/src/search/SearchApp.tsx apps/desktop/vite.config.ts
git commit -m "feat(search): vite multi-page entry + SearchApp stub"
```

---

## Phase 2 — Store + API integration

### Task 2: `useSearchData` Zustand store with stale-response guard

**Files:**
- Create: `apps/desktop/src/search/useSearchData.ts`
- Create: `apps/desktop/tests/search.store.test.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/desktop/tests/search.store.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const aiMocks = vi.hoisted(() => ({
  search: vi.fn(),
}))

vi.mock('~/state/cloud', () => ({
  ai: aiMocks,
}))

import { useSearchData } from '~/search/useSearchData'

beforeEach(() => {
  aiMocks.search.mockReset()
  useSearchData.setState({
    query: '',
    status: 'idle',
    answer: '',
    results: [],
    error: null,
    requestId: 0,
  })
})

describe('useSearchData', () => {
  it('runSearch transitions to loading then success', async () => {
    aiMocks.search.mockResolvedValue({
      answer: 'Baobab is a tree.',
      results: [{ title: 'Wikipedia', url: 'https://wikipedia.org/wiki/Baobab' }],
    })
    const promise = useSearchData.getState().runSearch('baobab')
    expect(useSearchData.getState().status).toBe('loading')
    expect(useSearchData.getState().query).toBe('baobab')
    await promise
    const s = useSearchData.getState()
    expect(s.status).toBe('success')
    expect(s.answer).toBe('Baobab is a tree.')
    expect(s.results).toHaveLength(1)
  })

  it('runSearch sets error state to auth_required on 401', async () => {
    aiMocks.search.mockRejectedValue(Object.assign(new Error('unauthorized'), { status: 401 }))
    await useSearchData.getState().runSearch('q')
    const s = useSearchData.getState()
    expect(s.status).toBe('error')
    expect(s.error).toBe('auth_required')
  })

  it('runSearch sets error state to unavailable on non-401 errors', async () => {
    aiMocks.search.mockRejectedValue(new Error('network failure'))
    await useSearchData.getState().runSearch('q')
    const s = useSearchData.getState()
    expect(s.status).toBe('error')
    expect(s.error).toBe('unavailable')
  })

  it('a stale response is discarded when a newer search is in flight', async () => {
    let resolveFirst: (v: unknown) => void = () => {}
    const firstPromise = new Promise((res) => { resolveFirst = res })
    aiMocks.search.mockReturnValueOnce(firstPromise)
    aiMocks.search.mockResolvedValueOnce({ answer: 'second', results: [] })

    const p1 = useSearchData.getState().runSearch('first')
    await useSearchData.getState().runSearch('second')

    // Now resolve the first request — it should be ignored because requestId moved on.
    resolveFirst({ answer: 'first', results: [{ title: 'stale', url: 'https://stale.example' }] })
    await p1

    const s = useSearchData.getState()
    expect(s.answer).toBe('second')
    expect(s.query).toBe('second')
    expect(s.results).toHaveLength(0)
  })

  it('runSearch with empty query is a no-op', async () => {
    await useSearchData.getState().runSearch('  ')
    expect(aiMocks.search).not.toHaveBeenCalled()
    expect(useSearchData.getState().status).toBe('idle')
  })
})
```

Run: `cd C:\dev\baobab\apps\desktop && npx vitest run tests/search.store.test.ts`
Expected: FAIL (`~/search/useSearchData` doesn't exist; `~/state/cloud` may also need verification).

- [ ] **Step 2: Check `~/state/cloud` export shape**

The mock above assumes a module `~/state/cloud` exports an `ai` object with `search()`. Quickly verify this matches the codebase:

```bash
cd C:\dev\baobab
grep -rn "export.*ai\b\|ai\..*search" apps/desktop/src --include="*.ts" --include="*.tsx" | head -10
```

Look for the actual import path / export name used by `Omnibar.tsx` for `aiClient`. If it's `import { aiClient } from '~/state/cloud'` (or similar), update the mock + import in the test to match. **Whatever the file imports, use the same name in the store and the test.**

If the existing Omnibar uses `import { aiClient } from '~/some/path'`, then:
- Mock: `vi.mock('~/some/path', () => ({ aiClient: { search: vi.fn() } }))`
- Hoist correspondingly
- The store imports `aiClient` from the same path

Adjust the test code now before continuing.

- [ ] **Step 3: Implement `useSearchData.ts`**

Create `apps/desktop/src/search/useSearchData.ts`:

```ts
import { create } from 'zustand'
import { aiClient } from '~/state/cloud'

export interface SearchResult {
  title: string
  url: string
}

type Status = 'idle' | 'loading' | 'success' | 'error'
type ErrorKind = 'auth_required' | 'unavailable'

interface SearchDataState {
  query: string
  status: Status
  answer: string
  results: SearchResult[]
  error: ErrorKind | null
  requestId: number
  runSearch: (query: string) => Promise<void>
}

function classifyError(e: unknown): ErrorKind {
  const status = (e as { status?: number } | null)?.status
  if (status === 401) return 'auth_required'
  return 'unavailable'
}

export const useSearchData = create<SearchDataState>((set, get) => ({
  query: '',
  status: 'idle',
  answer: '',
  results: [],
  error: null,
  requestId: 0,

  runSearch: async (rawQuery) => {
    const query = rawQuery.trim()
    if (!query) return
    const nextId = get().requestId + 1
    set({
      query,
      status: 'loading',
      answer: '',
      results: [],
      error: null,
      requestId: nextId,
    })
    try {
      const res = await aiClient.search({ query })
      if (get().requestId !== nextId) return // a newer search superseded
      set({
        status: 'success',
        answer: res.answer ?? '',
        results: Array.isArray(res.results) ? res.results : [],
        error: null,
      })
    } catch (e) {
      if (get().requestId !== nextId) return
      set({
        status: 'error',
        answer: '',
        results: [],
        error: classifyError(e),
      })
    }
  },
}))
```

**Note on the import path:** the snippet uses `~/state/cloud` — adjust per Step 2 to whatever the codebase actually exports `aiClient` from.

- [ ] **Step 4: Re-run tests — expect 5 passing**

```bash
cd C:\dev\baobab\apps\desktop && npx vitest run tests/search.store.test.ts
```

Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
cd C:\dev\baobab
git add apps/desktop/src/search/useSearchData.ts apps/desktop/tests/search.store.test.ts
git commit -m "feat(search): useSearchData store with stale-response guard"
```

---

## Phase 3 — UI components

### Task 3: `SearchHeader` — sticky logo + refine input

**Files:**
- Create: `apps/desktop/src/search/SearchHeader.tsx`
- Create: `apps/desktop/tests/search.header.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `apps/desktop/tests/search.header.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SearchHeader } from '~/search/SearchHeader'

describe('SearchHeader', () => {
  it('pre-fills the input with the current query', () => {
    render(<SearchHeader query="baobab" onRefine={() => undefined} />)
    expect(screen.getByDisplayValue('baobab')).toBeInTheDocument()
  })

  it('Enter calls onRefine with the trimmed input value', () => {
    const onRefine = vi.fn()
    render(<SearchHeader query="initial" onRefine={onRefine} />)
    const input = screen.getByDisplayValue('initial') as HTMLInputElement
    fireEvent.change(input, { target: { value: '  baobab tree  ' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onRefine).toHaveBeenCalledWith('baobab tree')
  })
})
```

Run: expect FAIL (module not found).

- [ ] **Step 2: Implement `SearchHeader.tsx`**

```tsx
import { useEffect, useState } from 'react'

interface Props {
  query: string
  onRefine: (next: string) => void
}

export function SearchHeader({ query, onRefine }: Props) {
  const [value, setValue] = useState(query)

  useEffect(() => { setValue(query) }, [query])

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return
    const trimmed = value.trim()
    if (!trimmed) return
    onRefine(trimmed)
  }

  return (
    <header
      style={{
        position: 'sticky', top: 0, zIndex: 10,
        display: 'flex', alignItems: 'center', gap: 16,
        padding: '10px 24px',
        height: 56, boxSizing: 'border-box',
        background: 'rgba(255,250,240,0.96)',
        backdropFilter: 'blur(8px)',
        borderBottom: '1px solid rgba(60,30,15,0.12)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span aria-hidden style={{
          width: 24, height: 24, borderRadius: '50%',
          background: 'radial-gradient(circle at 30% 30%, #5a8a1f, #2d5310)',
          border: '1.5px solid rgba(255,255,255,0.7)',
        }} />
        <span style={{
          fontFamily: "'Iowan Old Style', 'Palatino Linotype', Georgia, serif",
          fontSize: 16, fontWeight: 600, color: '#3c1810', letterSpacing: '-0.01em',
        }}>baobab</span>
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        aria-label="Search the grove"
        style={{
          flex: 1, height: 40, padding: '0 20px',
          borderRadius: 999,
          border: '1px solid rgba(60,30,15,0.18)',
          background: 'white',
          color: '#3c1810',
          fontSize: 14,
          outline: 'none',
          transition: 'border-color 120ms ease',
        }}
        onFocus={(e) => { e.currentTarget.style.borderColor = '#c4881f' }}
        onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(60,30,15,0.18)' }}
      />
    </header>
  )
}
```

- [ ] **Step 3: Re-run test — expect 2 PASS**

```bash
cd C:\dev\baobab\apps\desktop && npx vitest run tests/search.header.test.tsx
```

Expected: 2 tests pass.

- [ ] **Step 4: Commit**

```bash
cd C:\dev\baobab
git add apps/desktop/src/search/SearchHeader.tsx apps/desktop/tests/search.header.test.tsx
git commit -m "feat(search): SearchHeader with sticky logo + refine input"
```

---

### Task 4: `AnswerCard` — "From the grove" block

**Files:**
- Create: `apps/desktop/src/search/AnswerCard.tsx`

- [ ] **Step 1: Implement (presentational, no unit test — covered by SearchApp integration test in Task 7)**

Create `apps/desktop/src/search/AnswerCard.tsx`:

```tsx
interface Props {
  answer: string
}

export function AnswerCard({ answer }: Props) {
  if (!answer) return null
  return (
    <section
      style={{
        margin: '24px 24px 16px',
        padding: '20px 22px',
        background: '#fffbef',
        border: '1px solid rgba(196,136,31,0.35)',
        borderLeft: '4px solid #c4881f',
        borderRadius: 10,
        boxShadow: '0 2px 8px rgba(60,30,15,0.08)',
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: '#c4881f',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          marginBottom: 8,
        }}
      >
        From the grove
      </div>
      <p
        style={{
          margin: 0,
          color: '#3c1810',
          fontFamily: "'Iowan Old Style', 'Palatino Linotype', Georgia, serif",
          fontSize: 16,
          lineHeight: 1.6,
          whiteSpace: 'pre-wrap',
        }}
      >
        {answer}
      </p>
    </section>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
cd C:\dev\baobab\apps\desktop && npm run typecheck
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
cd C:\dev\baobab
git add apps/desktop/src/search/AnswerCard.tsx
git commit -m "feat(search): AnswerCard renders the From-the-grove block"
```

---

### Task 5: `ResultEntry` + `ResultList`

**Files:**
- Create: `apps/desktop/src/search/ResultEntry.tsx`
- Create: `apps/desktop/src/search/ResultList.tsx`

- [ ] **Step 1: Implement `ResultEntry.tsx`**

```tsx
import { useState } from 'react'
import type { SearchResult } from './useSearchData'

interface Props {
  result: SearchResult
}

export function ResultEntry({ result }: Props) {
  const [hovered, setHovered] = useState(false)
  return (
    <article
      style={{ marginBottom: 16 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{ fontSize: 12, color: '#8a3a1f', marginBottom: 2 }}>
        {prettyUrl(result.url)}
      </div>
      <a
        href={result.url}
        style={{
          fontSize: 18,
          color: '#1a4a8a',
          textDecoration: hovered ? 'underline' : 'none',
          fontWeight: 600,
          display: 'inline-block',
          transform: hovered ? 'translateY(-1px)' : 'translateY(0)',
          transition: 'transform 120ms ease, text-decoration 120ms ease',
        }}
      >
        {result.title}
      </a>
    </article>
  )
}

function prettyUrl(raw: string): string {
  try {
    const u = new URL(raw)
    const path = u.pathname.replace(/\/$/, '')
    return path ? `${u.hostname} › ${path.replace(/^\//, '').replace(/\//g, ' › ')}` : u.hostname
  } catch {
    return raw
  }
}
```

- [ ] **Step 2: Implement `ResultList.tsx`**

```tsx
import type { SearchResult } from './useSearchData'
import { ResultEntry } from './ResultEntry'

interface Props {
  results: SearchResult[]
  emptySlot: React.ReactNode
}

export function ResultList({ results, emptySlot }: Props) {
  if (results.length === 0) return <>{emptySlot}</>
  return (
    <section style={{ margin: '0 24px 32px' }}>
      {results.map((r, i) => (
        <ResultEntry key={`${r.url}-${i}`} result={r} />
      ))}
    </section>
  )
}
```

- [ ] **Step 3: Typecheck**

```bash
cd C:\dev\baobab\apps\desktop && npm run typecheck
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
cd C:\dev\baobab
git add apps/desktop/src/search/ResultEntry.tsx apps/desktop/src/search/ResultList.tsx
git commit -m "feat(search): ResultEntry and ResultList with prettified URL display"
```

---

### Task 6: `EmptyState` + `ErrorState` + `LoadingState`

**Files:**
- Create: `apps/desktop/src/search/EmptyState.tsx`
- Create: `apps/desktop/src/search/ErrorState.tsx`
- Create: `apps/desktop/src/search/LoadingState.tsx`

- [ ] **Step 1: Implement `EmptyState.tsx`**

```tsx
import { GroveTree } from '~/picker/GroveTree'

interface Props {
  query: string
}

export function EmptyState({ query }: Props) {
  return (
    <section
      style={{
        margin: '48px auto', maxWidth: 480, textAlign: 'center',
        padding: '0 24px',
      }}
    >
      <div style={{ display: 'inline-block', opacity: 0.7 }}>
        <GroveTree size={64} />
      </div>
      <h2 style={{
        fontFamily: "'Iowan Old Style', 'Palatino Linotype', Georgia, serif",
        fontSize: 20, color: '#3c1810', margin: '12px 0 6px', letterSpacing: '-0.01em',
      }}>
        No grove results for &ldquo;{query}&rdquo;
      </h2>
      <p style={{ fontSize: 14, color: 'rgba(60,30,15,0.7)', margin: 0 }}>
        Try a different query, or refine your search above.
      </p>
    </section>
  )
}
```

- [ ] **Step 2: Implement `ErrorState.tsx`**

```tsx
import { GroveTree } from '~/picker/GroveTree'

interface Props {
  variant: 'auth_required' | 'unavailable'
  onRetry?: () => void
  onSignIn?: () => void
}

export function ErrorState({ variant, onRetry, onSignIn }: Props) {
  const title =
    variant === 'auth_required'
      ? 'Sign in to use grove search'
      : 'Grove search is unavailable'
  const body =
    variant === 'auth_required'
      ? 'Connect your Baobab account to get AI-powered answers and results.'
      : 'The search service didn’t respond. Try again in a moment.'

  return (
    <section
      role="alert"
      style={{
        margin: '48px auto', maxWidth: 480, textAlign: 'center',
        padding: '0 24px',
      }}
    >
      <div style={{ display: 'inline-block', opacity: 0.7 }}>
        <GroveTree size={64} />
      </div>
      <h2 style={{
        fontFamily: "'Iowan Old Style', 'Palatino Linotype', Georgia, serif",
        fontSize: 20, color: '#3c1810', margin: '12px 0 6px', letterSpacing: '-0.01em',
      }}>
        {title}
      </h2>
      <p style={{ fontSize: 14, color: 'rgba(60,30,15,0.75)', margin: '0 0 16px' }}>
        {body}
      </p>
      {variant === 'auth_required' && onSignIn && (
        <button
          type="button"
          onClick={onSignIn}
          style={{
            padding: '10px 20px',
            border: 'none',
            borderRadius: 8,
            background: '#3c1810',
            color: 'white',
            cursor: 'pointer',
            fontSize: 14, fontWeight: 600,
          }}
        >
          Sign in
        </button>
      )}
      {variant === 'unavailable' && onRetry && (
        <button
          type="button"
          onClick={onRetry}
          style={{
            padding: '10px 20px',
            border: '1px solid rgba(60,30,15,0.25)',
            borderRadius: 8,
            background: 'transparent',
            color: '#3c1810',
            cursor: 'pointer',
            fontSize: 14, fontWeight: 600,
          }}
        >
          Try again
        </button>
      )}
    </section>
  )
}
```

- [ ] **Step 3: Implement `LoadingState.tsx`**

```tsx
export function LoadingState() {
  return (
    <div
      aria-label="Loading grove results"
      style={{ margin: '24px 24px 0' }}
    >
      <style>{`
        @keyframes bb-search-pulse {
          0%, 100% { opacity: 0.55; }
          50% { opacity: 1; }
        }
        .bb-search-skel { animation: bb-search-pulse 1.4s ease-in-out infinite; background: rgba(60,30,15,0.10); border-radius: 8px; }
      `}</style>
      <div className="bb-search-skel" style={{ height: 92, marginBottom: 18 }} />
      <div className="bb-search-skel" style={{ height: 18, width: '60%', marginBottom: 8 }} />
      <div className="bb-search-skel" style={{ height: 12, width: '40%', marginBottom: 22 }} />
      <div className="bb-search-skel" style={{ height: 18, width: '70%', marginBottom: 8 }} />
      <div className="bb-search-skel" style={{ height: 12, width: '45%', marginBottom: 22 }} />
      <div className="bb-search-skel" style={{ height: 18, width: '65%', marginBottom: 8 }} />
      <div className="bb-search-skel" style={{ height: 12, width: '42%' }} />
    </div>
  )
}
```

- [ ] **Step 4: Typecheck**

```bash
cd C:\dev\baobab\apps\desktop && npm run typecheck
```

Expected: clean.

- [ ] **Step 5: Commit**

```bash
cd C:\dev\baobab
git add apps/desktop/src/search/EmptyState.tsx apps/desktop/src/search/ErrorState.tsx apps/desktop/src/search/LoadingState.tsx
git commit -m "feat(search): Empty / Error / Loading states with brand-rooted visuals"
```

---

## Phase 4 — Full page composition

### Task 7: `SearchApp` wires everything together

**Files:**
- Modify: `apps/desktop/src/search/SearchApp.tsx`
- Create: `apps/desktop/tests/search.app.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `apps/desktop/tests/search.app.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'

const aiMocks = vi.hoisted(() => ({
  search: vi.fn(),
}))
vi.mock('~/state/cloud', () => ({
  aiClient: aiMocks,
}))

import { SearchApp } from '~/search/SearchApp'
import { useSearchData } from '~/search/useSearchData'

beforeEach(() => {
  aiMocks.search.mockReset()
  window.history.replaceState(null, '', '/search.html?q=baobab')
  useSearchData.setState({
    query: '',
    status: 'idle',
    answer: '',
    results: [],
    error: null,
    requestId: 0,
  })
})

describe('SearchApp', () => {
  it('reads ?q= and renders results when worker succeeds', async () => {
    aiMocks.search.mockResolvedValue({
      answer: 'Baobab is a tree.',
      results: [{ title: 'Wikipedia', url: 'https://wikipedia.org/wiki/Baobab' }],
    })
    render(<SearchApp />)
    await waitFor(() => {
      expect(screen.getByText('Baobab is a tree.')).toBeInTheDocument()
      expect(screen.getByText('Wikipedia')).toBeInTheDocument()
    })
  })

  it('shows empty state when both answer and results are empty', async () => {
    aiMocks.search.mockResolvedValue({ answer: '', results: [] })
    render(<SearchApp />)
    await waitFor(() => {
      expect(screen.getByText(/no grove results for/i)).toBeInTheDocument()
    })
  })

  it('shows auth_required error state on 401', async () => {
    aiMocks.search.mockRejectedValue(Object.assign(new Error('unauthorized'), { status: 401 }))
    render(<SearchApp />)
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/sign in to use grove search/i)
    })
  })
})
```

Run: expect FAIL (stub doesn't load query).

- [ ] **Step 2: Replace `SearchApp.tsx` with the real implementation**

```tsx
import { useEffect } from 'react'
import { SearchHeader } from './SearchHeader'
import { AnswerCard } from './AnswerCard'
import { ResultList } from './ResultList'
import { EmptyState } from './EmptyState'
import { ErrorState } from './ErrorState'
import { LoadingState } from './LoadingState'
import { useSearchData } from './useSearchData'

function readQueryFromUrl(): string {
  try {
    return new URLSearchParams(window.location.search).get('q') ?? ''
  } catch {
    return ''
  }
}

export function SearchApp() {
  const status = useSearchData((s) => s.status)
  const query = useSearchData((s) => s.query)
  const answer = useSearchData((s) => s.answer)
  const results = useSearchData((s) => s.results)
  const error = useSearchData((s) => s.error)
  const runSearch = useSearchData((s) => s.runSearch)

  // Initial load: read ?q= and run the search.
  useEffect(() => {
    const q = readQueryFromUrl()
    if (q) void runSearch(q)
  }, [runSearch])

  // Listen for browser back/forward navigations that change ?q=.
  useEffect(() => {
    function onPop() {
      const q = readQueryFromUrl()
      if (q) void runSearch(q)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [runSearch])

  function handleRefine(next: string) {
    const encoded = encodeURIComponent(next)
    window.history.pushState(null, '', `${window.location.pathname}?q=${encoded}`)
    void runSearch(next)
  }

  function handleRetry() {
    if (query) void runSearch(query)
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(180deg, #fde7c4 0%, #f4d8a8 40%, #fffaf2 100%)',
        color: '#3c1810',
      }}
    >
      <SearchHeader query={query} onRefine={handleRefine} />

      {status === 'loading' && <LoadingState />}

      {status === 'error' && error === 'auth_required' && (
        <ErrorState variant="auth_required" />
      )}

      {status === 'error' && error === 'unavailable' && (
        <ErrorState variant="unavailable" onRetry={handleRetry} />
      )}

      {status === 'success' && (
        <>
          <AnswerCard answer={answer} />
          <ResultList
            results={results}
            emptySlot={!answer ? <EmptyState query={query} /> : null}
          />
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Run test — expect 3 PASS**

```bash
cd C:\dev\baobab\apps\desktop && npx vitest run tests/search.app.test.tsx
```

Expected: 3 tests pass.

- [ ] **Step 4: Run full TS suite — confirm no regressions**

```bash
cd C:\dev\baobab\apps\desktop && npm test
```

Expected: 170 (existing) + 5 (store) + 2 (header) + 3 (app) = 180 tests passing.

- [ ] **Step 5: Commit**

```bash
cd C:\dev\baobab
git add apps/desktop/src/search/SearchApp.tsx apps/desktop/tests/search.app.test.tsx
git commit -m "feat(search): SearchApp wires header / answer / results / empty / error / loading"
```

---

## Phase 5 — Omnibar integration

### Task 8: Omnibar routes search to new page + decodes search URL for display

**Files:**
- Modify: `apps/desktop/src/chrome/Omnibar.tsx`
- Create: `apps/desktop/tests/omnibar.search.test.tsx`

- [ ] **Step 1: Read the current omnibar to map the edits**

Open `apps/desktop/src/chrome/Omnibar.tsx`. Key sections to find:

- Lines ~161-182: the `runAiSearch` function — DELETE this whole function.
- Lines ~138-139: the `useEffect` that sets `value` from `activeTab?.url` — extend the URL → display transform here.
- Lines ~184-197: the `submit()` function — replace the `runAiSearch(...)` call with a navigate.

Also check whether `openTab` is in scope (the existing fallback when `activeId` is null). If not, search for how new tabs are opened today and reuse that.

- [ ] **Step 2: Write failing tests for the search routing**

Create `apps/desktop/tests/omnibar.search.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const invokeMock = vi.fn()
vi.mock('@tauri-apps/api/core', () => ({ invoke: invokeMock }))
vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({ label: 'profile-test' }),
}))

// Mock the tabs store with controllable activeId / tabs / navigate / openTab.
const navigateMock = vi.fn()
const openTabMock = vi.fn()
const stateMock = {
  activeId: 'tab-1',
  tabs: [{ id: 'tab-1', url: 'about:blank' }],
  navigate: navigateMock,
  openTab: openTabMock,
}
vi.mock('~/state/tabs.store', () => ({
  useTabsStore: Object.assign(
    (selector: (s: typeof stateMock) => unknown) => selector(stateMock),
    {
      getState: () => stateMock,
      setState: (patch: Partial<typeof stateMock>) => { Object.assign(stateMock, patch) },
    },
  ),
}))

// Stub other Omnibar imports as needed. Reuse the project's existing test
// mocks for ~/auth/auth.store, ~/ai/ai.store, etc. Copy them from
// tests/chrome.test.tsx if needed.

import { Omnibar } from '~/chrome/Omnibar'

beforeEach(() => {
  invokeMock.mockReset()
  navigateMock.mockReset()
  openTabMock.mockReset()
  stateMock.activeId = 'tab-1'
  stateMock.tabs = [{ id: 'tab-1', url: 'about:blank' }]
})

describe('Omnibar search routing', () => {
  it('typing a search query and pressing Enter navigates to the search page', () => {
    render(<Omnibar />)
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'baobab tree facts' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(navigateMock).toHaveBeenCalledWith(
      'tab-1',
      'tauri://localhost/search.html?q=baobab%20tree%20facts',
    )
  })

  it('typing a hostname-with-dot still navigates as URL, not search', () => {
    render(<Omnibar />)
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'example.com' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(navigateMock).toHaveBeenCalledWith('tab-1', 'https://example.com')
  })

  it('omnibar value displays the decoded query when current tab is on a search page', () => {
    stateMock.tabs = [{ id: 'tab-1', url: 'tauri://localhost/search.html?q=baobab%20tree' }]
    render(<Omnibar />)
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('baobab tree')
  })
})
```

If the existing `Omnibar` requires mocks for `useAiStore`, `useAuthStore`, profile context, etc., copy the patterns from `tests/chrome.test.tsx` or `tests/picker.app.test.tsx`. The goal is to get `<Omnibar />` to render so we can drive the input.

Run: expect FAIL (`navigateMock` not called with the new URL).

- [ ] **Step 3: Apply the Omnibar edits**

In `apps/desktop/src/chrome/Omnibar.tsx`:

**3a. Delete `runAiSearch` entirely** (the function starting near line 161 and ending near line 182). Also remove the imports it relied on if they're no longer used elsewhere in the file (check what's left after the delete; the AI sidebar imports like `useAiStore`, `useAuthStore`, `aiClient`, `pushMessage`, `setActive`, `newMsgId` may all be removable IF they're only used by `runAiSearch`. Some are likely used elsewhere — keep those, delete only the truly-orphaned ones).

**3b. Replace the search branch in `submit()`** (around line 196):

```ts
// Before
await runAiSearch(parsed.query)

// After
const searchUrl = `tauri://localhost/search.html?q=${encodeURIComponent(parsed.query)}`
if (activeId) {
  void navigate(activeId, searchUrl)
} else {
  void openTab(searchUrl)
}
```

**3c. Extend the value-derivation `useEffect`** (around line 138). Change:

```ts
// Before
setValue(activeTab?.url === 'about:blank' ? '' : (activeTab?.url ?? ''))
```

to:

```ts
// After
setValue(displayValueForTabUrl(activeTab?.url))
```

And add this helper near the top of the file (e.g., right after the `isNavigableUrl` definition around line 24):

```ts
const SEARCH_URL_RE = /^tauri:\/\/localhost\/search\.html\?q=(.*)$/

function displayValueForTabUrl(url: string | undefined): string {
  if (!url) return ''
  if (url === 'about:blank') return ''
  const m = url.match(SEARCH_URL_RE)
  if (m) {
    try { return decodeURIComponent(m[1]) } catch { return m[1] }
  }
  return url
}
```

- [ ] **Step 4: Run search-routing test — expect PASS**

```bash
cd C:\dev\baobab\apps\desktop && npx vitest run tests/omnibar.search.test.tsx
```

Expected: 3 tests pass.

- [ ] **Step 5: Run full TS suite — confirm no regressions**

```bash
cd C:\dev\baobab\apps\desktop && npm test && npm run typecheck
```

Expected: 180 + 3 (omnibar.search) = 183 passing; typecheck clean.

If any pre-existing Omnibar tests broke (e.g., they tested the old `runAiSearch` flow), update them: the omnibar no longer calls the AI sidebar from submit. Search now routes to the new page. Update assertions accordingly.

- [ ] **Step 6: Commit**

```bash
cd C:\dev\baobab
git add apps/desktop/src/chrome/Omnibar.tsx apps/desktop/tests/omnibar.search.test.tsx
git commit -m "feat(omnibar): route search inputs to the new search page; decode search URL in display"
```

---

## Phase 6 — Manual integration

### Task 9: Manual smoke

**Files:** None — runtime verification only.

- [ ] **Step 1: Stop dev exe if running + reboot**

```bash
taskkill /F /IM baobab-desktop.exe
```

```bash
cd C:\dev\baobab\apps\desktop && npm run tauri dev
```

Wait for the Tauri exe to launch.

- [ ] **Step 2: Search-page acceptance walk**

1. In a profile window, focus the omnibar. Type `baobab tree facts` → press Enter.
2. Confirm: the active tab navigates to a brand-rooted search page (sunset gradient, leaf-logo, sticky header). "From the grove" answer card visible with AI-generated text. Result entries below with title + URL.
3. Click the back button. Confirm: returns to the previous page (NTP if started there).
4. Search again, this time `baobab` (one word). Confirm: still routes to the search page (parseOmnibarInput treats bareword as search).
5. Search `example.com` (with dot). Confirm: navigates to `https://example.com` — NOT the search page. URL-vs-search heuristic still works.
6. From the search page, click into the sticky header input. Edit to `baobab fruit`. Press Enter. Confirm: page updates with new results without reloading the whole tab (single SearchApp instance; popstate-driven refine).
7. Press the browser back button. Confirm: URL changes back to `?q=baobab%20tree%20facts`, results regenerate for that query (because popstate triggers a fresh runSearch).
8. Click a result link. Confirm: the active tab navigates to the destination URL (search page replaced).
9. Open a new tab → omnibar should be empty (NTP / about:blank). Type any search → opens search page in that tab.

- [ ] **Step 3: Edge cases**

- [ ] Empty `?q=`: navigate manually to `tauri://localhost/search.html?q=` (no value). Confirm: page renders empty state with the sticky search bar empty and ready.
- [ ] Sign out (Settings or AuthScreen) → search a query. If worker enforces auth: confirm the page shows the "Sign in to use grove search" ErrorState. Sign in → re-search → works again.
- [ ] Worker unavailable: temporarily disconnect internet, search a query. Confirm: page shows the "Grove search is unavailable" ErrorState with retry button. Reconnect, click Try again, results appear.
- [ ] Omnibar display when on a search page: focus a tab that's on `tauri://localhost/search.html?q=foo` → omnibar input shows `foo`, not the raw URL.
- [ ] AI sidebar still works independently: click the AI button (or its keyboard shortcut) → sidebar opens; typing a message in the chat panel still hits the AI conversation flow. (We didn't touch the sidebar, just the omnibar's call into it.)

- [ ] **Step 4: Final acceptance commit**

If everything passed:

```bash
cd C:\dev\baobab
git commit --allow-empty -m "feat(search): portal v1 manually verified

All 14 manual checks from
docs/superpowers/specs/2026-05-16-search-portal-design.md
verified end-to-end on Windows dev build:
- omnibar search routes to brand-rooted page
- URL vs search heuristic still works (example.com still navigates)
- refine via sticky header uses pushState, no full reload
- result clicks navigate the tab
- back/forward + popstate correctly re-issue search
- empty / auth_required / unavailable states all render
- omnibar shows decoded query when on a search page
- AI sidebar independent feature still works"
```

If anything failed: do NOT commit the marker. Diagnose, write the deviation into `memory/plan_deviations.md`, fix forward.

---

## Self-Review Notes

**Spec coverage check:**
- ✅ New Vite multi-page entry `search.html` → Task 1
- ✅ `useSearchData` store with status / answer / results / error / requestId stale-guard → Task 2
- ✅ Brand-rooted visual (sunset gradient bg, leaf logo, "From the grove" accented card) → Task 3 (header) + Task 4 (AnswerCard) + Task 7 (SearchApp background)
- ✅ Sticky search header with refine-in-place via pushState → Task 3 + Task 7
- ✅ Result entries: title + URL only (no snippet) → Task 5
- ✅ Empty + Error (auth/unavailable) + Loading states → Task 6
- ✅ SearchApp wires everything and reads `?q=` → Task 7
- ✅ Omnibar.submit() routes search to new page → Task 8
- ✅ Omnibar value displays decoded query when on search page → Task 8
- ✅ `runAiSearch` deletion (code cleanup) → Task 8 Step 3a
- ✅ AI sidebar left as independent feature → no task changes it; covered by Task 8's surgical scope
- ✅ Manual acceptance walk → Task 9

**Placeholder scan:** None — every code step has runnable code. The only inline judgement call is in Task 2 Step 2 ("verify the import path") and Task 8 Step 1 ("map the edits"); both are read-the-existing-file actions, not deferred work.

**Type consistency:**
- `SearchResult` type defined in `useSearchData.ts` and imported by `ResultEntry`/`ResultList` ✓
- `ErrorKind = 'auth_required' | 'unavailable'` consistent across store and `ErrorState` props ✓
- `Status = 'idle' | 'loading' | 'success' | 'error'` consistent ✓
- Omnibar's `displayValueForTabUrl` regex `SEARCH_URL_RE` matches the URL pattern used by `submit()` in the same file ✓
- The store's `runSearch` and React event handlers consistently pass `string` (no number/null surprises) ✓

**Final test counts:**
- Existing: 170 TS + 70 Rust
- After plan: 170 + 5 (store) + 2 (header) + 3 (app) + 3 (omnibar.search) = **183 TS**, **70 Rust** (no Rust changes in this plan)
