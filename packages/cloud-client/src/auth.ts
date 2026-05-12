import type { BaobabClient } from './client'

export interface AuthResponse {
  access: string
  refresh: string
}

export interface RefreshResponse {
  access: string
}

export interface MeResponse {
  id: string
  email: string | null
  phone: string | null
  privacy_mode: number
  low_bandwidth_mode: number
  default_model: string
}

export interface AppSettingsPatch {
  privacy_mode?: number
  low_bandwidth_mode?: number
  default_model?: string
}

export class AuthClient {
  constructor(private readonly client: BaobabClient) {}

  signupEmail(email: string, password: string): Promise<AuthResponse> {
    return this.client.postJson('/api/auth/signup', { email, password })
  }
  loginEmail(email: string, password: string): Promise<AuthResponse> {
    return this.client.postJson('/api/auth/login', { email, password })
  }
  signupPhone(phone: string, password: string): Promise<AuthResponse> {
    return this.client.postJson('/api/auth/signup', { phone, password })
  }
  loginPhone(phone: string, password: string): Promise<AuthResponse> {
    return this.client.postJson('/api/auth/login', { phone, password })
  }
  refresh(refreshToken: string): Promise<RefreshResponse> {
    return this.client.postJson('/api/auth/refresh', { refresh: refreshToken })
  }
  logout(): Promise<{ ok: true }> {
    return this.client.postJson('/api/auth/logout', {})
  }
  otpSend(phone: string, channel: 'sms' | 'voice' = 'sms'): Promise<{ ok: true }> {
    return this.client.postJson('/api/auth/otp/send', { phone, channel })
  }
  otpVerify(phone: string, code: string): Promise<AuthResponse> {
    return this.client.postJson('/api/auth/otp/verify', { phone, code })
  }
  me(): Promise<MeResponse> {
    return this.client.getJson('/api/auth/me')
  }
  async updateSettings(patch: AppSettingsPatch): Promise<{ ok: true }> {
    const r = await this.client.request('/api/auth/settings', {
      method: 'PUT',
      body: JSON.stringify(patch),
    })
    if (!r.ok) throw new Error(`${r.status}`)
    return (await r.json()) as { ok: true }
  }
}
