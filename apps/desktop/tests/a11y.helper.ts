// Accessibility test helper — runs jest-axe under Vitest.
//
// Strategy:
//   • Use `jest-axe` for the matcher + axe wrapper. It works fine under
//     Vitest because Vitest's `expect` exposes the same matcher-extension
//     API as Jest.
//   • Re-export a pre-configured `axe(...)` that we use everywhere. The
//     configuration here is the single source of truth for which axe rules
//     run against Baobab.
//   • jest-axe disables `cat.color` rules by default in jsdom (color
//     contrast cannot be measured without a real layout engine), which
//     happens to match the design constraint we'd otherwise have to
//     manually suppress for `var(--text-muted)` decorative copy and the
//     residency-chip dot. We document it here for clarity.
//
// Anything else axe surfaces — missing aria-label on icon-only buttons,
// inputs without labels, dialogs without labels, low-tabindex traps —
// is treated as a real violation to fix.

import { configureAxe, toHaveNoViolations } from 'jest-axe'
import { expect } from 'vitest'
import type { AxeResults } from 'axe-core'

// Extend Vitest's `expect` with the jest-axe matcher. Cast through `unknown`
// because jest-axe ships Jest matcher typings, not Vitest's.
expect.extend(toHaveNoViolations as unknown as Parameters<typeof expect.extend>[0])

// Module augmentation so `expect(...).toHaveNoViolations()` type-checks.
declare module 'vitest' {
  interface Assertion<T> {
    toHaveNoViolations: () => T
  }
  interface AsymmetricMatchersContaining {
    toHaveNoViolations: () => unknown
  }
}

/**
 * Run axe on a DOM node (or HTML string) with Baobab's standard config.
 *
 * Rules currently suppressed:
 *   • `cat.color` — disabled by jest-axe in jsdom (no layout engine, so
 *     contrast cannot be measured). This is the right default for us
 *     because the design uses `var(--text-muted)` and the residency-chip
 *     dot deliberately at low contrast.
 *   • `region` — Baobab renders inside a Tauri webview window, so the
 *     "all content must live inside a landmark" check produces false
 *     positives when individual components are mounted in isolation
 *     (which is exactly what the audit test does).
 */
export const axe = configureAxe({
  rules: {
    region: { enabled: false },
  },
})

export type { AxeResults }
