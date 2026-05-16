import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'

export interface ContextMenuItem {
  /** Use 'separator' for a thin divider line; ignore other fields. */
  kind?: 'item' | 'separator'
  label?: string
  /** Right-aligned hint, e.g. "Ctrl+T". */
  shortcut?: string
  /** Invoked on click or Enter/Space. Menu closes after, unless this throws. */
  onSelect?: () => void
  disabled?: boolean
  /** Renders the label in a danger color (used for destructive actions). */
  danger?: boolean
}

interface Props {
  items: ContextMenuItem[]
  /** Cursor coordinates from the contextmenu event (page coords). */
  x: number
  y: number
  onClose: () => void
  /** ARIA label for the menu itself. Defaults to "Context menu". */
  ariaLabel?: string
}

// Visual constants. Sized to match Chrome/Edge density: compact rows, generous
// hit target, soft shadow that reads against both dark chrome and light bg.
const MIN_WIDTH = 220
const ROW_HEIGHT = 30
const SEP_HEIGHT = 9
const VIEWPORT_PAD = 6

function isFocusableItem(item: ContextMenuItem): boolean {
  return item.kind !== 'separator' && !item.disabled
}

export function ContextMenu({ items, x, y, onClose, ariaLabel = 'Context menu' }: Props) {
  const menuRef = useRef<HTMLUListElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number }>({ left: x, top: y })
  const [focusIdx, setFocusIdx] = useState<number>(() =>
    items.findIndex(isFocusableItem),
  )

  // Clamp the menu inside the viewport. Measured AFTER first paint so the
  // real height/width are known — placing first then nudging avoids the
  // "menu briefly appears off-screen then snaps" flicker.
  useLayoutEffect(() => {
    const el = menuRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight

    let left = x
    let top = y
    if (left + rect.width + VIEWPORT_PAD > vw) {
      left = Math.max(VIEWPORT_PAD, vw - rect.width - VIEWPORT_PAD)
    }
    if (top + rect.height + VIEWPORT_PAD > vh) {
      // Place above the cursor when there isn't room below.
      top = Math.max(VIEWPORT_PAD, y - rect.height)
    }
    setPos({ left, top })
  }, [x, y, items])

  // Outside-click + Escape close. Pointerdown is used instead of click so the
  // menu disappears on press (matches OS context-menu feel).
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (!menuRef.current) return
      if (e.target instanceof Node && menuRef.current.contains(e.target)) return
      onClose()
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    function onResize() {
      onClose()
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKey, true)
    window.addEventListener('resize', onResize, true)
    window.addEventListener('blur', onClose, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKey, true)
      window.removeEventListener('resize', onResize, true)
      window.removeEventListener('blur', onClose, true)
    }
  }, [onClose])

  // Focus the first focusable item when the menu mounts. Keyboard users can
  // arrow-down from here; pointer users just click.
  useEffect(() => {
    if (focusIdx < 0) return
    const el = menuRef.current?.querySelectorAll<HTMLLIElement>('[role="menuitem"]')[focusIdx]
    el?.focus()
  }, [focusIdx])

  function activate(item: ContextMenuItem) {
    if (!isFocusableItem(item)) return
    onClose()
    // Defer so the menu unmounts before the action fires (otherwise an
    // action that opens another menu can race with our own teardown).
    queueMicrotask(() => item.onSelect?.())
  }

  function onMenuKeyDown(e: ReactKeyboardEvent<HTMLUListElement>) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const step = e.key === 'ArrowDown' ? 1 : -1
      let i = focusIdx
      for (let n = 0; n < items.length; n++) {
        i = (i + step + items.length) % items.length
        if (isFocusableItem(items[i]!)) {
          setFocusIdx(i)
          break
        }
      }
    } else if (e.key === 'Home') {
      e.preventDefault()
      const i = items.findIndex(isFocusableItem)
      if (i >= 0) setFocusIdx(i)
    } else if (e.key === 'End') {
      e.preventDefault()
      let i = -1
      for (let k = items.length - 1; k >= 0; k--) {
        if (isFocusableItem(items[k]!)) { i = k; break }
      }
      if (i >= 0) setFocusIdx(i)
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      const item = items[focusIdx]
      if (item) activate(item)
    }
  }

  return (
    <ul
      ref={menuRef}
      role="menu"
      aria-label={ariaLabel}
      onKeyDown={onMenuKeyDown}
      data-tauri-drag-region="false"
      style={{
        position: 'fixed',
        left: pos.left,
        top: pos.top,
        minWidth: MIN_WIDTH,
        margin: 0,
        padding: '6px 0',
        listStyle: 'none',
        background: 'var(--surface-2, #1f1a16)',
        color: 'var(--text-primary, #f4ece1)',
        border: '1px solid var(--border, rgba(255,255,255,0.08))',
        borderRadius: 10,
        boxShadow:
          '0 12px 30px rgba(0,0,0,0.45), 0 2px 6px rgba(0,0,0,0.30), 0 0 0 1px rgba(255,255,255,0.03)',
        fontSize: 13,
        zIndex: 10000,
        userSelect: 'none',
        animation: 'bb-ctxmenu-in 110ms ease-out both',
      }}
    >
      {items.map((item, i) => {
        if (item.kind === 'separator') {
          return (
            <li
              key={`sep-${i}`}
              role="separator"
              aria-hidden
              style={{
                height: 1,
                margin: `${(SEP_HEIGHT - 1) / 2}px 8px`,
                background: 'rgba(255,255,255,0.08)',
              }}
            />
          )
        }
        const focusable = isFocusableItem(item)
        const color = item.disabled
          ? 'rgba(244,236,225,0.36)'
          : item.danger
            ? '#f08866'
            : 'inherit'
        const itemStyle: CSSProperties = {
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          height: ROW_HEIGHT,
          paddingInline: 14,
          cursor: focusable ? 'pointer' : 'default',
          color,
          outline: 'none',
        }
        return (
          <li
            key={item.label ?? `item-${i}`}
            role="menuitem"
            aria-disabled={item.disabled || undefined}
            tabIndex={focusable ? -1 : undefined}
            onMouseEnter={(e) => {
              if (focusable) {
                ;(e.currentTarget as HTMLLIElement).style.background = 'rgba(255,255,255,0.07)'
                setFocusIdx(i)
              }
            }}
            onMouseLeave={(e) => {
              ;(e.currentTarget as HTMLLIElement).style.background = 'transparent'
            }}
            onClick={() => activate(item)}
            style={itemStyle}
          >
            <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {item.label}
            </span>
            {item.shortcut && (
              <span
                style={{
                  fontSize: 11,
                  color: item.disabled
                    ? 'rgba(244,236,225,0.28)'
                    : 'rgba(244,236,225,0.55)',
                  letterSpacing: '0.02em',
                  whiteSpace: 'nowrap',
                }}
              >
                {item.shortcut}
              </span>
            )}
          </li>
        )
      })}
      <style>{`
        @keyframes bb-ctxmenu-in {
          from { opacity: 0; transform: translateY(-2px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0)    scale(1); }
        }
      `}</style>
    </ul>
  )
}
