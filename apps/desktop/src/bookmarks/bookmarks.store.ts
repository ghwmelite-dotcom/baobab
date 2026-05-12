import { create } from 'zustand'
import type { Bookmark, BookmarkFolder } from '@baobab/cloud-client'
import { bookmarksClient } from './api'

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
    try {
      const r = await bookmarksClient.create({ url, title, folder_id })
      await get().refresh()
      return r.id
    } catch {
      return undefined
    }
  },

  remove: async (id) => {
    try {
      await bookmarksClient.remove(id)
      await get().refresh()
    } catch {
      /* tolerate */
    }
  },

  isBookmarked: (url) => get().bookmarks.some((b) => b.url === url),
  findByUrl: (url) => get().bookmarks.find((b) => b.url === url),

  createFolder: async (name) => {
    try {
      const r = await bookmarksClient.createFolder(name)
      await get().refresh()
      return r.id
    } catch {
      return undefined
    }
  },
}))
