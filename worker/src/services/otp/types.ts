export interface OtpProvider {
  name: string
  send(phone: string, message: string): Promise<{ ok: boolean; ref?: string; error?: string }>
}
