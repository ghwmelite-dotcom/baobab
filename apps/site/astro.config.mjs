// @ts-check
import { defineConfig } from 'astro/config'
import cloudflare from '@astrojs/cloudflare'
import react from '@astrojs/react'

// Static site with Cloudflare adapter. Using output: 'hybrid' allows the
// adapter to pre-render all static pages while maintaining the runtime for
// potential future dynamic routes. All pages are static; the AiDemo island
// makes its fetch from the browser to the public worker.
export default defineConfig({
  site: 'https://baobab.askozzy.work',
  output: 'hybrid',
  adapter: cloudflare(),
  integrations: [react()],
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
