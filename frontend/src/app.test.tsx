import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { setToken } from './api/client'
import { DEMO, FIX, mockApi, renderApp } from './test/utils'

afterEach(() => { vi.unstubAllGlobals(); setToken(null) })

describe('sign in', () => {
  it('sends signed-out visitors to the login page, which shows the demo hint and honesty chips', async () => {
    mockApi(); renderApp('/health', false)
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
    expect(screen.getByText(/Demo access/)).toBeInTheDocument()
    expect(screen.getByText(/Not yet validated on buses/)).toBeInTheDocument()
  })
  it('signs in with the demo account and lands on the app', async () => {
    mockApi(); renderApp('/', false)
    await userEvent.type(await screen.findByLabelText('Username'), DEMO.username)
    await userEvent.type(screen.getByLabelText('Password'), DEMO.password)
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByRole('navigation', { name: 'Sections' })).toBeInTheDocument()
  })
  it('shows the server message for a wrong password and stays on the page', async () => {
    mockApi(); renderApp('/', false)
    await userEvent.type(await screen.findByLabelText('Username'), 'demo')
    await userEvent.type(screen.getByLabelText('Password'), 'nope')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Username or password is not correct.')
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
  })
  it('signs out from the account menu', async () => {
    mockApi(); renderApp('/')
    await userEvent.click(await screen.findByRole('button', { name: /account menu/i }))
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
  })
})

describe('pages', () => {
  it.each(['/health', '/replacement', '/range', '/cost', '/evidence'])('keeps both honesty chips on %s (T5.1-4)', async (path) => {
    mockApi(); renderApp(path)
    const bar = await screen.findByLabelText('Model status')
    expect(within(bar).getByText(/Prior mode · no vendor data/)).toBeInTheDocument()
    expect(within(bar).getByText(/Not yet validated on buses/)).toBeInTheDocument()
  })
  it('lists every section in the floating nav', async () => {
    mockApi(); renderApp('/health')
    const nav = await screen.findByRole('navigation', { name: 'Sections' })
    expect(within(nav).getAllByRole('link').map((a) => a.textContent)).toEqual(['Overview', 'Health', 'Replacement', 'Range', 'Cost', 'Optimise', 'Evidence'])
  })
  it('shows the replacement range, never a single date (T5.3-3)', async () => {
    mockApi(); renderApp('/replacement')
    expect(await screen.findByText('Early (p10)')).toBeInTheDocument()
    expect(screen.getByText('Late (p90)')).toBeInTheDocument()
    expect(screen.getByText('Median (p50)')).toBeInTheDocument()
  })
  it('shows the same numbers in the table alternative as the API returned (T5.3-8)', async () => {
    mockApi(); renderApp('/health')
    await userEvent.click(await screen.findByRole('button', { name: 'Show as table' }))
    const med = (FIX.predict.replacement.retention_p50.value as number[])
    const row = (await screen.findAllByRole('row')).find((r) => within(r).queryAllByRole('cell')[0]?.textContent === '4')!
    expect(within(row).getAllByRole('cell')[2]).toHaveTextContent(String(Math.round(med[48] * 100)))
  })
  it('tells the user plainly when the service is down, with a retry (T5.1-3)', async () => {
    mockApi({ '/predict': () => { throw new TypeError('Failed to fetch') } })
    renderApp('/health')
    expect(await screen.findByText(/could not be reached/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })
  it('maps a server 422 to the field it names (T5.2-3)', async () => {
    mockApi({ '/predict': () => ({ status: 422, body: { error: { code: 'validation_error', message: 'Invalid request', fields: [{ field: 'scenario.km_per_day', message: 'Input should be less than or equal to 700' }] } } }) })
    renderApp('/health')
    expect(await screen.findByText(/less than or equal to 700/)).toBeInTheDocument()
  })
  it('stops calling the model while an input is invalid, and says which (T5.2-2)', async () => {
    const m = mockApi(); renderApp('/health')
    await screen.findByText('Health over time')
    const before = m.calls.filter((c) => c.path === '/predict').length
    const input = screen.getByRole('textbox', { name: 'Distance per day' })
    await userEvent.clear(input); await userEvent.type(input, '-5')
    expect(await screen.findByText(/Fix 1 scenario input/)).toBeInTheDocument()
    await new Promise((r) => setTimeout(r, 600))
    expect(m.calls.filter((c) => c.path === '/predict').length).toBe(before)
  })
  it('shows the outside-lab-data badge when the model says so (T5.3-9)', async () => {
    mockApi(); renderApp('/health')
    await waitFor(() => expect(screen.getByRole('button', { name: /Outside lab data/ })).toBeInTheDocument())
  })
  it('puts the changed scenario in the address bar so it can be shared (T5.2-4)', async () => {
    mockApi(); renderApp('/health')
    const input = await screen.findByRole('textbox', { name: 'Distance per day' })
    await userEvent.clear(input); await userEvent.type(input, '175')
    await waitFor(() => expect(window.location.search).toContain('km_per_day=175'))
  })
  it('changing bus type refreshes bus defaults but keeps the operator choices', async () => {
    mockApi(); renderApp('/health?zone=cool')
    await screen.findByText('Health over time')
    await userEvent.click(screen.getByRole('button', { name: '9 m' }))
    expect(screen.getByRole('textbox', { name: 'Battery size' })).toHaveValue('250')
    expect(screen.getByLabelText('Climate zone')).toHaveValue('cool')
  })
})
