import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { profileApi, type Profile } from './profile.api'
import { useAuthStore } from '~/auth/auth.store'
import { useTabsStore } from '~/state/tabs.store'
import { migrateLegacyAuthKeys } from './migrateLegacyKeys'

const ProfileContext = createContext<Profile | null>(null)

export const GUEST_PROFILE: Profile = {
  id: 'guest',
  name: 'Guest',
  fruitColor: 'baobwhite',
  avatarLetter: 'G',
  createdAt: '',
  lastUsedAt: '',
  cloudLink: null,
  userDataDirName: '',
}

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const id = await profileApi.currentProfileId().catch(() => null)
      if (cancelled || !id) return
      if (id === 'guest') {
        useAuthStore.getState().setProfileId('guest')
        useTabsStore.getState().setProfileId('guest')
        setProfile(GUEST_PROFILE)
        return
      }
      const list = await profileApi.list().catch(() => [])
      if (cancelled) return
      const match = list.find((p) => p.id === id) ?? null
      if (match) {
        useAuthStore.getState().setProfileId(match.id)
        useTabsStore.getState().setProfileId(match.id)
        // Migrate legacy (pre-profile) flat auth keys into the profile namespace
        // before any store hydration fires — must happen after setProfileId so
        // the scoped keys resolve to the correct profile prefix.
        await migrateLegacyAuthKeys(match.id)
      }
      setProfile(match)
    })()
    return () => { cancelled = true }
  }, [])

  return <ProfileContext.Provider value={profile}>{children}</ProfileContext.Provider>
}

export function useProfile(): Profile | null {
  return useContext(ProfileContext)
}
