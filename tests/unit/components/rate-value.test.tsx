import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { RateValue } from '@/frontend/components/rate-value'

describe('RateValue', () => {
  it('renders the final value after the count-up animation', async () => {
    render(<RateValue value={42} duration={50} />)

    await waitFor(() => expect(screen.getByText('42%')).toBeInTheDocument(), { timeout: 2000 })
  })
})
