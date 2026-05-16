import { useCallback } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'

/**
 * Returns an onMouseDown handler that programmatically starts an OS window
 * drag. Use it on chrome surfaces (tab strip, omnibar background, bookmarks
 * bar) so users can grab the window even when data-tauri-drag-region isn't
 * being recognised by the Wry layer (the attribute relies on a DOM scan
 * that doesn't always survive HMR in dev).
 *
 * The handler bails on right-click (so it doesn't fight context menus) and
 * on text inputs / buttons / their descendants — the caller may still wrap
 * the whole chrome bar with this and clicks on real controls keep working.
 */
export function useDragWindow(): (e: React.MouseEvent) => void {
  return useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return
    const target = e.target as HTMLElement | null
    if (!target) return
    // Don't hijack clicks on interactive descendants.
    if (target.closest('input, textarea, select, button, a, [role="button"]')) return
    e.preventDefault()
    void getCurrentWindow().startDragging()
  }, [])
}
