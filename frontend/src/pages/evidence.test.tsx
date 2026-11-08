import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

describe('Evidence: BLAST-Lite cross-check', () => {
  const x = FIX.evidence.crosscheck

  it('states plainly that our model is the more pessimistic one, with the numbers from the API', async () => {
    mockApi(); renderApp('/evidence')
    const h = await screen.findByRole('heading', { name: 'Cross-check against NREL BLAST-Lite' })
    const card = h.closest('.card') as HTMLElement
    const i10 = x.scenarios[0].years.indexOf(10)
    const ours = x.scenarios.map((s: { ours_cell_p50: number[] }) => s.ours_cell_p50[i10] * 100)
    expect(within(card).getByText(/most pessimistic of the three/)).toBeInTheDocument()
    expect(within(card).getByText(new RegExp(`${Math.round(Math.min(...ours))}.${Math.round(Math.max(...ours))}% of its capacity`))).toBeInTheDocument()
    expect(within(card).getByText(/not a validation on buses/)).toBeInTheDocument()
    expect(within(card).getByText(/Neither is validated on buses/, { exact: false })).toBeInTheDocument()
  })

  it('shows the same-condition table, the loss split and switches scenario', async () => {
    mockApi(); renderApp('/evidence')
    const h = await screen.findByRole('heading', { name: 'Cross-check against NREL BLAST-Lite' })
    const card = h.closest('.card') as HTMLElement
    expect(within(card).getAllByRole('row')).toHaveLength(x.single_condition_checks.reduce((n: number, c: { kind: string }) => n + (c.kind === 'storage' ? 1 : 2), 1))
    expect(within(card).getAllByRole('img', { name: /from calendar ageing and .* from cycling/ })).toHaveLength(3)
    const sel = within(card).getByLabelText('Scenario') as HTMLSelectElement
    expect(sel.value).toBe('12m_hot_dry')
    await userEvent.selectOptions(sel, '9m_cool')
    expect(within(card).getByText('9m · cool', { selector: 'div' })).toBeInTheDocument()
    await userEvent.click(within(card).getByRole('button', { name: 'Show as table' }))
    expect(within(card).getAllByRole('row').length).toBeGreaterThan(x.scenarios[0].years.length)
  })
})
