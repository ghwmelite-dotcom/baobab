# Baobab Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Baobab marketing landing page (single-page, 9 sections, four persona bands, inline AI demo) at `baobab.askozzy.work`, deployed via Cloudflare Pages on the OHCS account, reusing the desktop picker's Grove visual language while dogfooding the data-savings positioning (LCP ≤ 1.5 s on Slow 3G, JS ≤ 50 KB gzipped).

**Architecture:** New Astro 4.x project at `apps/site/` (sibling to `apps/desktop/`), using `@astrojs/cloudflare` adapter. Most sections are static `.astro` components (SSG, zero runtime JS). Two React islands: `GroveTree` (ported from desktop picker, hydrated `client:visible`) and `AiDemo` (calls existing public `/api/ai/search`). CSS tokens copied (not imported) from the desktop's globals.css.

**Tech Stack:** Astro 4.x · React 18 (islands only) · `@astrojs/cloudflare` adapter · `@astrojs/sitemap` · `@astrojs/react` · Cloudflare Pages (deploy via GH integration) · Cloudflare Web Analytics (cookieless).

**Reference docs:**
- Spec: `docs/superpowers/specs/2026-05-17-landing-page-design.md` (commit `bf074f6`)
- Brainstorm decisions memory: `~/.claude/projects/C--dev-baobab/memory/landing_page_decisions.md`
- Worker `/api/ai/search` route: `worker/src/routes/ai.ts:186-228` — POST `{ query }` → `{ answer, results: [{title, url}] }` or `{ error }` on 400/429/502
- Picker source assets to port: `apps/desktop/src/picker/GroveTree.tsx` (129 lines), `apps/desktop/src/picker/PickerDecorations.tsx` (163 lines)
- Desktop CSS tokens to port: `apps/desktop/src/styles/globals.css` + `@baobab/ui/src/theme/tokens.css` (workspace package)
- Existing release for download CTA: https://github.com/ghwmelite-dotcom/baobab/releases/latest

**Working directory for site tasks:** `apps/site/` (paths below are relative to that unless prefixed `worker/`, `docs/`, or the repo root).

---

## Task 1: Scaffold `apps/site/` Astro project

**Files:**
- Create: `apps/site/package.json`
- Create: `apps/site/astro.config.mjs`
- Create: `apps/site/tsconfig.json`
- Create: `apps/site/src/pages/index.astro` (skeleton)
- Create: `apps/site/.gitignore`
- Modify: `package.json` (repo root) — add `dev:site` / `build:site` / `deploy:site` scripts

- [ ] **Step 1: Create the new workspace package**

Create `apps/site/package.json`:

```json
{
  "name": "@baobab/site",
  "private": true,
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "deploy": "wrangler pages deploy ./dist --project-name=baobab-site"
  },
  "dependencies": {
    "astro": "^4.16.0",
    "@astrojs/cloudflare": "^11.0.0",
    "@astrojs/react": "^3.6.0",
    "@astrojs/sitemap": "^3.2.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "typescript": "^5.6.0"
  }
}
```

- [ ] **Step 2: Create `astro.config.mjs`**

```js
// @ts-check
import { defineConfig } from 'astro/config'
import cloudflare from '@astrojs/cloudflare'
import react from '@astrojs/react'
import sitemap from '@astrojs/sitemap'

// SSG (output: 'static') even though we use the Cloudflare adapter — the
// adapter is needed for Pages deployment metadata, but our pages are
// fully static. No SSR routes needed; the AiDemo island makes its fetch
// from the browser to the public worker.
export default defineConfig({
  site: 'https://baobab.askozzy.work',
  output: 'static',
  adapter: cloudflare(),
  integrations: [react(), sitemap()],
  compressHTML: true,
  build: {
    inlineStylesheets: 'auto',
  },
  vite: {
    build: {
      // Keep JS islands as small as possible — we're the data-savings
      // browser, the landing page must dogfood.
      cssMinify: 'esbuild',
    },
  },
})
```

- [ ] **Step 3: Create `tsconfig.json`**

```json
{
  "extends": "astro/tsconfigs/strict",
  "include": ["src/**/*", ".astro/types.d.ts"],
  "exclude": ["dist"]
}
```

- [ ] **Step 4: Create skeleton `src/pages/index.astro`**

```astro
---
// Baobab landing page. Sections built out in subsequent tasks.
---
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Baobab — A browser that doesn't waste your data</title>
  </head>
  <body>
    <main>
      <h1>Baobab landing page (skeleton)</h1>
      <p>Sections will be added in subsequent tasks.</p>
    </main>
  </body>
</html>
```

- [ ] **Step 5: Create `.gitignore`**

```
node_modules
dist
.astro
.wrangler
```

- [ ] **Step 6: Add root scripts to `package.json` (repo root)**

Edit `/c/dev/baobab/package.json`. Find the `"scripts"` block; add three new entries alongside the existing `dev:worker` / `dev:desktop` pattern:

```json
"dev:site": "cd apps/site && npm run dev",
"build:site": "cd apps/site && npm run build",
"deploy:site": "cd apps/site && npm run deploy"
```

- [ ] **Step 7: Install dependencies + verify dev server starts**

```bash
cd apps/site && npm install
cd apps/site && npx astro check --no-emit
cd apps/site && timeout 10 npm run dev 2>&1 | head -20
```
Expected: `astro check` returns no errors; `npm run dev` prints `Local: http://localhost:4321/` within 10 s before being killed by timeout.

- [ ] **Step 8: Verify build produces `dist/`**

```bash
cd apps/site && npm run build 2>&1 | tail -10
ls apps/site/dist/index.html
```
Expected: a `dist/index.html` exists with the skeleton content.

- [ ] **Step 9: Commit**

```bash
git add apps/site/ package.json
git commit -m "feat(site): scaffold apps/site/ Astro project + Cloudflare adapter

New workspace package for the marketing landing page at
baobab.askozzy.work. Astro 4.x with @astrojs/cloudflare for Pages
deployment, @astrojs/react for the GroveTree + AiDemo islands,
@astrojs/sitemap for sitemap.xml. SSG output (output: 'static');
no SSR routes — AiDemo makes its fetch from the browser to the
already-public worker /api/ai/search.

Root package.json gets dev:site / build:site / deploy:site
scripts matching the existing dev:worker / dev:desktop pattern.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Port CSS tokens to `apps/site/src/styles/tokens.css`

**Files:**
- Create: `apps/site/src/styles/tokens.css`
- Create: `apps/site/src/styles/global.css`
- Modify: `apps/site/src/pages/index.astro` — link the stylesheets

### Step 1: Read the source tokens

```bash
grep -E "^\s*--" /c/dev/baobab/apps/desktop/src/styles/globals.css | head -50
find /c/dev/baobab/packages -name "tokens.css" -exec cat {} \;
```

The desktop's `globals.css` imports `@baobab/ui/src/theme/tokens.css`. Read both files to get the canonical Sahel palette values; the file you create in this task is a **standalone copy** (not an import) so the landing has zero workspace dependency on `@baobab/ui` or `apps/desktop`.

- [ ] **Step 2: Create `apps/site/src/styles/tokens.css`**

The token set below mirrors the desktop's Sahel-dark theme. Update any value to match the upstream if it has drifted (`grep -A1 "\-\-canvas" packages/ui/src/theme/tokens.css`).

```css
/* Sahel-dark token set — ported from apps/desktop. KEEP IN SYNC if the
   upstream tokens change. */

:root {
  /* Canvas */
  --canvas: #15110d;
  --surface-1: #1c1612;
  --surface-2: #221a14;

  /* Text */
  --text-primary: #f6efe0;
  --text-secondary: #a89478;
  --text-muted: #7a5c3c;
  --text-on-accent: #2a1f15;

  /* Borders + accents */
  --border: #3a2f24;
  --accent: #d9a45a;
  --accent-light: #e8c089;
  --accent-dim: rgba(217, 164, 90, 0.18);

  /* Persona-band accents (used by Task 10) */
  --persona-metered: #d9a45a;
  --persona-builder: #9ec78a;
  --persona-diaspora: #c89876;
  --persona-org: #6a8caa;

  /* Status */
  --critical: #e07570;
  --sovereignty-ok: #9ec78a;
  --sovereignty-warn: #d9a45a;

  /* Typography */
  --font-default: 'Bookman Old Style', 'ITC Bookman', 'URW Bookman L',
                  'TeX Gyre Bonum', Bookman, 'Source Serif 4', Georgia,
                  'Times New Roman', serif;
  --font-display: 'Recoleta', 'General Sans Bold', var(--font-default);
  --font-mono: 'JetBrains Mono', Menlo, Consolas, monospace;

  /* Spacing scale (8-pt grid) */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 24px;
  --space-6: 32px;
  --space-8: 48px;
  --space-10: 64px;
  --space-12: 96px;
}
```

- [ ] **Step 3: Create `apps/site/src/styles/global.css`**

```css
@import './tokens.css';

* { box-sizing: border-box; }

html { scroll-behavior: smooth; }

