# Baobab Landing Page — Design Spec

## Overview

A marketing landing page for Baobab — the African AI browser — to live at `baobab.askozzy.work`. The page does three jobs simultaneously: tells the sovereignty story, showcases shipping features, and drives Windows installs. It speaks to four personas (curious individuals, African builders, diaspora readers, decision-makers in orgs) via a shared narrative followed by color-coded persona bands.

The page must dogfood the data-savings positioning: small JS bundle, fast first paint on slow connections, no third-party trackers. Visual identity reuses the desktop picker's Grove vocabulary (animated baobab tree, Sahel sunset palette, scattered African motifs, Recoleta serif wordmark) but composes new marketing-native pieces — it's on-brand without feeling like an in-app screen.

The single-page layout includes an inline "try the AI" widget that calls the worker's already-public `/api/ai/search` endpoint, giving visitors proof of the product without forcing an install first.

## Decisions locked (from brainstorm 2026-05-17)

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Page job = balanced (story + features + download), not a single-CTA funnel | All four personas need addressing; OS-Browser-style does this and works. |
| 2 | Audience = all four personas (curious individual + builder + diaspora + decision-maker) | User confirmed all four matter. |
| 3 | Structure = single page + color-coded persona bands | One URL, four front doors; persona bands sit after shared feature blocks. |
| 4 | Visual = Grove vocabulary + marketing-native compositions | Reuse picker palette/motifs/wordmark/`GroveTree.tsx` as vocabulary but compose new marketing pieces. |
| 5 | Tech = Astro + React islands | SSG for SEO/perf; React hydration only on animated components. |
| 6 | Hosting = Cloudflare Pages on OHCS account | Same account as worker; free; native Astro adapter. |
| 7 | Section outline locked (9 sections) + AI demo IN + waitlist OUT for v1 | AI demo is cheapest proof point; waitlist deferred until macOS/Android launch. |
| 8 | Hero = "B · Concrete" — "A browser that doesn't waste your data." + side-accent tree + "Download for Windows · 2.1 MB" CTA | Specific value upfront is universally legible across personas. |
| 9 | Domain = `baobab.askozzy.work` (subdomain of askozzy.work, already on Cloudflare DNS) | No purchase needed; one-click custom domain on Pages. |

## Scope

In-scope (this spec):
- New `apps/site/` Astro project with the section outline below
- Cloudflare Pages deploy via GH integration (push to `main` → auto-build)
- Custom domain `baobab.askozzy.work` mapped to the Pages project
- Reuse of `GroveTree.tsx` from `apps/desktop/src/picker/` as a React island
- Inline AI demo widget calling existing public `/api/ai/search`
- Cloudflare Web Analytics integration (cookieless)
- SEO meta + OG image + sitemap + JSON-LD
- WCAG 2.1 AA compliance + `prefers-reduced-motion`

Out-of-scope (deferred):
- Update the worker's BaobabBot UA strings to match the new domain (`baobab.askozzy.work` vs `baobab.africa`) — separate 5-min PR
- Waitlist / email capture endpoint + D1 schema
- Per-persona dedicated `/for-x` pages (v2 if any persona band gets disproportionate clicks)
- macOS download button (paused; P0c C1 ticket)
- Android (no Tauri Android build yet)
- Multilingual landing (English only for v1)
- Authenticated downloads or referral tracking
- Blog / changelog hosted at the same domain (separate decision)

## Architecture

```
apps/
  desktop/        (existing — Tauri + Vite + React)
  site/           (NEW — Astro 4.x)
    astro.config.mjs           astro adapter: @astrojs/cloudflare
    package.json               independent — its own deps + scripts
    src/
      pages/
        index.astro            the single landing page
      components/
        Hero.astro             SSG; embeds <GroveTree client:visible />
        Manifesto.astro        SSG
        FeatureBlock.astro     SSG; reused 6× with props
        SovereigntyDeepDive.astro SSG; embeds screenshot of in-app dashboard
        AiDemo.tsx             React island; calls /api/ai/search via fetch
        PersonaBand.astro      SSG; reused 4× with props (color, label, copy, CTA)
        DownloadCta.astro      SSG; build-time fetch of latest GitHub Release asset size
        Footer.astro           SSG
        GroveTree.tsx          PORTED from apps/desktop/src/picker/GroveTree.tsx
        Decorations.tsx        PORTED + slimmed from apps/desktop/src/picker/PickerDecorations.tsx
      styles/
        tokens.css             ported from apps/desktop/src/styles/globals.css (Sahel palette + Recoleta)
        global.css             a11y reset + landing-specific layout
      lib/
        latest-release.ts      build-time fetch of GH Releases API for asset size in CTA
      assets/
        og-image.png           1200×630 — hand-composed hero + headline
        screenshots/           PNGs captured from the running desktop app
worker/         (existing — Hono)
packages/       (existing)
```

