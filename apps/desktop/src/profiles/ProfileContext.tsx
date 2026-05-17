import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'
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
  pinRequired: false,
}

// 3 seconds is comfortably longer than a healthy profile resolve (≈50ms cold)
// but short enough that a user staring at "Loading profile…" doesn't think the
// app is wedged. Past this, surface the recovery UI.
const RESOLVE_TIMEOUT_MS = 3000

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [resolved, setResolved] = useState(false)

  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(() => {
      if (!cancelled) setResolved(true)
    }, RESOLVE_TIMEOUT_MS)

    void (async () => {
      const id = await profileApi.currentProfileId().catch(() => null)
      if (cancelled) return
      if (!id) {
        setResolved(true)
        return
      }
      if (id === 'guest') {
        useAuthStore.getState().setProfileId('guest')
        useTabsStore.getState().setProfileId('guest')
        setProfile(GUEST_PROFILE)
        setResolved(true)
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
      if (cancelled) return
      setProfile(match)
      setResolved(true)
    })()

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [])

  if (!resolved) {
    return (
      <div style={{ padding: 24, color: 'rgba(255,255,255,0.7)' }}>
        Loading profile…
      </div>
    )
  }

  if (!profile) {
    return <ProfileRecovery />
  }

  return <ProfileContext.Provider value={profile}>{children}</ProfileContext.Provider>
}

// Fallback UI shown when the profile resolve times out or returns null.
// Most often hit after WebView2 cache corruption — the IPC bridge never wires
// up, so currentProfileId() hangs forever. Recovery: open the profile picker
// and close this orphaned window.
function ProfileRecovery() {
  const reopenPicker = async () => {
    try {
      await profileApi.openPickerWindow()
      await getCurrentWindow().close()
    } catch {
      // If openPickerWindow itself fails (Tauri IPC broken), at least close
      // this window so the user can relaunch the app cleanly.
      await getCurrentWindow().close().catch(() => undefined)
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        padding: 32,
        background: 'var(--canvas)',
        color: 'var(--text-primary)',
        textAlign: 'center',
        gap: 16,
      }}
    >
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 22 }}>
        Couldn&apos;t load your profile
      </div>
      <div style={{ color: 'var(--text-muted)', fontSize: 13, maxWidth: 420, lineHeight: 1.5 }}>
        The profile context didn&apos;t resolve. This usually clears on a fresh
        launch from the profile picker.
      </div>
      <button
        type="button"
        onClick={() => void reopenPicker()}
        style={{
          marginTop: 8,
          padding: '10px 20px',
          background: 'var(--accent)',
          color: 'var(--canvas)',
          border: 'none',
          borderRadius: 8,
          fontSize: 13,
          fontWeight: 500,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        Open profile picker
      </button>
    </div>
  )
}

export function useProfile(): Profile | null {
  return useContext(ProfileContext)
}