html, body {
  margin: 0;
  background: var(--canvas);
  color: var(--text-primary);
  font-family: var(--font-default);
  font-size: 16px;
  line-height: 1.55;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

main { min-height: 100vh; }

/* Skip-to-main: first focusable element, visible on focus only */
.skip-link {
  position: absolute;
  top: -40px;
  left: 8px;
  background: var(--accent);
  color: var(--text-on-accent);
  padding: 6px 12px;
  border-radius: 4px;
  text-decoration: none;
  z-index: 9999;
}
.skip-link:focus { top: 8px; }

/* Focus ring — 2 px accent outline + 2 px offset on every interactive */
:where(a, button, input, select, textarea, [tabindex]):focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  border-radius: 4px;
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.001ms !important;
    transition-duration: 0.001ms !important;
  }
  html { scroll-behavior: auto; }
}
```

- [ ] **Step 4: Wire stylesheets into the skeleton page**

Edit `apps/site/src/pages/index.astro`:

```astro
---
import '../styles/global.css'
---
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Baobab — A browser that doesn't waste your data</title>
  </head>
  <body>
    <a href="#main" class="skip-link">Skip to main content</a>
    <main id="main">
      <h1 style="font-family: var(--font-display); color: var(--text-primary);">Baobab landing page (skeleton)</h1>
      <p style="color: var(--text-secondary);">Sahel-dark token verification: this paragraph should be warm-cream on dark.</p>
    </main>
  </body>
</html>
```

- [ ] **Step 5: Verify build still passes + visually inspect tokens**

```bash
cd apps/site && npm run build 2>&1 | tail -5
cd apps/site && timeout 10 npm run dev 2>&1 | head -10
```
Expected: build succeeds; dev server starts. Open http://localhost:4321 in a browser; background should be Sahel-dark (`#15110d`), heading in warm cream, paragraph in warmer secondary tan.

- [ ] **Step 6: Commit**

```bash
git add apps/site/src/styles apps/site/src/pages/index.astro
git commit -m "feat(site): port Sahel-dark CSS tokens + global.css

Standalone token set copied (not imported) from the desktop's
globals.css + @baobab/ui tokens. Keeping the landing's deps
empty of internal workspace packages means it can be deployed
independently if we ever split repos.

global.css adds: skip-to-main link, accent focus rings, and the
prefers-reduced-motion reset that the rest of the page will lean
on for the animated tree.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Site shell — sticky `<Header>` + `<Footer>` components

**Files:**
- Create: `apps/site/src/components/Header.astro`
- Create: `apps/site/src/components/Footer.astro`
- Create: `apps/site/src/layouts/Base.astro`
- Modify: `apps/site/src/pages/index.astro` — use the layout

- [ ] **Step 1: Create `Base.astro` layout**

```astro
---
import '../styles/global.css'
import Header from '../components/Header.astro'
import Footer from '../components/Footer.astro'

interface Props {
  title?: string
  description?: string
}
const {
  title = 'Baobab — A browser that doesn\'t waste your data',
  description = 'Reader mode auto-saves bandwidth on slow connections. Built on Cloudflare\'s African edge. Open in Yoruba, Swahili, Hausa.',
} = Astro.props
---
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="description" content={description} />
    <title>{title}</title>
    <link rel="canonical" href="https://baobab.askozzy.work/" />
  </head>
  <body>
    <a href="#main" class="skip-link">Skip to main content</a>
    <Header />
    <main id="main">
      <slot />
    </main>
    <Footer />
  </body>
</html>
```

- [ ] **Step 2: Create `Header.astro`**

```astro
---
// Sticky header. Transparent on hero (achieved via the page setting
// data-scrolled on body via a tiny IntersectionObserver, or simply
// using backdrop-filter without solid bg for v1). Solid Sahel-dark
// once scrolled past the hero.
---
<header
  style="
    position: sticky;
    top: 0;
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-3) var(--space-5);
    background: rgba(21, 17, 13, 0.85);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    border-bottom: 1px solid var(--border);
    font-family: var(--font-default);
  "
>
  <a
    href="/"
    style="
      color: var(--text-primary);
      font-family: var(--font-display);
      font-size: 18px;
      font-weight: 600;
      text-decoration: none;
      letter-spacing: 0.01em;
    "
  >baobab</a>
  <nav style="display: flex; align-items: center; gap: var(--space-4);">
    <a href="#features" style="color: var(--text-secondary); text-decoration: none; font-size: 13px;">Features</a>
    <a href="#why" style="color: var(--text-secondary); text-decoration: none; font-size: 13px;">Why</a>
    <a href="#personas" style="color: var(--text-secondary); text-decoration: none; font-size: 13px;">For builders</a>
    <a
      href="#download"
      style="
        background: var(--accent);
        color: var(--text-on-accent);
        padding: 6px 14px;
        border-radius: 999px;
        font-size: 13px;
        font-weight: 600;
        text-decoration: none;
      "
    >Download</a>
  </nav>
</header>
```

- [ ] **Step 3: Create `Footer.astro`**

```astro
---
// Footer. Four columns desktop, stacked mobile.
---
<footer
  style="
    background: var(--surface-1);
    border-top: 1px solid var(--border);
    padding: var(--space-8) var(--space-5);
    color: var(--text-muted);
    font-size: 12px;
  "
>
  <div style="max-width: 1080px; margin: 0 auto; display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: var(--space-6);">
    <div>
      <div style="font-family: var(--font-display); font-size: 18px; color: var(--text-primary); font-weight: 600;">baobab</div>
      <p style="margin-top: var(--space-2); line-height: 1.6;">An African AI browser, built sovereign-by-design on Cloudflare's African edge.</p>
    </div>
    <div>
      <div style="color: var(--text-secondary); font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; font-size: 11px; margin-bottom: var(--space-2);">Product</div>
      <ul style="list-style: none; padding: 0; margin: 0; line-height: 1.9;">
        <li><a href="#features" style="color: var(--text-muted); text-decoration: none;">Features</a></li>
        <li><a href="#why" style="color: var(--text-muted); text-decoration: none;">Why</a></li>
        <li><a href="#download" style="color: var(--text-muted); text-decoration: none;">Download</a></li>
        <li><a href="https://github.com/ghwmelite-dotcom/baobab/releases" style="color: var(--text-muted); text-decoration: none;">Releases</a></li>
      </ul>
    </div>
    <div>
      <div style="color: var(--text-secondary); font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; font-size: 11px; margin-bottom: var(--space-2);">Resources</div>
      <ul style="list-style: none; padding: 0; margin: 0; line-height: 1.9;">
        <li><a href="https://github.com/ghwmelite-dotcom/baobab" style="color: var(--text-muted); text-decoration: none;">Source</a></li>
        <li><a href="https://github.com/ghwmelite-dotcom/baobab/tree/main/docs" style="color: var(--text-muted); text-decoration: none;">Design notes</a></li>
      </ul>
    </div>
    <div>
      <div style="color: var(--text-secondary); font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; font-size: 11px; margin-bottom: var(--space-2);">Legal</div>
      <ul style="list-style: none; padding: 0; margin: 0; line-height: 1.9;">
        <li>AGPL-3.0</li>
        <li>Built on Cloudflare</li>
        <li>Made in Africa</li>
      </ul>
    </div>
  </div>
</footer>
```

- [ ] **Step 4: Simplify `index.astro` to use the layout**

Replace `apps/site/src/pages/index.astro` entirely with:

```astro
---
import Base from '../layouts/Base.astro'
---
<Base>
  <!-- Sections built out in subsequent tasks: Hero · Manifesto · Features ·
       Sovereignty · AiDemo · Persona bands · Download CTA. -->
  <section style="padding: var(--space-12) var(--space-5); text-align: center; color: var(--text-secondary);">
    <p>Sections coming online task by task.</p>
  </section>
</Base>
```

- [ ] **Step 5: Build + verify**

```bash
cd apps/site && npm run build 2>&1 | tail -5
```
Expected: build succeeds. Open `apps/site/dist/index.html` in a browser; sticky header should show "baobab" wordmark + nav links + accent Download button. Footer should show 4 columns.

- [ ] **Step 6: Commit**

```bash
git add apps/site/src/layouts apps/site/src/components/Header.astro apps/site/src/components/Footer.astro apps/site/src/pages/index.astro
git commit -m "feat(site): site shell — Base layout + sticky Header + Footer