**Cohesion with existing apps:**
- `apps/site/` is independent — its own `package.json`, own deploy. No build dependency on `apps/desktop/`.
- CSS tokens are copied (not imported) from the desktop's `globals.css` initially; if drift becomes painful, extract to a shared `packages/tokens/` package as a v2 refactor (defer).
- `GroveTree.tsx` and the slimmed `Decorations.tsx` are copied into `apps/site/src/components/` so the landing has zero runtime dependency on the desktop build.
- The repo root's `turbo.json` (if present) or workspace scripts get a `site:dev` / `site:build` / `site:deploy` entry.

## Section outline (top to bottom)

### 1. Sticky nav

`<header>` fixed-top, transparent on hero, solid Sahel-dark on scroll. Wordmark left (Recoleta). Right-aligned anchor links: Features · Why · For builders · `[Download]` (accent-pill CTA). Mobile: hamburger collapses anchors but keeps the Download CTA visible.

### 2. Hero

- Background: Sahel radial gradient (centered top, `#2a1f15` → `#15110d` 70%)
- Headline (Recoleta serif, ~48 px desktop / ~32 px mobile): **"A browser that doesn't waste your data."**
- Subhead (default sans, ~18 px): "Reader mode auto-saves bandwidth on slow connections. Built on Cloudflare's African edge. Open in Yoruba, Swahili, Hausa."
- Primary CTA: pill button labelled **"Download for Windows · 2.1 MB"** (size pulled from latest GitHub Release at build time via `lib/latest-release.ts`)
- Secondary CTA (below primary, ghost-style): "What's inside →" anchor to `#features`
- Right-side accent (desktop) / centered above headline (mobile): `<GroveTree client:visible />` rendered at ~140 px wide. Decoration motifs (sun, leaf, hexagon — 3–4 picks from `Decorations.tsx`) scattered ambient around it, ~30 % opacity, no animation when `prefers-reduced-motion` is set.

### 3. Manifesto / "Why"

Section id `#why`. ~300–500 words across 3–4 short paragraphs. Voice grounded in the in-app i18n strings ("Cloudflare's African POPs", "your data lives in", "African ones lifted first"). Themes:
1. The web is built for the wrong network. Most browsers assume gigabit fiber, infinite memory, and that latency to the nearest CDN is < 10 ms. None of that is true for the African web.
2. Sovereignty isn't a feature, it's the spine. Local-first by default. Optional sync stays on Cloudflare's African edge (D1 / R2 in the EU region as a stopgap until African regions ship).
3. A browser is the right shape for this. Cookies, navigation, data-residency commitments — they all live at the browser layer. Apps inherit from it.
4. The Sahel palette, the baobab metaphor, the Adinkra motifs — these aren't decoration. They're the visual reminder of who the product is for.

No images in this section — pure typography. Sets up trust before features.

### 4. Feature blocks (6 cards, 2 columns desktop / 1 column mobile)

Each block: large screenshot (or animated SVG for Reader/Translate/Grove), title (Recoleta sub-display size), 2–3 sentence body, optional small bullet list, anchor `#feature-{name}` for persona-band links.

