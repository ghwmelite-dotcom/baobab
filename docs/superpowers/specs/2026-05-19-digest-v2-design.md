# Digest v2 — Featured + Companions with Images

**Status:** Design approved 2026-05-19. Implementation plan to follow via `writing-plans`.
**Owner:** TBD (PM dispatches via Agent Hub)
**Surface:** Desktop NTP "Today on the continent" + worker `/api/continent-today` + new `/api/digest/img/:sha`.

## Summary

Replace the current text-only horizontal news strip with a magazine-style "featured + companions" layout: one large hero story with image, summary, and time-ago metadata, plus 4 compact thumb+title companion stories. Images are extracted from RSS feeds (with OG-image fallback), proxied through the worker, resized to WebP, and cached in R2. The digest refresh cadence drops from 12h to 2h. On slow connections (Bundle B `isSlow === true`), the layout stays but all image bytes are skipped — a session-scoped "Load images anyway" toggle lets curious users opt in.

## Goals

1. **Visual lift on the NTP** — the current text strip feels academic; African news media is highly visual. A magazine layout signals "alive, curated, contemporary."
2. **Latest-feeling content** — 2h refresh cadence (vs current 12h) so users opening the app multiple times a day see fresh stories.
3. **Data-savings parity** — images add bandwidth but must NOT undermine Bundle B's lite-mode pitch. Slow-mode renders the same layout text-only with zero image bytes.
4. **No regression in card-click behaviour** — clicking any card still opens the article in a new tab via `useTabsStore.openTab`.

## Non-goals

- Multi-DPR / `srcset` adaptive image serving (single WebP variant per role; future ticket).
- Adaptive quality based on observed network speed (only binary fast/slow split via existing `useConnectionStore`).
- Editorial curation (lead-story selection stays algorithmic — newest published, weighted by source diversity per existing `assembleDigest`).
- Image-CDN sweep job (R2 grows ~3MB/day forever; revisit at ~1TB).
- Per-source layout variations (all 6 sources render the same card style).

## Decisions matrix

| Axis | Decision | Rationale |
|---|---|---|
| Layout | Featured hero + 4 companions (Option B from brainstorm) | Magazine feel without dominating the NTP |
| Image source | RSS embed (`media:thumbnail`/`media:content`/`enclosure`) → OG image fallback | Near-100% coverage; OG fetch only on miss |
| Proxy | Worker fetch + CF Image Resizing to WebP + R2 cache | One IP exposure, ~30KB hero vs ~500KB original, free dedup across reruns |
| Refresh | 2-hour KV cache TTL (key bucketed by hour: `digest:YYYY-MM-DD-HH`) | "Latest" without flooding worker; cron pre-warms at 03:00 UTC |
| Slow-mode | Skip images entirely on `isSlow === true`; session-scoped opt-in toggle | Bundle B parity; user agency without churning bandwidth by default |
| Eagerness | Pre-warm hero (items[0]) during assembly; companions lazy | Instant hero render; cost smeared across users for thumbs |

## Architecture

Three changes across two surfaces:

**Worker** (`worker/`):
- `services/digest.ts` extended with `extractRssImage`, `extractOgImage`, `ensureImageInR2`. `assembleDigest` orchestrates: parse → AI summarize → OG fallback → hero pre-warm → return items with proxy URLs.
- New service `services/digest-img.ts` + route `routes/digest-img.ts` for the lazy image proxy endpoint.
- `types.ts` adds `imageUrl: { hero: string; thumb: string } | null` to `DigestItem`.

**Desktop** (`apps/desktop/src/digest/`):
- `DigestStrip.tsx` → renamed `DigestFeatured.tsx`. Reads `isSlow` from existing `useConnectionStore`.
- Two new child components: `FeaturedHero.tsx` and `CompanionCard.tsx`.
- `digest.store.ts` extended: `forceShowImages: boolean` action for the session-scoped "Load images anyway" override.

**Storage**:
- KV `PAGE_CACHE`:
  - `digest:YYYY-MM-DD-HH` — assembled digest, 2h TTL.
  - `digest-img-src:<sha>` — image URL side-index, 7d TTL.
  - `digest-lock:YYYY-MM-DD-HH` — in-flight assembly lock, 60s TTL (thundering-herd guard).
