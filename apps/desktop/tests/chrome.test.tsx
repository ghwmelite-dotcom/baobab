import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ChromeShell } from '~/chrome/ChromeShell'

describe('ChromeShell', () => {
  it('renders chrome bar / address bar / main / optional bookmarks bar', () => {
    render(
      <ChromeShell
        chromeBar={<div data-testid="chrome-bar">chrome</div>}
        addressBar={<div data-testid="address-bar">address</div>}
        bookmarksBar={<div data-testid="bookmarks-bar">bookmarks</div>}
      >
        <div data-testid="content">content</div>
      </ChromeShell>,
    )
    expect(screen.getByTestId('chrome-bar')).toBeInTheDocument()
    expect(screen.getByTestId('address-bar')).toBeInTheDocument()
    expect(screen.getByTestId('bookmarks-bar')).toBeInTheDocument()
    expect(screen.getByTestId('content')).toBeInTheDocument()
  })
})
