import { darkTokens, lightTokens, type ThemeTokens } from '@baobab/brand'
import type { CSSProperties, ReactNode } from 'react'

type ThemeName = 'dark' | 'light'

interface Props {
  theme?: ThemeName
  children: ReactNode
}

function tokensToCssVars(tokens: ThemeTokens): CSSProperties {
  const vars: Record<string, string> = {
    '--canvas': tokens.canvas,
    '--surface-1': tokens.surface1,
    '--surface-2': tokens.surface2,
    '--surface-3': tokens.surface3,
    '--border': tokens.border,
    '--border-accent': tokens.borderAccent,
    '--text-primary': tokens.textPrimary,
    '--text-secondary': tokens.textSecondary,
    '--text-muted': tokens.textMuted,
    '--accent': tokens.accent,
    '--accent-light': tokens.accentLight,
    '--accent-dim': tokens.accentDim,
    '--sovereignty-ok': tokens.sovereigntyOk,
    '--sovereignty-warn': tokens.sovereigntyWarn,
    '--critical': tokens.critical,
    '--info': tokens.info,
  }
  return vars as CSSProperties
}

export function ThemeProvider({ theme = 'dark', children }: Props) {
  const tokens = theme === 'dark' ? darkTokens : lightTokens
  return (
    <div data-baobab-theme={theme} style={tokensToCssVars(tokens)}>
      {children}
    </div>
  )
}
