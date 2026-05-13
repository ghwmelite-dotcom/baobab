import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

// vi.hoisted ensures the mocked module factory captures these same fn
// instances. Resetting per-test below keeps assertions independent.
const { mockIntent, mockVerify, mockOpenTab } = vi.hoisted(() => ({
  mockIntent: vi.fn(),
  mockVerify: vi.fn(),
  mockOpenTab: vi.fn(),
}))

// Mock the cloud-client wrapper module so we don't depend on the real
// HttpClient / fetch surface in the jsdom env.
vi.mock('~/payments/api', () => ({
  paymentsClient: {
    intent: mockIntent,
    verify: mockVerify,
  },
}))

// Mock the tabs store — the PayWidget calls openTab on a successful intent.
vi.mock('~/state/tabs.store', () => {
  const state = { openTab: mockOpenTab }
  const useTabsStore = Object.assign(
    (sel: (s: typeof state) => unknown) => sel(state),
    { getState: () => state, setState: () => undefined },
  )
  return { useTabsStore }
})

// Mock the auth store to return a user with an email so the form prefills.
vi.mock('~/auth/auth.store', () => {
  const state = { user: { email: 'tipper@example.test' } }
  const useAuthStore = Object.assign(
    (sel: (s: typeof state) => unknown) => sel(state),
    { getState: () => state, setState: () => undefined },
  )
  return { useAuthStore }
})

// Import AFTER mocks so the store module picks up the mocked paymentsClient.
import { PayWidget } from '~/payments/PayWidget'
import { usePaymentsStore } from '~/payments/payments.store'

// Re-initialise the store to its open state before each test. Direct
// setState gets us there without firing the unrelated reset paths.
beforeEach(() => {
  usePaymentsStore.setState({
    widgetOpen: true,
    pending: null,
    loading: false,
    status: null,
    error: null,
    unconfigured: false,
  })
  mockIntent.mockReset()
  mockVerify.mockReset()
  mockOpenTab.mockReset()
})

describe('PayWidget — happy path', () => {
  it('submits the form and opens the checkout URL in a new tab', async () => {
    const checkoutUrl = 'https://checkout.flutterwave.com/v3/hosted/pay/abc123'
    mockIntent.mockResolvedValueOnce({ checkoutUrl, txRef: 'baobab-test-1' })

    render(<PayWidget />)
    // Form is prefilled with email from auth store.
    const emailInput = screen.getByLabelText(/email/i) as HTMLInputElement
    expect(emailInput.value).toBe('tipper@example.test')

    // Amount defaults to 500. Set to 250 to verify it flows through.
    const amountInput = screen.getByLabelText(/amount/i) as HTMLInputElement
    fireEvent.change(amountInput, { target: { value: '250' } })

    fireEvent.click(screen.getByRole('button', { name: /pay now/i }))

    await waitFor(() => expect(mockIntent).toHaveBeenCalledOnce())
    expect(mockIntent).toHaveBeenCalledWith({
      amount: 250,
      currency: 'NGN',
      customer_email: 'tipper@example.test',
      customer_name: undefined,
    })
    await waitFor(() => expect(mockOpenTab).toHaveBeenCalledWith(checkoutUrl))
  })

  it('passes the trimmed customer name when provided', async () => {
    mockIntent.mockResolvedValueOnce({ checkoutUrl: 'https://x', txRef: 'baobab-test-2' })
    render(<PayWidget />)
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: '  Ada Lovelace  ' } })
    fireEvent.click(screen.getByRole('button', { name: /pay now/i }))
    await waitFor(() => expect(mockIntent).toHaveBeenCalledOnce())
    expect(mockIntent).toHaveBeenCalledWith(
      expect.objectContaining({ customer_name: 'Ada Lovelace' }),
    )
  })
})

describe('PayWidget — unconfigured path', () => {
  it('renders the friendly inline message when the worker reports payments_unconfigured', async () => {
    // Mimic an ApiError-shaped rejection.
    class FakeApiError extends Error {
      override name = 'ApiError'
      status: number
      body: unknown
      constructor(status: number, body: unknown) {
        super(`${status}`)
        this.status = status
        this.body = body
      }
    }
    mockIntent.mockRejectedValueOnce(
      new FakeApiError(503, { error: 'payments_unconfigured', message: 'not live yet' }),
    )

    render(<PayWidget />)
    fireEvent.click(screen.getByRole('button', { name: /pay now/i }))

    await waitFor(() =>
      expect(
        screen.getByText(/payments are in beta — keys aren't live yet/i),
      ).toBeInTheDocument(),
    )
    expect(mockOpenTab).not.toHaveBeenCalled()
  })
})

describe('PayWidget — close behavior', () => {
  it('closes when the close button is clicked', () => {
    render(<PayWidget />)
    expect(usePaymentsStore.getState().widgetOpen).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: /close payment widget/i }))
    expect(usePaymentsStore.getState().widgetOpen).toBe(false)
  })

  it('closes when Escape is pressed', () => {
    render(<PayWidget />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(usePaymentsStore.getState().widgetOpen).toBe(false)
  })

  it('does not render when widgetOpen is false', () => {
    usePaymentsStore.setState({ widgetOpen: false })
    render(<PayWidget />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
