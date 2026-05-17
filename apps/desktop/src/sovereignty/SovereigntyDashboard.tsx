import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, IconButton } from '@baobab/ui'
import { useSovereigntyStore } from '~/state/sovereignty.store'
import { useAuthStore } from '~/auth/auth.store'
import { useSovereigntyDashboardStore } from './dashboard.store'
import { useInventoryStore } from './inventory.store'
import { AfricaMap } from './AfricaMap'

// Trust Theatre: a full-screen overlay that makes Baobab's sovereignty
// pitch tactile — "your data lives in {colo}", an Africa map with the
// active POP pulsing, an inventory of what's stored on the server, and a
// one-click "Export everything as JSON" button. Every other browser
// makes vague privacy claims. This screen shows you the actual surface
// area and lets you walk away with it.

function LeafGlyph({ pulsing, size = 14 }: { pulsing: boolean; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 12 12"
      aria-hidden
      style={
        pulsing
          ? { animation: 'baobab-leaf-pulse 2.4s ease-in-out infinite', color: 'var(--sovereignty-ok)' }
          : { color: 'var(--sovereignty-warn)' }
      }
    >
      <path
        d="M 6 1 C 9 2, 11 4.5, 11 7 C 11 9.5, 9 11, 6 11 C 3 11, 1 9.5, 1 7 C 1 4.5, 3 2, 6 1 Z"
        fill="currentColor"
        opacity="0.85"
      />
      <path d="M 6 2 V 10" stroke="var(--canvas)" strokeWidth="0.8" opacity="0.4" />
    </svg>
  )
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function InventoryCard({ value, label }: { value: string; label: string }) {
  return (
    <div
      style={{
        background: 'var(--surface-1)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: '20px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        minHeight: 96,
      }}
    >
      <div
        data-testid="inventory-card-value"
        style={{
          fontFamily: 'var(--font-default)',
          fontSize: 30,
          fontWeight: 500,
          color: 'var(--text-primary)',
          lineHeight: 1.1,
          letterSpacing: '-0.01em',
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </div>
    </div>
  )
}

export function SovereigntyDashboard() {
  const { t } = useTranslation()
  const open = useSovereigntyDashboardStore((s) => s.open)
  const close = useSovereigntyDashboardStore((s) => s.close)
  const residency = useSovereigntyStore((s) => s.residency)
  const user = useAuthStore((s) => s.user)
  const openSignIn = useAuthStore((s) => s.openSignIn)
  const inventory = useInventoryStore((s) => s.inventory)
  const loading = useInventoryStore((s) => s.loading)
  const fetchInventory = useInventoryStore((s) => s.fetchInventory)
  const exportAll = useInventoryStore((s) => s.exportAll)

  // Refresh on open; the inventory is cheap and the user expects fresh
  // numbers when they re-enter the dashboard after adding bookmarks.
  useEffect(() => {
    if (open) void fetchInventory()
  }, [open, fetchInventory])

  if (!open) return null

  const isHome = residency.region === 'africa'
  const coloDisplay = residency.colo === 'unknown' ? '—' : residency.colo

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('sovereignty.dashboardTitle')}
      style={{
        position: 'absolute',
        inset: 0,
        background: 'var(--canvas)',
        zIndex: 32,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 16,
          borderBottom: '1px solid var(--border)',
        }}
      >
        <h1
          style={{
            margin: 0,
            fontFamily: 'var(--font-default)',
            fontSize: 22,
            color: 'var(--text-primary)',
          }}
        >
          {t('sovereignty.dashboardTitle')}
        </h1>
        <IconButton aria-label={t('settings.closeLabel')} onClick={close}>
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
            <path d="M3 3 L11 11 M11 3 L3 11" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </IconButton>
      </header>

      <div
        className="baobab-scroll"
        style={{
          flex: 1,
          overflow: 'auto',
          padding: '40px 24px 80px',
          width: '100%',
          maxWidth: 920,
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 40,
        }}
      >
        {/* Hero — large Fraunces colo name with a pulsing leaf next to it. */}
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 14, color: 'var(--text-secondary)', letterSpacing: '0.04em' }}>
            {t('sovereignty.dataLivesIn')}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <h2
              data-testid="sovereignty-colo"
              style={{
                margin: 0,
                fontFamily: 'var(--font-display)',
                fontSize: 88,
                fontWeight: 400,
                color: 'var(--text-primary)',
                letterSpacing: '-0.02em',
                lineHeight: 1,
              }}
            >
              {coloDisplay}
            </h2>
            <LeafGlyph pulsing={isHome} size={20} />
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            {residency.dataResidency || ' '}
          </div>
        </div>

        {/* Map */}
        <AfricaMap highlight={residency.colo} width={520} height={520} />

        {/* Inventory grid. If no inventory yet (loading / unauth) we
            still render placeholders so the layout doesn't jump. */}
        {!user ? (
          <div
            style={{
              border: '1px solid var(--border)',
              borderRadius: 12,
              padding: 20,
              maxWidth: 480,
              textAlign: 'center',
              color: 'var(--text-secondary)',
            }}
          >
            Sign in to see your data inventory.
            <div style={{ marginTop: 12 }}>
              <Button onClick={() => { close(); openSignIn() }}>{t('settings.signIn')}</Button>
            </div>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
              gap: 16,
              width: '100%',
              maxWidth: 720,
            }}
          >
            <InventoryCard
              value={loading && !inventory ? '—' : String(inventory?.bookmarks ?? 0)}
              label={t('sovereignty.inventory.bookmarks')}
            />
            <InventoryCard
              value={loading && !inventory ? '—' : String(inventory?.history ?? 0)}
              label={t('sovereignty.inventory.history')}
            />
            <InventoryCard
              value={loading && !inventory ? '—' : String(inventory?.offline_articles ?? 0)}
              label={t('sovereignty.inventory.offlineArticles')}
            />
            <InventoryCard
              value={loading && !inventory ? '—' : formatBytes(inventory?.offline_bytes ?? 0)}
              label={t('sovereignty.inventory.totalBytes')}
            />
          </div>
        )}

        {/* Export — only useful when signed in, but we still render the
            button when anon and route to sign-in on click (consistent
            with the bookmarks "save to sync" flow). */}
        <Button
          variant="primary"
          onClick={() => void exportAll()}
          style={{ marginTop: 8 }}
          data-testid="sovereignty-export"
        >
          {t('sovereignty.exportAll')}
        </Button>

        <p
          style={{
            margin: 0,
            maxWidth: 560,
            textAlign: 'center',
            fontSize: 12,
            color: 'var(--text-muted)',
            lineHeight: 1.6,
          }}
        >
          {t('sovereignty.footnote')}
        </p>
      </div>
    </div>
  )
}
