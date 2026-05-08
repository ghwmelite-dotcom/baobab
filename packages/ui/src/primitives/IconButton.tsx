import { type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from 'react'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required for accessibility — no visible text. */
  'aria-label': string
  children: ReactNode
}

const style: CSSProperties = {
  width: '44px',
  height: '44px',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: '10px',
  border: 'none',
  background: 'transparent',
  color: 'var(--text-secondary)',
  cursor: 'pointer',
  transition: 'background-color 150ms ease-out, color 150ms ease-out',
}

export function IconButton({ children, ...rest }: Props) {
  return (
    <button {...rest} style={{ ...style, ...rest.style }}>
      {children}
    </button>
  )
}
