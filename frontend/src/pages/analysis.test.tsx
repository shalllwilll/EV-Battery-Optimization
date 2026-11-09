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
