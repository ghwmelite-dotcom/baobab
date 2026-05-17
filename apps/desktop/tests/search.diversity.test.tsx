import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DiversityMeter } from '~/search/DiversityMeter'

describe('DiversityMeter', () => {
  it('renders the three stats', () => {
    render(<DiversityMeter sourceCount={8} countryCount={4} africanVoicePercent={65} />)
    expect(screen.getByText('8')).toBeInTheDocument()
    expect(screen.getByText('4')).toBeInTheDocument()
    expect(screen.getByText(/65%/)).toBeInTheDocument()
    expect(screen.getByText(/African voices/i)).toBeInTheDocument()
  })

  it('handles 0% gracefully', () => {
    render(<DiversityMeter sourceCount={3} countryCount={1} africanVoicePercent={0} />)
    expect(screen.getByText(/0%/)).toBeInTheDocument()
  })

  it('renders nothing when sourceCount is 0', () => {
    const { container } = render(<DiversityMeter sourceCount={0} countryCount={0} africanVoicePercent={0} />)
    expect(container.firstChild).toBeNull()
  })
})
