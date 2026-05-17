import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'

export interface NativeMenuItem {
  /** Stable identifier. Required for selectable items, omitted for separators. */
  id?: string
  label?: string
  /** Display-only hint (e.g. "Ctrl+R"). Does NOT bind the shortcut. */
  accelerator?: string
  enabled?: boolean
  separator?: boolean
}

/**
 * Pop up a native OS context menu at the cursor and resolve with the selected
 * item's `id`, or `null` if the user dismissed the menu without selecting.
 *
 * Why native:
 * - In our multi-webview chrome (one host webview for the strip + N native
 *   WebView2 children per tab), HTML overlays in the host CANNOT render over
 *   the tab webviews. Native menus render on the OS compositor layer, so
 *   they always appear above the page content.
 *
 * Cancellation: Tauri's `on_menu_event` only fires on selection — there is
 * no callback for "dismissed without selecting". We work around that by
 * unlistening on the next show, on a timeout, or when the caller's component
 * unmounts.
 */
export async function showContextMenu(items: NativeMenuItem[]): Promise<string | null> {
  let unlisten: UnlistenFn | null = null
  let timer: ReturnType<typeof setTimeout> | null = null

  const selection = new Promise<string | null>((resolve) => {
    // Subscribe BEFORE invoking show — Tauri can fire the event before the
    // invoke promise resolves if the menu is dismissed via accelerator,
    // and missing that race window would leave the caller hanging.
    void listen<string>('menu:select', (event) => {
      cleanup()
      resolve(event.payload ?? null)
    }).then((un) => {
      unlisten = un
    })
    // If the menu is closed without selection there is no event from Tauri
    // for us to hear. 30s is a generous upper bound — well past any real
    // user gesture, short enough not to leak listeners indefinitely.
    timer = setTimeout(() => {
      cleanup()
      resolve(null)
    }, 30_000)
  })

  function cleanup(): void {
    if (timer) clearTimeout(timer)
    timer = null
    if (unlisten) unlisten()
    unlisten = null
  }

  try {
    await invoke('show_context_menu', { items })
  } catch (e) {
    cleanup()
    throw e
  }

  return selection
}
