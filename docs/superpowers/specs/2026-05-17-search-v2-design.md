# Baobab Search v2 — Africa-First Conversational Search Design

**Status:** draft (awaiting user review)
**Date:** 2026-05-17
**Branch context:** v1 ships a brand-rooted search portal (`search.html` Vite entry, AI answer card + result list, sunset-gradient page, `/api/ai/search` worker route). v1 explicitly defers: result snippets, image/video/news tabs, related questions, autocomplete, suggestions, pagination, alternative engines. v2 takes the brand foundation and turns search into a flagship, distinctively Baobab feature.

## Goal

Make Baobab's search the visible front of its African-first identity: every query returns results re-ranked to surface African sources first, every answer cites African experts/publications by name, and conversational refine lets users go deeper on African topics without losing context. Backed by Google's actual search index (PSE), with a quantified trust badge and a bilingual answer mode that no other browser offers.

## Honest scope and non-goals

**What v2 ships:**

- New `/api/search` worker route backed by Google Programmable Search Engine + Workers AI (`@cf/meta/llama-3.1-8b-instruct`, matching the existing `/api/ai/search` model choice). Old `/api/ai/search` deprecated but kept for backward compat during rollout.
- Result re-ranking that bubbles African sources to the top with country flag + "African Source" badge. Static allowlist of African TLDs + curated publication domains.
- AI answer prompt instructs the LLM to prefer African experts and publications when citing. Citations returned as structured `{name, country, type}` array; rendered as named pills under the answer.
- **Intent detection:** navigational vs informational. Navigational queries (≤2 words, no question word, top result domain ≈ query) render a Google-style site card with logo / URL / Visit / sitelinks instead of a prose answer.
- **Conversational refine bar** sticky at page bottom. Follow-up queries include `contextChain` of prior query/answer pairs in the worker request; worker uses it in the LLM prompt for contextual answers. In-memory only — refresh clears the chain.
- **(C1) Source diversity meter** — compact badge under the answer card: source count, country count, % African voices.
- **(A1) Bilingual answer** — when the active profile has a heritage language set (Yoruba / Swahili / Hausa / Igbo / Amharic / Zulu / Xhosa / Wolof / Akan), the answer card renders English and that language side-by-side. Translation via existing `/api/translate`. Cached in the worker response.
- **(B2) Search-while-reading** — right-click any selected text on any web page → "Search Baobab for '<selection>'" → AI sidebar opens with the selection as a context-aware query (sourceUrl/sourceTitle passed to worker). First-class browser primitive.
- KV-backed response caching keyed on `sha256(query + targetLanguage + contextChain_hash)`. 24-hour TTL.
- Daily PSE quota counter with soft cap (9500/day) that triggers AI-only fallback before hitting Google's hard cap.

**Explicitly NOT in v2** (deferred to v2.1+):

- A2 currency-rewrite ("iPhone 15" → NGN by default)
- A3 Pidgin / Swahili / Hausa query understanding (query-side language detection)
- A4 WhatsApp / Telegram community results
- B1 cross-tab context as implicit search input
- B3 personal knowledge graph from bookmarks
- C2 citation hover-highlight (interactive prose ↔ source linking)
- C3 "show me the other side" toggle (Western vs African framing)
- C4 freshness stamp on answers
- D1 shareable search snapshots / public permalinks
- D2 publishable refine threads
- E1 bytes-saved badge per search
- E2 "queries stayed on your continent" sovereignty affordance
- Business / Local intent (maps, listings) — needs maps data, defer
- Image / video / news / shopping result tabs
- Per-profile alternative search engine (Baobab is the default; no alternatives in v2)
- Pagination (PSE returns 10/page; v2 shows first page only)
- Real-time streaming of partial answer text (worker waits for full LLM response)

## Key decisions

