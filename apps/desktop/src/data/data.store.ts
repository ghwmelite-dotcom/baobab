import { create } from 'zustand'
import { profileScoped } from '~/state/persistence'

type Scoped = ReturnType<typeof profileScoped>

export interface DayBucket {
  dateKey: string        // YYYY-MM-DD in local time
  bytesUsed: number
  bytesSaved: number
}

interface DataState {
  history: DayBucket[]
  budgetMb: number
  setProfileId: (id: string) => void
  hydrate: () => Promise<void>
  recordUsage: (used: number, saved: number) => void
  setBudget: (mb: number) => void
  today: () => DayBucket
  percentUsedToday: () => number
}

const STORAGE_KEY = 'data.dailyBuckets'
const BUDGET_KEY = 'data.budgetMb'
const HISTORY_MAX = 30

let scope: Scoped | null = null

function todayKey(): string {
  // en-CA gives YYYY-MM-DD, which sorts correctly and is unambiguous.
  return new Date().toLocaleDateString('en-CA')
}

function getOrCreateToday(history: DayBucket[]): { bucket: DayBucket; nextHistory: DayBucket[] } {
  const key = todayKey()
  const existing = history.find((b) => b.dateKey === key)
  if (existing) return { bucket: existing, nextHistory: history }
  const bucket: DayBucket = { dateKey: key, bytesUsed: 0, bytesSaved: 0 }
  // Append, sort by date asc, trim oldest.
  const merged = [...history, bucket].sort((a, b) => a.dateKey.localeCompare(b.dateKey))
  const trimmed = merged.length > HISTORY_MAX ? merged.slice(merged.length - HISTORY_MAX) : merged
  return { bucket, nextHistory: trimmed }
}

export const useDataStore = create<DataState>()((set, get) => ({
  history: [],
  budgetMb: 500,

  setProfileId: (id) => {
    scope = profileScoped(id)
  },

  hydrate: async () => {
    if (!scope) return
    const [hist, budget] = await Promise.all([
      scope.get<DayBucket[]>(STORAGE_KEY),
      scope.get<number>(BUDGET_KEY),
    ])
    set({
      history: Array.isArray(hist) ? hist : [],
      budgetMb: typeof budget === 'number' && budget > 0 ? budget : 500,
    })
  },

  recordUsage: (used, saved) => {
    set((s) => {
      const { bucket, nextHistory } = getOrCreateToday(s.history)
      const updatedBucket: DayBucket = {
        ...bucket,
        bytesUsed: bucket.bytesUsed + used,
        bytesSaved: bucket.bytesSaved + saved,
      }
      const history = nextHistory.map((b) => (b.dateKey === updatedBucket.dateKey ? updatedBucket : b))
      // Persist asynchronously (debounce omitted for simplicity; writes per tick are rare).
      if (scope) void scope.set(STORAGE_KEY, history)
      return { history }
    })
  },

  setBudget: (mb) => {
    const clamped = Math.max(1, Math.min(10_000, Math.round(mb)))
    set({ budgetMb: clamped })
    if (scope) void scope.set(BUDGET_KEY, clamped)
  },

  today: () => {
    const { bucket } = getOrCreateToday(get().history)
    return bucket
  },

  percentUsedToday: () => {
    const t = get().today()
    const budgetBytes = get().budgetMb * 1024 * 1024
    if (budgetBytes <= 0) return 0
    return (t.bytesUsed / budgetBytes) * 100
  },
}))
