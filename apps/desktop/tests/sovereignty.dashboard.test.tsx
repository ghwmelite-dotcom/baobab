import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// Mock the persistence + cloud-client wiring so we don't reach for real
// network or storage in this render-only test.
vi.mock('~/state/persistence', () => ({
  persistence: {
    get: vi.fn(async () => undefined),
    set: vi.fn(async () => undefined),
    delete: vi.fn(async () => undefined),
  },
}))

vi.mock('~/auth/api', () => ({
  authClient: {},
  client: { setAccessToken: vi.fn() },
}))

const mockExportAll = vi.fn(async () => undefined)
const mockFetchInventory = vi.fn(async () => undefined)

import { useSovereigntyDashboardStore } from '~/sovereignty/dashboard.store'
import { useSovereigntyStore } from '~/state/sovereignty.store'
import { useInventoryStore } from '~/sovereignty/inventory.store'
import { useAuthStore } from '~/auth/auth.store'
import { SovereigntyDashboard } from '~/sovereignty/SovereigntyDashboard'

beforeEach(() => {
  // Auth store: pretend we're signed in so the inventory grid renders
  // (the unauth branch shows a "sign in" CTA instead of cards).
  useAuthStore.setState({
    user: {
      id: 'u1',
      email: 't@x.com',
      phone: null,
      display_name: null,
      avatar_url: null,
      default_model: 'm',
      theme: 'dark',
      ad_blocking: 1,
      privacy_mode: 1,
      low_bandwidth_mode: 0,
      search_engine: 'baobab',
      language: 'en',
      country: null,
      sidebar_position: 'right',
      bandwidth_saved_bytes: 0,
      ai_provider: 'cloudflare',
      ai_provider_url: null,
      is_active: 1,
      created_at: 1_700_000_000,
      updated_at: 1_700_000_000,
    },
    status: 'idle',
    signInOverlayOpen: false,
  } as unknown as Parameters<typeof useAuthStore.setState>[0])

  useSovereigntyStore.setState({
    residency: { colo: 'LOS', region: 'africa', dataResidency: 'd1=weur,r2=eu' },
    lowBwMode: 'auto',
    adsBlocked: 0,
    pageLoadMs: null,
  })

  useInventoryStore.setState({
    inventory: {
      bookmarks: 5,
      history: 12,
      offline_articles: 3,
      offline_bytes: 102400,
      account_created_at: 1_700_000_000,
      last_visit_at: 1_700_500_000,
    },
    loading: false,
    loaded: true,
    error: null,
    fetchInventory: mockFetchInventory,
    exportAll: mockExportAll,
  })

  useSovereigntyDashboardStore.setState({ open: true })
})

describe('SovereigntyDashboard', () => {
  it('renders the colo in the hero', () => {
    render(<SovereigntyDashboard />)
    expect(screen.getByTestId('sovereignty-colo').textContent).toBe('LOS')
  })

  it('renders all four inventory numbers', () => {
    render(<SovereigntyDashboard />)
    const values = screen.getAllByTestId('inventory-card-value').map((n) => n.textContent)
    // bookmarks=5, history=12, offline_articles=3, offline_bytes=102400 → 100.0 KB
    expect(values).toContain('5')
    expect(values).toContain('12')
    expect(values).toContain('3')
    expect(values.some((v) => v?.includes('100') && v?.toLowerCase().includes('kb'))).toBe(true)
  })

  it('renders the export-as-JSON button and calls exportAll on click', () => {
    render(<SovereigntyDashboard />)
    const btn = screen.getByTestId('sovereignty-export')
    expect(btn).toBeInTheDocument()
    expect(btn.textContent).toMatch(/export everything as json/i)
    fireEvent.click(btn)
    expect(mockExportAll).toHaveBeenCalled()
  })

  it('does not render when the dashboard store is closed', () => {
    useSovereigntyDashboardStore.setState({ open: false })
    const { container } = render(<SovereigntyDashboard />)
    expect(container.firstChild).toBeNull()
  })
})
