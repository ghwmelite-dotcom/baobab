// Shared types consumed by desktop, mobile, and (typed-only) the worker.

export interface Tab {
  id: string
  url: string
  title: string
  faviconUrl?: string
  pinned: boolean
  active: boolean
  loading: boolean
  /** Unix ms — last time a navigation completed */
  lastVisitedAt: number
  /**
   * Private browsing tab — uses an ephemeral webview data_directory,
   * is excluded from the tab-snapshot persistence, and is skipped by
   * history recording.
   */
  incognito?: boolean
}

export interface HistoryEntry {
  id: string
  url: string
  title: string
  visitedAt: number
}

export interface Bookmark {
  id: string
  url: string
  title: string
  folderId: string | null
  createdAt: number
}

export interface BookmarkFolder {
  id: string
  name: string
  parentId: string | null
}

export interface Residency {
  /** CF colo three-letter code, e.g. 'LOS' */
  colo: string
  /** 'africa' or 'edge-fallback' */
  region: 'africa' | 'edge-fallback' | 'unknown'
  /** Raw X-Data-Residency header value (e.g. 'd1=weur,r2=eu') */
  dataResidency: string
}

export type LowBandwidthMode = 'auto' | 'on' | 'off'

export interface AppSettings {
  theme: 'dark' | 'light' | 'system'
  defaultModel: string
  lowBandwidth: LowBandwidthMode
  showGlobalSearchResults: boolean
  privateMode: boolean
}
