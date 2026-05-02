import type { OtpProvider } from './types'

export function termii(opts: { apiKey: string; from: string }): OtpProvider {
  return {
    name: 'termii',
    async send(phone, message) {
      const res = await fetch('https://api.ng.termii.com/api/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: phone.replace(/^\+/, ''),
          from: opts.from,
          sms: message,
          type: 'plain',
          channel: 'generic',
          api_key: opts.apiKey,
        }),
      })
      if (!res.ok) return { ok: false, error: `Termii ${res.status}` }
      const json = await res.json() as { message_id?: string; code?: string }
      return json.code === 'ok' ? { ok: true, ref: json.message_id } : { ok: false, error: json.code ?? 'unknown' }
    },
  }
}
