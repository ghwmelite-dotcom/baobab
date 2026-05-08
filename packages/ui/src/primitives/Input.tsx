import { forwardRef, type CSSProperties, type InputHTMLAttributes } from 'react'

const style: CSSProperties = {
  height: '44px',
  paddingInline: '12px',
  borderRadius: '10px',
  border: '1px solid var(--border)',
  background: 'var(--surface-1)',
  color: 'var(--text-primary)',
  fontFamily: 'var(--font-ui, "General Sans", system-ui, sans-serif)',
  fontSize: '14px',
  outline: 'none',
}

type Props = InputHTMLAttributes<HTMLInputElement>

export const Input = forwardRef<HTMLInputElement, Props>((props, ref) => (
  <input
    ref={ref}
    {...props}
    className={['baobab-input', props.className].filter(Boolean).join(' ')}
    style={{ ...style, ...props.style }}
  />
))
Input.displayName = 'Input'
