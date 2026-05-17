import { describe, it, expect, beforeEach, vi } from 'vitest'

beforeEach(() => {
  // Default mock: 4g, not saveData, online.
  Object.defineProperty(navigator, 'connection', {
    configurable: true,
    value: { effectiveType: '4g', downlink: 10, saveData: false, addEventListener: vi.fn(), removeEventListener: vi.fn() },
  })
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
})

describe('connection.store', () => {
  it('treats 4g + 10 Mbps downlink as fast', async () => {
    const { useConnectionStore } = await import('~/state/connection.store')
    useConnectionStore.getState().sync()
    expect(useConnectionStore.getState().isSlow).toBe(false)
  })

  it('treats slow-2g as slow', async () => {
    Object.defineProperty(navigator, 'connection', {
      configurable: true,
      value: { effectiveType: 'slow-2g', downlink: 0.05, saveData: false, addEventListener: vi.fn(), removeEventListener: vi.fn() },
    })
    const { useConnectionStore } = await import('~/state/connection.store')
    useConnectionStore.getState().sync()
    expect(useConnectionStore.getState().isSlow).toBe(true)
  })

  it('does NOT treat 4g+saveData as slow — saveData is a preference, not a speed signal', async () => {
    Object.defineProperty(navigator, 'connection', {
      configurable: true,
      value: { effectiveType: '4g', downlink: 10, saveData: true, addEventListener: vi.fn(), removeEventListener: vi.fn() },
    })
    const { useConnectionStore } = await import('~/state/connection.store')
    useConnectionStore.getState().sync()
    expect(useConnectionStore.getState().isSlow).toBe(false)
  })

  it('does NOT treat 4g + low downlink as slow — WebView2 reports downlink unreliably', async () => {
    Object.defineProperty(navigator, 'connection', {
      configurable: true,
      value: { effectiveType: '4g', downlink: 0.8, saveData: false, addEventListener: vi.fn(), removeEventListener: vi.fn() },
    })
    const { useConnectionStore } = await import('~/state/connection.store')
    useConnectionStore.getState().sync()
    expect(useConnectionStore.getState().isSlow).toBe(false)
  })

  it('slowModeOverride="always" makes isSlowEffective true even on fast connection', async () => {
    const { useConnectionStore } = await import('~/state/connection.store')
    useConnectionStore.getState().sync()
    useConnectionStore.setState({ slowModeOverride: 'always' })
    expect(useConnectionStore.getState().isSlowEffective()).toBe(true)
  })

  it('slowModeOverride="never" makes isSlowEffective false even when isSlow detection fires', async () => {
    Object.defineProperty(navigator, 'connection', {
      configurable: true,
      value: { effectiveType: '2g', downlink: 0.1, saveData: false, addEventListener: vi.fn(), removeEventListener: vi.fn() },
    })
    const { useConnectionStore } = await import('~/state/connection.store')
    useConnectionStore.getState().sync()
    expect(useConnectionStore.getState().isSlow).toBe(true)
    useConnectionStore.setState({ slowModeOverride: 'never' })
    expect(useConnectionStore.getState().isSlowEffective()).toBe(false)
  })
})
