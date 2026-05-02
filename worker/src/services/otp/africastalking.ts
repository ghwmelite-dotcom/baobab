import type { OtpProvider } from './types'

export function africasTalking(opts: { username: string; apiKey: string }): OtpProvider {
  return {
    name: 'africastalking',
    async send(phone, message) {
      const body = new URLSearchParams({ username: opts.username, to: phone, message })
      const res = await fetch('https://api.africastalking.com/version1/messaging', {
        method: 'POST',
        headers: {
          apiKey: opts.apiKey,
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body,
      })
      if (!res.ok) return { ok: false, error: `AT ${res.status}` }
      const json = await res.json() as { SMSMessageData?: { Recipients?: Array<{ messageId: string; status: string }> } }
      const r = json.SMSMessageData?.Recipients?.[0]
      return r?.status === 'Success' ? { ok: true, ref: r.messageId } : { ok: false, error: r?.status ?? 'unknown' }
    },
  }
}
