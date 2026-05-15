import { useEffect, useState } from 'react'
import { GroveTree } from './GroveTree'
import { ProfileGrid } from './ProfileGrid'
import { NewProfileSheet } from './NewProfileSheet'
import { UnlockSheet } from './UnlockSheet'
import { ChangePinSheet } from './ChangePinSheet'
import { RenameSheet } from './RenameSheet'
import { ConfirmDeleteSheet } from './ConfirmDeleteSheet'
import { PickerControls } from './PickerControls'
import { usePickerData } from './usePickerData'

export function PickerApp() {
  const profiles = usePickerData((s) => s.profiles)
  const showOnStartup = usePickerData((s) => s.showOnStartup)
  const error = usePickerData((s) => s.error)
  const hydrate = usePickerData((s) => s.hydrate)
  const create = usePickerData((s) => s.create)
  const renameAction = usePickerData((s) => s.rename)
  const deleteAction = usePickerData((s) => s.delete)
  const toggleShow = usePickerData((s) => s.toggleShowOnStartup)
  const select = usePickerData((s) => s.select)
  const openGuest = usePickerData((s) => s.openGuest)
  const unlockTarget = usePickerData((s) => s.unlockTarget)
  const clearUnlockTarget = usePickerData((s) => s.clearUnlockTarget)

  const setPin = usePickerData((s) => s.setPin)
  const removePin = usePickerData((s) => s.removePin)

  const [sheetOpen, setSheetOpen] = useState(false)
  const [pinSheet, setPinSheet] = useState<{ mode: 'set' | 'change' | 'remove'; profileId: string } | null>(null)
  const [renameTarget, setRenameTarget] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  useEffect(() => { void hydrate() }, [hydrate])

  const unlockingProfile = profiles.find((p) => p.id === unlockTarget) ?? null
  const pinSheetProfile = pinSheet ? profiles.find((p) => p.id === pinSheet.profileId) ?? null : null
  const renameProfile = renameTarget ? profiles.find((p) => p.id === renameTarget) ?? null : null
  const deleteProfile = deleteTarget ? profiles.find((p) => p.id === deleteTarget) ?? null : null

  return (
    <div
      data-tauri-drag-region
      style={{
        position: 'relative',
        height: '100vh',
        overflow: 'hidden',
        background: 'linear-gradient(180deg, #fde7c4 0%, #f4b878 30%, #d97a3a 65%, #6b2814 100%)',
      }}
    >
      <PickerControls />
      <div
        data-tauri-drag-region
        style={{
          height: '100%',
          overflowY: 'auto',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          padding: '52px 32px 88px',
        }}
      >
        <GroveTree size={108} />
        <h1 data-tauri-drag-region style={{ color: '#3c1810', fontSize: 28, margin: '20px 0 6px', letterSpacing: '-0.01em' }}>Who's using Baobab?</h1>
        <p data-tauri-drag-region style={{ color: 'rgba(60,24,16,0.7)', fontSize: 14, margin: 0 }}>
          {profiles.length} {profiles.length === 1 ? 'profile' : 'profiles'} in this grove
        </p>
        <div data-tauri-drag-region="false" style={{ marginTop: 40 }}>
          <ProfileGrid
            profiles={profiles}
            onSelect={(id) => void select(id)}
            onRename={(id) => setRenameTarget(id)}
            onDelete={(id) => setDeleteTarget(id)}
            onAdd={() => setSheetOpen(true)}
            onSetPin={(id) => setPinSheet({ mode: 'set', profileId: id })}
            onChangePin={(id) => setPinSheet({ mode: 'change', profileId: id })}
            onRemovePin={(id) => setPinSheet({ mode: 'remove', profileId: id })}
          />
        </div>
      </div>

      <button
        type="button"
        data-tauri-drag-region="false"
        aria-label="Open guest window"
        onClick={() => void openGuest()}
        style={{
          position: 'absolute', bottom: 18, left: 24,
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 16px 8px 12px',
          background: 'rgba(255,250,240,0.92)',
          color: '#3c1810',
          border: '1.5px solid rgba(60,30,15,0.15)',
          borderRadius: 999,
          cursor: 'pointer',
          fontSize: 13, fontWeight: 600,
          boxShadow: '0 2px 8px rgba(60,20,10,0.18)',
          transition: 'background 120ms ease, transform 120ms ease',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,1)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,250,240,0.92)'; e.currentTarget.style.transform = 'translateY(0)' }}
      >
        <span aria-hidden style={{
          width: 22, height: 22, borderRadius: '50%',
          background: 'radial-gradient(circle at 30% 30%, #c0b5a0, #6a5a48)',
          color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 700,
        }}>G</span>
        Guest mode
      </button>

      <label
        data-tauri-drag-region="false"
        style={{
          position: 'absolute', bottom: 18, right: 24,
          color: 'rgba(255,250,240,0.95)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8,
        }}
      >
        <input
          type="checkbox"
          data-tauri-drag-region="false"
          checked={showOnStartup}
          onChange={(e) => void toggleShow(e.target.checked)}
          aria-label="Show on startup"
        />
        Show on startup
      </label>
      {error && <div role="alert" data-tauri-drag-region="false" style={{ position: 'absolute', top: 44, left: '50%', transform: 'translateX(-50%)', color: '#a23a1f', fontSize: 13, background: 'rgba(255,250,240,0.95)', padding: '6px 12px', borderRadius: 6 }}>{error}</div>}
      <NewProfileSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onCreate={(name, color, pin) => create(name, color, pin)}
      />
      <UnlockSheet open={!!unlockTarget} profile={unlockingProfile} onClose={clearUnlockTarget} />
      <ChangePinSheet
        open={!!pinSheet}
        mode={pinSheet?.mode ?? 'set'}
        profile={pinSheetProfile}
        onClose={() => setPinSheet(null)}
        onSetPin={setPin}
        onRemovePin={removePin}
      />
      <RenameSheet
        open={!!renameTarget}
        profile={renameProfile}
        onClose={() => setRenameTarget(null)}
        onRename={renameAction}
      />
      <ConfirmDeleteSheet
        open={!!deleteTarget}
        profile={deleteProfile}
        onClose={() => setDeleteTarget(null)}
        onDelete={deleteAction}
      />
    </div>
  )
}