| Decision | Choice | Reasoning |
|---|---|---|
| Flagship direction | Africa-first answers | User picked over Perplexity-style, bytes-saved, privacy/sovereignty. Leans on existing brand + worker-side AI infra. |
| Sub-features | AI cites African voices + Result rank boost + Google index access | Multi-select user choice. Defers translation toggle, rich place/people cards. |
| Search backend | Google Programmable Search Engine | Hits Google's actual index. 100/day free, $5/1000 paid, $50/day hard cap. Cheapest credible quality match. |
| Approach | Conversational Africa (Perplexity-style) | Picked over layered enhancement (too incremental) and Pano view (heavy, sidebar data unsourced). |
| Out-of-this-world | Source diversity meter + Search-while-reading + Bilingual answer | All three combinable in ~4.5 days; uniquely Baobab. |
| Re-rank strategy | Stable sort by African flag + curated publication match | Preserves PSE's relevance ordering within each bucket. No ranking model from scratch. |
| Intent detection | Heuristic (query length + question word + domain match) | Avoids classifier training. ~30 lines of worker code. |
| Citation extraction | Hard-prompt JSON + brace-scan parser, mirroring v1 ai.ts pattern | Workers AI llama's `response_format` is documented-inconsistent (existing comment in `worker/src/routes/ai.ts:198`). Use the same `extractJson` helper v1 uses; validate each citation's name against the result set before inclusion. |
| Refine context store | In-memory per tab, no persistence | Refresh clears chain. Avoids cross-session privacy concerns. Server-side only via request payload. |
| Caching key | `sha256(query + targetLanguage + sha256(contextChain))` | Per-language, per-conversation entry. Hits common cases without cross-contamination. |
| Quota fallback | Soft cap (9500/day) → AI-only mode with cached results-of-similar-queries when available | Graceful degradation. Hard cap = AI knowledge only. |
| Auth | Public (anonymous OK), cached responses served to anonymous; signed-in users get fresh PSE | Search must work for all. Cost control via cache hit ratio. |
| Heritage language setting | Per-profile in Settings → Language section | Separate from UI language. Defaults to null (no bilingual). |

## Architecture

```
┌──────────── User journey ────────────────────────────────────────────┐
│                                                                      │
│  Omnibar query           Right-click selection                        │
│       │                       │                                       │
│       ▼                       ▼                                       │
│  search.html              AI Sidebar (B2)                             │
│       │                       │                                       │
│       └───────────┬───────────┘                                       │
│                   ▼                                                   │
│         POST /api/search                                              │
│                   │                                                   │
│                   ▼                                                   │
│  ┌────────────── Worker ───────────────────────────────────────────┐  │
│  │                                                                 │  │
│  │  searchCache.get(key)  ──hit──> return                          │  │
│  │       │ miss                                                    │  │
│  │       ▼                                                         │  │
│  │  searchQuota.consume()  ──over──> mark fallbackMode='ai-only'   │  │
│  │       │                                                         │  │
│  │       ▼                                                         │  │
│  │  pse.searchGoogle(query)  →  10 raw results + pagemap           │  │
│  │       │                                                         │  │
│  │       ▼                                                         │  │
│  │  africaRank.rerank(results)  →  annotated + sorted (Africa top) │  │
│  │       │                                                         │  │
│  │       ▼                                                         │  │
│  │  intent.detectIntent(query, results)                            │  │
│  │       │                                                         │  │
│  │       ├─ if nav: intent.extractSiteCard(results[0])             │  │
│  │       ▼                                                         │  │
│  │  answerSynthesis.synthesize(query, top-N, contextChain?)        │  │
│  │       → { answer.en, citations[] }                              │  │
│  │       │                                                         │  │
│  │       ├─ if targetLanguage: translate.translate(answer.en)      │  │
│  │       ▼                                                         │  │
│  │  compute diversity (counts + %African)                          │  │
│  │       │                                                         │  │
│  │       ▼                                                         │  │
│  │  searchCache.set(key, response, 24h)                            │  │
│  │       │                                                         │  │
│  │       ▼                                                         │  │
│  │  return SearchResponse                                          │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

## Response shape

```ts
interface SearchResponse {
  intent: 'navigational' | 'informational'
  query: string
  answer: {
    en: string
    bilingual?: { lang: 'yo'|'sw'|'ha'|'ig'|'am'|'zu'|'xh'|'wo'|'ak', text: string }
  } | null   // null only on AI failure after PSE success
  citations: Array<{
    name: string         // "Souleymane Sidibé"
    country: string      // ISO-3166 alpha-2, e.g. "ML"
    url?: string
    type: 'scholar' | 'publication' | 'institution'
  }>
  results: Array<{
    title: string
    url: string
    snippet: string
    source: string       // displayLink, e.g. "techcabal.com"
    country?: string     // ISO from TLD or curated mapping
    isAfrican: boolean
  }>
  diversity: {
    sourceCount: number
    countryCount: number
    africanVoicePercent: number   // 0..100
  }
  siteCard?: {           // populated only when intent === 'navigational'
    name: string
    logoUrl?: string     // from PSE pagemap, optional
    url: string
    country?: string
    description: string
    sitelinks: Array<{ title: string, path: string, url: string }>
  }
  meta: {
    cached: boolean
    pseQueriesRemainingToday: number
    fallbackMode?: 'ai-only' | 'quota-degraded'
    translateFailed?: boolean
  }
}

