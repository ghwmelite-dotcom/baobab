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

  it('treats downlink < 1.5 as slow even if effectiveType is 4g', async () => {
    Object.defineProperty(navigator, 'connection', {
      configurable: true,
      value: { effectiveType: '4g', downlink: 0.8, saveData: false, addEventListener: vi.fn(), removeEventListener: vi.fn() },
    })
    const { useConnectionStore } = await import('~/state/connection.store')
    useConnectionStore.getState().sync()
    expect(useConnectionStore.getState().isSlow).toBe(true)
  })

  it('forces slow when slowModeForced is true', async () => {
    const { useConnectionStore } = await import('~/state/connection.store')
    useConnectionStore.getState().sync()
    useConnectionStore.setState({ slowModeForced: true })
    expect(useConnectionStore.getState().isSlowEffective()).toBe(true)
  })
})
