import { create } from 'zustand'
import type { Inventory } from '@baobab/cloud-client'
import { MeClient } from '@baobab/cloud-client'
import { client } from '~/auth/api'
import { useAuthStore } from '~/auth/auth.store'

const meClient = new MeClient(client)

interface InventoryState {
  inventory: Inventory | null
  loading: boolean
  loaded: boolean
  error: string | null
  fetchInventory: () => Promise<void>
  exportAll: () => Promise<void>
}

// Format YYYY-MM-DD in local time. Used in the export filename so a user
// in Lagos who hits "export" at 23:50 doesn't get a "tomorrow" filename.
function today(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Anchor-click download trick — works in Tauri's webview without needing
// the Tauri download manager, since /api/me/export already returns a
// Content-Disposition header. We construct an object URL from the Blob so
// the browser doesn't re-request the URL (which would re-trigger auth).
function offerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // Defer revoking the URL by a tick so the click has time to register.
  setTimeout(() => URL.revokeObjectURL(url), 1_000)
}

export const useInventoryStore = create<InventoryState>()((set) => ({
  inventory: null,
  loading: false,
  loaded: false,
  error: null,

  fetchInventory: async () => {
    if (!useAuthStore.getState().user) {
      // Unauthenticated — leave inventory null. The dashboard renders
      // a "sign in to see your sovereignty" prompt in that case.
      set({ loaded: true, error: null })
      return
    }
    set({ loading: true, error: null })
    try {
      const inv = await meClient.inventory()
      set({ inventory: inv, loading: false, loaded: true })
    } catch (e) {
      set({ loading: false, loaded: true, error: e instanceof Error ? e.message : 'unknown' })
    }
  },

  exportAll: async () => {
    if (!useAuthStore.getState().user) {
      useAuthStore.getState().openSignIn()
      return
    }
    set({ error: null })
    try {
      const blob = await meClient.exportAll()
      offerDownload(blob, `baobab-export-${today()}.json`)
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'export-failed' })
    }
  },
}))
