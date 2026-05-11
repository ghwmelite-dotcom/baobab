import { AuthClient, BaobabClient } from '@baobab/cloud-client'

const baseUrl = import.meta.env.VITE_BAOBAB_API_URL ?? 'https://baobab-api.ohcsghana-main.workers.dev'

export const client: BaobabClient = new BaobabClient({
  baseUrl,
  onUnauthorized: async (): Promise<string | null> => {
    const { useAuthStore } = await import('./auth.store')
    const { persistence } = await import('~/state/persistence')
    const refreshToken = useAuthStore.getState().refreshToken
    if (!refreshToken) return null
    try {
      const r = await authClient.refresh(refreshToken)
      useAuthStore.setState({ accessToken: r.access })
      await persistence.set('auth.accessToken', r.access)
      return r.access
    } catch {
      return null
    }
  },
})

export const authClient: AuthClient = new AuthClient(client)
