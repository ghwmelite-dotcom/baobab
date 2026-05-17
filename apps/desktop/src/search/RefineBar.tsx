import { useState } from 'react'
import { useSearchData } from './useSearchData'

export function RefineBar() {
  const [text, setText] = useState('')
  const refine = useSearchData((s) => s.refine)

  const submit = async () => {
    if (!text.trim()) return
    const q = text.trim()
    setText('')
    window.history.pushState(
      null,
      '',
      `${window.location.pathname}?q=${encodeURIComponent(q)}`,
    )
    await refine(q)
  }

  return (
    <div
      style={{
        position: 'sticky',
        bottom: 16,
        margin: '32px auto 0',
        maxWidth: 720,
        background: '#3c1810',
        borderRadius: 999,
        padding: '6px 6px 6px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        boxShadow: '0 8px 32px rgba(60, 24, 16, 0.18)',
      }}
    >
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            void submit()
          }
        }}
        placeholder="Ask a follow-up — refine your search"
        aria-label="Refine search"
        style={{
          flex: 1,
          background: 'transparent',
          border: 'none',
          outline: 'none',
          color: '#f4d8a8',
          fontSize: 13.5,
          padding: '8px 0',
        }}
      />
      <button
        type="button"
        onClick={() => void submit()}
        disabled={!text.trim()}
        style={{
          height: 34,
          padding: '0 18px',
          background: '#d97706',
          color: '#15110d',
          border: 'none',
          borderRadius: 999,
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        Refine →
      </button>
    </div>
  )
}
