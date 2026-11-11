import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import axe from 'axe-core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setToken } from '../api/client'
import { mockApi, renderApp } from '../test/utils'

beforeEach(() => localStorage.clear())
afterEach(() => { vi.unstubAllGlobals(); setToken(null) })

const open = async () => { mockApi(); renderApp('/fleet'); await screen.findByRole('heading', { level: 1, name: 'Fleet' }) }
const gate = () => screen.getByRole('region', { name: /check this before|can’t be added/i })
const paste = async (text: string) => {
  await userEvent.click(await screen.findByRole('button', { name: /Paste from a spreadsheet/ }))
  const box = await screen.findByRole('textbox', { name: /Paste the cells/ })
  await userEvent.click(box)
  await userEvent.paste(text)
  await userEvent.click(screen.getByRole('button', { name: 'Check pasted cells' }))
}
const ROSTER = ['bus_id,in_service,depot,route,bus_type,km_per_day', 'B-1,2023-07,Depot A,Route 1,12m,210', 'B-2,2023-09,Depot A,Route 1,12m,210', 'B-3,,Depot B,Route 2,9m,160', 'B-4,2023-13,Depot B,Route 2,9m,160'].join('\n')

describe('Fleet page: ways in and the gate', () => {
  it('starts empty with every way in listed, and the app still works without a fleet', async () => {
    await open()
    expect(screen.getByRole('heading', { name: 'Start your fleet' })).toBeInTheDocument()
    for (const n of [/Upload a file/, /Paste from a spreadsheet/, /Add buses by hand/, /Try the sample fleet/]) expect(await screen.findByRole('button', { name: n })).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('the sample fleet goes through the gate, is labelled synthetic, and only then joins', async () => {
    await open()
    await userEvent.click(await screen.findByRole('button', { name: /Try the sample fleet/ }))
    expect(within(gate()).getByText(/60 buses in \d+ duty classes/)).toBeInTheDocument()
    expect(localStorage.getItem('ph.fleet.v1')).toBeNull()
    await userEvent.click(within(gate()).getByRole('button', { name: 'Use this fleet' }))
    expect(await screen.findByText('Synthetic, for demonstration')).toBeInTheDocument()
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getAllByRole('checkbox').length).toBeGreaterThan(60)
    await waitFor(() => expect(localStorage.getItem('ph.fleet.v1')).not.toBeNull())
  })

  it('pasted cells show a preview with what was assumed and what was rejected, and add nothing until confirmed', async () => {
    await open()
    await paste(ROSTER)
    const g = within(await screen.findByRole('region', { name: /check this before/i }))
    expect(g.getByText(/3 buses in 2 duty classes/)).toBeInTheDocument()
    expect(g.getByText(/no in-service month/)).toBeInTheDocument()
    expect(g.getByText(/1 row not imported/)).toBeInTheDocument()
    await userEvent.click(g.getByRole('button', { name: 'Show reasons' }))
    expect(g.getByText(/not a month/)).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    await userEvent.click(g.getByRole('button', { name: 'Create fleet' }))
    expect(await screen.findByRole('heading', { name: 'My fleet' })).toBeInTheDocument()
    expect(screen.getByRole('rowheader', { name: 'B-1' })).toBeInTheDocument()
    expect(screen.queryByRole('rowheader', { name: 'B-4' })).not.toBeInTheDocument()
    expect(screen.getByText('age unknown')).toBeInTheDocument()
  })

  it('names the bus type and the battery price it assumed when the file says nothing about them', async () => {
    await open()
    await paste(['bus_id,route', 'B-1,R1', 'B-2,R1'].join('\n'))
    const g = within(await screen.findByRole('region', { name: /check this before/i }))
    expect(g.getByText(/2 buses have no bus type, so they are taken as 12 m, like the bus on screen/)).toBeInTheDocument()
    expect(g.getByText(/the bus on screen's price \(₹12,000 per kWh\)/)).toBeInTheDocument()
  })

  it('a file with no bus id column is refused with the reason and nothing is added', async () => {
    await open()
    await paste('depot\nA')
    expect(await screen.findByRole('alert')).toHaveTextContent(/bus_id column is required/)
    expect(screen.queryByRole('region', { name: /check this before/i })).not.toBeInTheDocument()
  })

  it('the add-buses form makes a batch, catches a bad count, and one undo removes it', async () => {
    await open()
    await userEvent.click(await screen.findByRole('button', { name: /Add buses by hand/ }))
    const count = await screen.findByLabelText('How many buses')
    await userEvent.clear(count); await userEvent.type(count, '0')
    await userEvent.click(screen.getByRole('button', { name: 'Check these buses' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/1 to 500/)
    await userEvent.clear(count); await userEvent.type(count, '3')
    await userEvent.type(screen.getByLabelText('Depot'), 'Depot Z')
    await userEvent.click(screen.getByRole('button', { name: 'Check these buses' }))
    const g = within(await screen.findByRole('region', { name: /check this before/i }))
    expect(g.getByText(/B-101 to B-103/)).toBeInTheDocument()
    expect(g.getByText(/duty of the bus on screen/)).toBeInTheDocument()
    await userEvent.click(g.getByRole('button', { name: 'Create fleet' }))
    expect(await screen.findByRole('rowheader', { name: 'B-103' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(await screen.findByRole('heading', { name: 'Start your fleet' })).toBeInTheDocument()
  })
})

describe('Fleet page: the roster', () => {
  const withFleet = async () => { await open(); await paste(ROSTER); await userEvent.click(await screen.findByRole('button', { name: 'Create fleet' })); await screen.findByRole('table') }

  it('edits a depot where it sits and rejects a bad month with the reason', async () => {
    await withFleet()
    await userEvent.click(screen.getByRole('button', { name: /Depot of B-1: Depot A/ }))
    const box = screen.getByRole('textbox', { name: 'Depot of B-1' })
    await userEvent.clear(box); await userEvent.type(box, 'Depot Q{Enter}')
    expect(await screen.findByRole('button', { name: /Depot of B-1: Depot Q/ })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /In-service month of B-2/ }))
    const m = screen.getByRole('textbox', { name: 'In-service month of B-2' })
    await userEvent.clear(m); await userEvent.type(m, '2031-01{Enter}')
    expect(await screen.findByRole('alert')).toHaveTextContent(/future/)
  })

  it('changes several selected buses at once', async () => {
    await withFleet()
    await userEvent.click(screen.getByRole('checkbox', { name: 'Select B-1' }))
    await userEvent.click(screen.getByRole('checkbox', { name: 'Select B-2' }))
    const bar = within(screen.getByRole('group', { name: /Change 2 selected buses/ }))
    await userEvent.type(bar.getByLabelText('Route'), 'Route 9')
    await userEvent.click(bar.getByRole('button', { name: 'Apply to 2' }))
    expect(await screen.findAllByRole('button', { name: /Route of B-[12]: Route 9/ })).toHaveLength(2)
    expect(screen.queryByRole('group', { name: /selected buses/ })).not.toBeInTheDocument()
  })

  it('filters by text', async () => {
    await withFleet()
    await userEvent.type(screen.getByRole('textbox', { name: 'Find a bus, depot or route' }), 'Depot B')
    expect(screen.queryByRole('rowheader', { name: 'B-1' })).not.toBeInTheDocument()
    expect(screen.getByRole('rowheader', { name: 'B-3' })).toBeInTheDocument()
  })

  it('adding to an existing fleet matches on id and offers replace as the alternative', async () => {
    await withFleet()
    await userEvent.click(screen.getByRole('button', { name: 'Add buses' }))
    await paste(['bus_id,in_service', 'B-1,2022-01', 'B-9,2022-02'].join('\n'))
    const g = within(await screen.findByRole('region', { name: /check this before/i }))
    expect(g.getByText(/kept as they are/)).toBeInTheDocument()
    expect(g.getByRole('radio', { name: /Replace my fleet/ })).toBeInTheDocument()
    await userEvent.click(g.getByRole('button', { name: /Add 2 buses/ }))
    expect(await screen.findByRole('rowheader', { name: 'B-9' })).toBeInTheDocument()
    expect(screen.getByRole('rowheader', { name: 'B-3' })).toBeInTheDocument()
  })
})

// Colour contrast needs real layout, so it is checked in a browser; everything else is scanned here.
const scan = async () => (await axe.run(document.body, { rules: { 'color-contrast': { enabled: false } } })).violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`)

describe('Fleet page: accessibility', () => {
  it('has no violations empty, with a method open, at the gate, and with a roster and the bulk bar', async () => {
    await open()
    expect(await scan()).toEqual([])
    await userEvent.click(await screen.findByRole('button', { name: /Add buses by hand/ }))
    await screen.findByLabelText('How many buses')
    expect(await scan()).toEqual([])
    await userEvent.click(screen.getByRole('button', { name: /Paste from a spreadsheet/ }))
    const box = await screen.findByRole('textbox', { name: /Paste the cells/ })
    await userEvent.click(box); await userEvent.paste(ROSTER)
    await userEvent.click(screen.getByRole('button', { name: 'Check pasted cells' }))
    await screen.findByRole('region', { name: /check this before/i })
    await userEvent.click(screen.getByRole('button', { name: 'Show reasons' }))
    expect(await scan()).toEqual([])
    await userEvent.click(screen.getByRole('button', { name: 'Create fleet' }))
    await screen.findByRole('table')
    await userEvent.click(screen.getByRole('checkbox', { name: 'Select B-1' }))
    await screen.findByRole('group', { name: /selected buses/ })
    expect(await scan()).toEqual([])
    expect(screen.getAllByRole('main')).toHaveLength(1)
  })
})
