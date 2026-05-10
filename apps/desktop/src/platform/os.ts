export type OsKind = 'windows' | 'macos' | 'linux' | 'unknown'

export function detectOs(): OsKind {
  if (typeof navigator === 'undefined') return 'unknown'
  const p = navigator.platform.toLowerCase()
  if (p.includes('win')) return 'windows'
  if (p.includes('mac')) return 'macos'
  if (p.includes('linux')) return 'linux'
  return 'unknown'
}

export const OS = detectOs()
