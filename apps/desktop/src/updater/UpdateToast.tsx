import { useEffect, useState } from 'react'
import { checkForUpdate, installAndRelaunch, type UpdateInfo } from './updater'
import { Button } from '@baobab/ui'

const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000 // 6h

export function UpdateToast() {
  const [update, setUpdate] = useState<UpdateInfo | null>(null)
  const [installing, setInstalling] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    let active = true
    const run = async () => {
      const u = await checkForUpdate()
      if (active && u) setUpdate(u)
    }
    void run()
    const t = setInterval(() => {
      void run()
    }, CHECK_INTERVAL_MS)
    return () => {
      active = false
      clearInterval(t)
    }
  }, [])

  if (!update || dismissed) return null

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'absolute',
        bottom: 16,
        right: 16,
        background: 'var(--surface-2)',
        border: '1px solid var(--border-accent)',
        borderRadius: 12,
        padding: 12,
        zIndex: 40,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        maxWidth: 320,
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
      }}
    >
      <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600 }}>
        Update available — v{update.version}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
        Install now to get the latest features and fixes.
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <Button
          loading={installing}
          onClick={async () => {
            setInstalling(true)
            const r = await installAndRelaunch()
            setInstalling(false)
            if (r === 'error') setDismissed(true)
          }}
        >
          Install
        </Button>
        <Button variant="ghost" onClick={() => setDismissed(true)}>
          Later
        </Button>
      </div>
    </div>
  )
}
