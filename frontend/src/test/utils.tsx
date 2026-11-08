import type { ReactNode } from 'react'
import { render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import health from './fixtures/health.json'
import presets from './fixtures/presets.json'
import zones from './fixtures/zones.json'
import evidence from './fixtures/evidence.json'
import predict from './fixtures/predict.json'
import compare from './fixtures/compare.json'
import recommend from './fixtures/recommend.json'
import { setToken } from '../api/client'
import { AuthProvider } from '../auth/AuthContext'
import App from '../App'

export const FIX = { health, presets, zones, evidence, predict, compare, recommend }
export const DEMO = { username: 'demo', password: 'PackHorizon-2026' }

type Routes = Record<string, (body: unknown) => { status?: number; body: unknown }>
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { 'Content-Type': 'application/json' } })

/** Replaces fetch with the real captured API responses. `over` lets a test change or break one endpoint. */
export function mockApi(over: Routes = {}) {
  const calls: { path: string; body: unknown }[] = []
  const routes: Routes = {
    '/health': () => ({ body: FIX.health }), '/presets': () => ({ body: FIX.presets }), '/zones': () => ({ body: FIX.zones }), '/evidence': () => ({ body: FIX.evidence }),
    '/predict': () => ({ body: FIX.predict }), '/compare': () => ({ body: FIX.compare }), '/recommend': () => ({ body: FIX.recommend }),
    '/auth/me': () => ({ body: { username: 'demo' } }),
    '/auth/login': (b) => {
      const x = b as typeof DEMO
      return x.username === DEMO.username && x.password === DEMO.password ? { body: { access_token: 'tok', token_type: 'bearer', expires_in: 3600, username: 'demo' } }
        : { status: 401, body: { error: { code: 'invalid_credentials', message: 'Username or password is not correct.', fields: [] } } }
    },
    ...over,
  }
  const f = vi.fn(async (url: string, init?: RequestInit) => {
    const path = url.replace(/^.*\/api\/v1/, '')
    const body = init?.body ? JSON.parse(String(init.body)) : undefined
    calls.push({ path, body })
    const r = routes[path]
    if (!r) return json({ error: { code: 'http_error', message: 'Not Found', fields: [] } }, 404)
    const out = r(body)
    return json(out.body, out.status ?? 200)
  })
  vi.stubGlobal('fetch', f)
  return { fetch: f, calls }
}

export function renderApp(path = '/', signedIn = true) {
  setToken(signedIn ? 'tok' : null)
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  window.history.replaceState(null, '', path)
  const wrap = (c: ReactNode) => <QueryClientProvider client={qc}><MemoryRouter initialEntries={[path]}><AuthProvider>{c}</AuthProvider></MemoryRouter></QueryClientProvider>
  return render(wrap(<App />))
}
