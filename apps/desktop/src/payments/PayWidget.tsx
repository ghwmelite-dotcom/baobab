import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, IconButton, Input } from '@baobab/ui'
import { useAuthStore } from '~/auth/auth.store'
import { useTabsStore } from '~/state/tabs.store'
import { usePaymentsStore } from './payments.store'

// Currencies we surface in the demo. Order matters — GHS is the alpha
// default (Baobab's home market) and shows first in the picker.
const CURRENCIES = ['GHS', 'NGN', 'KES', 'ZAR', 'USD'] as const
type Currency = (typeof CURRENCIES)[number]

const MIN_AMOUNT = 1
const MAX_AMOUNT = 1_000_000

export function PayWidget() {
  const { t } = useTranslation()
  const open = usePaymentsStore((s) => s.widgetOpen)
  const close = usePaymentsStore((s) => s.closeWidget)
  const loading = usePaymentsStore((s) => s.loading)
  const error = usePaymentsStore((s) => s.error)
  const unconfigured = usePaymentsStore((s) => s.unconfigured)
  const createIntent = usePaymentsStore((s) => s.createIntent)

  // Form state — kept local so we don't pollute the store with input ticks.
  const prefillEmail = useMemo(() => useAuthStore.getState().user?.email ?? '', [])
  const [amount, setAmount] = useState<string>('500')
  const [currency, setCurrency] = useState<Currency>('GHS')
  const [email, setEmail] = useState<string>(prefillEmail)
  const [name, setName] = useState<string>('')

  // Esc closes the widget — payments are opt-in, never a wall.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, close])

  // When the modal opens, refresh the email prefill from the latest auth
  // state so re-opening after a sign-in catches the user's address.
  useEffect(() => {
    if (open) {
      const u = useAuthStore.getState().user
      if (u?.email && !email) setEmail(u.email)
    }
    // We intentionally only react to `open` — the user is free to overwrite
    // the prefilled email and we don't want subsequent re-renders to clobber
    // their edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  if (!open) return null

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const amountNum = Number(amount)
    if (!Number.isFinite(amountNum) || amountNum < MIN_AMOUNT || amountNum > MAX_AMOUNT) return
    if (!email) return
    const intent = await createIntent({
      amount: amountNum,
      currency,
      customer_email: email,
      customer_name: name.trim() || undefined,
    })
    if (intent?.checkoutUrl) {
      void useTabsStore.getState().openTab(intent.checkoutUrl)
      // Leave the widget open so the user sees the success state; they can
      // dismiss it themselves. The new tab takes focus for them.
    }
  }

  const amountInvalid = (() => {
    const n = Number(amount)
    return !Number.isFinite(n) || n < MIN_AMOUNT || n > MAX_AMOUNT
  })()

  return (
    <div
      role="presentation"
      onClick={close}
      style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(11, 9, 7, 0.55)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        zIndex: 36,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        animation: 'baobab-fade-in 180ms ease forwards',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('payments.title')}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 440,
          background: 'var(--surface-1)',
          border: '1px solid var(--border)',
          borderRadius: 18,
          padding: '32px 32px 24px',
          color: 'var(--text-primary)',
          boxShadow: '0 24px 64px -16px rgba(0, 0, 0, 0.5)',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          animation: 'baobab-fade-in-up 240ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
        }}
      >
        <IconButton
          aria-label={t('payments.closeLabel')}
          onClick={close}
          style={{ position: 'absolute', top: 12, right: 12 }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
            <path d="M3 3 L11 11 M11 3 L3 11" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </IconButton>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
          <h1
            style={{
              fontFamily: 'var(--font-default)',
              fontSize: 26,
              margin: 0,
              fontWeight: 600,
              letterSpacing: '-0.01em',
            }}
          >
            {t('payments.title')}
          </h1>
          <p
            style={{
              margin: 0,
              color: 'var(--text-secondary)',
              fontSize: 13,
              lineHeight: 1.5,
            }}
          >
            {t('payments.subtitle')}
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 4 }}
        >
          <div style={{ display: 'flex', gap: 12 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                {t('payments.amount')}
              </span>
              <Input
                type="number"
                inputMode="numeric"
                min={MIN_AMOUNT}
                max={MAX_AMOUNT}
                step="1"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                aria-invalid={amountInvalid ? true : undefined}
              />
            </label>
            <label
              style={{ display: 'flex', flexDirection: 'column', gap: 4, width: 110 }}
            >
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                {t('payments.currency')}
              </span>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as Currency)}
                style={{
                  height: 36,
                  padding: '0 10px',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  background: 'var(--surface-1)',
                  color: 'var(--text-primary)',
                  fontSize: 14,
                  fontFamily: 'var(--font-default)',
                  cursor: 'pointer',
                }}
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              {t('payments.email')}
            </span>
            <Input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              {t('payments.name')}
            </span>
            <Input
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>

          {unconfigured ? (
            <div
              role="status"
              style={{
                fontSize: 12.5,
                lineHeight: 1.5,
                padding: 12,
                borderRadius: 10,
                background: 'var(--accent-dim)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-accent)',
              }}
            >
              {t('payments.unconfigured')}
            </div>
          ) : null}

          {error ? (
            <div style={{ color: 'var(--critical, #e85d75)', fontSize: 12 }}>{error}</div>
          ) : null}

          <Button
            type="submit"
            loading={loading}
            disabled={loading || amountInvalid || !email}
          >
            {loading ? t('payments.creating') : t('payments.payNow')}
          </Button>
        </form>
      </div>
    </div>
  )
}
