import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const { mockLoginEmail, mockSignupEmail, mockLoginPhone, mockSignupPhone, mockOtpSend, mockOtpVerify } = vi.hoisted(() => ({
  mockLoginEmail: vi.fn(async () => undefined),
  mockSignupEmail: vi.fn(async () => undefined),
  mockLoginPhone: vi.fn(async () => undefined),
  mockSignupPhone: vi.fn(async () => undefined),
  mockOtpSend: vi.fn(async () => undefined),
  mockOtpVerify: vi.fn(async () => undefined),
}))

vi.mock('~/auth/auth.store', () => {
  const state = {
    status: 'idle' as const,
    error: null as string | null,
    signInOverlayOpen: true,
    loginEmail: mockLoginEmail,
    signupEmail: mockSignupEmail,
    loginPhone: mockLoginPhone,
    signupPhone: mockSignupPhone,
    otpSend: mockOtpSend,
    otpVerify: mockOtpVerify,
    openSignIn: () => undefined,
    closeSignIn: () => undefined,
  }
  const useAuthStore = Object.assign(
    (sel: (s: typeof state) => unknown) => sel(state),
    { getState: () => state, setState: () => undefined },
  )
  return { useAuthStore }
})

import { AuthScreen } from '~/auth/AuthScreen'

describe('AuthScreen', () => {
  it('switches between phone and email tabs', () => {
    render(<AuthScreen />)
    fireEvent.click(screen.getByRole('tab', { name: /email/i }))
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: /phone/i }))
    expect(screen.getByLabelText(/phone number/i)).toBeInTheDocument()
  })

  it('calls loginEmail on Sign in submit', () => {
    render(<AuthScreen />)
    fireEvent.click(screen.getByRole('tab', { name: /email/i }))
    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'a@b.com' } })
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'long-password-123' } })
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))
    expect(mockLoginEmail).toHaveBeenCalledWith('a@b.com', 'long-password-123')
  })

  it('calls loginPhone on Sign in submit from Phone tab', () => {
    render(<AuthScreen />)
    fireEvent.click(screen.getByRole('tab', { name: /phone/i }))
    fireEvent.change(screen.getByLabelText(/phone number/i), { target: { value: '+233241112222' } })
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'long-password-123' } })
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))
    expect(mockLoginPhone).toHaveBeenCalledWith('+233241112222', 'long-password-123')
  })
})
