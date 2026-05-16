# Baobab Search Portal v1 — Design

**Status:** draft (awaiting user review)
**Date:** 2026-05-16
**Branch context:** Today, omnibar search inputs (anything without a `.`) route to `runAiSearch` which dumps results into the AI sidebar as chat messages. That's an unfamiliar UX for a browser. This v1 replaces that with a dedicated brand-rooted search results page that opens in the active tab, mimicking the Google/Perplexity-style "search → results page" flow that users expect.

## Goal

Bare-word or natural-language omnibar inputs (e.g. `youtube`, `baobab tree facts`, `how do hexagons tessellate`) navigate the active tab to a dedicated Baobab search results page. The page mimics Google's information density but is visually Baobab-branded (sunset gradient, motif decorations, leaf-logo, fruit-accented AI answer card). Anyone can search — no sign-in required.

## Honest scope and non-goals

**What v1 ships:**
- New `tauri://localhost/search.html` page rendered in any tab via the existing Vite multi-page pattern
- "From the grove" AI answer card at the top, powered by the existing `/api/ai/search` worker endpoint
- List of result entries (title + URL) below the answer
- Sticky search bar at top of page (so user can refine without going back)
- Omnibar displays the search query when the active tab is on the search page (not the raw `tauri://...` URL)
- Loading + empty + error states with brand-appropriate visuals
- Page navigates the active tab when a result link is clicked (standard `<a>` behaviour, but anchors target `_self`)
- Scattered decorative motifs reusing the picker's `PickerDecorations` visual vocabulary

**Explicitly NOT in v1:**
- Result snippets — backend currently returns only `{ title, url }` per result; adding descriptions is a worker change. Defer to v1.1.
- Image / video / news / shopping result tabs.
- "Related questions" follow-ups (Perplexity-style).
- Autocomplete-while-typing in the omnibar (existing history-based autocomplete stays untouched).
- Suggested searches on the search page itself.
- Per-profile default search engine (the page IS the default; no alternatives in v1).
- Pagination — `/api/ai/search` returns a single result page; v1 shows whatever it returns.
- HTTP-level request cancellation or input-debouncing. (Each search fetch runs to completion; we don't abort. **But** a client-side `requestId` guard in `useSearchData.runSearch` discards a stale response when a newer search has already been issued — see Error handling. That's response-tracking, not cancellation.)

## Key decisions

| Decision | Choice | Reasoning |
|---|---|---|
| Visual direction | Brand-rooted (Baobab Grove) | Differentiates from Google/Perplexity, leans into existing brand identity. |
| Auth gating | No sign-in required | A browser's search bar must work for everyone. Worker may still enforce auth; if so we render an "AI answer unavailable, sign in to enable" nudge but show result links anyway. |
| Open behaviour | Replace current tab | Chrome-style. Hit enter → current tab navigates to results. Back button returns to the previous page. |
| URL pattern | `tauri://localhost/search.html?q=<urlencoded>` | Matches the existing picker multi-page entry pattern (`tauri://localhost/picker.html`). No new custom protocols. |
| Omnibar display | Show query, not URL, on search pages | Decode `?q=` and display as if the search bar contained the user's query. Lets users refine in place. |
| Result entry shape | Title + URL only in v1 | Backend doesn't return snippets; faking them client-side would be misleading. |
| Result link target | `_self` (navigates current tab) | Standard browser behaviour. Search page replaces itself with the destination. |
| AI sidebar | Untouched | The sidebar's `runAiSearch` flow stays available as an independent feature toggled by the AI button. Only the **omnibar's call** to it is removed. |
| Code cleanup | Delete `runAiSearch` from `Omnibar.tsx` | Becomes dead code once we route search to the new page. Cleaner than leaving an orphaned helper. |

## Architecture

### New Vite entry point

Following the `picker.html` precedent:

- `apps/desktop/search.html` — minimal HTML shell that loads `/src/search.tsx`
- `apps/desktop/src/search.tsx` — React entry, mounts `<SearchApp />`
- `apps/desktop/vite.config.ts` — extend `rollupOptions.input` with a third entry: `search: path.resolve(__dirname, 'search.html')`

