import { create } from 'zustand'
import type { Bookmark, BookmarkFolder } from '@baobab/cloud-client'
import { bookmarksClient } from './api'
import { useAuthStore } from '~/auth/auth.store'
import { gate } from '~/data/wifiGate'

interface BookmarksState {
  drawerOpen: boolean
  bookmarks: Bookmark[]
  folders: BookmarkFolder[]
  loading: boolean
  toggle: () => void
  refresh: () => Promise<void>
  add: (url: string, title?: string, folder_id?: string) => Promise<string | undefined>
  remove: (id: string) => Promise<void>
  isBookmarked: (url: string) => boolean
  findByUrl: (url: string) => Bookmark | undefined
  createFolder: (name: string) => Promise<string | undefined>
}

export const useBookmarksStore = create<BookmarksState>()((set, get) => ({
  drawerOpen: false,
  bookmarks: [],
  folders: [],
  loading: false,

  toggle: () => set((s) => ({ drawerOpen: !s.drawerOpen })),

  refresh: async () => {
    set({ loading: true })
    try {
      const r = await bookmarksClient.list()
      set({ bookmarks: r.bookmarks, folders: r.folders, loading: false })
    } catch {
      set({ loading: false })
    }
  },

  add: async (url, title, folder_id) => {
    if (!useAuthStore.getState().user) {
      useAuthStore.getState().openSignIn()
      return undefined
    }
    try {
      const r = await gate(() => bookmarksClient.create({ url, title, folder_id }))
      if (r === null) {
        // Deferred until Wi-Fi.
        return undefined
      }
      await get().refresh()
      return r.id
    } catch {
      return undefined
    }
  },

  remove: async (id) => {
    try {
      const r = await gate(() => bookmarksClient.remove(id))
      if (r === null) {
        // Deferred until Wi-Fi.
        return
      }
      await get().refresh()
    } catch {
      /* tolerate */
    }
  },

  isBookmarked: (url) => get().bookmarks.some((b) => b.url === url),
  findByUrl: (url) => get().bookmarks.find((b) => b.url === url),

  createFolder: async (name) => {
    try {
      const r = await gate(() => bookmarksClient.createFolder(name))
      if (r === null) {
        // Deferred until Wi-Fi.
        return undefined
      }
      await get().refresh()
      return r.id
    } catch {
      return undefined
    }
  },
}))