| # | Title | Body angle | Screenshot |
|---|-------|-----------|------------|
| 4a | 📖 Reader Auto-Savings | "On slow connections, a 3-second countdown intercepts heavy pages and renders a clean text version instead. Reader mode autosaves typically 80–95% of a news page's weight, before you even see it load." | reader.html article view |
| 4b | 🌳 The Grove · multi-profile | "Chrome-style profile isolation, with real per-profile cookie containers (WebView2 `data_directory`). Optional PIN per profile for shared computers." | picker UI |
| 4c | 🔍 African-first Search | "Type without a `.` and Baobab searches with Workers AI on Cloudflare's African edge. Sources are reranked to lift African voices to the top." | search.html results |
| 4d | 🌐 Translate without leaving the browser | "TranslatePad opens with one shortcut, m2m100 + Llama fallback on the worker. Yoruba, Swahili, Hausa, Amharic, Wolof, Zulu, French, Arabic, English." | TranslatePad screenshot |
| 4e | 🚫 Ad-blocker (with YouTube skip) | "103-host starter from EasyList + EasyPrivacy. YouTube ads auto-skip via DOM fast-forward. Per-profile, default ON." | Settings AdblockSection |
| 4f | 📊 Data gauge + budget | "Daily byte budget you set; toasts at 80 % and 100 %. Reader savings count too. Wi-Fi-only sync (default ON) defers history/bookmarks pushes to Wi-Fi class connections." | Settings DataSection |

### 5. Sovereignty deep-dive

Section id `#sovereignty`. Full-bleed screenshot of in-app `SovereigntyDashboard` (the "Your data lives in" map). 3-paragraph plain-English data-residency explanation:
1. What's stored where (D1 + R2 in eeur region until African regions are available; tokens local in encrypted Tauri secure store)
2. What's never stored or shared (no third-party analytics, no model-training on user data, no sale of any data)
3. How the user can verify (Settings → Sovereignty shows current colo + region; sync can be disabled entirely)

### 6. Try the AI inline (the proof)

Section id `#try-ai`. Compact widget:
- Single-line input ("Ask anything about Africa…" placeholder)
- Submit button → calls `POST /api/ai/search` on worker (already public; rate-limited per IP at 30/min)
- Streams the response in below the input (SSE if the route supports it; otherwise full JSON render)
- Below the response, a small footer: "Powered by Workers AI on Cloudflare's African edge. Try the full version → [Install Baobab]"
- On rate-limit (429): shows "You've used your demo quota — install Baobab for the full experience" with the download CTA.

This is the only React island besides GroveTree. Pure fetch + small render state.

### 7. Persona bands (4 stacked, color-coded)

Section id `#personas`. Each band: solid Sahel-dark background, accent-color left border (3 px), persona icon, 80–120 words, single CTA link.

| Band | Accent color | Persona | Copy angle | CTA |
|------|------|---------|-----------|-----|
| 7a | `#d9a45a` (warm amber) | On metered data | "If your data plan is the bottleneck, Baobab was built for you. The byte gauge, Reader mode, and Wi-Fi-only sync work together so 100 MB of mobile data goes further." | Anchor → `#feature-reader` |
| 7b | `#9ec78a` (green) | Builders | "If you're an engineer who'd fork, contribute, or build on this — the worker is Hono on Cloudflare, the desktop is Tauri 2 + React, and most routes are public. Read the design notes." | "View repo →" (GitHub link) |
| 7c | `#c89876` (terracotta) | Diaspora / global readers | "If you're abroad and curious about why this needs to exist — the manifesto above is the short version. The longer story is in the design docs and the source." | "Read the manifesto →" anchor + repo link |
| 7d | `#6a8caa` (slate blue) | Organisations | "Multi-profile windows with real cookie isolation. Sovereignty Dashboard for compliance review. Volume installs via MSI (Q3 2026). Get in touch." | "Talk to us →" mailto with subject prefilled |

### 8. Download CTA repeat

Section id `#download`. Same primary CTA pill from the hero, larger. Below: small text "Linux: AppImage + .deb available · macOS: paused until signing certs · Android: roadmap". Beside it, "View all releases →" link to the GitHub Releases page.

### 9. Footer

Sahel-dark, small-text, four columns:
- Brand: wordmark + 1-line tagline
- Product: Features · Why · Download · Releases (GitHub)
- Resources: Design docs (link to repo `docs/superpowers/`) · Source · License (if/when chosen)
- Legal: Privacy summary (1-page on the same site, link target) · Cloudflare + Workers AI credit

Copyright + version line at the bottom: "Built on Cloudflare. Made in Africa."

## Data flow

```
                                  Cloudflare Pages
   User → DNS (baobab.askozzy.work) → CDN edge → SSG HTML + tiny island bundle

                  AiDemo island        ────────► Worker
                  (React, hydrated)                /api/ai/search
                                       ◄────────  (already public, 30/min/IP)

                  GroveTree island     ─── self-contained (no network)
                  (React, animated)

                  Latest GH Release    ──── build-time fetch via lib/latest-release.ts
                  size + version           (NOT runtime — bakes into HTML during build)
```

