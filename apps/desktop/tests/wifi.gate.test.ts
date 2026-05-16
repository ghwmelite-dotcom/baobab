import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useConnectionStore } from '~/state/connection.store'
import { gate, setWifiOnlySync } from '~/data/wifiGate'

beforeEach(() => {
  useConnectionStore.setState({ effectiveType: '4g', type: 'wifi', isOffline: false, isSlow: false, downlinkMbps: 30 })
  setWifiOnlySync(true)
})

describe('wifiGate.gate', () => {
  it('runs the fn when type is wifi', async () => {
    const fn = vi.fn(async () => 'ran')
    expect(await gate(fn)).toBe('ran')
    expect(fn).toHaveBeenCalledOnce()
  })

  it('short-circuits when type is cellular and wifiOnly is on', async () => {
    useConnectionStore.setState({ type: 'cellular', effectiveType: '3g' })
    const fn = vi.fn(async () => 'ran')
    expect(await gate(fn)).toBe(null)
    expect(fn).not.toHaveBeenCalled()
  })

  it('runs the fn on cellular when wifiOnly is off', async () => {
    useConnectionStore.setState({ type: 'cellular' })
    setWifiOnlySync(false)
    const fn = vi.fn(async () => 'ran')
    expect(await gate(fn)).toBe('ran')
  })
})