interface SearchRequest {
  query: string
  context?: Array<{ query: string, answer: string }>
  targetLanguage?: 'yo'|'sw'|'ha'|'ig'|'am'|'zu'|'xh'|'wo'|'ak'
  // Search-while-reading enrichment:
  source?: { url: string, title: string }
}
```

## Worker changes

**New files** (under `worker/src/`):

| File | Responsibility |
|---|---|
| `routes/search.ts` | New `/api/search` handler. Orchestrates cache → quota → PSE → rerank → intent → answer → diversity → translate. ~120 LoC. |
| `services/pse.ts` | Google PSE client wrapper. `searchGoogle(query, num=10): Promise<PseResult[]>`. Uses `env.GOOGLE_PSE_API_KEY` + `env.GOOGLE_PSE_CX`. ~60 LoC. |
| `services/africaRank.ts` | `rerank(results: PseResult[]): AnnotatedResult[]`. Reads from `data/africanSources.ts`. Adds `isAfrican` + `country`. Stable sort: African first, preserves PSE order within buckets. ~80 LoC. |
| `services/intent.ts` | `detectIntent(query, topResult): 'navigational'\|'informational'`. Rules: ≤2 word query + no question word ("how/what/why/when/where/who/which") + top result domain ≈ query (substring or token match). Also `extractSiteCard(result)` from PSE `pagemap`. ~70 LoC. |
| `services/answerSynthesis.ts` | `synthesize(query, results, contextChain?, source?): Promise<{answer, citations}>`. Builds LLM prompt with Africa-first instruction. Hard-prompt JSON output (`@cf/meta/llama-3.1-8b-instruct`) parsed via existing `extractJson` brace-scanner (factored out of `worker/src/routes/ai.ts`). Citation `name` cross-checked against result set; orphans dropped. ~100 LoC. |
| `services/searchCache.ts` | `cacheGet(key)/cacheSet(key, response, ttl)`. Uses existing KV namespace. Key = `sha256(query + targetLang + sha256(contextChain))`. ~40 LoC. |
| `services/searchQuota.ts` | Daily PSE counter in KV (`pse:quota:YYYY-MM-DD`). `consume(): { allowed, fallbackMode }`. Soft cap 9500/day → falls back to AI-only. ~50 LoC. |
| `data/africanSources.ts` | Static export: `AFRICAN_TLDS: Set<string>` (`.ng`, `.ke`, `.za`, `.gh`, `.et`, `.tz`, `.ug`, `.zw`, `.ci`, `.sn`, `.ml`, `.ma`, `.eg`, `.dz`, `.mz`, ...) and `AFRICAN_PUBLICATIONS: Map<string, ISOCountry>`. Seed list comes from the existing prompt in `worker/src/routes/ai.ts:204` (`premiumtimesng.com`, `dailymaverick.co.za`, `theeastafrican.co.ke`, `africanews.com`, `gov.ng`, `gov.ke`, `gov.gh`, `gov.za`, `au.int`); extend with `techcabal.com`, `mg.co.za`, `theafricareport.com`, `africa.businessinsider.com`, `ventureburn.com`. ~80 LoC. Maintained by hand initially. |

**Modified files:**

- `worker/src/index.ts` — register `/api/search` route. Keep `/api/ai/search` route for v1 desktop clients still in the wild (returns the old shape via a thin adapter calling the new handler).
- `worker/wrangler.toml` — add `GOOGLE_PSE_API_KEY` + `GOOGLE_PSE_CX` as secrets. Document setup in `worker/SECRETS.md`.
- `packages/cloud-client/src/ai.ts` — extend `aiClient.search()`:
  ```ts
  search(req: {
    query: string,
    context?: Array<{query, answer}>,
    targetLanguage?: string,
    source?: { url: string, title: string }
  }): Promise<SearchResponse>
  ```
  Old signature still works (request fields optional).

## Client / search.html changes

**Modified files** in `apps/desktop/src/search/`:

| File | Status | Changes |
|---|---|---|
| `SearchApp.tsx` | Modified | Branches on `intent`. Reads heritage language from profile/auth store. Manages contextChain for refine. |
| `SearchHeader.tsx` | Unchanged | Sticky bar stays. |
| `AnswerCard.tsx` | Modified | Bilingual 2-col grid when `answer.bilingual` present. Renders voice pills below prose. |
| `SiteCard.tsx` | New | Navigational variant: logo / name / URL / Visit button / sitelinks grid / context strip. |
| `DiversityMeter.tsx` | New | Renders 3 stats + African-voice progress bar. |
| `ResultList.tsx` | Modified | Each item: country flag emoji + African badge. |
| `ResultEntry.tsx` | Modified | Adds snippet, country flag, badge. |
| `RefineBar.tsx` | New | Sticky-bottom input. Push to history via `pushState`. Push prior to local contextChain. |
| `useSearchData.ts` | Modified | Store shape grows: intent, siteCard, diversity, contextChain, targetLanguage. Adds `refine(query)` action. |
| `LoadingState.tsx` | Modified | Skeletons for site card variant + diversity meter shimmer. |
| `ErrorState.tsx` | Modified | New `quota_degraded` variant. |

**Profile setting:**

- `apps/desktop/src/settings/sections/LanguageSection.tsx` — new "Heritage language for answers" dropdown. Persists to existing scoped per-profile storage.

## Search-while-reading (B2)

**Modified files:**

| File | Changes |
|---|---|
| `apps/desktop/src-tauri/src/tabs.rs` | Emit `app://selection-search` event when context-menu "Search Baobab" is invoked with selection text. Reuses existing selection plumbing from translate-selection flow. |
| `apps/desktop/src/chrome/contextMenus.ts` | Add "Search Baobab for '<selection>'" entry. Visible only when text is selected. |
| `apps/desktop/src/ai/Sidebar.tsx` | New entry path: when `app://selection-search` event fires, auto-open sidebar, switch to "search" mode, pre-fill input with selection. |
| `apps/desktop/src/ai/ChatPanel.tsx` | Selection-mode: first submit calls `/api/search` with `source: { url, title }`. Renders compact answer card + top 3 results inline. Click a result → opens in active tab. |
| `apps/desktop/src/ai/ai.store.ts` | New action `runSearchFromSelection(text, source)`. New `mode: 'chat'\|'search'` state field. |