- R2 `ASSETS`:
  - `digest-img/<sha256(originalUrl)>/hero.webp` — 600w, quality 75.
  - `digest-img/<sha256(originalUrl)>/thumb.webp` — 200w, quality 75.

## Data flow

### Cache miss path (every 2h)

```
GET /api/continent-today
  ↓ assembleDigest()
  ├─ acquire digest-lock:<key> in KV (60s TTL). On conflict, poll cache + back off.
  ├─ Promise.allSettled across 6 sources, each:
  │    fetch RSS → parseRssItems(xml, source)
  │      ↓ for each <item>:
  │        - title, link, description, publishedAt   (existing)
  │        - rssImage = extractRssImage(block)
  │            tries <media:thumbnail url="">, <media:content url="" medium="image">,
  │            <enclosure type="image/*" url="">; returns string|null
  ├─ AI summarize each (existing) — parallel
  ├─ Sort + take top 10 (existing)
  ├─ For items[0..9] with rssImage === null:
  │     ogImage = extractOgImage(item.link, env)
  │       → fetch with Range: bytes=0-30000, 3s timeout, custom User-Agent
  │       → regex /<meta property="og:image" content="([^"]+)"/
  │       → resolve relative URL against item.link; reject data: URIs
  ├─ Pre-warm hero (items[0]):
  │     ensureImageInR2(env, items[0].imageUrl, ['hero'])
  │       → fetch(originalUrl, { cf: { image: { width: 600, format: 'webp', quality: 75 }}})
  │       → R2.put('digest-img/<sha>/hero.webp', body)
  │       → KV.put('digest-img-src:<sha>', JSON.stringify({url, source, addedAt}), {ttl: 604800})
  ├─ Map each item's imageUrl to proxy URLs:
  │     { hero: '/api/digest/img/<sha>?v=hero',
  │       thumb: '/api/digest/img/<sha>?v=thumb' }
  │   (or null if both rssImage and ogImage failed)
  ├─ KV.put('digest:<key>', JSON.stringify(items), {ttl: 7200})
  └─ release digest-lock
  ↓
return c.json({ items })
```

### Lazy image path (per-companion, on browser <img> request)

```
GET /api/digest/img/<sha>?v=hero|thumb
  ↓ rateLimit(60/min, key=ip)
  ↓ CORS (global middleware — http://tauri.localhost already allowed)
  ↓ Try R2.get('digest-img/<sha>/<variant>.webp')
  ├─ Hit → return stream with Cache-Control: public, immutable, max-age=2592000
  └─ Miss:
     ├─ Look up KV 'digest-img-src:<sha>'
     │  - Missing → 404
     │  - Present → originalUrl
     ├─ Fetch originalUrl with size cap 5MB, 5s timeout, custom UA
     │  Fail → 502
     ├─ Resize via fetch(url, { cf: { image: { width, format: 'webp', quality: 75 }}})
     │  - If CF Image Resizing unavailable → fall back to storing original bytes
     ├─ R2.put('digest-img/<sha>/<variant>.webp', resized)
     └─ Stream + Cache-Control
```

### Desktop render

```
NTP mounts
  ↓ DigestFeatured mounts → useDigestStore.fetch() if !loaded
  ↓ fetch /api/continent-today → items[]
  ↓ const isSlow = useConnectionStore(s => s.isSlow)
  ↓ const forceImages = useDigestStore(s => s.forceShowImages)
  ↓ const showImages = !isSlow || forceImages

  if items.length === 0: <EmptyState />
  else:
    <FeaturedHero item={items[0]} showImage={showImages} />
    {items.slice(1, 5).map(i => <CompanionCard item={i} showImage={showImages} />)}
    {isSlow && <LoadImagesAnywayPill />}

  <img src={item.imageUrl?.hero} loading="eager" onError={...} />
  <img src={item.imageUrl?.thumb} loading="lazy" onError={...} />
```

## Worker code structure

### Files

```
worker/src/services/
  digest.ts                    [modified]
  digest-img.ts                NEW

worker/src/routes/
  digest-img.ts                NEW
  continent-today.ts           [unchanged — just consumes new digest.ts shape]

worker/src/types.ts            [modified — DigestItem field]
worker/src/index.ts            [modified — register /api/digest/img route]
```

