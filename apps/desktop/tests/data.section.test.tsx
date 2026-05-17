import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('~/state/persistence', () => {
  const store = new Map<string, unknown>()
  const profileScoped = () => ({
    get: (k: string) => Promise.resolve(store.get(k)),
    set: (k: string, v: unknown) => { store.set(k, v); return Promise.resolve() },
    delete: (k: string) => { store.delete(k); return Promise.resolve() },
  })
  return { profileScoped, persistence: {} }
})

vi.mock('~/data/data.api', () => ({ dataApi: { setSlowMode: vi.fn(async () => undefined) } }))

import { useDataStore } from '~/data/data.store'
import { DataSection } from '~/settings/sections/DataSection'

beforeEach(() => {
  useDataStore.setState({ history: [], budgetMb: 500 })
  useDataStore.getState().setProfileId('p1')
})

describe('DataSection', () => {
  it('shows 0% used and the full budget when there is no usage', () => {
    render(<DataSection />)
    expect(screen.getByText(/0 MB of 500 MB/)).toBeInTheDocument()
  })

  it('renders the used/saved counters reflecting today\'s bucket', () => {
    useDataStore.getState().recordUsage(50 * 1024 * 1024, 10 * 1024 * 1024)
    render(<DataSection />)
    expect(screen.getByText(/50 MB of 500 MB/)).toBeInTheDocument()
    expect(screen.getByText(/saved 10 MB/i)).toBeInTheDocument()
  })

  it('shows 100% when usage equals the budget', () => {
    useDataStore.getState().setBudget(10)
    useDataStore.getState().recordUsage(10 * 1024 * 1024, 0)
    render(<DataSection />)
    expect(screen.getByText(/10 MB of 10 MB/)).toBeInTheDocument()
  })
})