Keyboard alternative: `Ctrl+Shift+S` with active selection invokes the same flow without right-click.

## Error handling

| Failure | Worker behaviour | Client UI |
|---|---|---|
| Worker 5xx / unreachable | — | `error: 'unavailable'` + retry button |
| Quota soft-cap hit | 200 OK, `fallbackMode: 'quota-degraded'`, AI-only answer using cached similar queries if available, no fresh citations | Banner: "Search at capacity — answer is AI-only, citations limited" |
| Quota hard-cap hit | 200 OK, `fallbackMode: 'ai-only'`, AI knowledge only, no PSE call at all | Banner: "Live search unavailable today" |
| PSE returns 0 results | 200 OK, `results: []`, AI-only answer | Answer renders, empty results section, hint message |
| AI synthesis fails after PSE OK | 200 OK, `answer: null, citations: []`, full results | Results list, no answer card, hint "Answer synthesis unavailable" |
| Translation fails (A1) | 200 OK, `answer.bilingual: null`, `meta.translateFailed: true` | English only, subtle note "Bilingual unavailable for this query" |
| Auth required (signed-in features) | 401 | `error: 'auth_required'`, results render with sign-in nudge |
| AbortController (user typed new query mid-load) | — | `requestId` guard discards stale response |
| Profile heritageLanguage = null | No translate call | English-only, no note |
| Refine with no contextChain | Treated as fresh query | Normal flow |

## Edge cases

- Empty query → worker 400 → client EmptyState with "Enter something to search"
- Query > 2000 chars → worker truncates + header `x-query-truncated: true` → client shows truncation indicator
- Query is URL → handled by Omnibar before reaching search.html (existing behaviour, unchanged)
- Same query within 24h → `meta.cached: true` returned; subtle cached indicator
- Concurrent refines → latest wins via `requestId` guard
- Profile with PIN, user not yet authenticated → search works anonymously; A1 disabled
- User on Slow 3G → search.html is in SKIP list for Bundle B intercept (internal page); page is < 30 KB; works fine

## Testing

| Layer | Coverage |
|---|---|
| Worker / unit | `pse.searchGoogle` (mocked fetch). `africaRank.rerank` table tests across 30+ domains. `intent.detectIntent` covering: short brand match (nav), long question (info), single-word non-brand (info), brand with question-word (info). `searchCache` round-trip with mocked KV. `searchQuota` cap behavior + day rollover. `answerSynthesis` prompt format + citation extraction with mocked LLM. |
| Worker / integration | `/api/search` happy path with mocked PSE + mocked LLM + KV emulator. Quota-exhausted fallback. Cache hit. Auth-required path. Bilingual translate path. Navigational intent → site card extraction. |
| Client / unit | `useSearchData.runSearch` happy path + stale-response guard. `useSearchData.refine` contextChain accumulation. `SiteCard` rendering. `DiversityMeter` math + bar fill calculation. `AnswerCard` bilingual vs monolingual. `ResultEntry` African badge + flag for various country codes. |
| Client / integration | `SearchApp` end-to-end with mocked worker response: informational query renders answer + diversity + results; navigational renders site card + related; refine adds to contextChain and triggers new fetch. |
| Cross-cutting | Search-while-reading: selection → context menu → sidebar opens → calls `/api/search` with sourceUrl/title context. |