### Function signatures

```ts
// services/digest.ts
function extractRssImage(block: string): string | null

async function extractOgImage(
  articleUrl: string,
  env: Env
): Promise<string | null>

async function ensureImageInR2(
  env: Env,
  imageUrl: string,
  variants: ('hero' | 'thumb')[]
): Promise<string>  // returns sha256 of originalUrl

// services/digest-img.ts
async function serveImage(
  env: Env,
  sha: string,
  variant: 'hero' | 'thumb'
): Promise<Response>
```

### Endpoint contract

```
GET /api/digest/img/:sha?v=hero|thumb
  v=         'hero' | 'thumb' (default 'thumb')
  200        image/webp + Cache-Control: public, immutable, max-age=2592000
  404        side-index expired (image hasn't been served in 7+ days)
  502        upstream fetch failed and nothing in R2
  429        rate-limit (60/min/IP)
```

### Why a KV side-index instead of signed URLs in the DigestItem payload

Signed URLs (`/api/digest/img?u=<base64>&sig=<hmac>`) keep the worker stateless but bloat every DigestItem by ~200 chars per URL (5 items × 2 variants = 2KB per response just for URLs). And rotating the HMAC secret invalidates in-flight links. KV side-index (`digest-img-src:<sha>`) keeps URLs short (32-char sha) at the cost of one KV read per cache-miss (~1ms on Workers). Acceptable trade.

## Desktop components

### File structure

```
apps/desktop/src/digest/
  DigestFeatured.tsx          [renamed from DigestStrip.tsx]
  FeaturedHero.tsx            NEW
  CompanionCard.tsx           NEW
  digest.store.ts             [modified — forceShowImages action]
```

### Props

```ts
// FeaturedHero.tsx
interface Props {
  item: DigestItem
  showImage: boolean
}

// CompanionCard.tsx
interface Props {
  item: DigestItem
  showImage: boolean
}
```

### Visual specs (matches the approved mockup at .superpowers/brainstorm/.../desktop-components.html)

**FeaturedHero** (~1.6fr column):
- Outer button: `background: #fffaf2`, `border: 1px solid rgba(196,136,31,0.35)`, `border-top: 4px solid #c4881f`, `border-radius: 14px`, `overflow: hidden`, flex-column.
- Image: 16:9 aspect-ratio, `border-radius: 10px 10px 0 0`. Absolute-positioned source pill top-left: `🇿🇦 Daily Maverick` with `background: rgba(60,24,16,0.7)`, `color: #fde7c4`, `font-size: 9px`, uppercase letterspacing `0.12em`.
- Body (16px padding): title (Iowan Old Style serif, 17px, 500 weight, line-height 1.25), summary (font-default, 11.5px, line-height 1.45, 3-line clamp), footer (`Read on {source} · {timeAgo}` in font-default 10px, color `#8a6e3a`).
- Slow-mode variant: replace 16:9 image area with a `border-left: 4px solid #c4881f` (vs border-top), source pill becomes inline text above title.

**CompanionCard** (1fr column, stacked 4-row × 8px gap):
- Outer button: same surface tokens as hero, `border-radius: 10px`, 8px padding.
- Image (showImage=true): 56×56 square, `border-radius: 6px`, `flex: 0 0 56px`.
- Right side: source eyebrow (9px uppercase) + title (Iowan Old Style 12px, 500, 2-line clamp).
- Slow-mode variant: drop the 56×56 thumb entirely, expand padding to 10px×12px.

**`LoadImagesAnywayPill`** (visible only when `isSlow === true`):
- Position: top-right of the section header (next to "Today on the continent").
- Style: rounded pill (border-radius 999px), transparent background, `border: 1px solid rgba(60,30,15,0.2)`, `color: #6f3a14`, `font-size: 10px`.
- Click: `useDigestStore.getState().setForceShowImages(true)` — session-scoped (NOT persisted to disk).

### Store changes

```ts
// digest.store.ts additions
interface DigestState {
  // ... existing
  forceShowImages: boolean
  setForceShowImages: (v: boolean) => void
}

// in create():
forceShowImages: false,
setForceShowImages: (v) => set({ forceShowImages: v }),
```

