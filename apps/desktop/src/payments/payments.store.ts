import { create } from 'zustand'
import { ApiError, type PaymentIntent, type PaymentStatus } from '@baobab/cloud-client'
import { paymentsClient } from './api'

interface PendingIntent {
  txRef: string
  amount: number
  currency: string
  checkoutUrl: string
}

interface PaymentsState {
  widgetOpen: boolean
  pending: PendingIntent | null
  loading: boolean
  /** Last status returned by /verify, populated after pollStatus succeeds. */
  status: PaymentStatus | null
  /**
   * Generic error message for the form (network failure, validation). Cleared
   * each time openWidget is called.
   */
  error: string | null
  /**
   * Set when the worker returns 503 `payments_unconfigured`. The PayWidget
   * surfaces this as a friendly "keys aren't live yet" inline message rather
   * than treating it as a hard error.
   */
  unconfigured: boolean
  openWidget: () => void
  closeWidget: () => void
  createIntent: (input: {
    amount: number
    currency: string
    customer_email: string
    customer_name?: string
  }) => Promise<PaymentIntent | null>
  pollStatus: (txRef: string) => Promise<PaymentStatus | null>
}

function isApiError(e: unknown): e is ApiError {
  return e instanceof Error && e.name === 'ApiError'
}

function isUnconfiguredError(e: unknown): boolean {
  if (!isApiError(e)) return false
  if (e.status !== 503) return false
  const body = e.body as { error?: unknown } | null
  return !!body && body.error === 'payments_unconfigured'
}

export const usePaymentsStore = create<PaymentsState>()((set) => ({
  widgetOpen: false,
  pending: null,
  loading: false,
  status: null,
  error: null,
  unconfigured: false,

  openWidget: () => set({ widgetOpen: true, error: null, unconfigured: false, status: null }),

  closeWidget: () => set({ widgetOpen: false }),

  createIntent: async (input) => {
    set({ loading: true, error: null, unconfigured: false })
    try {
      const intent = await paymentsClient.intent(input)
      set({
        pending: {
          txRef: intent.txRef,
          amount: input.amount,
          currency: input.currency,
          checkoutUrl: intent.checkoutUrl,
        },
        loading: false,
      })
      return intent
    } catch (e) {
      if (isUnconfiguredError(e)) {
        set({ loading: false, unconfigured: true })
        return null
      }
      const message =
        isApiError(e) && typeof (e.body as { error?: unknown } | null)?.error === 'string'
          ? String((e.body as { error: string }).error)
          : e instanceof Error
            ? e.message
            : 'payment failed'
      set({ loading: false, error: message })
      return null
    }
  },

  pollStatus: async (txRef) => {
    try {
      const status = await paymentsClient.verify(txRef)
      set({ status })
      return status
    } catch {
      // Verification is best-effort — silently fail; the user can re-trigger.
      return null
    }
  },
}))
