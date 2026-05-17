import { useEffect, useState } from 'react'
import { GroveTree } from './GroveTree'
import { ProfileGrid } from './ProfileGrid'
import { NewProfileSheet } from './NewProfileSheet'
import { UnlockSheet } from './UnlockSheet'
import { ChangePinSheet } from './ChangePinSheet'
import { RenameSheet } from './RenameSheet'
import { ConfirmDeleteSheet } from './ConfirmDeleteSheet'
import { PickerControls } from './PickerControls'
import { PickerDecorations } from './PickerDecorations'
import { usePickerData } from './usePickerData'

const SERIF_STACK = "'Iowan Old Style', 'Palatino Linotype', 'Hoefler Text', Georgia, 'Times New Roman', serif"

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
      data-baobab-surface="grove"
      style={{
        position: 'relative',
        height: '100vh',
        overflow: 'hidden',
        background: 'linear-gradient(180deg, var(--grove-sky-dawn, #fde7c4) 0%, var(--grove-sky-ember, #f4b878) 28%, var(--grove-sky-flame, #d97a3a) 60%, var(--grove-sky-dusk, #8a3815) 92%, var(--grove-sky-night, #4a1e0a) 100%)',
        fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
        userSelect: 'none',
      }}
    >
      <style>{`
        @keyframes bb-fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes bb-tree-in { from { opacity: 0; transform: translateY(-16px) scale(0.96); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes bb-text-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes bb-tile-in { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes bb-sway { 0%, 100% { transform: rotate(-1.4deg); } 50% { transform: rotate(1.4deg); } }
        @keyframes bb-glow { 0%, 100% { opacity: 0.35; } 50% { opacity: 0.55; } }

        .bb-deco { animation: bb-fade-in 800ms ease 100ms both; }
        .bb-tree { animation: bb-tree-in 700ms cubic-bezier(0.16, 0.85, 0.45, 1) both, bb-sway 5.4s ease-in-out 700ms infinite; transform-origin: 50% 100%; }
        .bb-title { animation: bb-text-in 600ms ease 250ms both; }
        .bb-subtitle { animation: bb-text-in 600ms ease 350ms both; }
        .bb-grid-wrap { animation: bb-fade-in 500ms ease 450ms both; }
        .bb-footer-l { animation: bb-text-in 500ms ease 600ms both; }
        .bb-footer-r { animation: bb-text-in 500ms ease 650ms both; }

        @media (prefers-reduced-motion: reduce) {
          .bb-deco, .bb-tree, .bb-title, .bb-subtitle, .bb-grid-wrap, .bb-footer-l, .bb-footer-r {
            animation: none !important;
          }
        }
      `}</style>

      <div className="bb-deco">
        <PickerDecorations />
      </div>

      <PickerControls />

      <div
        data-tauri-drag-region
        style={{
          height: '100%',
          overflowY: 'auto',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          padding: '48px 32px 96px',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <div className="bb-tree">
          <GroveTree size={120} />
        </div>
        <h1
          data-tauri-drag-region
          className="bb-title"
          style={{
            color: 'var(--grove-text-primary)',
            fontFamily: SERIF_STACK,
            fontSize: 32,
            fontWeight: 600,
            margin: '20px 0 8px',
            letterSpacing: '-0.02em',
            lineHeight: 1.1,
          }}
        >
          Who's using Baobab?
        </h1>
        <p
          data-tauri-drag-region
          className="bb-subtitle"
          style={{
            color: 'var(--grove-text-secondary)',
            fontSize: 14,
            margin: 0,
            letterSpacing: '0.01em',
          }}
        >
          {profiles.length} {profiles.length === 1 ? 'profile' : 'profiles'} in this grove
        </p>
        <div data-tauri-drag-region="false" className="bb-grid-wrap" style={{ marginTop: 36 }}>
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
        className="bb-footer-l"
        style={{
          position: 'absolute', bottom: 20, left: 28,
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '9px 18px 9px 12px',
          background: 'var(--grove-pill-bg)',
          color: 'var(--grove-text-primary)',
          border: '1.5px solid var(--grove-pill-border)',
          borderRadius: 999,
          cursor: 'pointer',
          fontSize: 13, fontWeight: 600,
          boxShadow: '0 3px 10px var(--grove-pill-shadow)',
          backdropFilter: 'blur(6px)',
          transition: 'background 160ms ease, transform 160ms ease, box-shadow 160ms ease',
          zIndex: 2,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--grove-pill-bg-hover)'
          e.currentTarget.style.transform = 'translateY(-2px)'
          e.currentTarget.style.boxShadow = '0 6px 16px var(--grove-pill-shadow-hover)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'var(--grove-pill-bg)'
          e.currentTarget.style.transform = 'translateY(0)'
          e.currentTarget.style.boxShadow = '0 3px 10px var(--grove-pill-shadow)'
        }}
      >
        <span aria-hidden style={{
          width: 24, height: 24, borderRadius: '50%',
          background: 'radial-gradient(circle at 30% 30%, var(--grove-avatar-highlight), var(--grove-avatar-shadow))',
          color: 'var(--grove-avatar-text)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, fontWeight: 700,
          border: '1.5px solid var(--grove-avatar-ring)',
        }}>G</span>
        Guest mode
      </button>

      <label
        data-tauri-drag-region="false"
        className="bb-footer-r"
        style={{
          position: 'absolute', bottom: 22, right: 28,
          color: 'var(--grove-text-on-dusk)', fontSize: 13, fontWeight: 500,
          display: 'flex', alignItems: 'center', gap: 8,
          textShadow: '0 1px 2px var(--grove-pill-text-shadow)',
          zIndex: 2,
        }}
      >
        <input
          type="checkbox"
          data-tauri-drag-region="false"
          checked={showOnStartup}
          onChange={(e) => void toggleShow(e.target.checked)}
          aria-label="Show on startup"
          style={{ accentColor: 'var(--grove-text-primary)', cursor: 'pointer' }}
        />
        Show on startup
      </label>
      {error && (
        <div
          role="alert"
          data-tauri-drag-region="false"
          style={{
            position: 'absolute', top: 50, left: '50%', transform: 'translateX(-50%)',
            color: 'var(--critical)', fontSize: 13, background: 'var(--grove-toast-bg)',
            padding: '6px 14px', borderRadius: 8, boxShadow: '0 4px 12px var(--grove-error-shadow)',
            zIndex: 30,
          }}
        >
          {error}
        </div>
      )}
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
