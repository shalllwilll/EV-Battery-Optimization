import { screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { setToken } from '../api/client'
import { FIX, mockApi, renderApp } from '../test/utils'

afterEach(() => { vi.unstubAllGlobals(); setToken(null) })

describe('Evidence: what vendor data would change', () => {
  it('shows the calibration demo numbers from the API, with the not-LFP caveat', async () => {
    mockApi(); renderApp('/evidence')
    const h = await screen.findByRole('heading', { name: 'What vendor data would change' })
    const card = h.closest('.card') as HTMLElement
    const cd = FIX.evidence.metrics.calibration_demo
    const rs = cd.with_snippet_features.results
    const r0 = rs[0], r5 = rs.find((r: { n_labels: number }) => r.n_labels === 5)!
    expect(within(card).getByText(`${r0.prior_mape.toFixed(2)}% to ${r5.partial_pooling_mape.toFixed(2)}%`, { exact: false })).toBeInTheDocument()
    expect(within(card).getAllByText(/not a result for LFP buses/).length).toBeGreaterThan(0)
    expect(within(card).getAllByRole('row')).toHaveLength(rs.length + 1)
  })
})
