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

const open = async (name: string) => { await userEvent.click(await screen.findByRole('button', { name })); return screen.findByRole('complementary', { name: new RegExp(name === 'Goals' ? 'Pick a goal' : name === 'Bus B' ? 'Bus B' : name) }) }
const goals = () => open('Goals')

describe('Optimise (compare two buses)', () => {
  it('shows only the stat strip and the dock until a panel is opened', async () => {
    mockApi(); renderApp('/optimise')
    expect(await screen.findByText('Range at replacement')).toBeInTheDocument()
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
    for (const n of ['Bus A', 'Bus B', 'Goals', 'Details', 'View']) expect(screen.getByRole('button', { name: n })).toBeInTheDocument()
  })
  it('shows the route check sentence exactly as the API wrote it, in the goals panel', async () => {
    mockApi(); renderApp('/optimise')
    const g = await goals()
    expect(await within(g).findByText(FIX.recommend.feasibility.plain)).toBeInTheDocument()
  })
  it('lists every goal and points repeated advice back to the first one', async () => {
    mockApi(); renderApp('/optimise')
    const g = await goals()
    expect(await within(g).findByRole('heading', { name: 'Keep full range', level: 3 })).toBeInTheDocument()
    for (const t of ['Balanced', 'Lowest cost per km', 'Longest battery life', 'Hot-climate protection']) expect(within(g).getAllByRole('heading', { name: t, level: 3 }).length).toBe(1)
    expect(within(g).getAllByText(/found the same best option as/).length).toBeGreaterThan(0)
  })
  it('starts with Bus B equal to Bus A and does not call /compare until something changes', async () => {
    const api = mockApi(); renderApp('/optimise')
    const b = await open('Bus B')
    expect(within(b).getByRole('button', { name: 'Same as Bus A' })).toBeDisabled()
    expect(screen.getAllByText('Change Bus B to compare').length).toBeGreaterThan(0)
    expect(api.calls.some((c) => c.path === '/compare')).toBe(false)
  })
  it('adopting a goal sets Bus B to that goal, closes the panel and runs the paired comparison on it', async () => {
    const api = mockApi(); renderApp('/optimise')
    const g = await goals()
    const card = (await within(g).findByRole('heading', { name: 'Lowest cost per km', level: 3 })).closest('article')!
    await userEvent.click(within(card as HTMLElement).getByRole('button', { name: 'Try on Bus B' }))
    const want = byId('lowest_cost').charging.scenario
    await waitFor(() => expect(api.calls.some((c) => c.path === '/compare')).toBe(true), { timeout: 3000 })
    const body = api.calls.find((c) => c.path === '/compare')!.body as { scenarios: { soc_max_pct: number; charge_start_hour: number }[] }
    expect(body.scenarios).toHaveLength(2)
    expect(body.scenarios[0].soc_max_pct).toBe(FIX.predict.scenario.soc_max_pct)
    expect(body.scenarios[1].soc_max_pct).toBe(want.soc_max_pct)
    expect(body.scenarios[1].charge_start_hour).toBe(want.charge_start_hour)
    await waitFor(() => expect(screen.queryByRole('complementary')).not.toBeInTheDocument())
    const g2 = await goals()
    const card2 = (await within(g2).findByRole('heading', { name: 'Lowest cost per km', level: 3 })).closest('article')! as HTMLElement
    expect(within(card2).getByText('Shown on Bus B', { selector: '.tag' })).toBeInTheDocument()
  })
  it('only shows cooling and energy-use changes after the user allows them', async () => {
    mockApi(); renderApp('/optimise')
    const g = await goals()
    await within(g).findByRole('heading', { name: 'Keep full range', level: 3 })
    expect(within(g).queryByText(/needs your confirmation/)).not.toBeInTheDocument()
    await userEvent.click(within(g).getByRole('checkbox', { name: /Include changes that need your confirmation/ }))
    expect((await within(g).findAllByText('needs your confirmation')).length).toBeGreaterThan(0)
    expect(within(g).getByText(byId('max_range').with_confirmation!.summary)).toBeInTheDocument()
  })
  it('re-applies the chosen goal when cooling and energy-use changes are allowed afterwards', async () => {
    const api = mockApi(); renderApp('/optimise')
    const g = await goals()
    const card = (await within(g).findByRole('heading', { name: 'Keep full range', level: 3 })).closest('article')! as HTMLElement
    await userEvent.click(within(card).getByRole('button', { name: 'Try on Bus B' }))
    const g2 = await goals()
    await userEvent.click(within(g2).getByRole('checkbox', { name: /Include changes that need your confirmation/ }))
    const want = byId('max_range').with_confirmation!.scenario
    await waitFor(() => {
      const last = [...api.calls].reverse().find((c) => c.path === '/compare')!.body as { scenarios: { heat_rise_c: number; kwh_per_km: number }[] }
      expect(last.scenarios[1].heat_rise_c).toBe(want.heat_rise_c)
      expect(last.scenarios[1].kwh_per_km).toBeCloseTo(want.kwh_per_km as number, 6)
    }, { timeout: 3000 })
    const card2 = within(g2).getByRole('heading', { name: 'Keep full range', level: 3 }).closest('article')! as HTMLElement
    expect(within(card2).getByText('Shown on Bus B', { selector: '.tag' })).toBeInTheDocument()
  })
  it('explains the levers that were deliberately left alone, in the details panel', async () => {
    mockApi(); renderApp('/optimise')
    const d = await open('Details')
    expect(await within(d).findByText('What we did not change, and why')).toBeInTheDocument()
    expect(within(d).getByText(/never suggested/)).toBeInTheDocument()
  })
  it('keeps Bus A and the sliders usable when the goal search fails', async () => {
    mockApi({ '/recommend': () => ({ status: 500, body: { error: { code: 'internal_error', message: 'Something went wrong.', fields: [] } } }) })
    renderApp('/optimise')
    expect(await screen.findByText('Health, year 4.0')).toBeInTheDocument()
    const b = await open('Bus B')
    expect(within(b).getByRole('button', { name: 'Same as Bus A' })).toBeInTheDocument()
    const g = await goals()
    expect(await within(g).findByRole('alert')).toBeInTheDocument()
  })
})