**Manual smoke checklist** (pre-tag):
1. Empty omnibar Enter → no-op
2. "paystack" → navigational site card with 🇳🇬 flag + sitelinks
3. "history of Mansa Musa" → informational answer + African voice pills + diversity meter showing ≥40% African
4. Click Refine "What happened after his death?" → context-aware follow-up, contextChain visible in network payload
5. Set profile heritage language = Yoruba → next search shows bilingual EN/YO
6. Right-click selected text on Wikipedia → "Search Baobab" → sidebar opens, query auto-runs
7. Force quota exhaustion (mock) → degraded banner renders, AI-only answer
8. Disconnect network mid-search → error state, retry button works
9. Same query twice in a minute → second response shows `meta.cached: true`
10. Query with question word on a brand ("how does paystack work") → informational layout, not navigational

## Rollout / configuration

**Pre-merge:**
- `wrangler secret put GOOGLE_PSE_API_KEY` (Google Cloud Console → APIs & Services → Credentials → Create API key, restrict to "Custom Search JSON API")
- `wrangler secret put GOOGLE_PSE_CX` (Programmable Search Engine → cse.google.com → create engine: "Search the entire web", grab cx ID)
- Document setup in `worker/SECRETS.md`

**Cost monitoring:**
- Set Google Cloud billing alert at $40/day
- Set Cloudflare worker analytics alert on `/api/search` 5xx rate > 1%
- Worker logs `pseQueriesRemainingToday` per response for ad-hoc tracing

**Backward compat:**
- v1 desktop clients (r38 and earlier) still hit `/api/ai/search`. That route stays, returns the v1 `{answer, results: [{title, url}]}` shape. Worker adapter calls new handler internally and downcasts response. Deprecate the route once r39+ adoption hits 95% (per release-stats).

**Feature flag:**
- A1 bilingual answer is gated by profile setting (already opt-in by nature)
- B2 search-while-reading: ship as the default behaviour for selected text. Power users who don't want it can disable via Settings → Privacy → "Show 'Search Baobab' in context menu" toggle (~3 LoC).

## Risks / open questions

| Risk | Mitigation |
|---|---|
| PSE cost blows budget on a Hacker News spike | Hard daily cap ($50/day = 10K queries). Soft cap at 9500 → AI-only fallback. Cache hit ratio target 70%. Monitor first week. |
| Static African allowlist misses smaller publications | Hand-curated initially. Add a "Tag as African source" mechanism in future (v2.2) so users can propose additions. |
| African TLD ≠ African content (e.g., `.ng` site about Nigeria written by Reuters) | OK — we're surfacing African-domiciled SOURCES, not authenticating content origin. Honest framing. |
| Bilingual translation quality varies wildly (Yoruba better than Igbo) | Existing translate quality is what it is. Show "Bilingual unavailable for this query" gracefully when translate returns garbage (low confidence score). |
| LLM citation extraction returns hallucinated names | Cross-check citation `url` (if provided) against actual results list; drop citations whose URL isn't in the result set. Trust-but-verify. |
| Search-while-reading: selection on text-heavy pages might be huge (a paragraph) | Cap selection input at 500 chars in the worker. Truncate client-side with toast. |
| Refine context unbounded growth | Cap contextChain at 5 entries (sliding window). LLM context window concern + UX clarity. |

## Success criteria

v2 ships when:
1. All testing checklist items pass
2. Cache hit ratio ≥ 60% on dogfood traffic over 24h
3. African voices % shows ≥ 40% on "African topic" sample queries (Mansa Musa, jollof, Lagos fintech, Cape Town water crisis, Amapiano)
4. p95 worker latency ≤ 2000ms (includes PSE + LLM + translate when applicable)
5. p95 cached response latency ≤ 200ms
6. Source diversity meter renders correctly on all 10 smoke-test queries
7. Bilingual answer renders for Yoruba/Swahili/Hausa profile on at least 80% of queries (lower for less-resourced languages is acceptable)
8. Manual smoke checklist 10/10 passes

Post-ship metrics to track for v2.1 planning:
- PSE queries per active user per day
- Refine-bar usage rate (refines per search session)
- Search-while-reading invocations per active user per day
- Heritage language opt-in rate
- Cache hit ratio by query class