### New `apps/desktop/src/search/` folder

| File | Responsibility |
|---|---|
| `SearchApp.tsx` | Top-level: reads `?q=` from `location.search`, owns the page layout, renders header + decorations + result region |
| `SearchHeader.tsx` | Sticky top bar: small leaf+wordmark logo, refine-able search input pre-filled with current query, enter-to-search |
| `AnswerCard.tsx` | "From the grove" cream card with `border-left: 3px solid #c4881f`, renders the AI answer text |
| `ResultList.tsx` | Maps over results, renders each as a `<ResultEntry>` |
| `ResultEntry.tsx` | One result: warm-brown URL line above deep-blue title link; hover lifts + underlines |
| `EmptyState.tsx` | "No grove search results for X" with the GroveTree SVG (small) and an encouraging tagline |
| `ErrorState.tsx` | Worker error fallback. Two variants: "auth required" (render result links + "Sign in for AI answer" nudge) and "search service unavailable" (generic try-again) |
| `LoadingState.tsx` | Pulse-animated placeholder card |
| `useSearchData.ts` | Zustand store: `{ query, status: 'idle'\|'loading'\|'success'\|'error', answer, results, error }` + `runSearch(query)` action |

### Omnibar changes

`apps/desktop/src/chrome/Omnibar.tsx`:

1. **Delete** the `runAiSearch` function entirely (lines ~161–182). It becomes unused after step 2.
2. **In `submit()`**, replace the search branch:
   ```ts
   // Before
   await runAiSearch(parsed.query)

   // After
   const target = `tauri://localhost/search.html?q=${encodeURIComponent(parsed.query)}`
   if (activeId) void navigate(activeId, target)
   else void openTab(target)
   ```
3. **In the `value` derivation that drives the input's display**, add a search-page-aware decoding step:
   ```ts
   function displayValueForTab(url: string | undefined): string {
     if (!url) return ''
     // tauri://localhost/search.html?q=foo  → "foo"
     const m = url.match(/^tauri:\/\/localhost\/search\.html\?q=(.*)$/)
     if (m) {
       try { return decodeURIComponent(m[1]) } catch { return m[1] }
     }
     return url === 'about:blank' ? '' : url
   }
   ```
   Wire this into wherever the omnibar's input currently shows the tab URL. The current code uses `value` state derived from focus + tab url; the search-page transform applies when the tab url matches the search pattern.
4. **Sidebar-search call site is gone** — `useAuthStore.getState().openSignIn()` no longer triggers from omnibar submit. Search just works.

### Cloud client and worker

No changes. v1 uses the existing `aiClient.search({ query }): Promise<{ answer: string; results: Array<{ title; url }> }>` exactly as it stands.

When the worker requires auth and the user isn't signed in, the call rejects with an HTTP-401-shaped error. The page handles this gracefully:
- Renders `<ErrorState variant="auth-required">` which shows the bare results section as an empty state plus a nudge: "Sign in to your Baobab account for AI-powered answers." Result links may be absent (if worker returns 401 with no body) — in that case it's a pure nudge.

If the worker is reachable but returns an error (5xx, timeout), render `<ErrorState variant="unavailable">`: "Grove search is unavailable. Try again in a moment."

## Data flow

### Happy path

```
User types `baobab tree facts` in omnibar → Enter
  → Omnibar.submit():
      parsed = { kind: 'search', query: 'baobab tree facts' }
      navigate(activeId, 'tauri://localhost/search.html?q=baobab%20tree%20facts')
  → Tab webview navigates to that URL
  → Vite serves search.html → loads /src/search.tsx → mounts <SearchApp/>
  → SearchApp:
      readQueryFromURL() → 'baobab tree facts'
      store.runSearch('baobab tree facts')
        → status: 'loading'
        → aiClient.search({ query }) hits /api/ai/search
        → worker responds { answer: '...', results: [...] }
        → status: 'success'
  → AnswerCard renders answer; ResultList renders entries
  → User clicks a result → standard <a href> navigation → tab replaces search page with destination
