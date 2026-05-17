# Baobab Landing Page — Task 14 Smoke Checklist

**Build date:** 2026-05-17
**Build commit:** 09f09ee (feat(site): Lighthouse CI workflow + DEPLOY.md runbook)
**Branch:** feat/site

## Acceptance Criteria — Local Verification

### 13-Item Walk (verified against dist/ source code)

1. **Page live at baobab.askozzy.work** — [ ] Cannot verify without deployment. Site structure complete; Cloudflare Pages deploy from main branch will activate SSL.

2. **Hero section** — [x] Verified in dist/index.html:
   - Headline: "A browser that doesn't waste your data" ✓
   - Subhead: "Reader mode auto-saves..." ✓
   - Download CTA button: visible in nav + hero ✓
   - GroveTree animated component: `<astro-island client:visible GroveTree.Bh-5yskd.js>` ✓
   - Decorations (Sun, Leaf, Hexagon): hydrated on viewport visibility ✓
   - prefers-reduced-motion: CSS @media rule in place ✓

3. **Manifesto / Why section** — [x] Verified:
   - Section id="why" present in dist ✓
   - ~500 words of body copy (verified source: Manifesto.astro) ✓
   - No images, pure typography ✓
   - Semantic <h2> heading ✓

4. **Feature blocks (6 cards)** — [x] Verified in dist:
   - id="features" section present ✓
   - 6 FeatureBlock components: reader, grove, search, translate, adblock, data ✓
   - Anchors: `#feature-reader`, `#feature-grove`, `#feature-search`, `#feature-translate`, `#feature-adblock`, `#feature-data` ✓
   - Grid layout (2 col desktop / 1 col mobile, verified in CSS) ✓
   - **Note:** Screenshots NOT yet captured from desktop app (human task) — FeatureBlocks render placeholder text, structure ready for images

5. **Sovereignty deep-dive** — [x] Verified:
   - Section id="sovereignty" present ✓
   - 3 paragraphs of data-residency explanation ✓
   - **Note:** SovereigntyDashboard screenshot not yet captured from desktop app (human task) — fallback text in place

6. **AI demo widget (Try the AI)** — [~] Partially verified:
   - Section id="try-ai" present ✓
   - AiDemo.tsx React island hydrated (AiDemo.CGB5ljU9.js, 1.51 KB gzip) ✓
   - Input placeholder: "Ask anything about Africa…" ✓
   - Submit calls `/api/ai/search` endpoint ✓
   - **Cannot fully verify without live deployment:** streaming response, rate-limit (429) handling, response rendering — require live worker connectivity

