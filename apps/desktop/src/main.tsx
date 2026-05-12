import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/react'
import './i18n'
import { App } from './App'
import { ErrorBoundary } from './error/ErrorBoundary'

const dsn = import.meta.env.VITE_SENTRY_DSN
if (typeof dsn === 'string' && dsn.length > 0) {
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0,
    replaysSessionSampleRate: 0,
  })
}

const root = document.getElementById('root')
if (!root) throw new Error('#root not found in index.html')

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
