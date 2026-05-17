import { useEffect, type ReactNode } from 'react'
import { useAuthStore } from './auth.store'

export function AuthGate({ children }: { children: ReactNode }) {
  const hydrate = useAuthStore((s) => s.hydrate)
  useEffect(() => {
    void hydrate()
  }, [hydrate])
  return <>{children}</>
}