Header is sticky, semi-transparent over the hero (backdrop-filter
blur), solid below. Nav anchors use the section IDs the upcoming
feature tasks will create (#features, #why, #personas, #download).

Footer is 4 responsive columns: brand, product, resources, legal.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Port `GroveTree` + slimmed `Decorations` React islands

**Files:**
- Create: `apps/site/src/components/GroveTree.tsx`
- Create: `apps/site/src/components/Decorations.tsx`

The desktop's `GroveTree.tsx` is 129 lines of inline SVG with `<style>` for the keyframe animations. It's pure SVG + a single `size` prop — no internal state, no React hooks. Direct copy works.

The desktop's `PickerDecorations.tsx` is 163 lines and renders 8+ decoration elements scattered absolutely positioned. For the landing we want ~3–4 of them only (sun, leaf, hexagon, dot) as ambient accents — not the full picker maximalism. Slim during the port.

- [ ] **Step 1: Read the source files**

```bash
cat /c/dev/baobab/apps/desktop/src/picker/GroveTree.tsx
cat /c/dev/baobab/apps/desktop/src/picker/PickerDecorations.tsx
```

Note the exact prop interfaces, animation keyframe names, and `prefers-reduced-motion` handling. The destination components must preserve these.

- [ ] **Step 2: Copy `GroveTree.tsx` verbatim**

Copy the file content from `apps/desktop/src/picker/GroveTree.tsx` to `apps/site/src/components/GroveTree.tsx`. No changes needed — the component has no internal imports (it's pure SVG + inline `<style>`).

```bash
cp /c/dev/baobab/apps/desktop/src/picker/GroveTree.tsx /c/dev/baobab/apps/site/src/components/GroveTree.tsx
```

Verify:
```bash
diff /c/dev/baobab/apps/desktop/src/picker/GroveTree.tsx /c/dev/baobab/apps/site/src/components/GroveTree.tsx
```
Expected: no diff.

- [ ] **Step 3: Create slimmed `Decorations.tsx`**

Read `apps/desktop/src/picker/PickerDecorations.tsx` carefully and EXTRACT only these decoration elements (drop the rest):
- Sun disc
- Leaf
- Hexagon
- Dot pair

Create `apps/site/src/components/Decorations.tsx` with only those 4 decoration components, exported individually:

```tsx
/**
 * Slim subset of the desktop picker's decorations. Used as ambient
 * accents around the hero's GroveTree — NOT the picker's full
 * 8-element maximalist scatter.
 */
import type { CSSProperties } from 'react'

interface DecorationProps {
  style?: CSSProperties
}

export function SunDisc({ style }: DecorationProps) {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 32 32"
      aria-hidden="true"
      style={style}
    >
      {/* COPY the sun-disc SVG markup from PickerDecorations.tsx here.
          Preserve the rotation animation keyframe. Honour
          prefers-reduced-motion (the picker already does — keep the
          same media query.) */}
    </svg>
  )
}

export function Leaf({ style }: DecorationProps) {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true" style={style}>
      {/* COPY leaf SVG markup */}
    </svg>
  )
}

export function Hexagon({ style }: DecorationProps) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" style={style}>
      {/* COPY hexagon SVG markup */}
    </svg>
  )
}

export function DotPair({ style }: DecorationProps) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" style={style}>
      {/* COPY dot-pair SVG markup */}
    </svg>
  )
}
```

The four functions above are stubs — you must fill in the actual SVG paths/circles/polygons from the source `PickerDecorations.tsx`. Match the markup exactly so the animations keep working.

- [ ] **Step 4: Verify Astro build still passes with the new tsx files**

```bash
cd apps/site && npm run build 2>&1 | tail -5
```
Expected: build succeeds. The files are not yet imported into any page — this verifies the React tooling is wired correctly.

- [ ] **Step 5: Commit**

```bash
git add apps/site/src/components/GroveTree.tsx apps/site/src/components/Decorations.tsx
git commit -m "feat(site): port GroveTree + slim Decorations from desktop picker

GroveTree.tsx copied verbatim — pure SVG with inline keyframe
animations, no internal imports, drop-in works.

Decorations.tsx slims the desktop's 8-element scatter down to 4
ambient pieces (sun, leaf, hexagon, dot pair) suitable for use as
hero accent marks. The picker's full maximalist scatter would be
too busy for marketing.

Both honour prefers-reduced-motion via the same CSS media query
the picker uses.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Hero section with GroveTree island + build-time release fetch

**Files:**
- Create: `apps/site/src/components/Hero.astro`
- Create: `apps/site/src/lib/latest-release.ts`
- Modify: `apps/site/src/pages/index.astro` — render `<Hero />`

- [ ] **Step 1: Create the build-time GitHub Release fetcher**

`apps/site/src/lib/latest-release.ts`:

```ts
/**
 * Build-time fetch of the latest desktop release from GitHub.
 * Returns the Windows installer size + version + tag so the hero CTA
 * can show "Download for Windows · 2.1 MB". Falls back gracefully
 * on fetch failure so build never blocks.
 */

interface ReleaseAsset {
  name: string
  size: number
  browser_download_url: string
}

interface ReleaseInfo {
  tag: string
  windowsAssetUrl: string
  windowsSizeMb: string
}

const FALLBACK: ReleaseInfo = {
  tag: 'desktop-v0.1.0',
  windowsAssetUrl: 'https://github.com/ghwmelite-dotcom/baobab/releases/latest',
  windowsSizeMb: '',
}

export async function getLatestRelease(): Promise<ReleaseInfo> {
  try {
    const r = await fetch('https://api.github.com/repos/ghwmelite-dotcom/baobab/releases/latest', {
      headers: { Accept: 'application/vnd.github+json' },
    })
    if (!r.ok) return FALLBACK
    const data = await r.json() as { tag_name: string; assets: ReleaseAsset[] }
    const win = data.assets.find((a) => /x64-setup\.exe$/.test(a.name))
    if (!win) return { ...FALLBACK, tag: data.tag_name }
    return {
      tag: data.tag_name,
      windowsAssetUrl: win.browser_download_url,
      windowsSizeMb: `${(win.size / (1024 * 1024)).toFixed(1)} MB`,
    }
  } catch {
    return FALLBACK
  }
}
```

- [ ] **Step 2: Create `Hero.astro`**

```astro
---
import GroveTree from './GroveTree.tsx'
import { SunDisc, Leaf, Hexagon, DotPair } from './Decorations.tsx'
import { getLatestRelease } from '../lib/latest-release.ts'

const release = await getLatestRelease()
const ctaLabel = release.windowsSizeMb
  ? `Download for Windows · ${release.windowsSizeMb}`
  : 'Download for Windows'
---

<section
  id="hero"
  style="
    position: relative;
    padding: var(--space-12) var(--space-5) var(--space-10);
    background: radial-gradient(ellipse at top, #2a1f15 0%, var(--canvas) 70%);
    border-bottom: 1px solid var(--border);
    overflow: hidden;
  "
>
  <!-- Ambient decorations (absolute) -->
  <SunDisc style={{ position: 'absolute', top: '24px', right: '40px', opacity: 0.4 }} />
  <Leaf style={{ position: 'absolute', bottom: '60px', left: '5%', opacity: 0.35 }} />
  <Hexagon style={{ position: 'absolute', top: '40%', left: '8%', opacity: 0.3 }} />
  <DotPair style={{ position: 'absolute', bottom: '20%', right: '10%', opacity: 0.4 }} />

  <div style="max-width: 1080px; margin: 0 auto; display: grid; grid-template-columns: 1fr auto; gap: var(--space-8); align-items: center;">
    <div>
      <h1
        style="
          font-family: var(--font-display);
          font-size: clamp(32px, 5vw, 56px);
          font-weight: 600;
          line-height: 1.1;
          letter-spacing: -0.01em;
          color: var(--text-primary);
          margin: 0;
        "
      >
        A browser that doesn't waste your data.
      </h1>
      <p
        style="
          margin-top: var(--space-4);
          font-size: 18px;
          line-height: 1.6;
          color: var(--text-secondary);
          max-width: 520px;
        "
      >
        Reader mode auto-saves bandwidth on slow connections. Built on Cloudflare's African edge. Open in Yoruba, Swahili, Hausa.
      </p>
      <div style="margin-top: var(--space-6); display: flex; gap: var(--space-3); flex-wrap: wrap;">
        <a
          href={release.windowsAssetUrl}
          style="
            background: var(--accent);
            color: var(--text-on-accent);
            padding: 12px 22px;
            border-radius: 999px;
            font-weight: 600;
            text-decoration: none;
            font-size: 14px;
            display: inline-flex;
            align-items: center;
          "
        >{ctaLabel}</a>
        <a
          href="#features"
          style="
            color: var(--text-secondary);
            padding: 12px 18px;
            border-radius: 999px;
            border: 1px solid var(--border);
            text-decoration: none;
            font-size: 14px;
          "
        >What's inside →</a>
      </div>
      <p style="margin-top: var(--space-3); font-size: 12px; color: var(--text-muted);">
        Latest: <code>{release.tag}</code> · Linux AppImage + .deb also available
      </p>
    </div>
    <div style="display: flex; justify-content: center;">
      <GroveTree size={160} client:visible />
    </div>
  </div>
</section>

<style>
  /* Tree below text on narrow viewports */
  @media (max-width: 720px) {
    section#hero > div {
      grid-template-columns: 1fr;
    }
    section#hero > div > div:last-child {
      order: -1;
    }
  }
</style>
```

- [ ] **Step 3: Render `<Hero />` in the page**

Edit `apps/site/src/pages/index.astro`:

```astro
---
import Base from '../layouts/Base.astro'
import Hero from '../components/Hero.astro'
---
<Base>
  <Hero />
  <!-- Manifesto, Features, Sovereignty, AiDemo, Personas, Download, follow. -->
</Base>
```

- [ ] **Step 4: Build + verify the hero renders correctly**

```bash
cd apps/site && npm run build 2>&1 | tail -10
```
Expected: build succeeds. The build log should show "Performed manual hydration directive on GroveTree" (Astro logging the island).

Open `apps/site/dist/index.html` in a browser:
- Headline renders in display serif
- CTA pill shows "Download for Windows · X.X MB" (X.X = actual GitHub Release asset size at build time) or just "Download for Windows" on fetch failure
- GroveTree is on the right (or above on narrow viewport) and animates (fruits glow, leaves twinkle)

- [ ] **Step 5: Commit**

```bash
git add apps/site/src/components/Hero.astro apps/site/src/lib/latest-release.ts apps/site/src/pages/index.astro
git commit -m "feat(site): hero section with GroveTree island + build-time CTA size

Headline 'A browser that doesn't waste your data.' in Recoleta
display serif (with serif stack fallback). Subhead grounded in
the in-app i18n voice. Download CTA pill labels itself with the
actual Windows installer size pulled from the GitHub Releases API
at build time; falls back to plain 'Download for Windows' if the
fetch errors so build never blocks.

GroveTree is a client:visible React island — it hydrates only when
scrolled into view (which is immediately on the hero). Decorations
scatter ambient around the section.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Manifesto / "Why" section

**Files:**
- Create: `apps/site/src/components/Manifesto.astro`
- Modify: `apps/site/src/pages/index.astro`

- [ ] **Step 1: Create `Manifesto.astro`**

```astro
---
// "Why" section. 4 short paragraphs, no images. Voice grounded in
// the in-app i18n strings ('Cloudflare's African POPs', 'Reaching
// across the continent', 'Your data lives in').
---
<section
  id="why"
  style="
    padding: var(--space-12) var(--space-5);
    background: var(--surface-1);
    border-bottom: 1px solid var(--border);
  "
>
  <div style="max-width: 720px; margin: 0 auto;">
    <p
      style="
        font-family: var(--font-display);
        font-size: 12px;
        font-weight: 600;
        letter-spacing: 0.15em;
        text-transform: uppercase;
        color: var(--accent);
        margin: 0 0 var(--space-3);
      "
    >Why</p>
    <h2
      style="
        font-family: var(--font-display);
        font-size: clamp(24px, 3.5vw, 36px);
        line-height: 1.2;
        color: var(--text-primary);
        margin: 0 0 var(--space-6);
      "
    >Most browsers were designed somewhere else.</h2>
    <div style="display: grid; gap: var(--space-5); color: var(--text-secondary); font-size: 17px; line-height: 1.7;">
      <p>
        The dominant browsers assume gigabit fibre, infinite RAM, and that the nearest CDN
        is less than ten milliseconds away. None of those things are reliably true on the
        African web. Baobab starts from where the connection actually is: a metered
        4G handset, an MTN data bundle, a 2G corner of a rural network. The product is
        designed around that constraint, not in spite of it.
      </p>
      <p>
        Sovereignty isn't a feature here, it's the spine. Your browsing stays local by
        default. Optional sync stores bookmarks, history and chats on Cloudflare's
        edge — with the explicit goal of African regions when they ship (D1 and R2
        sit in the EU region today as a pragmatic stopgap). We never sell your data,
        share it with third parties, or train models on it. Settings → Sovereignty
        shows you exactly where each read came from.
      </p>
      <p>
        A browser is the right shape for this. Cookies, navigation guards, ad-block
        scope, data-residency commitments — they all live at the browser layer. Apps
        inherit from it. If we want a different default, the browser is where it has
        to start.
      </p>
      <p>
        The Sahel palette, the baobab tree, the Adinkra motifs — these aren't
        decoration. They're the visual reminder of who the product is for. We built
        it to be ours.
      </p>
    </div>
  </div>
</section>
```

- [ ] **Step 2: Render `<Manifesto />` in the page**

```astro
---
import Base from '../layouts/Base.astro'
import Hero from '../components/Hero.astro'
import Manifesto from '../components/Manifesto.astro'
---
<Base>
  <Hero />
  <Manifesto />
  <!-- Features, Sovereignty, AiDemo, Personas, Download follow. -->
</Base>
```

- [ ] **Step 3: Build + verify**

```bash
cd apps/site && npm run build 2>&1 | tail -5
```
Expected: build succeeds. Open dist/index.html — manifesto section renders after the hero with the "WHY" eyebrow label, the section heading, and the 4-paragraph body.

- [ ] **Step 4: Commit**

```bash
git add apps/site/src/components/Manifesto.astro apps/site/src/pages/index.astro
git commit -m "feat(site): manifesto / why section

Four short paragraphs grounded in the in-app i18n voice. Honest about
the EU-region D1/R2 stopgap rather than overclaiming 'data lives in
Africa'. Sets up the feature blocks that follow.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: FeatureBlock component + 6 feature instances

**Files:**
- Create: `apps/site/src/components/FeatureBlock.astro`
- Create: `apps/site/src/components/Features.astro`
- Create: `apps/site/src/assets/screenshots/.gitkeep` (placeholder directory marker)
- Modify: `apps/site/src/pages/index.astro`

The 6 features per the spec section 4: Reader Auto-Savings, Grove multi-profile, African-first Search, Translate, Ad-blocker, Data gauge + budget.

Screenshots are **placeholder** for v1 (real captures are a separate manual step). The component supports both image-based and SVG-based illustrations.

- [ ] **Step 1: Create `FeatureBlock.astro`**

```astro
---
interface Props {
  id: string
  emoji: string
  title: string
  body: string
  bullets?: string[]
  screenshotAlt?: string
  screenshotSrc?: string
  reverse?: boolean
}
const { id, emoji, title, body, bullets, screenshotAlt, screenshotSrc, reverse = false } = Astro.props
---
<article
  id={`feature-${id}`}
  style={`
    padding: var(--space-10) var(--space-5);
    background: var(--canvas);
    border-bottom: 1px solid var(--border);
  `}
>
  <div
    style={`
      max-width: 1080px;
      margin: 0 auto;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--space-8);
      align-items: center;
      ${reverse ? 'direction: rtl;' : ''}
    `}
  >
    <div style={reverse ? 'direction: ltr;' : ''}>
      <div style="font-size: 28px; margin-bottom: var(--space-3);" aria-hidden="true">{emoji}</div>
      <h3
        style="
          font-family: var(--font-display);
          font-size: clamp(22px, 3vw, 28px);
          color: var(--text-primary);
          margin: 0 0 var(--space-3);
        "
      >{title}</h3>
      <p style="color: var(--text-secondary); font-size: 16px; line-height: 1.65; margin: 0 0 var(--space-3);">{body}</p>
      {bullets && (
        <ul style="color: var(--text-secondary); font-size: 15px; line-height: 1.8; padding-left: 20px; margin: 0;">
          {bullets.map((b) => <li>{b}</li>)}
        </ul>
      )}
    </div>
    <div style={reverse ? 'direction: ltr;' : ''}>
      {screenshotSrc ? (
        <img
          src={screenshotSrc}
          alt={screenshotAlt || ''}
          loading="lazy"
          style="
            width: 100%;
            border-radius: 12px;
            border: 1px solid var(--border);
            background: var(--surface-1);
          "
        />
      ) : (
        <div
          style="
            aspect-ratio: 4 / 3;
            background: linear-gradient(135deg, var(--surface-1), var(--surface-2));
            border: 1px dashed var(--border);
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: var(--text-muted);
            font-size: 12px;
            text-align: center;
          "
          aria-hidden="true"
        >
          Screenshot · {title}<br/><small>(captured in Task 14)</small>
        </div>
      )}
    </div>
  </div>
</article>

<style>
  @media (max-width: 720px) {
    article > div {
      grid-template-columns: 1fr !important;
      direction: ltr !important;
    }
  }
</style>
```

- [ ] **Step 2: Create `Features.astro` that renders 6 blocks**

```astro
---
import FeatureBlock from './FeatureBlock.astro'
---
<section
  id="features"
  style="
    background: var(--canvas);
    border-bottom: 1px solid var(--border);
    padding-top: var(--space-8);
  "
>
  <header style="max-width: 720px; margin: 0 auto; padding: 0 var(--space-5);">
    <p style="font-family: var(--font-display); font-size: 12px; font-weight: 600; letter-spacing: 0.15em; text-transform: uppercase; color: var(--accent); margin: 0 0 var(--space-3);">What's inside</p>
    <h2 style="font-family: var(--font-display); font-size: clamp(24px, 3.5vw, 36px); color: var(--text-primary); margin: 0 0 var(--space-6);">Six features that earn their weight.</h2>
  </header>

  <FeatureBlock
    id="reader"
    emoji="📖"
    title="Reader Auto-Savings"
    body="On slow connections a 3-second countdown intercepts heavy pages and renders a clean text version instead — typically 80–95% lighter on news sites. The tab never fetches the heavy page when Reader is chosen."
    bullets={[
      'Domain skip-list (search engines, gmail, github, login flows) bypasses automatically',
      'AI summary opt-in via a Summarize pill so slow-mode renders are fast first',
      'Savings feed your daily data gauge',
    ]}
    screenshotAlt="Baobab Reader mode rendering an article with a saved-data header"
  />

  <FeatureBlock
    id="grove"
    emoji="🌳"
    title="The Grove · multi-profile"
    body="Chrome-style profile windows with real per-profile cookie isolation (each profile gets its own WebView2 data directory). Optional 4-digit PIN per profile for shared computers, with progressive lockout on wrong attempts."
    screenshotAlt="The Baobab Grove profile picker"
    reverse={true}
  />

  <FeatureBlock
    id="search"
    emoji="🔍"
    title="African-first Search"
    body="Type without a '.' and Baobab searches with Workers AI on Cloudflare's African edge. Sources are reranked to lift African voices to the top of the result list."
    bullets={[
      'No sign-in required',
      'Sunset gradient results page with brand-rooted answer card',
    ]}
    screenshotAlt="Baobab Search results page"
  />

  <FeatureBlock
    id="translate"
    emoji="🌐"
    title="Translate without leaving the browser"
    body="TranslatePad opens with one shortcut and translates between English, Yoruba, Swahili, Hausa, Amharic, Wolof, Zulu, French and Arabic — m2m100-1.2b on the worker, Llama fallback."
    screenshotAlt="Baobab TranslatePad open in the chrome"
    reverse={true}
  />

  <FeatureBlock
    id="adblock"
    emoji="🚫"
    title="Ad-blocker with YouTube skip"
    body="103-hostname starter list from EasyList + EasyPrivacy. YouTube ads auto-skip via DOM fast-forward (the player jumps to the end of the ad whenever one's detected). Per-profile, default ON."
    screenshotAlt="Settings ad-block section"
  />

  <FeatureBlock
    id="data"
    emoji="📊"
    title="Data gauge + daily budget"
    body="Set a daily byte cap. Toasts warn at 80% and again at 100% (auto-enables slow-mode at 100%). Reader savings count alongside ad-block savings. Wi-Fi-only sync (default ON) defers history and bookmarks pushes to Wi-Fi-class connections."
    screenshotAlt="Settings Data section with byte gauge and sparkline"
    reverse={true}
  />
</section>
```

- [ ] **Step 3: Add to page**

```astro
---
import Base from '../layouts/Base.astro'
import Hero from '../components/Hero.astro'
import Manifesto from '../components/Manifesto.astro'
import Features from '../components/Features.astro'
---
<Base>
  <Hero />
  <Manifesto />
  <Features />
  <!-- Sovereignty, AiDemo, Personas, Download follow. -->
</Base>
```

- [ ] **Step 4: Create the screenshots directory placeholder**

```bash
mkdir -p /c/dev/baobab/apps/site/src/assets/screenshots
echo "# Screenshot capture procedure" > /c/dev/baobab/apps/site/src/assets/screenshots/RECAPTURING.md
echo "" >> /c/dev/baobab/apps/site/src/assets/screenshots/RECAPTURING.md
echo "Capture from the desktop app at 1280x800 window size, 2x DPI." >> /c/dev/baobab/apps/site/src/assets/screenshots/RECAPTURING.md
echo "Save as PNG; filenames match the FeatureBlock id (reader.png, grove.png, search.png, translate.png, adblock.png, data.png)." >> /c/dev/baobab/apps/site/src/assets/screenshots/RECAPTURING.md
echo "Update each FeatureBlock's screenshotSrc prop to './src/assets/screenshots/<id>.png'." >> /c/dev/baobab/apps/site/src/assets/screenshots/RECAPTURING.md
echo "Real screenshots are captured manually in Task 14." >> /c/dev/baobab/apps/site/src/assets/screenshots/RECAPTURING.md
```

- [ ] **Step 5: Build + verify**

```bash
cd apps/site && npm run build 2>&1 | tail -5
```
Expected: build succeeds. dist/index.html shows 6 feature blocks alternating left/right; each has the emoji + title + body + bullets (where present) + screenshot placeholder.

- [ ] **Step 6: Commit**

```bash
git add apps/site/src/components/FeatureBlock.astro apps/site/src/components/Features.astro apps/site/src/assets apps/site/src/pages/index.astro
git commit -m "feat(site): FeatureBlock component + 6 feature instances

Alternating left/right layout (the reverse prop flips the grid).
Each block has emoji, title, body, optional bullets, and a screenshot
slot. Real screenshots captured manually in Task 14 (see
RECAPTURING.md); for now blocks render a styled placeholder.

The six features map exactly to what shipped through Bundle A + B:
Reader, Grove (multi-profile), Search, Translate, Ad-blocker, Data
gauge.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Sovereignty deep-dive section

**Files:**
- Create: `apps/site/src/components/SovereigntyDeepDive.astro`
- Modify: `apps/site/src/pages/index.astro`

- [ ] **Step 1: Create `SovereigntyDeepDive.astro`**

```astro
---
// Sovereignty deep-dive. Full-bleed screenshot of SovereigntyDashboard
// (captured in Task 14), 3 paragraphs of plain-English data residency.
---
<section
  id="sovereignty"
  style="
    padding: var(--space-12) var(--space-5);
    background: var(--surface-1);
    border-bottom: 1px solid var(--border);
  "
>
  <div style="max-width: 1080px; margin: 0 auto;">
    <header style="max-width: 720px; margin: 0 auto var(--space-8);">
      <p style="font-family: var(--font-display); font-size: 12px; font-weight: 600; letter-spacing: 0.15em; text-transform: uppercase; color: var(--accent); margin: 0 0 var(--space-3);">Sovereignty</p>
      <h2 style="font-family: var(--font-display); font-size: clamp(24px, 3.5vw, 36px); color: var(--text-primary); margin: 0;">Your data lives where you can see it.</h2>
    </header>

    <div
      style="
        aspect-ratio: 16 / 9;
        background: linear-gradient(135deg, var(--surface-2), var(--surface-1));
        border: 1px dashed var(--border);
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--text-muted);
        font-size: 13px;
        margin-bottom: var(--space-8);
      "
      aria-hidden="true"
    >
      SovereigntyDashboard screenshot · captured in Task 14
    </div>

    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: var(--space-6); color: var(--text-secondary); font-size: 15px; line-height: 1.7;">
      <div>
        <h3 style="font-family: var(--font-display); font-size: 18px; color: var(--text-primary); margin: 0 0 var(--space-3);">What's stored where</h3>
        <p>Your bookmarks, history, and chats sync to Cloudflare D1 (structured data) and R2 (content). Both are in the EU region today; we're moving to African regions when Cloudflare ships them. Auth tokens live in the OS keyring, encrypted at rest.</p>
      </div>
      <div>
        <h3 style="font-family: var(--font-display); font-size: 18px; color: var(--text-primary); margin: 0 0 var(--space-3);">What we never do</h3>
        <p>No third-party analytics. No model training on your data. No data sales. No tracking beacons embedded by us. Local mode disables sync entirely if you'd rather keep everything on this machine.</p>
      </div>
      <div>
        <h3 style="font-family: var(--font-display); font-size: 18px; color: var(--text-primary); margin: 0 0 var(--space-3);">How you verify</h3>
        <p>Settings → Sovereignty shows which Cloudflare colo served your last reads, and which regions hold your persisted data. Toggle sync off at any time; the local profile keeps working without it.</p>
      </div>
    </div>
  </div>
</section>
```

- [ ] **Step 2: Add to page**

```astro
---
import Base from '../layouts/Base.astro'
import Hero from '../components/Hero.astro'
import Manifesto from '../components/Manifesto.astro'
import Features from '../components/Features.astro'
import SovereigntyDeepDive from '../components/SovereigntyDeepDive.astro'
---
<Base>
  <Hero />
  <Manifesto />
  <Features />
  <SovereigntyDeepDive />
  <!-- AiDemo, Personas, Download follow. -->
</Base>
```

- [ ] **Step 3: Build + verify**

```bash
cd apps/site && npm run build 2>&1 | tail -5
```
Expected: build succeeds. dist/index.html shows sovereignty section with eyebrow + heading + screenshot placeholder + 3 column body.

- [ ] **Step 4: Commit**

```bash
git add apps/site/src/components/SovereigntyDeepDive.astro apps/site/src/pages/index.astro
git commit -m "feat(site): sovereignty deep-dive section

Honest about EU-region D1/R2 stopgap. Three columns: what's stored
where, what we never do, how to verify. Screenshot slot for the
SovereigntyDashboard image (captured in Task 14).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: AiDemo React island (public `/api/ai/search` call)

**Files:**
- Create: `apps/site/src/components/AiDemo.tsx`
- Modify: `apps/site/src/pages/index.astro`

The worker's `/api/ai/search` is already public (per the search portal v1 work) and returns `{ answer: string, results: Array<{ title: string, url: string }> }`. Rate-limited at 30/min per IP.

- [ ] **Step 1: Create `AiDemo.tsx`**

```tsx
import { useState } from 'react'

const API_BASE = 'https://baobab-api.ohcsghana-main.workers.dev'

interface SearchResponse {
  answer: string
  results: Array<{ title: string; url: string }>
}

type State =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'ok'; data: SearchResponse }
  | { phase: 'error'; kind: 'rate-limited' | 'network' | 'server'; detail?: string }

