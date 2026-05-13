import { client } from '~/auth/api'

export interface TranslateResponse {
  translatedText: string
  detectedSourceLang: string
  model: 'm2m100' | 'llama'
}

export interface TranslateRequest {
  text: string
  sourceLang?: string
  targetLang: string
}

export async function translateText(req: TranslateRequest): Promise<TranslateResponse> {
  return client.postJson<TranslateResponse>('/api/translate', req)
}
