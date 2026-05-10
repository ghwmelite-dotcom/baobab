import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ChromeShell } from '~/chrome/ChromeShell'

describe('ChromeShell', () => {
  it('renders titlebar / tabstrip slot / main / status regions', () => {
    render(
      <ChromeShell
        titlebar={<div data-testid="tb">tb</div>}
        tabStrip={<div data-testid="ts">ts</div>}
        omnibar={<div data-testid="ob">ob</div>}
        statusBar={<div data-testid="sb">sb</div>}
      >
        <div data-testid="content">content</div>
      </ChromeShell>,
    )
    expect(screen.getByTestId('tb')).toBeInTheDocument()
    expect(screen.getByTestId('ts')).toBeInTheDocument()
    expect(screen.getByTestId('ob')).toBeInTheDocument()
    expect(screen.getByTestId('sb')).toBeInTheDocument()
    expect(screen.getByTestId('content')).toBeInTheDocument()
  })
})
