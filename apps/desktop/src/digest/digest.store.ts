import { create } from 'zustand'
import { gate } from '~/data/wifiGate'

export interface DigestSource {
  id: string
  name: string
  country: string
}

export interface DigestItem {
  id: string
  title: string
  summary: string
  source: DigestSource
  url: string
  publishedAt: string
}

interface DigestState {
  items: DigestItem[]
  loading: boolean
  loaded: boolean
  fetch: () => Promise<void>
}

const baseUrl =
  import.meta.env.VITE_BAOBAB_API_URL ??
  'https://baobab-api.ohcsghana-main.workers.dev'

interface DigestResponse {
  items: DigestItem[]
  error?: string
}

export const useDigestStore = create<DigestState>()((set, get) => ({
  items: [],
  loading: false,
  loaded: false,

  fetch: async () => {
    if (get().loading) return
    set({ loading: true })
    try {
      const r = await gate(() =>
        fetch(`${baseUrl.replace(/\/$/, '')}/api/continent-today`, {
          method: 'GET',
          headers: { Accept: 'application/json' },
        }),
      )
      if (r === null) {
        // Deferred until Wi-Fi. Don't surface an error or wipe existing items;
        // just reset the loading flag so a later trigger can retry.
        set({ loading: false })
        return
      }
      if (!r.ok) {
        // Treat any non-2xx as "no stories today" — UI degrades to empty state
        // rather than surfacing an error banner. The NTP must never feel broken.
        set({ loading: false, loaded: true })
        return
      }
      const body = (await r.json()) as DigestResponse
      set({
        items: Array.isArray(body.items) ? body.items : [],
        loading: false,
        loaded: true,
      })
    } catch {
      // Network failure / offline — leave items empty, mark loaded so we
      // don't churn retries.
      set({ loading: false, loaded: true })
    }
  },
}))