export function AiDemo() {
  const [query, setQuery] = useState('')
  const [state, setState] = useState<State>({ phase: 'idle' })

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const q = query.trim()
    if (!q) return
    if (!navigator.onLine) {
      setState({ phase: 'error', kind: 'network', detail: 'offline' })
      return
    }
    setState({ phase: 'loading' })
    try {
      const r = await fetch(`${API_BASE}/api/ai/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
      })
      if (r.status === 429) {
        setState({ phase: 'error', kind: 'rate-limited' })
        return
      }
      if (!r.ok) {
        setState({ phase: 'error', kind: 'server', detail: `${r.status}` })
        return
      }
      const data = (await r.json()) as SearchResponse
      setState({ phase: 'ok', data })
    } catch (err) {
      setState({
        phase: 'error',
        kind: 'network',
        detail: err instanceof Error ? err.message : 'unknown',
      })
    }
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <form onSubmit={onSubmit} style={{ display: 'flex', gap: 8 }}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask anything about Africa…"
          aria-label="Search query"
          style={{
            flex: 1,
            padding: '14px 16px',
            background: 'var(--canvas)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border)',
            borderRadius: 999,
            fontSize: 16,
            fontFamily: 'inherit',
          }}
        />
        <button
          type="submit"
          disabled={state.phase === 'loading' || !query.trim()}
          style={{
            background: 'var(--accent)',
            color: 'var(--text-on-accent)',
            border: 'none',
            padding: '14px 22px',
            borderRadius: 999,
            fontSize: 14,
            fontWeight: 600,
            cursor: state.phase === 'loading' || !query.trim() ? 'default' : 'pointer',
            opacity: state.phase === 'loading' || !query.trim() ? 0.55 : 1,
          }}
        >
          {state.phase === 'loading' ? 'Searching…' : 'Search'}
        </button>
      </form>

      <div
        role="status"
        aria-live="polite"
        style={{ marginTop: 24 }}
      >
        {state.phase === 'idle' && (
          <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>
            Powered by Workers AI on Cloudflare's African edge. Rate-limited; install Baobab for the full experience.
          </p>
        )}
        {state.phase === 'loading' && (
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: 0 }}>Reaching across the continent…</p>
        )}
        {state.phase === 'ok' && (
          <div>
            <p style={{ color: 'var(--text-primary)', fontSize: 16, lineHeight: 1.65, margin: '0 0 16px' }}>
              {state.data.answer}
            </p>
            {state.data.results.length > 0 && (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {state.data.results.slice(0, 5).map((r) => (
                  <li key={r.url} style={{ marginBottom: 12 }}>
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: 'var(--accent)', textDecoration: 'none', fontSize: 14 }}
                    >
                      {r.title}
                    </a>
                    <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>{r.url}</div>
                  </li>
                ))}
              </ul>
            )}
            <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 16 }}>
              Try the full version with bookmarks, history and translate — <a href="#download" style={{ color: 'var(--accent)' }}>install Baobab</a>.
            </p>
          </div>
        )}
        {state.phase === 'error' && state.kind === 'rate-limited' && (
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: 0 }}>
            You've used your demo quota — <a href="#download" style={{ color: 'var(--accent)' }}>install Baobab</a> for unlimited use.
          </p>
        )}
        {state.phase === 'error' && state.kind === 'network' && state.detail === 'offline' && (
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: 0 }}>
            You're offline — Baobab works offline once installed.
          </p>
        )}
        {state.phase === 'error' && state.kind === 'network' && state.detail !== 'offline' && (
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: 0 }}>
            Network error — try again, or <a href="#download" style={{ color: 'var(--accent)' }}>install Baobab</a>.
          </p>
        )}
        {state.phase === 'error' && state.kind === 'server' && (
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: 0 }}>
            AI is temporarily unavailable ({state.detail}) — <a href="#download" style={{ color: 'var(--accent)' }}>install Baobab</a> for local translation + reader.
          </p>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Wrap in an `.astro` section + add to page**

Create `apps/site/src/components/TryAi.astro`:

```astro
---
import { AiDemo } from './AiDemo.tsx'
---
<section
  id="try-ai"
  style="
    padding: var(--space-10) var(--space-5);
    background: var(--canvas);
    border-bottom: 1px solid var(--border);
  "
>
  <header style="max-width: 720px; margin: 0 auto var(--space-6);">
    <p style="font-family: var(--font-display); font-size: 12px; font-weight: 600; letter-spacing: 0.15em; text-transform: uppercase; color: var(--accent); margin: 0 0 var(--space-3);">Try it</p>
    <h2 style="font-family: var(--font-display); font-size: clamp(24px, 3.5vw, 36px); color: var(--text-primary); margin: 0 0 var(--space-3);">Ask before you install.</h2>
    <p style="color: var(--text-secondary); font-size: 16px; margin: 0;">
      The same AI search that powers Baobab in-browser. Rate-limited for the demo; install the desktop app for unlimited use.
    </p>
  </header>
  <AiDemo client:visible />
</section>
```

Add to page:

```astro
---
import Base from '../layouts/Base.astro'
import Hero from '../components/Hero.astro'
import Manifesto from '../components/Manifesto.astro'
import Features from '../components/Features.astro'
import SovereigntyDeepDive from '../components/SovereigntyDeepDive.astro'
import TryAi from '../components/TryAi.astro'
---
<Base>
  <Hero />
  <Manifesto />
  <Features />
  <SovereigntyDeepDive />
  <TryAi />
  <!-- Personas, Download follow. -->
</Base>
```

- [ ] **Step 3: Build + manual test**

```bash
cd apps/site && npm run build 2>&1 | tail -5
cd apps/site && timeout 15 npm run dev 2>&1 | head -10
```

Open http://localhost:4321 — scroll to the Try It section. Type a question, click Search. Within ~5 seconds an answer + results list should render.

- [ ] **Step 4: Commit**

```bash
git add apps/site/src/components/AiDemo.tsx apps/site/src/components/TryAi.astro apps/site/src/pages/index.astro
git commit -m "feat(site): AiDemo island — try the AI without installing

Single React island that POSTs to the already-public /api/ai/search
worker route. Renders answer + up to 5 results. Handles 429
(rate-limited), 5xx, network failure, and offline states each with
a specific install CTA in their copy.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: PersonaBand component + 4 instances

**Files:**
- Create: `apps/site/src/components/PersonaBand.astro`
- Create: `apps/site/src/components/Personas.astro`
- Modify: `apps/site/src/pages/index.astro`

- [ ] **Step 1: Create `PersonaBand.astro`**

```astro
---
interface Props {
  id: string
  accentVar: string  // CSS var name e.g. --persona-metered
  label: string
  body: string
  ctaHref: string
  ctaLabel: string
}
const { id, accentVar, label, body, ctaHref, ctaLabel } = Astro.props
---
<article
  id={`persona-${id}`}
  style={`
    background: var(--surface-1);
    border-left: 3px solid var(${accentVar});
    padding: var(--space-6) var(--space-5);
    margin-bottom: var(--space-3);
    max-width: 720px;
    margin-inline: auto;
    border-radius: 0 8px 8px 0;
  `}
>
  <div
    style={`
      font-family: var(--font-display);
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(${accentVar});
      margin-bottom: var(--space-2);
    `}
  >{label}</div>
  <p style="color: var(--text-secondary); font-size: 16px; line-height: 1.65; margin: 0 0 var(--space-3);">{body}</p>
  <a
    href={ctaHref}
    style={`
      display: inline-flex;
      align-items: center;
      gap: 4px;
      color: var(${accentVar});
      font-size: 14px;
      font-weight: 600;
      text-decoration: none;
    `}
  >{ctaLabel} →</a>
</article>
```

- [ ] **Step 2: Create `Personas.astro`**

```astro
---
import PersonaBand from './PersonaBand.astro'
---
<section
  id="personas"
  style="
    padding: var(--space-10) var(--space-5);
    background: var(--canvas);
    border-bottom: 1px solid var(--border);
  "
>
  <header style="max-width: 720px; margin: 0 auto var(--space-6);">
    <p style="font-family: var(--font-display); font-size: 12px; font-weight: 600; letter-spacing: 0.15em; text-transform: uppercase; color: var(--accent); margin: 0 0 var(--space-3);">For you if</p>
    <h2 style="font-family: var(--font-display); font-size: clamp(24px, 3.5vw, 36px); color: var(--text-primary); margin: 0;">Find your slot.</h2>
  </header>

  <PersonaBand
    id="metered"
    accentVar="--persona-metered"
    label="If your data plan is the bottleneck"
    body="Baobab was built for you. The byte gauge, Reader mode, and Wi-Fi-only sync work together so 100 MB of mobile data goes further. Slow mode kicks in automatically; the daily budget is yours to set."
    ctaHref="#feature-reader"
    ctaLabel="See Reader Mode"
  />

  <PersonaBand
    id="builder"
    accentVar="--persona-builder"
    label="If you're an engineer"
    body="The worker is Hono on Cloudflare. The desktop is Tauri 2 + React 18. Most routes are public. The design specs live in the repo. Read the notes, fork what you want, file what doesn't work."
    ctaHref="https://github.com/ghwmelite-dotcom/baobab"
    ctaLabel="View the repo"
  />

  <PersonaBand
    id="diaspora"
    accentVar="--persona-diaspora"
    label="If you're abroad and curious"
    body="The manifesto above is the short version. The longer story is in the design docs and the source. Read about the choices we made and why — the why matters more than the what."
    ctaHref="#why"
    ctaLabel="Read the manifesto"
  />

  <PersonaBand
    id="org"
    accentVar="--persona-org"
    label="If you run an organisation"
    body="Multi-profile windows with real cookie isolation per profile. Sovereignty Dashboard surfaces your data residency for compliance review. Volume install via MSI is on the roadmap (Q3 2026)."
    ctaHref="mailto:hello@baobab.askozzy.work?subject=Baobab%20for%20our%20org"
    ctaLabel="Talk to us"
  />
</section>
```

- [ ] **Step 3: Add to page**

```astro
---
import Base from '../layouts/Base.astro'
import Hero from '../components/Hero.astro'
import Manifesto from '../components/Manifesto.astro'
import Features from '../components/Features.astro'
import SovereigntyDeepDive from '../components/SovereigntyDeepDive.astro'
import TryAi from '../components/TryAi.astro'
import Personas from '../components/Personas.astro'
---
<Base>
  <Hero />
  <Manifesto />
  <Features />
  <SovereigntyDeepDive />
  <TryAi />
  <Personas />
  <!-- Download CTA follows. -->
</Base>
```

- [ ] **Step 4: Build + verify**

```bash
cd apps/site && npm run build 2>&1 | tail -5
```
Expected: 4 stacked persona bands, each with a colored left border (amber / green / terracotta / slate blue), label, body, and CTA arrow link.

- [ ] **Step 5: Commit**

```bash
git add apps/site/src/components/PersonaBand.astro apps/site/src/components/Personas.astro apps/site/src/pages/index.astro
git commit -m "feat(site): four persona bands

Color-coded left-border accent for each persona (amber / green /
terracotta / slate). Each band names the persona, gives the one-line
pitch, and links to the most relevant section or external surface.

org band uses a mailto: with subject prefilled — no contact form
needed for v1.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: Download CTA repeat section

**Files:**
- Create: `apps/site/src/components/DownloadCta.astro`
- Modify: `apps/site/src/pages/index.astro`

- [ ] **Step 1: Create `DownloadCta.astro`**

```astro
---
import { getLatestRelease } from '../lib/latest-release.ts'

const release = await getLatestRelease()
const ctaLabel = release.windowsSizeMb
  ? `Download for Windows · ${release.windowsSizeMb}`
  : 'Download for Windows'
---
<section
  id="download"
  style="
    padding: var(--space-12) var(--space-5);
    background: radial-gradient(ellipse at bottom, #2a1f15 0%, var(--canvas) 70%);
    text-align: center;
    border-bottom: 1px solid var(--border);
  "
>
  <h2
    style="
      font-family: var(--font-display);
      font-size: clamp(28px, 4vw, 42px);
      color: var(--text-primary);
      margin: 0 0 var(--space-3);
      line-height: 1.15;
    "
  >Try it now.</h2>
  <p style="color: var(--text-secondary); font-size: 17px; margin: 0 0 var(--space-6);">
    {release.windowsSizeMb && `${release.windowsSizeMb} · `}Windows · Linux (AppImage, .deb) · macOS coming back · Android in roadmap
  </p>
  <a
    href={release.windowsAssetUrl}
    style="
      display: inline-block;
      background: var(--accent);
      color: var(--text-on-accent);
      padding: 14px 28px;
      border-radius: 999px;
      font-weight: 600;
      text-decoration: none;
      font-size: 15px;
    "
  >{ctaLabel}</a>
  <p style="margin-top: var(--space-4); font-size: 13px;">
    <a href="https://github.com/ghwmelite-dotcom/baobab/releases" style="color: var(--text-muted); text-decoration: none;">View all releases →</a>
  </p>
</section>
```

- [ ] **Step 2: Add to page**

```astro
---
import Base from '../layouts/Base.astro'
import Hero from '../components/Hero.astro'
import Manifesto from '../components/Manifesto.astro'
import Features from '../components/Features.astro'
import SovereigntyDeepDive from '../components/SovereigntyDeepDive.astro'
import TryAi from '../components/TryAi.astro'
import Personas from '../components/Personas.astro'
import DownloadCta from '../components/DownloadCta.astro'
---
<Base>
  <Hero />
  <Manifesto />
  <Features />
  <SovereigntyDeepDive />
  <TryAi />
  <Personas />
  <DownloadCta />
</Base>
```

- [ ] **Step 3: Build + verify**

```bash
cd apps/site && npm run build 2>&1 | tail -5
```
Expected: download CTA renders below personas with the inverted radial-gradient (Sahel-warm at bottom) + the platform list + the accent download button + the "View all releases →" link.

- [ ] **Step 4: Commit**

```bash
git add apps/site/src/components/DownloadCta.astro apps/site/src/pages/index.astro
git commit -m "feat(site): download CTA repeat at section #download

Same release info as the hero CTA, reused via the latest-release
helper (build-time fetch). Inverted radial gradient (Sahel-warm at
bottom) gives a closing visual rhythm before the footer.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 12: SEO meta + OG + JSON-LD + sitemap + robots + Cloudflare Web Analytics

**Files:**
- Modify: `apps/site/src/layouts/Base.astro` — add OG/Twitter/JSON-LD meta tags
- Modify: `apps/site/astro.config.mjs` — sitemap integration already wired in Task 1
- Create: `apps/site/public/robots.txt`
- Create: `apps/site/public/og-image.png` (placeholder — real image captured in Task 14)

- [ ] **Step 1: Expand `Base.astro` with full SEO meta**

Replace the `<head>` of `apps/site/src/layouts/Base.astro` with:

```astro
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="description" content={description} />
    <title>{title}</title>
    <link rel="canonical" href="https://baobab.askozzy.work/" />

    <!-- Open Graph -->
    <meta property="og:title" content={title} />
    <meta property="og:description" content={description} />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="https://baobab.askozzy.work/" />
    <meta property="og:image" content="https://baobab.askozzy.work/og-image.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />

    <!-- Twitter -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content={title} />
    <meta name="twitter:description" content={description} />
    <meta name="twitter:image" content="https://baobab.askozzy.work/og-image.png" />

    <!-- JSON-LD: SoftwareApplication -->
    <script type="application/ld+json" set:html={JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'Baobab',
      applicationCategory: 'WebBrowser',
      operatingSystem: 'Windows, Linux',
      description,
      url: 'https://baobab.askozzy.work/',
      downloadUrl: 'https://github.com/ghwmelite-dotcom/baobab/releases/latest',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    })} />

    <!-- Cloudflare Web Analytics — cookieless. The site/data tag is configured
         once per Pages project from the Cloudflare dashboard; the script tag
         below picks it up server-side. -->
    <script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token": "REPLACE_WITH_TOKEN_FROM_CF_DASHBOARD"}'></script>
  </head>
```

NOTE: The `REPLACE_WITH_TOKEN_FROM_CF_DASHBOARD` placeholder MUST be replaced once the Cloudflare Pages project is created (done in Task 13). The Cloudflare dashboard issues a per-site token under Pages → Settings → Analytics → "Web Analytics for Pages". Until then the script loads but reports nothing — harmless.

- [ ] **Step 2: Create `public/robots.txt`**

```bash
mkdir -p /c/dev/baobab/apps/site/public
cat > /c/dev/baobab/apps/site/public/robots.txt << 'EOF'
User-agent: *
Allow: /

Sitemap: https://baobab.askozzy.work/sitemap-index.xml
EOF
```

- [ ] **Step 3: Create placeholder `og-image.png`**

The real image is captured in Task 14. For now place a 1200×630 placeholder so the meta tag points at something. Use Astro's `public/` directory:

```bash
# A 1200x630 dark PNG with the Sahel canvas color
# (any tool works; for the placeholder a simple solid-color image is fine).
# If ImageMagick is available:
magick -size 1200x630 xc:'#15110d' /c/dev/baobab/apps/site/public/og-image.png 2>/dev/null \
  || echo "TODO: capture real OG image in Task 14 — see /apps/site/public/og-image.png"
```

If ImageMagick isn't available, create an empty placeholder so the build doesn't 404 on the asset:

```bash
touch /c/dev/baobab/apps/site/public/og-image.png
```

- [ ] **Step 4: Verify sitemap is generated**

```bash
cd apps/site && npm run build 2>&1 | grep -i sitemap
ls /c/dev/baobab/apps/site/dist/ | grep -i sitemap
```
Expected: build log mentions sitemap; `dist/sitemap-index.xml` and `dist/sitemap-0.xml` exist.

- [ ] **Step 5: Commit**

```bash
git add apps/site/src/layouts/Base.astro apps/site/public/robots.txt apps/site/public/og-image.png
git commit -m "feat(site): SEO meta + OG + JSON-LD + robots + Cloudflare analytics

Open Graph + Twitter Card meta. JSON-LD SoftwareApplication
schema for the install card. robots.txt allows all and points at
the sitemap (auto-generated by @astrojs/sitemap). Cloudflare Web
Analytics beacon script — token placeholder filled in once the
Pages project is created in Task 13.

og-image.png is a placeholder (solid Sahel-dark); the real
composition is captured in Task 14.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 13: Cloudflare Pages deploy + custom domain + Lighthouse CI

**Files:**
- Create: `.github/workflows/site-deploy.yml`
- Modify: `apps/site/src/layouts/Base.astro` — replace Cloudflare Analytics token placeholder once the Pages project is created

The Cloudflare Pages project is created manually via dashboard (one-time setup). After that, deploys are git-push-driven.

- [ ] **Step 1: Create Cloudflare Pages project (one-time manual step)**

Cloudflare dashboard → Pages → Create application → Connect to Git:
- Repository: `ghwmelite-dotcom/baobab`
- Production branch: `main`
- Framework preset: `Astro`
- Build command: `cd apps/site && npm ci && npm run build`
- Build output directory: `apps/site/dist`
- Project name: `baobab-site`
- Account: OHCS (`f4f236a6...`)
- Environment variables: none for v1

After the first build succeeds, Cloudflare assigns a `baobab-site.pages.dev` preview URL. Click "Custom domains" → "Set up a custom domain" → enter `baobab.askozzy.work`. Cloudflare automatically creates the CNAME record because the zone is on the same account.

- [ ] **Step 2: Replace the Cloudflare Web Analytics token in `Base.astro`**

Get the token from Cloudflare dashboard → Pages → baobab-site → Settings → Analytics → "Enable Web Analytics". Copy the issued JWT-style token.

Edit `apps/site/src/layouts/Base.astro`:

Find:
```html
<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token": "REPLACE_WITH_TOKEN_FROM_CF_DASHBOARD"}'></script>
```
Replace `REPLACE_WITH_TOKEN_FROM_CF_DASHBOARD` with the actual token.

- [ ] **Step 3: Optional — add a GitHub Action for Lighthouse CI on PR previews**

Create `.github/workflows/site-deploy.yml`:

```yaml
name: Site preview + Lighthouse

on:
  pull_request:
    paths:
      - 'apps/site/**'
      - '.github/workflows/site-deploy.yml'

permissions:
  contents: read
  pull-requests: write

jobs:
  lighthouse:
    name: Lighthouse on Pages preview
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      # Cloudflare Pages auto-builds a preview deployment on every PR. Wait
      # for it, then run Lighthouse against the preview URL.
      - name: Wait for Cloudflare Pages preview
        id: pages
        uses: WalshyDev/cf-pages-await@v1
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: f4f236a6cd8fbddf397c6e9de17d8113
          project: baobab-site

      - name: Lighthouse CI
        uses: treosh/lighthouse-ci-action@v11
        with:
          urls: ${{ steps.pages.outputs.url }}
          uploadArtifacts: true
          temporaryPublicStorage: true
          runs: 1
```

This requires the `CLOUDFLARE_API_TOKEN` secret to exist (used for wrangler in other workflows; check `gh secret list` to confirm; add it if missing).

- [ ] **Step 4: Commit + push; verify Pages auto-deploys**

```bash
git add apps/site/src/layouts/Base.astro .github/workflows/site-deploy.yml
git commit -m "feat(site): deploy via Cloudflare Pages + Lighthouse CI on PR previews

Pages project 'baobab-site' on the OHCS account, auto-triggered
by push to main via the GH integration. Custom domain
baobab.askozzy.work mapped via the Pages dashboard (CNAME auto-
created because askozzy.work zone is on the same account).

Lighthouse runs against the PR preview URL once Pages finishes
building it. Budgets: Performance ≥95, Accessibility =100, Best
Practices ≥95, SEO =100.

Cloudflare Web Analytics token wired into Base.astro.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"

git push origin main
```

Verify in dashboard: `baobab-site` builds, deploys, custom domain serves with SSL.

---

## Task 14: Manual smoke + screenshot capture + acceptance criteria verification

**Files:** (no code changes — verification + asset captures)

This task is largely manual.

- [ ] **Step 1: Capture screenshots**

Run the desktop app (`cd apps/desktop && npm run tauri dev`). At 1280×800 window size:

1. Reader Mode rendering an article — save as `apps/site/src/assets/screenshots/reader.png`
2. The Grove profile picker — `grove.png`
3. Search results page — `search.png`
4. TranslatePad open — `translate.png`
5. Settings → Ad-block — `adblock.png`
6. Settings → Data — `data.png`
7. Settings → Sovereignty Dashboard — `sovereignty.png`

Use a screenshot tool that captures at 2× DPI for crispness on retina displays.

- [ ] **Step 2: Wire screenshots into the components**

Edit `apps/site/src/components/Features.astro` — for each `<FeatureBlock>` add a `screenshotSrc` prop:

```astro
<FeatureBlock
  id="reader"
  ...
  screenshotSrc="/src/assets/screenshots/reader.png"
  screenshotAlt="..."
/>
```

(Astro resolves `/src/...` paths at build time and inlines/optimises the images.)

Same edit for the SovereigntyDeepDive screenshot.

- [ ] **Step 3: Compose the real OG image**

Open a 1200×630 canvas in Figma/Photoshop/Affinity. Compose:
- Background: Sahel-dark radial gradient (`#2a1f15` → `#15110d`)
- Center-left: hero headline "A browser that doesn't waste your data." in Recoleta serif, warm cream
- Right: smaller animated baobab tree (static snapshot, no animation in OG)
- Subtle decoration motifs (sun, leaf) scattered ambient

Export PNG → save as `apps/site/public/og-image.png` (overwrite the placeholder).

- [ ] **Step 4: Walk the acceptance criteria from the spec**

Open `docs/superpowers/specs/2026-05-17-landing-page-design.md` section "## Acceptance criteria". For each numbered criterion (1–13), verify against the deployed `https://baobab.askozzy.work/` URL or the locally-built `dist/`:

```
[ ] 1. Page live with valid SSL
[ ] 2. Hero renders headline + CTA + animated tree
[ ] 3. Manifesto 3–4 paragraphs render
[ ] 4. 6 feature blocks with screenshot + title + body
[ ] 5. Sovereignty deep-dive with dashboard screenshot
[ ] 6. AI demo widget — type → submit → answer within 5s; 429 shows install CTA
[ ] 7. 4 persona bands color-coded by accent border-left
[ ] 8. Download CTA repeat links to latest GH release Windows asset
[ ] 9. Footer with 4 columns + copyright
[ ] 10. Cloudflare Web Analytics firing (check Pages dashboard within 24 h)
[ ] 11. Lighthouse Performance ≥95 on Slow 3G; LCP ≤1.5s
[ ] 12. Lighthouse Accessibility =100; keyboard traversable
[ ] 13. SEO tags + JSON-LD validate (use https://search.google.com/test/rich-results)
```

- [ ] **Step 5: Commit screenshots + OG image**

```bash
git add apps/site/src/assets/screenshots/*.png apps/site/public/og-image.png apps/site/src/components/Features.astro apps/site/src/components/SovereigntyDeepDive.astro
git commit -m "feat(site): real screenshots + composed OG image

Seven captures from the desktop app (Reader, Grove, Search,
Translate, Ad-block, Data, Sovereignty) wired into the feature
blocks + sovereignty deep-dive. og-image.png is a 1200x630
composition with hero headline + tree + ambient motifs.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"

git push origin main
```

Cloudflare Pages auto-rebuilds; new screenshots ship to production.

---

## Self-review notes (already applied)

- **Spec coverage:** Every section of the spec maps to a task above. Section outline (T3–T11), data flow (T1, T5, T9), perf budget (T1 Astro config + verified in T14), a11y (T2 global.css + T9 aria-live + T14 Lighthouse), SEO+OG (T12), analytics (T12+T13), browser support (Astro defaults handle), deploy (T13), error handling (T9 covers AI demo failure modes; T5 covers latest-release fetch fallback).
- **Placeholder scan:** every step has concrete content. Two genuine TODO touchpoints are documented as such:
  - T4 Step 3 — fill in actual SVG markup from `PickerDecorations.tsx` (cannot embed the full source verbatim without reading the file; the task instructs the implementer to copy it).
  - T13 Step 2 — replace `REPLACE_WITH_TOKEN_FROM_CF_DASHBOARD` once Pages issues the token (genuinely a runtime artifact, not pre-knowable).
- **Type / name consistency:** `getLatestRelease`, `ReleaseInfo`, `SearchResponse`, `AiDemo`, `PersonaBand`, `FeatureBlock`, `Hero`, `Manifesto` all consistently used. The `accentVar` prop on `PersonaBand` matches the CSS custom-property names defined in `tokens.css` (T2).
- **No spec requirement is missing a task.** The 13 acceptance criteria all map to T14's manual walk-through.
