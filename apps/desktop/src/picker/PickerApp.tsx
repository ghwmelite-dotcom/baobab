import { useEffect, useState } from 'react'
import { GroveTree } from './GroveTree'
import { ProfileGrid } from './ProfileGrid'
import { NewProfileSheet } from './NewProfileSheet'
import { UnlockSheet } from './UnlockSheet'
import { ChangePinSheet } from './ChangePinSheet'
import { RenameSheet } from './RenameSheet'
import { ConfirmDeleteSheet } from './ConfirmDeleteSheet'
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
    <div style={{
      position: 'relative',
      height: '100vh',
      overflow: 'hidden',
      background: 'linear-gradient(180deg, #fde7c4 0%, #f4b878 30%, #d97a3a 65%, #6b2814 100%)',
    }}>
      <div style={{
        height: '100%',
        overflowY: 'auto',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '56px 32px 88px',
      }}>
        <GroveTree size={108} />
        <h1 style={{ color: '#3c1810', fontSize: 28, margin: '20px 0 6px', letterSpacing: '-0.01em' }}>Who's using Baobab?</h1>
        <p style={{ color: 'rgba(60,24,16,0.7)', fontSize: 14, margin: 0 }}>
          {profiles.length} {profiles.length === 1 ? 'profile' : 'profiles'} in this grove
        </p>
        <div style={{ marginTop: 40 }}>
          <ProfileGrid
            profiles={profiles}
            onSelect={(id) => void select(id)}
            onRename={(id) => setRenameTarget(id)}
            onDelete={(id) => setDeleteTarget(id)}
            onAdd={() => setSheetOpen(true)}
            onGuest={() => void openGuest()}
            onSetPin={(id) => setPinSheet({ mode: 'set', profileId: id })}
            onChangePin={(id) => setPinSheet({ mode: 'change', profileId: id })}
            onRemovePin={(id) => setPinSheet({ mode: 'remove', profileId: id })}
          />
        </div>
      </div>
      <label style={{
        position: 'absolute', bottom: 18, left: 24,
        color: 'rgba(255,250,240,0.95)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8,
        pointerEvents: 'auto',
      }}>
        <input
          type="checkbox"
          checked={showOnStartup}
          onChange={(e) => void toggleShow(e.target.checked)}
          aria-label="Show on startup"
        />
        Show on startup
      </label>
      {error && <div role="alert" style={{ position: 'absolute', bottom: 18, right: 24, color: '#fff8ee', fontSize: 13 }}>{error}</div>}
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
