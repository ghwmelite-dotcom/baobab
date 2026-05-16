import { GroveTree } from '~/picker/GroveTree'

interface Props {
  variant: 'auth_required' | 'unavailable'
  onRetry?: () => void
  onSignIn?: () => void
}

export function ErrorState({ variant, onRetry, onSignIn }: Props) {
  const title =
    variant === 'auth_required'
      ? 'Sign in to use grove search'
      : 'Grove search is unavailable'
  const body =
    variant === 'auth_required'
      ? 'Connect your Baobab account to get AI-powered answers and results.'
      : 'The search service didn’t respond. Try again in a moment.'

  return (
    <section
      role="alert"
      style={{
        margin: '48px auto', maxWidth: 480, textAlign: 'center',
        padding: '0 24px',
      }}
    >
      <div style={{ display: 'inline-block', opacity: 0.7 }}>
        <GroveTree size={64} />
      </div>
      <h2 style={{
        fontFamily: "'Iowan Old Style', 'Palatino Linotype', Georgia, serif",
        fontSize: 20, color: '#3c1810', margin: '12px 0 6px', letterSpacing: '-0.01em',
      }}>
        {title}
      </h2>
      <p style={{ fontSize: 14, color: 'rgba(60,30,15,0.75)', margin: '0 0 16px' }}>
        {body}
      </p>
      {variant === 'auth_required' && onSignIn && (
        <button
          type="button"
          onClick={onSignIn}
          style={{
            padding: '10px 20px',
            border: 'none',
            borderRadius: 8,
            background: '#3c1810',
            color: 'white',
            cursor: 'pointer',
            fontSize: 14, fontWeight: 600,
          }}
        >
          Sign in
        </button>
      )}
      {variant === 'unavailable' && onRetry && (
        <button
          type="button"
          onClick={onRetry}
          style={{
            padding: '10px 20px',
            border: '1px solid rgba(60,30,15,0.25)',
            borderRadius: 8,
            background: 'transparent',
            color: '#3c1810',
            cursor: 'pointer',
            fontSize: 14, fontWeight: 600,
          }}
        >
          Try again
        </button>
      )}
    </section>
  )
}
