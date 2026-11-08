import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { setToken } from '../api/client'
import type { PresetResult } from '../api/types'
import { FIX, mockApi, renderApp } from '../test/utils'

afterEach(() => { vi.unstubAllGlobals(); setToken(null) })
const presets = FIX.recommend.presets as unknown as PresetResult[]
const byId = (id: string) => presets.find((p) => p.id === id)!

describe('Overview (3D)', () => {
  it('shows the key numbers from the API and keeps both honesty chips', async () => {
    mockApi(); renderApp('/')
    expect(await screen.findByText('Replace around')).toBeInTheDocument()
    expect(screen.getByText('Range on a full charge')).toBeInTheDocument()
    const bar = screen.getByLabelText('Model status')
    expect(within(bar).getByText(/Not yet validated on buses/)).toBeInTheDocument()
  })
  it('falls back to a plain card when WebGL is not available, and says the numbers are still shown', async () => {
    mockApi(); renderApp('/')
    expect(await screen.findByText('3D view is not available here')).toBeInTheDocument()
    expect(screen.getByText(/Every number on this page is still shown/)).toBeInTheDocument()
  })
})

describe('Optimise (compare two buses)', () => {
  it('shows the route check sentence exactly as the API wrote it', async () => {
    mockApi(); renderApp('/optimise')
    expect(await screen.findByText(FIX.recommend.feasibility.plain)).toBeInTheDocument()
  })
  it('lists every goal and points repeated advice back to the first one', async () => {
    mockApi(); renderApp('/optimise')
    const first = await screen.findByRole('heading', { name: 'Keep full range', level: 3 })
    expect(first).toBeInTheDocument()
    for (const t of ['Balanced', 'Lowest cost per km', 'Longest battery life', 'Hot-climate protection']) expect(screen.getAllByRole('heading', { name: t, level: 3 }).length).toBe(1)
    expect(screen.getAllByText(/found the same best option as/).length).toBeGreaterThan(0)
  })
  it('starts with Bus B equal to Bus A and does not call /compare until something changes', async () => {
    const api = mockApi(); renderApp('/optimise')
    await screen.findByText(FIX.recommend.feasibility.plain)
    expect(screen.getByRole('button', { name: 'Same as Bus A' })).toBeDisabled()
    expect(screen.getAllByText('No changes yet').length).toBeGreaterThan(0)
    expect(api.calls.some((c) => c.path === '/compare')).toBe(false)
  })
  it('adopting a goal sets Bus B to that goal and runs the paired comparison on it', async () => {
    const api = mockApi(); renderApp('/optimise')
    const card = (await screen.findByRole('heading', { name: 'Lowest cost per km', level: 3 })).closest('article')!
    await userEvent.click(within(card as HTMLElement).getByRole('button', { name: 'Try on Bus B' }))
    const want = byId('lowest_cost').charging.scenario
    await waitFor(() => expect(api.calls.some((c) => c.path === '/compare')).toBe(true), { timeout: 3000 })
    const body = api.calls.find((c) => c.path === '/compare')!.body as { scenarios: { soc_max_pct: number; charge_start_hour: number }[] }
    expect(body.scenarios).toHaveLength(2)
    expect(body.scenarios[0].soc_max_pct).toBe(FIX.predict.scenario.soc_max_pct)
    expect(body.scenarios[1].soc_max_pct).toBe(want.soc_max_pct)
    expect(body.scenarios[1].charge_start_hour).toBe(want.charge_start_hour)
    expect(screen.getByRole('button', { name: 'Same as Bus A' })).toBeEnabled()
    expect(within(card as HTMLElement).getByText('Shown on Bus B', { selector: '.tag' })).toBeInTheDocument()
  })
  it('only shows cooling and energy-use changes after the user allows them', async () => {
    mockApi(); renderApp('/optimise')
    await screen.findByRole('heading', { name: 'Keep full range', level: 3 })
    expect(screen.queryByText(/needs your confirmation/)).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('checkbox', { name: /Include changes that need your confirmation/ }))
    expect((await screen.findAllByText('needs your confirmation')).length).toBeGreaterThan(0)
    expect(screen.getByText(byId('max_range').with_confirmation!.summary)).toBeInTheDocument()
  })
  it('re-applies the chosen goal when cooling and energy-use changes are allowed afterwards', async () => {
    const api = mockApi(); renderApp('/optimise')
    const card = (await screen.findByRole('heading', { name: 'Keep full range', level: 3 })).closest('article')! as HTMLElement
    await userEvent.click(within(card).getByRole('button', { name: 'Try on Bus B' }))
    await userEvent.click(screen.getByRole('checkbox', { name: /Include changes that need your confirmation/ }))
    const want = byId('max_range').with_confirmation!.scenario
    await waitFor(() => {
      const last = [...api.calls].reverse().find((c) => c.path === '/compare')!.body as { scenarios: { heat_rise_c: number; kwh_per_km: number }[] }
      expect(last.scenarios[1].heat_rise_c).toBe(want.heat_rise_c)
      expect(last.scenarios[1].kwh_per_km).toBeCloseTo(want.kwh_per_km as number, 6)
    }, { timeout: 3000 })
    expect(within(card).getByText('Shown on Bus B', { selector: '.tag' })).toBeInTheDocument()
  })
  it('explains the levers that were deliberately left alone', async () => {
    mockApi(); renderApp('/optimise')
    expect(await screen.findByText('What we did not change, and why')).toBeInTheDocument()
    expect(screen.getByText(/never suggested/)).toBeInTheDocument()
  })
  it('keeps Bus A and the sliders usable when the goal search fails', async () => {
    mockApi({ '/recommend': () => ({ status: 500, body: { error: { code: 'internal_error', message: 'Something went wrong.', fields: [] } } }) })
    renderApp('/optimise')
    expect(await screen.findByText('Health at year 4.0')).toBeInTheDocument()
    expect(await screen.findByText(/goal presets could not be loaded/)).toBeInTheDocument()
  })
})
