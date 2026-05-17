import { useEffect, useState } from 'react'
import { useDataStore } from '~/data/data.store'
import { useConnectionStore } from '~/state/connection.store'
import { isWifiOnlySync, setWifiOnlySync } from '~/data/wifiGate'
import { dataApi } from '~/data/data.api'

function formatMb(bytes: number): string {
  return `${Math.round(bytes / (1024 * 1024))} MB`
}

export function DataSection() {
  const budgetMb = useDataStore((s) => s.budgetMb)
  const setBudget = useDataStore((s) => s.setBudget)
  const today = useDataStore((s) => s.today())
  const history = useDataStore((s) => s.history)
  const percent = useDataStore((s) => s.percentUsedToday())
  const override = useConnectionStore((s) => s.slowModeOverride)
  const setOverride = useConnectionStore((s) => s.setOverride)

  const [wifiOnly, setWifiOnlyLocal] = useStateBridged()

  const usedLabel = `${formatMb(today.bytesUsed)} of ${budgetMb} MB`
  const savedLabel = `You've saved ${formatMb(today.bytesSaved)} by blocking ads and lazy loading.`

  return (
    <section style={{ padding: 24, maxWidth: 720 }}>
      <h2 style={{ fontSize: 14, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--text-muted)', margin: 0 }}>
        Data savings
      </h2>

      <div style={{ display: 'flex', alignItems: 'center', gap: 24, margin: '20px 0' }}>
        <Gauge percent={Math.min(100, Math.round(percent))} />
        <div>
          <div style={{ fontSize: 22, fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>
            {usedLabel}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
            {savedLabel}
          </div>
        </div>
      </div>

      <Row label="Daily budget">
        <input
          type="range"
          min={50}
          max={2000}
          step={50}
          value={budgetMb}
          onChange={(e) => setBudget(Number(e.target.value))}
          style={{ width: 240 }}
        />
        <span style={{ minWidth: 80, color: 'var(--text-secondary)', fontSize: 12 }}>{budgetMb} MB</span>
      </Row>

      <Row label="Only sync on Wi-Fi" hint="Defers history, bookmarks, and the daily digest.">
        <input
          type="checkbox"
          checked={wifiOnly}
          onChange={(e) => { setWifiOnlySync(e.target.checked); setWifiOnlyLocal(e.target.checked) }}
        />
      </Row>

      <Row label="Slow mode" hint="Automatic follows your connection. Always-off skips Reader interception entirely.">
        <select
          value={override}
          onChange={(e) => {
            const next = e.target.value as 'auto' | 'always' | 'never'
            setOverride(next)
            void dataApi.setSlowMode(next === 'always')
          }}
          style={{ background: 'var(--surface-1)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', fontSize: 12 }}
        >
          <option value="auto">Automatic</option>
          <option value="always">Always on</option>
          <option value="never">Always off</option>
        </select>
      </Row>

      <Sparkline history={history} />
    </section>
  )
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderTop: '1px solid var(--border)' }}>
      <div>
        <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{label}</div>
        {hint && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{hint}</div>}
      </div>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>{children}</div>
    </div>
  )
}

function Gauge({ percent }: { percent: number }) {
  const r = 36, c = 2 * Math.PI * r
  const dash = (percent / 100) * c
  const color = percent >= 100 ? 'var(--sovereignty-warn)' : percent >= 80 ? '#e88e2a' : 'var(--accent)'
  return (
    <svg width="96" height="96" viewBox="0 0 96 96" aria-hidden>
      <circle cx="48" cy="48" r={r} fill="none" stroke="var(--border)" strokeWidth="8" />
      <circle
        cx="48" cy="48" r={r} fill="none" stroke={color} strokeWidth="8"
        strokeDasharray={`${dash} ${c}`} strokeLinecap="round"
        transform="rotate(-90 48 48)"
      />
      <text x="48" y="54" textAnchor="middle" fontSize="18" fill="var(--text-primary)">{percent}%</text>
    </svg>
  )
}

function Sparkline({ history }: { history: { dateKey: string; bytesUsed: number }[] }) {
  const last7 = history.slice(-7)
  if (last7.length === 0) return null
  const max = Math.max(...last7.map((b) => b.bytesUsed), 1)
  return (
    <div style={{ marginTop: 16, padding: 12, background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>Last 7 days</div>
      <div style={{ display: 'flex', alignItems: 'end', gap: 4, height: 36 }}>
        {last7.map((b) => (
          <div
            key={b.dateKey}
            title={`${b.dateKey}: ${formatMb(b.bytesUsed)}`}
            style={{ width: 14, height: `${(b.bytesUsed / max) * 100}%`, minHeight: 2, background: 'var(--accent)', opacity: 0.75, borderRadius: 2 }}
          />
        ))}
      </div>
    </div>
  )
}

// Local state mirror for wifiGate's module-level flag so the checkbox can be controlled.
function useStateBridged(): [boolean, (b: boolean) => void] {
  const [v, setV] = useState<boolean>(isWifiOnlySync())
  useEffect(() => { setV(isWifiOnlySync()) }, [])
  return [v, setV]
}
