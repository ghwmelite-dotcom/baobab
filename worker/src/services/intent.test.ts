import { describe, it, expect } from 'vitest'
import { detectIntent, extractSiteCard, type BraveRawResult } from './intent'

describe('intent.detectIntent', () => {
  const top = (url: string, title = 'Title'): BraveRawResult => ({
    title, url, description: '', meta_url: { hostname: new URL(url).hostname },
  })

  it('short brand match → navigational', () => {
    expect(detectIntent('paystack', top('https://paystack.com/'))).toBe('navigational')
    expect(detectIntent('youtube', top('https://youtube.com/'))).toBe('navigational')
  })

  it('long question → informational', () => {
    expect(detectIntent('how does paystack work', top('https://paystack.com/'))).toBe('informational')
  })

  it('contains question word → informational regardless of length', () => {
    expect(detectIntent('what is paystack', top('https://paystack.com/'))).toBe('informational')
    expect(detectIntent('why paystack', top('https://paystack.com/'))).toBe('informational')
  })

  it('top result domain does not match query → informational', () => {
    expect(detectIntent('konga', top('https://en.wikipedia.org/wiki/Konga'))).toBe('informational')
  })

  it('three+ word non-question query → informational', () => {
    expect(detectIntent('best mobile money apps', top('https://flutterwave.com/'))).toBe('informational')
  })

  it('handles empty / null topResult', () => {
    expect(detectIntent('anything', null)).toBe('informational')
  })

  it('falls back to URL hostname when meta_url.hostname missing', () => {
    const result: BraveRawResult = {
      title: 'Paystack', url: 'https://paystack.com/', description: '',
    }
    expect(detectIntent('paystack', result)).toBe('navigational')
  })
})

describe('intent.extractSiteCard', () => {
  it('extracts basic site card from Brave profile + meta_url', () => {
    const result: BraveRawResult = {
      title: 'Paystack - Modern online and offline payments',
      url: 'https://paystack.com/',
      description: 'Modern payments for Africa',
      meta_url: { hostname: 'paystack.com' },
      profile: { name: 'Paystack', long_name: 'Paystack', img: 'https://paystack.com/logo.png' },
    }
    const card = extractSiteCard(result)
    expect(card).not.toBeNull()
    expect(card!.name).toBe('Paystack')
    expect(card!.url).toBe('https://paystack.com/')
    expect(card!.description).toBe('Modern payments for Africa')
    expect(card!.logoUrl).toBe('https://paystack.com/logo.png')
  })

  it('falls back to title-without-suffix when profile missing', () => {
    const result: BraveRawResult = {
      title: 'Paystack - Modern online payments',
      url: 'https://paystack.com/',
      description: 'fallback snippet',
      meta_url: { hostname: 'paystack.com' },
    }
    const card = extractSiteCard(result)
    expect(card!.name).toBe('Paystack')
    expect(card!.description).toBe('fallback snippet')
  })

  it('returns null when input is missing required fields', () => {
    expect(extractSiteCard(null as never)).toBeNull()
  })
})
