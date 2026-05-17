/**
 * Build-time fetch of the latest desktop release from GitHub.
 * Returns the Windows installer size + version + tag so the hero CTA
 * can show "Download for Windows · 2.1 MB". Falls back gracefully
 * on fetch failure so build never blocks.
 */

interface ReleaseAsset {
  name: string
  size: number
  browser_download_url: string
}

interface ReleaseInfo {
  tag: string
  windowsAssetUrl: string
  windowsSizeMb: string
}

const FALLBACK: ReleaseInfo = {
  tag: 'desktop-v0.1.0',
  windowsAssetUrl: 'https://github.com/ghwmelite-dotcom/baobab/releases/latest',
  windowsSizeMb: '',
}

export async function getLatestRelease(): Promise<ReleaseInfo> {
  try {
    const r = await fetch('https://api.github.com/repos/ghwmelite-dotcom/baobab/releases/latest', {
      headers: { Accept: 'application/vnd.github+json' },
    })
    if (!r.ok) return FALLBACK
    const data = await r.json() as { tag_name: string; assets: ReleaseAsset[] }
    const win = data.assets.find((a) => /x64-setup\.exe$/.test(a.name))
    if (!win) return { ...FALLBACK, tag: data.tag_name }
    return {
      tag: data.tag_name,
      windowsAssetUrl: win.browser_download_url,
      windowsSizeMb: `${(win.size / (1024 * 1024)).toFixed(1)} MB`,
    }
  } catch {
    return FALLBACK
  }
}
