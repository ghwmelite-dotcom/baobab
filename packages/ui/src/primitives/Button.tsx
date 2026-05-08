import { type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  loading?: boolean
  children: ReactNode
}

const baseStyle: CSSProperties = {
  minHeight: '44px',
  minWidth: '44px',
  paddingInline: '16px',
  borderRadius: '12px',
  border: '1px solid var(--border)',
  fontFamily: 'var(--font-ui, "General Sans", system-ui, sans-serif)',
  fontWeight: 500,
  cursor: 'pointer',
  transition: 'background-color 150ms ease-out, transform 150ms ease-out',
}

const variantStyles: Record<Variant, CSSProperties> = {
  primary: { background: 'var(--accent)', color: '#15110d', borderColor: 'var(--accent)' },
  secondary: { background: 'var(--surface-2)', color: 'var(--text-primary)' },
  ghost: { background: 'transparent', color: 'var(--text-primary)', borderColor: 'transparent' },
}

export function Button({
  variant = 'primary',
  loading = false,
  disabled,
  children,
  style,
  ...rest
}: Props) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      style={{ ...baseStyle, ...variantStyles[variant], ...style }}
    >
      {children}
    </button>
  )
}