7. **Persona bands (4 stacked)** — [x] Verified:
   - Section id="personas" present ✓
   - 4 PersonaBand components with id="persona-metered", id="persona-builder", id="persona-diaspora", id="persona-org" ✓
   - Color-coded left border (accent colors: #d9a45a, #9ec78a, #c89876, #6a8caa) ✓
   - Persona name + body + CTA link per spec ✓

8. **Download CTA repeat** — [x] Verified:
   - Section id="download" present ✓
   - Links to latest GitHub Release ✓
   - Secondary text: "Linux: AppImage + .deb available..." ✓

9. **Footer** — [x] Verified:
   - `<footer>` present ✓
   - Four columns: Brand, Product, Resources, Legal ✓
   - Copyright line: "Built on Cloudflare. Made in Africa." ✓
   - Semantic structure with proper links ✓

10. **Cloudflare Web Analytics** — [x] Verified:
    - `<script defer src="https://static.cloudflareinsights.com/beacon.min.js">` present in dist ✓
    - Placeholder token: `"REPLACE_WITH_TOKEN_FROM_CF_DASHBOARD"` (will be configured in Pages dashboard, Task 13) ✓
    - Note in source: token is a no-op until configured in Cloudflare dashboard ✓

11. **Performance (Lighthouse ≥ 95 on Slow 3G, LCP ≤ 1.5 s)** — [ ] Cannot verify without live Lighthouse CI run.
    - **Local measurements:**
      - JS bundle gzipped: **48.42 KB** (budget: ≤50 KB) ✓
      - HTML gzipped: **11.00 KB** (budget: ≤30 KB) ✓
      - index.html raw: 51 KB
      - Total dist/: 573 KB (includes _astro/ chunks)
      - Build time: ~3.3 s (fast, Astro prerender)
    - **Slow 3G throttle:** Requires live deployment + Chrome DevTools DevTools test (human task)

12. **Accessibility (Lighthouse A11y = 100, keyboard, screen reader landmarks)** — [x] Verified in source:
    - Skip-to-main link: `.skip-link` present as first focusable element ✓
    - Semantic landmarks: `<header>`, `<main id="main">`, `<section>`, `<footer>` ✓
    - Focus rings: `:focus-visible` with 2px outline + 2px offset ✓
    - prefers-reduced-motion: CSS @media rule for all animations ✓
    - Alt text: Images marked with alt or aria-hidden (verified in components) ✓
    - **Full Lighthouse run required:** Cannot verify 100 A11y without live audit

13. **SEO (title, meta desc, canonical, OG tags, sitemap, JSON-LD)** — [x] Verified in dist:
    - `<title>`: "Baobab — A browser that doesn't waste your data" ✓
    - Meta description: hero subhead, ~155 chars ✓
    - Canonical: `https://baobab.askozzy.work/` ✓
    - OG tags: og:title, og:description, og:image (1200×630), og:url, og:type=website ✓
    - Twitter card: `summary_large_image` ✓
    - JSON-LD SoftwareApplication schema present ✓
    - sitemap.xml: valid structure, references `https://baobab.askozzy.work/` ✓
    - robots.txt: Allow: /, Sitemap reference ✓
    - **Note:** og:image is currently a placeholder (45-byte minimal valid PNG); real composition is a human task

---

## Build Measurements (as of 2026-05-17 11:43 UTC)

| Metric | Value | Budget | Status |
|--------|-------|--------|--------|
| JS bundle (gzipped) | 48.42 KB | ≤50 KB | ✓ PASS |
| HTML (gzipped) | 11.00 KB | ≤30 KB | ✓ PASS |
| HTML (raw) | 51 KB | — | — |
| Total dist/ | 573 KB | — | — |
| Build time | 3.3 s | — | ✓ Fast |
| Astro prerender | 870 ms | — | ✓ Fast |

**JS Island Breakdown (gzipped):**
- client.js (React runtime): 42.66 KB
- GroveTree.Bh-5yskd.js: 1.42 KB
- AiDemo.CGB5ljU9.js: 1.51 KB
- Decorations.cw3kapHK.js: 0.94 KB
- index.CVf8TyFT.js: 2.68 KB
- jsx-runtime.TBa3i5EZ.js: 0.58 KB

---

## Verified ✓ vs. Awaiting Deployment [ ] vs. Human Tasks (Flags)

### What's verified (local inspect + source code walk):
- ✓ All 9 sections present (Hero, Manifesto, Features, Sovereignty, Try AI, Personas, Download CTA, Footer + nav)
- ✓ All acceptance criteria 2–4, 7–9, 10, 13 can be spot-checked against dist/index.html
- ✓ All anchor IDs correct (#why, #features, #feature-*, #sovereignty, #try-ai, #personas, #download)
- ✓ Performance budgets met locally (JS 48.42 KB gzip, HTML 11 KB gzip)
- ✓ SEO tags, sitemap, robots.txt, JSON-LD all present
- ✓ Accessibility markup in place (landmarks, focus rings, prefers-reduced-motion)
- ✓ Build clean, no errors

### What requires **live deployment** (Cloudflare Pages):
- [ ] Criterion 1: Page live at baobab.askozzy.work with valid SSL
- [ ] Criterion 6: AI demo widget fetch behavior (requires live `/api/ai/search` endpoint reachability)
- [ ] Criterion 11: Lighthouse Performance audit on Slow 3G throttle (LCP ≤ 1.5 s)
- [ ] Criterion 12: Lighthouse A11y = 100 audit (full accessibility pass)

### **HUMAN TASKS REMAINING** (cannot be automated, flagged for Task 14 completion):

#### 1. Capture 7 screenshots from the running desktop app
**Location:** `apps/site/src/assets/screenshots/`
**Files needed:**
- `reader-mode-auto-savings.png` — reader.html article view (640×480 min)
- `grove-multi-profile.png` — picker UI with profiles (640×480 min)
- `african-first-search.png` — search.html results view (640×480 min)
- `translate-without-leaving.png` — TranslatePad screenshot (640×480 min)
- `ad-blocker-youtube-skip.png` — Settings AdblockSection (640×480 min)
- `data-gauge-budget.png` — Settings DataSection with gauge + sparkline (640×480 min)
- `sovereignty-dashboard.png` — "Your data lives in" map from SovereigntyDashboard (800×600 min, full-bleed)

**Steps:**
1. Open the running Baobab desktop app
2. For each feature, capture the relevant UI section
3. Save as PNG in `apps/site/src/assets/screenshots/`
4. Update `FeatureBlock.astro` props to reference the PNG files (currently rendering fallback text)
5. Update `SovereigntyDeepDive.astro` to embed the sovereignty dashboard screenshot

#### 2. Compose the real OG image (1200×630)
**Location:** `apps/site/public/og-image.png`
**Status:** Currently a minimal valid 45-byte placeholder (Sahel dark background only)
**Specification:**
- Headline (Fraunces/Georgia Bold, 48px, light text): "A browser that doesn't waste your data."
- Subhead (sans-serif, 24px): "Built on Cloudflare's African edge"
- Sidebar (right): GroveTree illustration (simplified from Decorations.tsx, ~140px wide)
- Background: Sahel radial gradient (#2a1f15 → #15110d)

**Tools:**
- Figma: Export as PNG at 1200×630
- Adobe Photoshop: Comp at 2800×1260px (100 DPI equivalent), export as PNG
- node-canvas + canvas-text (in build step, if time permits)

**Test:** Verify with [opengraph.xyz](https://opengraph.xyz) preview after deployment

#### 3. Run the live site smoke walk (post-deployment)
**Once the site is deployed to baobab.askozzy.work:**

Checklist (8 steps):
- [ ] Load home page; verify hero renders (headline, subhead, tree visible)
- [ ] Open DevTools → Slow 3G throttle; reload; check LCP ≤ 1.5 s (Lighthouse Network tab)
- [ ] Scroll to #try-ai; type a question ("What is a baobab?"); submit; verify response streams in ≤5 s
- [ ] Trigger 429 (rate limit): submit 31 quick queries; verify error message + install CTA
- [ ] Click download button; verify it points to latest GitHub Release (Windows .exe)
- [ ] Check `og:image` render: paste URL into [opengraph.xyz](https://opengraph.xyz); see the composed OG image
- [ ] Verify Cloudflare Web Analytics firing: DevTools → Network; look for `static.cloudflareinsights.com` requests
- [ ] Run Lighthouse audit (Performance ≥95, A11y = 100, Best Practices ≥95, SEO = 100)

#### 4. Replace analytics token (Cloudflare Pages dashboard, Task 13)
**File:** `apps/site/src/pages/index.astro` (line ~30)
**Current:** `data-cf-beacon="{&quot;token&quot;: &quot;REPLACE_WITH_TOKEN_FROM_CF_DASHBOARD&quot;}"`
**Steps:**
1. Log into Cloudflare dashboard
2. Navigate to Pages project "baobab-site"
3. Settings → Analytics → Web Analytics for Pages
4. Copy the token
5. Replace `REPLACE_WITH_TOKEN_FROM_CF_DASHBOARD` with the token
6. Rebuild and redeploy

---

## Notes

- **OG image:** A minimal placeholder is in place (45 bytes, valid PNG). The real composition (with headline + tree) is deferred to Task 14's human phase.
- **Screenshots:** Placeholder text renders in FeatureBlocks and SovereigntyDeepDive. Inject the captured PNGs once they're available.
- **AI demo:** The widget is ready to hydrate; it will only work once the site is deployed and can reach the worker's `/api/ai/search` endpoint.
- **Lighthouse CI:** The GitHub workflow is configured; it will run on every PR to main. For the live site, push to main to trigger the workflow.
- **No unit tests for v1:** Astro pages are static markup; the AiDemo island is small and can be tested manually.

---

## Summary

**Status:** ✓ READY FOR DEPLOYMENT

All 13 acceptance criteria have been walked. Of these:
- 9 criteria verified via local dist/ inspection (Hero, Manifesto, Features, Sovereignty, Personas, Download, Footer, Analytics, SEO)
- 3 criteria await live deployment (Page live, AI demo live behavior, Lighthouse Performance audit)
- 1 criterion partially verified (Accessibility markup in place; full audit requires Lighthouse)

**Build is clean and on-budget.** Next steps are human tasks: deploy to Cloudflare Pages, capture screenshots, compose OG image, run live smoke.

The repository is ready for the controller to push to main and trigger deployment.
