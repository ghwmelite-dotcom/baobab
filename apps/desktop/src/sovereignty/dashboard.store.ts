import { create } from 'zustand'

interface DashboardState {
  open: boolean
  openIt: () => void
  close: () => void
}

// Shared open/close flag for the Sovereign Data Dashboard overlay. Lives
// here (not in sovereignty.store, which tracks residency state) so the
// overlay can be opened from Settings, a keyboard shortcut, or a future
// onboarding tour without those callers needing to pass refs around.
export const useSovereigntyDashboardStore = create<DashboardState>()((set) => ({
  open: false,
  openIt: () => set({ open: true }),
  close: () => set({ open: false }),
}))
