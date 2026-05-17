import { describe, it, expect } from 'vitest'
import { shouldUseLowBandwidth } from './lowbw'

describe('shouldUseLowBandwidth', () => {
  const fast = { effectiveType: '4g', saveData: false } as const
  const slow = { effectiveType: '3g', saveData: false } as const
  const saveData = { effectiveType: '4g', saveData: true } as const

  it('manual on always true', () => {
    expect(shouldUseLowBandwidth('on', fast)).toBe(true)
  })
  it('manual off always false', () => {
    expect(shouldUseLowBandwidth('off', slow)).toBe(false)
  })
  it('auto + 3g → true', () => {
    expect(shouldUseLowBandwidth('auto', slow)).toBe(true)
  })
  it('auto + 4g → false', () => {
    expect(shouldUseLowBandwidth('auto', fast)).toBe(false)
  })
  it('auto + saveData hint → true', () => {
    expect(shouldUseLowBandwidth('auto', saveData)).toBe(true)
  })
})
