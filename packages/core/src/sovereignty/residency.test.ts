import { describe, it, expect } from 'vitest'
import { parseResidencyHeaders } from './residency'

describe('parseResidencyHeaders', () => {
  it('extracts colo, region, and data residency', () => {
    const h = new Headers({
      'X-Baobab-Colo': 'LOS',
      'X-Baobab-Region': 'africa',
      'X-Data-Residency': 'd1=weur,r2=eu',
    })
    expect(parseResidencyHeaders(h)).toEqual({
      colo: 'LOS',
      region: 'africa',
      dataResidency: 'd1=weur,r2=eu',
    })
  })
  it('falls back to unknown when headers missing', () => {
    expect(parseResidencyHeaders(new Headers())).toEqual({
      colo: 'unknown',
      region: 'unknown',
      dataResidency: '',
    })
  })
  it('coerces unrecognized region values to unknown', () => {
    const h = new Headers({
      'X-Baobab-Colo': 'FRA',
      'X-Baobab-Region': 'mars',
      'X-Data-Residency': '',
    })
    expect(parseResidencyHeaders(h).region).toBe('unknown')
  })
})
