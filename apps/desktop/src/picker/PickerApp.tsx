import { useEffect, useState } from 'react'
import { GroveTree } from './GroveTree'
import { ProfileGrid } from './ProfileGrid'
import { NewProfileSheet } from './NewProfileSheet'
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

  const [sheetOpen, setSheetOpen] = useState(false)

  useEffect(() => { void hydrate() }, [hydrate])

  async function handleRename(id: string) {
    const p = profiles.find((x) => x.id === id); if (!p) return
    const next = window.prompt('Rename profile', p.name)
    if (next && next.trim()) await renameAction(id, next.trim())
  }
  async function handleDelete(id: string) {
    const p = profiles.find((x) => x.id === id); if (!p) return
    if (window.confirm(`Delete profile "${p.name}"? This wipes its data.`)) await deleteAction(id)
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #fde7c4 0%, #f4b878 30%, #d97a3a 65%, #6b2814 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '48px 24px 24px',
    }}>
      <GroveTree size={96} />
      <h1 style={{ color: '#3c1810', fontSize: 24, margin: '16px 0 4px' }}>Who's using Baobab?</h1>
      <p style={{ color: 'rgba(60,24,16,0.7)', fontSize: 13, margin: 0 }}>
        {profiles.length} {profiles.length === 1 ? 'profile' : 'profiles'} in this grove
      </p>
      <div style={{ marginTop: 32 }}>
        <ProfileGrid
          profiles={profiles}
          onSelect={(id) => void select(id)}
          onRename={handleRename}
          onDelete={handleDelete}
          onAdd={() => setSheetOpen(true)}
          onGuest={() => void openGuest()}
        />
      </div>
      <label style={{
        position: 'absolute', bottom: 16, left: 16,
        color: 'rgba(255,250,240,0.95)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <input
          type="checkbox"
          checked={showOnStartup}
          onChange={(e) => void toggleShow(e.target.checked)}
          aria-label="Show on startup"
        />
        Show on startup
      </label>
      {error && <div role="alert" style={{ position: 'absolute', bottom: 16, right: 16, color: '#fff8ee' }}>{error}</div>}
      <NewProfileSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onCreate={(name, color) => create(name, color)}
      />
    </div>
  )
}
