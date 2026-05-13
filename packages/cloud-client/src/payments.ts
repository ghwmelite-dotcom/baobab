import type { BaobabClient } from './client'

// Mobile Money pay-button (Flutterwave demo).
//
// The worker creates a Flutterwave checkout intent and returns a hosted
// payment URL we can pop in a new tab. `txRef` is a baobab-prefixed
// merchant reference used to verify completion server-side.
export interface PaymentIntent {
  checkoutUrl: string
  txRef: string
}

export interface PaymentStatus {
  /** Flutterwave's transaction status: 'successful', 'pending', 'failed', or 'unknown'. */
  status: string
  amount?: number
  currency?: string
}

export interface PaymentIntentRequest {
  amount: number
  currency: string
  customer_email: string
  customer_name?: string
}

export class PaymentsClient {
  constructor(private readonly client: BaobabClient) {}

  intent(input: PaymentIntentRequest): Promise<PaymentIntent> {
    return this.client.postJson('/api/payments/intent', input)
  }

  verify(txRef: string): Promise<PaymentStatus> {
    return this.client.getJson(`/api/payments/verify/${encodeURIComponent(txRef)}`)
  }
}
