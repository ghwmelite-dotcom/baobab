import { Component, type ErrorInfo, type ReactNode } from 'react'
import * as Sentry from '@sentry/react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
  componentStack: string | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, componentStack: null }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const componentStack = errorInfo.componentStack ?? null
    this.setState({ componentStack })
    console.error(error, errorInfo)
    Sentry.captureException(error, { contexts: { react: { componentStack } } })
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('baobab:react-error', {
          detail: { error, componentStack },
        }),
      )
    }
  }

  private handleReload = (): void => {
    window.location.reload()
  }

  private handleCopy = (): void => {
    const { error, componentStack } = this.state
    if (!error) return
    const payload = [
      `${error.name}: ${error.message}`,
      '',
      error.stack ?? '(no stack)',
      '',
      'Component stack:',
      componentStack ?? '(no component stack)',
    ].join('\n')
    void navigator.clipboard.writeText(payload).catch(() => undefined)
  }

  render(): ReactNode {
    const { error, componentStack } = this.state
    if (!error) return this.props.children

    const isDev = import.meta.env.DEV

    return (
      <div
        role="alert"
        style={{
          position: 'fixed',
          inset: 0,
          background: 'var(--canvas)',
          color: 'var(--text-primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          zIndex: 9999,
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 520,
            background: 'var(--surface-1)',
            border: '1px solid var(--border)',
            borderRadius: 18,
            padding: '32px 32px 28px',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            boxShadow: '0 24px 64px -16px rgba(0, 0, 0, 0.5)',
          }}
        >
          <h1
            style={{
              fontFamily: 'var(--font-default)',
              fontSize: 32,
              fontWeight: 600,
              margin: 0,
              letterSpacing: '-0.01em',
            }}
          >
            Something snapped.
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: 14,
              color: 'var(--text-secondary)',
              lineHeight: 1.5,
            }}
          >
            Baobab hit an unexpected error. You can try again, and we won't lose your tabs.
          </p>

          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button
              type="button"
              onClick={this.handleReload}
              style={{
                background: 'var(--accent)',
                color: 'var(--text-on-accent)',
                border: 'none',
                borderRadius: 10,
                padding: '10px 18px',
                fontSize: 13.5,
                fontWeight: 600,
                cursor: 'pointer',
                minHeight: 36,
              }}
            >
              Reload Baobab
            </button>
            <button
              type="button"
              onClick={this.handleCopy}
              style={{
                background: 'transparent',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                padding: '10px 18px',
                fontSize: 13.5,
                cursor: 'pointer',
                minHeight: 36,
              }}
            >
              Copy error details
            </button>
          </div>

          <details
            open={isDev}
            style={{
              marginTop: 8,
              fontSize: 12,
              color: 'var(--text-muted)',
              borderTop: '1px solid var(--border)',
              paddingTop: 12,
            }}
          >
            <summary
              style={{
                cursor: 'pointer',
                fontSize: 12,
                color: 'var(--text-muted)',
                userSelect: 'none',
              }}
            >
              Error details
            </summary>
            <pre
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11.5,
                color: 'var(--text-muted)',
                margin: '10px 0 0',
                padding: 0,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                lineHeight: 1.45,
              }}
            >
              {error.name}: {error.message}
              {componentStack ? `\n${componentStack}` : ''}
            </pre>
          </details>
        </div>
      </div>
    )
  }
}
