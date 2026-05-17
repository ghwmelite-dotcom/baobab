import { describe, it, expect } from 'vitest'
import { countryFor, isAfrican, AFRICAN_TLDS, AFRICAN_SOURCES_SEED } from './search-rank'

describe('search-rank', () => {
  describe('countryFor', () => {
    it('returns ISO from .ng TLD', () => {
      expect(countryFor('techcabal.com.ng')).toBe('NG')
      expect(countryFor('vanguardngr.com')).toBe('NG')
    })
    it('returns ISO from curated seed map', () => {
      expect(countryFor('mg.co.za')).toBe('ZA')
      expect(countryFor('dailymaverick.co.za')).toBe('ZA')
    })
    it('returns ISO from .ke .gh .et .ug TLDs', () => {
      expect(countryFor('foo.co.ke')).toBe('KE')
      expect(countryFor('foo.com.gh')).toBe('GH')
      expect(countryFor('foo.gov.et')).toBe('ET')
      expect(countryFor('foo.go.ug')).toBe('UG')
    })
    it('returns null for non-African hosts', () => {
      expect(countryFor('cnn.com')).toBeNull()
      expect(countryFor('britannica.com')).toBeNull()
    })
    it('handles www. prefix', () => {
      expect(countryFor('www.vanguardngr.com')).toBe('NG')
    })
  })

  describe('isAfrican', () => {
    it('matches TLD or seed map', () => {
      expect(isAfrican('vanguardngr.com')).toBe(true)
      expect(isAfrican('foo.co.za')).toBe(true)
      expect(isAfrican('cnn.com')).toBe(false)
    })
  })

  describe('AFRICAN_TLDS', () => {
    it('includes major African TLDs', () => {
      expect(AFRICAN_TLDS.has('.ng')).toBe(true)
      expect(AFRICAN_TLDS.has('.ke')).toBe(true)
      expect(AFRICAN_TLDS.has('.za')).toBe(true)
      expect(AFRICAN_TLDS.has('.gh')).toBe(true)
      expect(AFRICAN_TLDS.has('.et')).toBe(true)
    })
  })

  describe('AFRICAN_SOURCES_SEED', () => {
    it('keeps existing seed entries with country annotations', () => {
      expect(AFRICAN_SOURCES_SEED['vanguardngr.com']).toBeDefined()
      expect(AFRICAN_SOURCES_SEED['mg.co.za']).toBeDefined()
    })
  })
})
