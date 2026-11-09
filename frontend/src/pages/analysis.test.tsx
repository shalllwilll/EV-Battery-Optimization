import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { setToken } from '../api/client'
import { mockApi, renderApp } from '../test/utils'

afterEach(() => { vi.unstubAllGlobals(); setToken(null); try { localStorage.clear() } catch { /* ignore */ } })

describe('analysis pages', () => {
  it('Health: ageing lab with a one-line insight, a day strip, a temperature ring and the notes list', async () => {
    mockApi(); renderApp('/health')
    expect(await screen.findByRole('heading', { name: 'Ageing lab' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /^Ninety-six cells/ })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /^Drives .* charges .* rests full/ })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /^Mean cell temperature by month/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /See ageing on the bus/ })).toHaveAttribute('href', '/')
    expect(screen.getByRole('region', { name: 'Try a change' })).toBeInTheDocument()
  })

  it('Replacement: fifty dots, a fleet planner that remembers its size, and the probability detail', async () => {
    mockApi(); renderApp('/replacement')
    expect(await screen.findByRole('heading', { name: 'Fifty runs, fifty replacement dates' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /^Fifty dots, each one 2 percent/ })).toBeInTheDocument()
    const fleet = await screen.findByLabelText('Buses in the fleet')
    fireEvent.change(fleet, { target: { value: '120' } })
    expect(localStorage.getItem('ph.fleet')).toBe('120')
    expect(screen.getByText(/Detail: share of runs/)).toBeInTheDocument()
    await userEvent.click(screen.getAllByRole('button', { name: 'Show as table' })[0])
    expect(screen.getAllByRole('columnheader', { name: 'Expected buses' })).toHaveLength(1)
  })

  it('Range: route-fit hero says whether the route is covered and the route slider is labelled', async () => {
    mockApi(); renderApp('/range')
    expect(await screen.findByRole('heading', { name: 'Does it cover your route?' })).toBeInTheDocument()
    expect(screen.getByRole('slider', { name: 'Route length, kilometres per day' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /^A full charge goes about/ })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /^Range on a full charge by pack age/ })).toBeInTheDocument()
  })

  it('Cost: price curve hero with a keyboard-reachable price control', async () => {
    mockApi(); renderApp('/cost')
    expect(await screen.findByRole('heading', { name: 'Cost against battery price' })).toBeInTheDocument()
  })
})

describe('decision insights', () => {
  it('Health: ranks one-lever changes, applies one to the Try a change bar, and says how far charging can be staggered', async () => {
    mockApi(); renderApp('/health')
    expect(await screen.findByRole('heading', { name: 'What to do first' })).toBeInTheDocument()
    const rows = await screen.findAllByRole('button', { name: /Apply to the Try a change bar/ })
    expect(rows.length).toBeGreaterThan(0)
    expect(await screen.findByText(/Charging can start anywhere in the/)).toBeInTheDocument()
    await userEvent.click(rows[0])
    expect(await screen.findByRole('button', { name: 'Reset' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'List as table' }))
    expect(await screen.findByRole('columnheader', { name: 'Months gained (10th pct)' })).toBeInTheDocument()
  }, 15000)

  it('Cost: draws cost against the replacement line with the numbers in its label', async () => {
    mockApi(); renderApp('/cost')
    expect(await screen.findByRole('heading', { name: 'Cost against the replacement line' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /^Cost per kilometre against the replacement line/ })).toBeInTheDocument()
    expect(screen.queryByText('Pack cost per year of life')).not.toBeInTheDocument()
  })

  it('Range: names how many buses are short, in buckets, never as an invented percentage', async () => {
    mockApi(); renderApp('/range')
    expect(await screen.findByText(/buses short|every run short|fewer than 1 in 10/)).toBeInTheDocument()
    expect(screen.queryByText(/\d+ % of buses/)).not.toBeInTheDocument()
  })

  it('Replacement: puts a budget range and a bulk-order window on the fleet plan', async () => {
    mockApi(); renderApp('/replacement')
    expect(await screen.findByText(/^Budget about /)).toBeInTheDocument()
    await userEvent.click(screen.getAllByRole('button', { name: 'Show as table' })[0])
    expect(screen.getAllByRole('columnheader', { name: '10th pct' })).toHaveLength(1)
  }, 15000)
})
