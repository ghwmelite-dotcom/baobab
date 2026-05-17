import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('~/state/persistence', () => {
  const store = new Map<string, unknown>()
  const profileScoped = () => ({
    get: (k: string) => Promise.resolve(store.get(k)),
    set: (k: string, v: unknown) => { store.set(k, v); return Promise.resolve() },
    delete: (k: string) => { store.delete(k); return Promise.resolve() },
  })
  return { profileScoped, persistence: {} }
})

vi.mock('~/auth/api', () => ({
  authClient: {
    me: vi.fn(async () => ({ id: 'u', email: 'a@b.com', phone: null, display_name: null, privacy_mode: 0, low_bandwidth_mode: 0, default_model: 'x' })),
    loginEmail: vi.fn(async () => ({ access: 'a', refresh: 'r' })),
    logout: vi.fn(async () => ({ ok: true })),
  },
  client: { setAccessToken: vi.fn() },
}))

import { useAuthStore } from '~/auth/auth.store'
import { LanguageSection } from '~/settings/sections/LanguageSection'

beforeEach(() => {
  useAuthStore.setState({ heritageLanguage: null } as never)
  useAuthStore.getState().setProfileId('test-profile')
})

describe('LanguageSection heritage language dropdown', () => {
  it('renders the dropdown with 10 options', () => {
    render(<LanguageSection />)
    const select = screen.getByLabelText(/Heritage language/i) as HTMLSelectElement
    expect(select).toBeInTheDocument()
    expect(select.options.length).toBe(10)  // None + 9 languages
  })

  it('updates the auth store on selection', () => {
    render(<LanguageSection />)
    const select = screen.getByLabelText(/Heritage language/i)
    fireEvent.change(select, { target: { value: 'yo' } })
    expect(useAuthStore.getState().heritageLanguage).toBe('yo')
  })

  it('selecting None clears the value', () => {
    useAuthStore.setState({ heritageLanguage: 'yo' } as never)
    render(<LanguageSection />)
    const select = screen.getByLabelText(/Heritage language/i)
    fireEvent.change(select, { target: { value: '' } })
    expect(useAuthStore.getState().heritageLanguage).toBeNull()
  })
})
