import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const apiMocks = vi.hoisted(() => ({
  getState: vi.fn(),
  setEnabled: vi.fn(),
  refreshLists: vi.fn(),
}))
vi.mock('~/adblock/adblock.api', () => ({ adblockApi: apiMocks }))

const profileMock = vi.hoisted(() => ({ useProfile: vi.fn() }))
vi.mock('~/profiles/useProfile', () => profileMock)

const stubProfile = {
  id: 'p1', name: 'Akua', fruitColor: 'mango' as const, avatarLetter: 'A',
  createdAt: '', lastUsedAt: '', cloudLink: null, userDataDirName: '', pinRequired: false,
}

import { useAdblockStore } from '~/adblock/adblock.store'
import { AdblockSection } from '~/settings/sections/AdblockSection'

beforeEach(() => {
  apiMocks.getState.mockReset()
  apiMocks.setEnabled.mockReset()
  apiMocks.refreshLists.mockReset()
  profileMock.useProfile.mockReturnValue(stubProfile)
  useAdblockStore.setState({
    enabled: true,
    lastUpdated: '2026-05-16T00:00:00Z',
    source: { kind: 'Bundled' },
    refreshing: false,
    error: null,
    lastRefreshAttempt: 0,
  })
})

describe('AdblockSection', () => {
  it('renders the toggle bound to store state', () => {
    render(<AdblockSection />)
    const checkbox = screen.getByRole('checkbox', { name: /block ads and trackers/i }) as HTMLInputElement
    expect(checkbox.checked).toBe(true)
  })

  it('clicking the toggle calls setEnabled with the profile id', async () => {
    apiMocks.setEnabled.mockResolvedValue(undefined)
    render(<AdblockSection />)
    fireEvent.click(screen.getByRole('checkbox', { name: /block ads and trackers/i }))
    await waitFor(() => {
      expect(apiMocks.setEnabled).toHaveBeenCalledWith('p1', false)
    })
  })

  it('clicking refresh button calls refreshLists', async () => {
    apiMocks.refreshLists.mockResolvedValue({
      enabled: true,
      lastUpdated: '2026-05-16T10:00:00Z',
      source: { kind: 'Upstream', fetchedAt: '2026-05-16T10:00:00Z' },
    })
    render(<AdblockSection />)
    fireEvent.click(screen.getByRole('button', { name: /refresh filter lists/i }))
    await waitFor(() => {
      expect(apiMocks.refreshLists).toHaveBeenCalled()
    })
  })
})