- Runtime: HTML + ~50 KB JS (Astro islands), no third-party scripts.
- Build time: Astro fetches the latest GitHub Release to populate the CTA size text.
- Auth: none. The AI demo route is already public; rate-limit is the only abuse boundary.

## Performance budget

- JS bundle ≤ 50 KB gzipped (Astro islands; only GroveTree + AiDemo hydrate)
- HTML payload above-fold ≤ 30 KB gzipped (Sahel-dark inline-styled hero)
- CSS ≤ 15 KB gzipped (no Tailwind; hand-written tokens + utility classes)
- LCP ≤ 1.5 s on Slow 3G (throttle in Chrome DevTools as the acceptance test)
- INP ≤ 200 ms on a mid-range mobile
- Zero render-blocking third-party scripts
- No webfont in critical path: Recoleta loads via `font-display: optional` (it's wordmark-only; the page degrades to General Sans Bold without it)
- Astro `compressHTML: true` + `output: 'static'`

## Accessibility

- WCAG 2.1 AA contrast on all text (Sahel palette already passes for primary; verify accent-on-dark and ghost-button states)
- Semantic landmarks: `<header>`, `<main>`, `<section>` with `aria-labelledby`, `<footer>`
- Skip-to-main link as the first focusable element
- All interactive elements keyboard-reachable; visible focus ring (custom, accent-colored, 2 px outline + 2 px offset)
- Animated tree + decorations respect `prefers-reduced-motion: reduce` (the picker already does — port the same CSS)
- AiDemo input has visible label or `aria-label`; streaming response has `role="status"` + `aria-live="polite"`
- All images have `alt` text; decorative SVGs use `aria-hidden="true"`
- Color is never the only signal (persona bands use both color AND a textual persona name)

## SEO + Open Graph

- `<title>`: "Baobab — A browser that doesn't waste your data"
- Meta description: hero subhead verbatim (~155 chars)
- Canonical: `https://baobab.askozzy.work/`
- OG: `og:title`, `og:description`, `og:image` (1200×630 PNG hand-composed with hero tree + headline), `og:url`, `og:type=website`
- Twitter: `twitter:card=summary_large_image`
- JSON-LD `SoftwareApplication` schema with download URL, OS support, screenshots, applicationCategory
- `sitemap.xml` auto-generated via `@astrojs/sitemap`
- `robots.txt` allowing all (no need to gate; the page is purely public)

## Analytics

- Cloudflare Web Analytics — cookieless, no PII, no GDPR consent banner needed
- Inserted as a single `<script>` tag from `static.cloudflareinsights.com`
- Track: page views, referrer, country (aggregate only), core web vitals
- DO NOT add Google Analytics, Plausible-self-hosted, Segment, PostHog, or any third-party tracker

## Browser support

- Last 2 versions of Chrome / Edge / Firefox / Safari (evergreen)
- iOS Safari 15+
- Android Chrome 100+
- NO IE11 (zero traffic, modern stack)
- Animated tree degrades to static SVG on older browsers (no CSS animations applied where `animation` property unsupported — this is automatic)

## Deploy

1. Push to `main` branch
2. Cloudflare Pages GH integration triggers build
3. Build: `cd apps/site && npm ci && npm run build` produces `apps/site/dist/`
4. Pages serves `dist/` from edge
5. Preview deployments auto-created on PRs (free Pages feature)
6. Custom domain `baobab.askozzy.work` mapped to the project via Pages dashboard (one-time setup)
7. SSL: Cloudflare-managed automatically (Universal SSL)

No separate GitHub Action required initially.

## Error handling

| Failure | Handling |
|---------|----------|
| `GroveTree` JS fails to load | Falls back to a static SVG snapshot baked into the HTML — page is still complete |
| AiDemo `/api/ai/search` fetch fails (5xx) | Inline error in the response slot: "AI is temporarily unavailable — install Baobab to try locally" + Download link |
| AiDemo rate-limit (429) | "You've used your demo quota — install Baobab for the full experience" + Download link |
| AiDemo network offline | Detects `!navigator.onLine` before fetch; shows "You're offline — Baobab works offline once installed" |
| Latest GitHub Release fetch fails at build time | CTA falls back to "Download for Windows" (no size) and build still completes |
| Cloudflare Pages build fails | Pages dashboard surfaces error; previous version stays live (atomic deploys) |

## Testing strategy

- **Visual** — Lighthouse CI on every PR; budgets: Performance ≥ 95, Accessibility = 100, Best Practices ≥ 95, SEO = 100 (preview deployment URL passed to Lighthouse action)
- **Build** — Astro build must succeed on Cloudflare Pages (caught by deploy)
- **Manual smoke (final task)** — open preview URL on Slow 3G in Chrome DevTools, verify LCP < 1.5 s, AI demo widget streams a real answer, download link points at the latest GitHub Release, OG card renders correctly in [opengraph.xyz](https://opengraph.xyz) preview
- **No unit tests for v1** — Astro pages are mostly static markup; AiDemo's logic is small enough that a single integration smoke covers it. If the AiDemo grows (history of asked questions, model picker, etc.) add Vitest at that point.

## Risks / decisions

- **`baobab.africa` brand mismatch.** Worker UA strings (`BaobabBot/1.0 (+https://baobab.africa)`) reference a domain we're not using yet. Either acquire + redirect to `baobab.askozzy.work`, or update the UA strings. Separate ~5-min PR. Not blocking this spec.
- **AI demo cost.** Every visitor who uses the demo costs a Workers AI invocation. At 30/min/IP rate-limit + organic traffic, this is bounded but worth monitoring on the Cloudflare dashboard. Tighten to 10/min/IP if abuse appears.
- **Screenshot maintenance.** Six feature blocks each have screenshots. When the desktop UI changes, screenshots drift. Mitigation: keep raw screenshots in `apps/site/src/assets/screenshots/` with filenames matching the feature; document re-capture procedure in a short `RECAPTURING.md`.
- **Sovereignty story partially aspirational.** "Cloudflare's African POPs serve all reads when available" — D1 + R2 are currently in EU region, not African. The page should be honest about this (the manifesto's paragraph 2 acknowledges "stopgap until African regions ship"). Don't overclaim.
- **Recoleta licensing.** Recoleta is a paid font from Latinotype. The desktop app uses it. If licensing for web use requires a separate purchase, fall back to General Sans Bold (free, similar character).
- **Public AI demo on a marketing page.** Spam risk if `/api/ai/search` is hit by bots. Cloudflare Turnstile (free, no UI for genuine users) is a no-op to add if abuse becomes real — defer until then.

## Acceptance criteria

1. **Page live** at `https://baobab.askozzy.work/` with SSL valid certificate.
2. **Hero** renders headline, subhead, Download CTA, and the animated GroveTree on the right (or above on mobile). Tree animates unless `prefers-reduced-motion` is set.
3. **Manifesto** renders the 3–4 paragraphs of body copy, no images, semantic headings.
4. **Feature blocks** — 6 cards, each with screenshot + title + body, anchored for persona-band links.
5. **Sovereignty deep-dive** renders SovereigntyDashboard screenshot + 3 paragraphs.
6. **AI demo** — typing a question + submit calls `/api/ai/search` and renders a response within 5 s. Rate-limit (429) shown gracefully with install CTA.
7. **Persona bands** — 4 stacked, color-coded by accent border-left, with persona name + body + CTA link.
8. **Download CTA repeat** at the bottom; links to the latest GitHub Release Windows asset.
9. **Footer** — Brand, Product, Resources, Legal columns; copyright line.
10. **Cloudflare Web Analytics** firing on every page view.
11. **Performance** — Lighthouse Performance ≥ 95 on Slow 3G; LCP ≤ 1.5 s.
12. **Accessibility** — Lighthouse A11y = 100; keyboard traversable; screen-reader landmarks correct.
13. **SEO** — `<title>` + meta description + canonical + OG tags + sitemap.xml all present; JSON-LD validates.

## Open items intentionally deferred

- Per-persona dedicated pages (`/for-builders` etc.) — v2 if telemetry shows demand
- Waitlist / newsletter — v2 when macOS / Android launches give us something to announce
- Blog / changelog hosted at same domain — separate decision
- BaobabBot UA strings → askozzy.work update — separate 5-min PR
- macOS download surface — when P0c C1 (signing certs) ships
- Android download surface — when there's a Tauri Android build
- Site-level i18n — v2; English-only for now
