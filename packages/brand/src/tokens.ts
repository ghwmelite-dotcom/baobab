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
  textOnAccent: string
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
  textOnAccent: '#15110d',
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
  textOnAccent: '#faf6ee',
  accent: '#c2410c',
  accentLight: '#d97706',
  accentDim: 'rgba(194, 65, 12, 0.1)',
  sovereigntyOk: '#4d7c0f',
  sovereigntyWarn: '#c2410c',
  critical: '#991b1b',
  info: '#0e7490',
}

// "Grove sunset" surface — used by the profile picker and search results.
// A warm sky-over-savanna gradient with paired ink/pill tokens for the
// floating UI that sits on top of it. Exposed via
// [data-baobab-surface='grove'] in @baobab/ui's tokens.css.
export interface GroveTokens {
  // Sunset sky gradient stops (picker uses all five; search uses dawn + mist + haze).
  skyDawn: string
  skyMist: string
  skyHaze: string
  skyEmber: string
  skyFlame: string
  skyDusk: string
  skyNight: string
  // Warm ink — primary text + accents on the light end of the gradient.
  textPrimary: string
  textSecondary: string
  // Pale text on the dark end of the gradient (paired with pillTextShadow).
  textOnDusk: string
  // Floating pill controls (guest button, etc.).
  pillBg: string
  pillBgHover: string
  pillBorder: string
  pillShadow: string
  pillShadowHover: string
  pillTextShadow: string
  // Elevated translucent toast surface (error, status, etc.). Slightly more opaque than pillBg.
  toastBg: string
  errorShadow: string
  // Guest avatar.
  avatarHighlight: string
  avatarShadow: string
  avatarRing: string
  avatarText: string
}

export const groveTokens: GroveTokens = {
  skyDawn: '#fde7c4',
  skyMist: '#f4d8a8',
  skyHaze: '#fffaf2',
  skyEmber: '#f4b878',
  skyFlame: '#d97a3a',
  skyDusk: '#8a3815',
  skyNight: '#4a1e0a',
  textPrimary: '#3c1810',
  textSecondary: 'rgba(60, 24, 16, 0.7)',
  textOnDusk: 'rgba(255, 250, 240, 0.95)',
  pillBg: 'rgba(255, 250, 240, 0.92)',
  pillBgHover: '#ffffff',
  pillBorder: 'rgba(60, 30, 15, 0.15)',
  pillShadow: 'rgba(60, 20, 10, 0.22)',
  pillShadowHover: 'rgba(60, 20, 10, 0.30)',
  pillTextShadow: 'rgba(60, 20, 10, 0.4)',
  toastBg: 'rgba(255, 250, 240, 0.96)',
  errorShadow: 'rgba(0, 0, 0, 0.15)',
  avatarHighlight: '#c0b5a0',
  avatarShadow: '#6a5a48',
  avatarRing: 'rgba(255, 255, 255, 0.6)',
  avatarText: '#ffffff',
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
