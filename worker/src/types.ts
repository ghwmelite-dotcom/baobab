import type { D1Database, KVNamespace, R2Bucket, DurableObjectNamespace, Ai } from '@cloudflare/workers-types'

export interface Env {
  AI: Ai
  DB: D1Database
  SESSIONS: KVNamespace
  PAGE_CACHE: KVNamespace
  RATE_LIMITS: KVNamespace
  OFFLINE_INDEX: KVNamespace
  OTP: KVNamespace
  ASSETS: R2Bucket
  OFFLINE: R2Bucket
  READER_QUEUE: DurableObjectNamespace

  // vars
  ENVIRONMENT: string
  APP_NAME: string
  APP_VERSION: string
  CORS_ORIGIN: string
  DEFAULT_MODEL: string
  LOWBW_MODEL: string
  SUMMARIZE_MODEL: string
  CODE_MODEL: string
  TRANSLATE_MODEL: string
  EMBEDDING_MODEL: string

  // secrets (set via wrangler secret put)
  AUTH_SECRET: string
  ENCRYPTION_KEY: string
  ADMIN_API_KEY: string
  BRAVE_API_KEY: string
  SENTRY_DSN?: string
  OTP_AFRICASTALKING_KEY?: string
  OTP_AFRICASTALKING_USERNAME?: string
  OTP_TWILIO_SID?: string
  OTP_TWILIO_TOKEN?: string
  OTP_TWILIO_FROM?: string
  OTP_TERMII_KEY?: string
  OTP_TERMII_FROM?: string

  // Paystack (cards / bank / USSD / Mobile Money / QR / bank transfer).
  // PUBLIC_KEY is safe to embed; SECRET_KEY must be set via
  // `wrangler secret put PAYSTACK_SECRET_KEY`. BASE_URL defaults to
  // 'https://api.paystack.co' but is overridable for tests + staging.
  PAYSTACK_PUBLIC_KEY?: string
  PAYSTACK_SECRET_KEY?: string
  PAYSTACK_BASE_URL?: string
}

export type AppContext = {
  Bindings: Env
  Variables: {
    // reqId is set by the requestId middleware (registered first in index.ts).
    // Optional in the type so non-route code paths typecheck, but in any
    // request-scoped handler this is reliably populated.
    reqId?: string
    userId?: string
    userEmail?: string
    // jti is set by authMiddleware; logout reads it to revoke the active session.
    jti?: string
  }
}
