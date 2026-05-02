import type { Env } from '../../types'
import type { OtpProvider } from './types'
import { africasTalking } from './africastalking'
import { termii } from './termii'
import { twilio } from './twilio'

function countryFromE164(phone: string): string {
  // simple table — extend as needed.
  if (phone.startsWith('+234')) return 'NG'
  if (phone.startsWith('+233')) return 'GH'
  if (phone.startsWith('+254')) return 'KE'
  if (phone.startsWith('+27'))  return 'ZA'
  if (phone.startsWith('+256')) return 'UG'
  if (phone.startsWith('+255')) return 'TZ'
  if (phone.startsWith('+250')) return 'RW'
  return 'XX'
}

export function selectProviders(env: Env, phone: string): OtpProvider[] {
  const country = countryFromE164(phone)
  const providers: OtpProvider[] = []

  // Termii is Nigeria-first; prefer it for NG.
  if (country === 'NG' && env.OTP_TERMII_KEY && env.OTP_TERMII_FROM) {
    providers.push(termii({ apiKey: env.OTP_TERMII_KEY, from: env.OTP_TERMII_FROM }))
  }
  if (env.OTP_AFRICASTALKING_KEY && env.OTP_AFRICASTALKING_USERNAME) {
    providers.push(africasTalking({ apiKey: env.OTP_AFRICASTALKING_KEY, username: env.OTP_AFRICASTALKING_USERNAME }))
  }
  if (env.OTP_TWILIO_SID && env.OTP_TWILIO_TOKEN && env.OTP_TWILIO_FROM) {
    providers.push(twilio({ sid: env.OTP_TWILIO_SID, token: env.OTP_TWILIO_TOKEN, from: env.OTP_TWILIO_FROM }))
  }

  return providers
}
