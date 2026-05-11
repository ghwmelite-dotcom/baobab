import { BaobabClient, probeHealth } from '@baobab/cloud-client'
import { useSovereigntyStore } from './sovereignty.store'

const baseUrl =
  import.meta.env.VITE_BAOBAB_API_URL ??
  'https://baobab-api.ohcsghana-main.workers.dev'

const client = new BaobabClient({ baseUrl })

export async function refreshResidency(): Promise<void> {
  try {
    const r = await probeHealth(client)
    if (r.ok) {
      useSovereigntyStore.getState().setResidency(r.residency)
    }
  } catch {
    // Network errors are silent — status bar shows "—" until a probe succeeds.
  }
}