`isSlow` is read directly from `useConnectionStore` in the component, not mirrored into the digest store.

## Error handling

### Image discovery (assembly time, per item)

| Failure | Behavior |
|---|---|
| RSS image tags malformed/missing | Skip to OG fallback |
| OG fetch 4xx/5xx / 3s timeout | `imageUrl = null`; card renders without image |
| OG HTML has no `<meta property="og:image">` | Same as above |
| `og:image` relative URL | Resolve against `item.link` |
| `og:image` is `data:` URI | Reject (no resize on inline blobs) |
| Source blocks default UA | Use `User-Agent: Mozilla/5.0 (compatible; BaobabDigest/1.0; +https://baobab.africa)`; if still blocked, accept `null` |

### Image fetch + resize (pre-warm or lazy)

| Failure | Behavior |
|---|---|
| Upstream 4xx/5xx | No R2 write. Lazy path returns 502. |
| Upstream >5MB | Abort fetch, treat as failed |
| Bad SSL cert | Worker fetch rejects, treated as failed |
| CF Image Resizing returns error | Store original bytes in R2, serve as-is (degraded but functional) |
| R2.put fails | Log + serve upstream bytes one-shot; next request retries |
| KV side-index expired but R2 image present | Serve R2 object anyway (URL no longer needed) |

### Concurrency

| Scenario | Behavior |
|---|---|
| Cache expires while many users loading | `digest-lock:<key>` (60s TTL) ensures one assembler; others poll cache with exponential backoff (250ms, 500ms, 1s) |
| Cron pre-warm fails | Next user request re-triggers assembly. Cron is an optimization, not correctness. |
| Same article across two feeds | Deduped by URL hash (existing `FINAL_ITEM_LIMIT = 10` logic); image SHA = SHA of original image URL, so same image dedups in R2 across reruns |

### Browser-side fallback

```tsx
<img
  src={item.imageUrl?.hero}
  loading="eager"
  onError={() => setImageFailed(true)}
  alt=""
/>
{imageFailed && <TextOnlyHeroFragment item={item} />}
```

If the proxy returns any error at runtime, the card silently falls back to the text-only variant. No broken-image icon is ever shown.

## Caching strategy

| Layer | Key | TTL | Notes |
|---|---|---|---|
| Digest assembly | `digest:YYYY-MM-DD-HH` (bucketed to even hours) | 2h | 12 unique keys per day, all expire naturally |
| Image URL side-index | `digest-img-src:<sha>` | 7d | Long enough that R2 images stay reachable |
| Assembly lock | `digest-lock:YYYY-MM-DD-HH` | 60s | Thundering-herd guard |
| R2 image objects | `digest-img/<sha>/<variant>.webp` | none (immutable) | Same source URL → same sha → same object; natural dedup |
| HTTP response on `/api/digest/img` | n/a (Cache-Control header) | 30d on browser/CF edge | Once served, never re-validated |

**Growth estimate:** ~50 unique articles/day × 2 variants × ~30KB = ~3MB/day = ~1GB/year. Well under R2 free tier ceiling. Schedule a sweep job at ~1TB; no action needed pre-launch.

## Testing

### Worker (vitest, mocked fetch/KV/R2)

```
worker/src/services/digest.test.ts             [extend]
  extractRssImage: table-driven across 6 sources' typical patterns
  extractOgImage: mock HTML for og:image present/absolute/relative/missing/timeout/4xx
  ensureImageInR2: R2 hit / R2 miss + successful resize / upstream fail / >5MB / CF resize fail
  assembleDigest: happy path + mixed-image-presence + concurrent assembly lock

worker/src/routes/digest-img.test.ts            NEW
  R2 hit → 200 with immutable Cache-Control
  R2 miss + URL in side-index → fetch + resize + R2.put + 200
  R2 miss + side-index expired → 404
  Upstream 5xx + R2 miss → 502
  Rate-limit: 61st req from same IP in 60s → 429
  v=hero vs v=thumb width selection
  default v= → 'thumb'
```

### Desktop (vitest)

