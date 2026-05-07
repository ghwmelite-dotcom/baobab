// "Modern Sahel" palette — design spec §6.1.
// Sunset over the savanna; deliberately avoids Pan-African flag colors.
// All text/background pairs verified WCAG AA.

export interface ThemeTokens {
  canvas: string
  surface1: string
  surface2: string
  surface3: string
  border: string
  borderAccent: string
  textPrimary: string
  textSecondary: string
  textMuted: string
  accent: string
  accentLight: string
  accentDim: string
  sovereigntyOk: string
  sovereigntyWarn: string
  critical: string
  info: string
}

export const darkTokens: ThemeTokens = {
  canvas: '#15110d',
  surface1: '#1c1814',
  surface2: '#251f19',
  surface3: '#2e271f',
  border: '#3a3127',
  borderAccent: '#4a3e2f',
  textPrimary: '#f0e9dc',
  textSecondary: '#b8ad9a',
  textMuted: '#7a7060',
  accent: '#d97706',
  accentLight: '#f59e0b',
  accentDim: 'rgba(217, 119, 6, 0.12)',
  sovereigntyOk: '#65a30d',
  sovereigntyWarn: '#d97706',
  critical: '#b91c1c',
  info: '#0891b2',
}

export const lightTokens: ThemeTokens = {
  canvas: '#faf6ee',
  surface1: '#f4ecdc',
  surface2: '#ebe1cd',
  surface3: '#e0d4bc',
  border: '#cdbfa3',
  borderAccent: '#b09b78',
  textPrimary: '#1c1814',
  textSecondary: '#3f3527',
  textMuted: '#6b5d49',
  accent: '#c2410c',
  accentLight: '#d97706',
  accentDim: 'rgba(194, 65, 12, 0.1)',
  sovereigntyOk: '#4d7c0f',
  sovereigntyWarn: '#c2410c',
  critical: '#991b1b',
  info: '#0e7490',
}

export const typography = {
  display: 'Recoleta',
  displayFallback: 'General Sans',
  ui: 'General Sans',
  reading: 'Source Serif 4',
  mono: 'JetBrains Mono',
} as const

export const motion = {
  sidebarSlideMs: 240,
  tabOpenMs: 180,
  readerRevealMs: 320,
  ease: 'cubic-bezier(0.16, 1, 0.3, 1)', // ease-out
} as const

export const spacing = {
  base: 8, // base-8 grid
  hitTargetMin: 44,
} as const
