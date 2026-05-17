import { useEffect, useRef, useState } from 'react'
import { useDataStore } from './data.store'
import { useConnectionStore } from '~/state/connection.store'
import { dataApi } from './data.api'

type ToastState = { message: string; key: number } | null

export function DataToast() {
  const percent = useDataStore((s) => s.percentUsedToday())
  const budgetMb = useDataStore((s) => s.budgetMb)
  const [toast, setToast] = useState<ToastState>(null)
  const lastTier = useRef<0 | 80 | 100>(0)

  useEffect(() => {
    const tier = percent >= 100 ? 100 : percent >= 80 ? 80 : 0
    if (tier === lastTier.current) return

    if (tier === 80 && lastTier.current < 80) {
      const remainingMb = Math.max(0, Math.round(budgetMb * 0.2))
      setToast({ message: `${remainingMb} MB left today. Slow mode kicks in at 0.`, key: Date.now() })
    } else if (tier === 100 && lastTier.current < 100) {
      setToast({ message: 'Daily budget reached. Slow mode enabled.', key: Date.now() })
      useConnectionStore.getState().setForced(true)
      void dataApi.setSlowMode(true)
    } else if (tier === 0) {
      // Day rollover: clear forced slow mode, no toast.
      useConnectionStore.getState().setForced(false)
      void dataApi.setSlowMode(false)
    }
    lastTier.current = tier
  }, [percent, budgetMb])

  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 5000)
    return () => clearTimeout(id)
  }, [toast])

  if (!toast) return null
  return (
    <div
      role="status"
      style={{
        position: 'fixed',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        padding: '10px 16px',
        background: 'rgba(28, 24, 20, 0.95)',
        border: '1px solid var(--border)',
        borderLeft: '3px solid var(--accent)',
        color: 'var(--text-primary)',
        borderRadius: 8,
        fontSize: 13,
        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        zIndex: 9000,
        animation: 'baobab-fade-in 220ms ease-out',
      }}
    >
      {toast.message}
    </div>
  )
}
