import type { OtpProvider } from './types'

export function twilio(opts: { sid: string; token: string; from: string }): OtpProvider {
  return {
    name: 'twilio',
    async send(phone, message) {
      const auth = btoa(`${opts.sid}:${opts.token}`)
      const body = new URLSearchParams({ To: phone, From: opts.from, Body: message })
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${opts.sid}/Messages.json`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
      })
      if (!res.ok) return { ok: false, error: `Twilio ${res.status}` }
      const json = await res.json() as { sid?: string; status?: string }
      return { ok: !!json.sid, ref: json.sid }
    },
  }
}
