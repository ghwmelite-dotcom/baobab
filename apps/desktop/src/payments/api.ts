import { PaymentsClient } from '@baobab/cloud-client'
import { client } from '~/auth/api'

// Shared cloud-client wrapper for payments routes. Mirrors the
// `authClient` / `meClient` pattern — built once over the same
// authenticated BaobabClient so tokens and refresh propagate.
export const paymentsClient = new PaymentsClient(client)