```

### Refine in place

```
User on search page, clicks the sticky search input, edits query, presses Enter
  → SearchHeader emits onRefine(newQuery)
  → SearchApp updates location: history.pushState(null, '', `?q=${encoded}`)
      AND triggers store.runSearch(newQuery)
  → AnswerCard + ResultList re-render
  → Back button returns to previous query state via pushState entries
```

(Using `history.pushState` rather than full navigation keeps the page mounted — faster, no flash.)

### Empty results

```
Worker returns { answer: '...', results: [] }
  → ResultList renders <EmptyState query="X"> instead of zero entries
  → AnswerCard still renders if `answer` is non-empty
  → If both empty: page shows a single "No results in the grove" card with a tree illustration
```

### Worker auth required

```
aiClient.search() rejects with status 401
  → store.status: 'error', error: 'auth_required'
  → <ErrorState variant="auth-required" /> renders
```

### Worker unavailable (network or 5xx)

```
aiClient.search() rejects with a non-401 error
  → store.status: 'error', error: 'unavailable'
  → <ErrorState variant="unavailable" /> shows a retry button
```

## Visual specification

**Background:**
```css
background: linear-gradient(180deg, #fde7c4 0%, #f4d8a8 40%, #fffaf2 100%);
```
Lighter at the bottom for result legibility — the picker's deep sunset would tank readability for long result lists.

**Decorations:** Reuse `PickerDecorations` but with tighter placement and slower animations (search is utilitarian, motion should fade into the background). One new prop on the component: `density: 'picker' | 'page'` — `'page'` shows fewer + lower opacity.

**Header (sticky):**
- 56px tall, full-width, `position: sticky; top: 0; z-index: 10`
- Backdrop: `rgba(255,250,240,0.96)` with `backdrop-filter: blur(8px)`
- Bottom border: `1px solid rgba(60,30,15,0.12)`
- Logo on left: 24px leaf SVG circle (sunset gradient) + "baobab" wordmark in `Iowan Old Style` serif at 16px
- Search input: rounded 999px, 40px tall, soft `border: 1px solid rgba(60,30,15,0.18)`, focus `border-color: #c4881f`. Padding 12/20. Pre-filled with current query.
- Enter triggers refine

**Answer card:**
- Margin: 24px from header, 16px horizontal on >720px viewports, 8px on smaller
- Background: `#fffbef`
- Border: `1px solid rgba(196,136,31,0.35)`, `border-left: 4px solid #c4881f`
- Padding: 20px
- Label "FROM THE GROVE" at top in tiny uppercase orange
- Body in `Iowan Old Style` 16px, line-height 1.6, color `#3c1810`
- Subtle box-shadow: `0 2px 8px rgba(60,30,15,0.08)`

**Result entries:**
- Each entry: 12px vertical gap
- URL line: 12px, `#8a3a1f`
- Title link: 18px, `#1a4a8a`, hovers to `#0d2a5a` with underline
- No snippet line in v1
- Hover state: subtle 1px translate-up, no other change

**Empty / error states:**
- Centered in the page below the header
- Small GroveTree SVG (60px) on top
- Heading at 18px serif
- Body at 14px sans
- For "auth required": include a sign-in button styled like the existing AuthScreen buttons

**Loading:**
- Pulse-animated placeholder card matching AnswerCard dimensions
- Plus 3 skeleton result rows

## Error handling

- **Missing or malformed `?q=` param** — show empty state immediately (no API call); user can type into the sticky header to search.
- **Worker timeout** — `aiClient.search` rejects after the underlying fetch's default timeout. ErrorState (unavailable variant) with retry button.
- **Worker 401** — ErrorState (auth-required variant).
- **Worker 5xx** — same as timeout.
- **Refine while a previous search is in flight** — `runSearch` stores an incrementing `requestId`; when a response lands, only apply it if `requestId === store.currentRequestId`. Otherwise discard. Prevents stale results overwriting fresh ones.
- **Click a result, browser fails to load the destination** — that's the destination page's problem, not ours. Standard browser error page.

## Security

- **No new IPC commands.** Search page makes its `aiClient.search` call from the renderer like any other API consumer. No new attack surface.
- **No new permissions in `capabilities/default.json`.** The search page runs in the same Tauri window context as `index.html`; existing allowlist (`profile-*`, `picker`, `guest-*`) already covers any window that hosts a tab webview.
- **URL parameter sanitization** — `?q=` is read via `URLSearchParams` and only ever stringified into React text content (never injected as HTML). No XSS surface.
- **Result links** — rendered as `<a href>`. We do NOT add `rel="noopener noreferrer"` since the link target is the same tab. Standard browser behaviour applies.

## Testing

### TS unit (vitest)

- `useSearchData.runSearch(query)` — happy path: API success updates state to success with answer + results
- `useSearchData.runSearch(query)` — auth error: 401 → status 'error', error 'auth_required'
- `useSearchData.runSearch(query)` — unavailable: 5xx → status 'error', error 'unavailable'
- `useSearchData.runSearch(query)` — stale-response guard: a second runSearch supersedes the first; if first response lands later it's discarded
- `<SearchHeader>` — input pre-fills from prop, enter calls onRefine with trimmed value
- `<AnswerCard>` — renders the answer text and the "FROM THE GROVE" label
- `<ResultList>` — renders one entry per result; empty list renders the empty-state slot
- `<ResultEntry>` — title and URL render correctly; clicking the title triggers default link behaviour (verified via fireEvent)
- `<EmptyState>` — query text appears in the heading
- `<ErrorState variant="auth-required">` — sign-in nudge appears
- `<ErrorState variant="unavailable">` — retry button calls onRetry prop
- `Omnibar.submit()` parsing change — verifies a search query navigates to `tauri://localhost/search.html?q=...`
- `Omnibar` display value — when active tab URL is the search-page pattern, omnibar shows decoded query (not the URL)

### Integration / manual

1. Type `baobab` in omnibar → enter → active tab navigates to search page. Brand-rooted layout renders. AI answer + results visible within ~2 seconds.
2. Type `baobab tree facts` → similar, with multi-word query in the URL and displayed correctly.
3. Click a result → tab navigates to destination. Back button returns to search page (still showing query + results).
4. From search page, edit query in sticky header → enter → page updates with new results, URL bar reflects new query.
5. Sign out → search → expect ErrorState (auth-required) variant. Sign in → re-search → works.
6. Test refine: rapid two searches (`a` then immediately `b`) — final state shows `b`'s results, not `a`'s.
7. Test bare-word with no `.` (`youtube`) → search.
8. Test `.com`-suffixed word (`youtube.com`) → still navigates as URL, not search.
9. Open search page directly via `tauri://localhost/search.html?q=test` typed in omnibar → renders correctly.
10. Open with empty/missing `?q=` → empty state with input ready.

## Migration

No migration. Existing installs: omnibar behaviour change is invisible until a user types a search query; the first one routes to the new page.

## Acceptance criteria for v1

- ✅ Typing a search query in omnibar and pressing Enter navigates the active tab to a search results page
- ✅ The page renders an "From the grove" AI answer card when the worker returns one
- ✅ Results render as title+URL links
- ✅ Clicking a result navigates the tab to that URL
- ✅ Sticky search bar in the header lets the user refine without going back
- ✅ Omnibar displays the decoded query (not `tauri://...`) when on a search page
- ✅ The page works without signing in; if worker requires auth, an inline nudge appears
- ✅ Empty results show a brand-appropriate empty state
- ✅ Worker errors show a retry-able error state
- ✅ The picker's `PickerDecorations` are reused with reduced density on the search page
- ✅ No existing tests regress (170 TS + 70 Rust at HEAD stays green)
- ✅ Vite multi-page build produces `dist/search.html`

## Open questions

None. All design choices made.
