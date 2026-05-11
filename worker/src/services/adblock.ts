const AD_HOST_PATTERNS = [
  /googletagmanager\.com/i,
  /google-analytics\.com/i,
  /googleadservices\.com/i,
  /googlesyndication\.com/i,
  /doubleclick\.net/i,
  /adsbygoogle/i,
  /facebook\.net\/tr/i,
  /connect\.facebook\.net/i,
  /scorecardresearch\.com/i,
  /quantserve\.com/i,
  /chartbeat\.com/i,
  /amazon-adsystem\.com/i,
  /taboola\.com/i,
  /outbrain\.com/i,
  /criteo\.com/i,
  /\/ads?\//i,
]

const AD_CLASS_OR_ID = /\b(ad-|ads-|advert|sponsored|banner|popup|interstitial)\b/i

export function stripAds(html: string): { html: string; ads_blocked: number; trackers_blocked: number } {
  let ads = 0
  let trackers = 0

  const cleaned = html
    .replace(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*><\/script>/gi, (m, src: string) => {
      if (AD_HOST_PATTERNS.some((p) => p.test(src))) {
        if (/analytics|\/tr\/|pixel|scorecardresearch|quantserve|chartbeat/i.test(src)) trackers++
        else ads++
        return ''
      }
      return m
    })
    .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gi, (m, inner: string) => {
      if (/gtag\(|ga\(|fbq\(|_paq|amplitude\.|mixpanel\./.test(inner)) {
        trackers++
        return ''
      }
      return m
    })
    .replace(/<iframe\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>[\s\S]*?<\/iframe>/gi, (m, src: string) => {
      if (AD_HOST_PATTERNS.some((p) => p.test(src)) || /ads?|banner|sponsor/i.test(src)) {
        ads++
        return ''
      }
      return m
    })
    .replace(/<div\b[^>]*\b(class|id)\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/div>/gi, (m, _attr, val: string) => {
      if (AD_CLASS_OR_ID.test(val)) {
        ads++
        return ''
      }
      return m
    })

  return { html: cleaned, ads_blocked: ads, trackers_blocked: trackers }
}
