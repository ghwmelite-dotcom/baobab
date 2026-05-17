import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent, screen } from '@testing-library/react'

const tabsMocks = vi.hoisted(() => ({
  openTab: vi.fn(async () => 't1'),
}))

vi.mock('~/state/persistence', () => {
  const persistence = {
    get: vi.fn((_key: string) => Promise.resolve(undefined)),
    set: vi.fn((_key: string, _value: unknown) => Promise.resolve()),
    delete: vi.fn((_key: string) => Promise.resolve()),
  }
  const profileScoped = (profileId: string) => {
    const prefix = `profile.${profileId}.`
    return {
      get: (key: string) => persistence.get(prefix + key),
      set: (key: string, value: unknown) => persistence.set(prefix + key, value),
      delete: (key: string) => persistence.delete(prefix + key),
    }
  }
  return { persistence, profileScoped }
})

vi.mock('~/auth/api', () => ({
  authClient: {},
  client: { setAccessToken: vi.fn() },
}))

import { DigestStrip } from '~/digest/DigestStrip'
import { useDigestStore, type DigestItem } from '~/digest/digest.store'
import { useTabsStore } from '~/state/tabs.store'

const FIXTURE: DigestItem[] = [
  {
    id: 'punch:abc',
    title: 'Lagos infrastructure plans unveiled',
    summary: 'A new master plan was announced detailing road and rail expansion.',
    source: { id: 'punch', name: 'Punch', country: 'NG' },
    url: 'https://example.test/punch/a',
    publishedAt: '2026-05-13T08:00:00.000Z',
  },
  {
    id: 'dm:def',
    title: 'Cape Town water reserves recover',
    summary: 'Reservoirs are nearing full capacity after sustained winter rainfall.',
    source: { id: 'daily-maverick', name: 'Daily Maverick', country: 'ZA' },
    url: 'https://example.test/dm/a',
    publishedAt: '2026-05-13T07:00:00.000Z',
  },
  {
    id: 'tc:ghi',
    title: 'Fintech raises Series A from African investors',
    summary: 'The round was led by a Lagos-based fund with participation from Nairobi.',
    source: { id: 'techcabal', name: 'TechCabal', country: 'NG' },
    url: 'https://example.test/tc/a',
    publishedAt: '2026-05-13T06:00:00.000Z',
  },
]

beforeEach(() => {
  tabsMocks.openTab.mockClear()
  useDigestStore.setState({
    items: FIXTURE,
    loading: false,
    loaded: true,
  })
  useTabsStore.setState({
    tabs: [],
    activeId: null,
    openTab: tabsMocks.openTab,
  } as unknown as Parameters<typeof useTabsStore.setState>[0])
})

describe('DigestStrip', () => {
  it('renders the heading and all fixture card titles', () => {
    render(<DigestStrip />)
    expect(screen.getByText('Today on the continent')).toBeInTheDocument()
    expect(screen.getByText('Lagos infrastructure plans unveiled')).toBeInTheDocument()
    expect(screen.getByText('Cape Town water reserves recover')).toBeInTheDocument()
    expect(screen.getByText('Fintech raises Series A from African investors')).toBeInTheDocument()
  })

  it('shows the "Read on {source}" footer for each card', () => {
    render(<DigestStrip />)
    expect(screen.getByText('Read on Punch')).toBeInTheDocument()
    expect(screen.getByText('Read on Daily Maverick')).toBeInTheDocument()
    expect(screen.getByText('Read on TechCabal')).toBeInTheDocument()
  })

  it('clicking a card opens its url in a new tab', () => {
    const { container } = render(<DigestStrip />)
    const cards = container.querySelectorAll('button')
    expect(cards.length).toBe(FIXTURE.length)
    fireEvent.click(cards[0]!)
    expect(tabsMocks.openTab).toHaveBeenCalledWith('https://example.test/punch/a')
  })

  it('renders the empty-state copy when there are no items', () => {
    useDigestStore.setState({ items: [], loading: false, loaded: true })
    render(<DigestStrip />)
    expect(
      screen.getByText("Stories will surface here once we've checked the wires."),
    ).toBeInTheDocument()
  })
})
