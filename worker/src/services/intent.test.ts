import { describe, it, expect } from 'vitest'
import { detectIntent, extractSiteCard, type PseRawResult } from './intent'

describe('intent.detectIntent', () => {
  const top = (url: string, title = 'Title'): PseRawResult => ({
    title, link: url, snippet: '', displayLink: new URL(url).hostname,
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
})

describe('intent.extractSiteCard', () => {
  it('extracts basic site card from PSE pagemap', () => {
    const result: PseRawResult = {
      title: 'Paystack - Modern online and offline payments',
      link: 'https://paystack.com/',
      displayLink: 'paystack.com',
      snippet: 'Accept payments online and in-person.',
      pagemap: {
        metatags: [{ 'og:site_name': 'Paystack', 'og:description': 'Modern payments for Africa' }],
        cse_image: [{ src: 'https://paystack.com/logo.png' }],
      },
    }
    const card = extractSiteCard(result)
    expect(card).not.toBeNull()
    expect(card!.name).toBe('Paystack')
    expect(card!.url).toBe('https://paystack.com/')
    expect(card!.description).toBe('Modern payments for Africa')
    expect(card!.logoUrl).toBe('https://paystack.com/logo.png')
  })

  it('falls back to title-without-suffix when og:site_name missing', () => {
    const result: PseRawResult = {
      title: 'Paystack - Modern online payments',
      link: 'https://paystack.com/',
      displayLink: 'paystack.com',
      snippet: 'fallback snippet',
    }
    const card = extractSiteCard(result)
    expect(card!.name).toBe('Paystack')
    expect(card!.description).toBe('fallback snippet')
  })

  it('returns null when input is missing required fields', () => {
    expect(extractSiteCard(null as never)).toBeNull()
  })
})
