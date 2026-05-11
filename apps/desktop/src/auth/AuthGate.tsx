import { useEffect, type ReactNode } from 'react'
import { useAuthStore } from './auth.store'
import { AuthScreen } from './AuthScreen'

export function AuthGate({ children }: { children: ReactNode }) {
  const status = useAuthStore((s) => s.status)
  const hydrate = useAuthStore((s) => s.hydrate)
  useEffect(() => {
    void hydrate()
  }, [hydrate])

  if (status === 'authed') return <>{children}</>
  return <AuthScreen />
}