```
apps/desktop/src/digest/DigestFeatured.test.tsx [extend]
  items.length === 0 → empty state
  items.length >= 5 → FeaturedHero + 4 CompanionCards rendered
  items.length === 3 → FeaturedHero + 2 cards (graceful degradation)
  isSlow === true → text-only variant, zero <img> elements
  forceShowImages toggle → flips back to image variant
  imageFailed onError swap → TextOnlyHeroFragment renders, no broken-image icon
  openTab called with item.url on click + keyboard (Enter, Space)

apps/desktop/src/digest/digest.store.test.ts    [extend]
  fetch parses imageUrl: { hero, thumb } | null shape correctly
  forceShowImages action toggles + persists within session, not across re-load
```

### Accessibility

- `alt=""` on all `<img>` is intentional (decorative; meaning carried by title text); parent `<button>` has `aria-label={`${title} — Read on ${source}`}`.
- Keyboard nav: Tab through hero → 4 companions; Enter/Space opens. Focus ring uses `--accent-light`.
- Source pill on hero (dark overlay over image): 4.5:1 contrast against the variety of test images verified.

### Manual smoke (pre-tag)

1. Cold NTP → hero loads instantly (pre-warmed R2), companions appear progressively as scrolled into view.
2. After 2h+ → new digest assembles; hero appears within ~1s of first request.
3. Trip slow-mode in chrome connection pill → digest re-renders text-only with no image bytes in network panel.
4. Click "Load images anyway" → image variant returns; reopen NTP → defaults back to text-only.
5. Block `*.r2.dev` in devtools → cards still render via `onError` fallback, no broken-image icons.
6. Click any card → opens article in new tab (existing behavior).
7. Inspect `/api/digest/img/<sha>?v=hero` → `Content-Type: image/webp`, `Cache-Control: public, immutable, max-age=2592000`.
8. Cron pre-warm: trigger manually via `wrangler dev` cron preview; verify `digest:YYYY-MM-DD-HH` key appears with hero pre-warmed.

## Rollout

**Pre-merge:**
- Verify CF Image Resizing is enabled on the OHCS Workers account. If not, the wasm fallback (`@cf-wasm/image-optim` or similar) is acceptable for v2.0 — same WebP output, ~150KB worker bundle bump. Confirm before tagging.
- No new secrets required. Worker already has `ASSETS` R2 bucket and `PAGE_CACHE` KV.

**Deploy order:**
1. Worker deploy with new endpoints + assembled digest shape.
2. Desktop release (next `desktop-v0.1.0-rN`) with `DigestFeatured` + components.
3. Old r39 clients keep working — their `digest.store.ts` will see `imageUrl: { hero, thumb }` but the old `DigestStrip` will just ignore it (no schema-breaking changes; `DigestItem` interface only added a field).

**Feature flag:** None. The desktop release flips the visual atomically. Old clients see no change since they don't reference `imageUrl`.

**Backward compat:**
- Worker `/api/continent-today` response shape grows by one optional field. r32-r38 clients keep working.
- New `/api/digest/img/:sha` is additive.

## Acceptance criteria

1. Worker `vitest run` green, including all new test cases.
2. Desktop `vitest run` + `tsc --noEmit` green.
3. Manual smoke checklist 8/8 passes.
4. p95 `/api/continent-today` latency ≤ 3s on cache miss (includes hero pre-warm).
5. p95 `/api/digest/img/:sha?v=hero` latency ≤ 100ms on cache hit, ≤ 1.5s on cache miss.
6. Slow-mode connection (DevTools throttling = Slow 3G + `isSlow === true`) → zero image bytes on the network panel for the NTP load.
7. R2 `ASSETS` bucket growth observed at ≤ 5MB/day during week-1.
8. Hero image renders within 200ms of NTP mount on a warm cache.

## Out of scope (post-launch tickets)

- Multi-DPR `srcset` variants (2x, 3x).
- "Why this story?" tooltip on hero (editorial signal).
- Inline image attribution / Creative Commons credit for sources that require it.
- A "Read more" expand-summary on hero (currently 3-line clamp).
- Cron sweep for R2 images older than N months.
- Per-user feed personalization (relevance ranking based on past clicks).
- Native Tauri image cache for faster cold-launch rendering.
