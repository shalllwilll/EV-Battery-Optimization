import { useMemo } from 'react'
import { keepPreviousData, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, health } from './client'
import type { CompareResult, EvidenceResponse, PredictionResult, PresetsResponse, RecommendResponse, Scenario, ZonesResponse } from './types'
import { useDebounced } from '../lib/useDebounced'
import { toFleetRequest } from '../lib/fleet/io'
import type { Fleet, FleetForecast } from '../lib/fleet/types'

const key = (o: unknown) => JSON.stringify(o)
const STATIC = { staleTime: Infinity, retry: 1 } as const
// One fixed seed and draw count so every page, every panel and the 3D bus show the same numbers for the same scenario.
export const N_DRAWS = 2000

export const useHealth = () => useQuery({ queryKey: ['health'], queryFn: health, refetchInterval: 30_000, retry: false })
export const usePresets = () => useQuery({ queryKey: ['presets'], queryFn: ({ signal }) => api.get<PresetsResponse>('/presets', signal), ...STATIC })
export const useZones = () => useQuery({ queryKey: ['zones'], queryFn: ({ signal }) => api.get<ZonesResponse>('/zones', signal), ...STATIC })
export const useEvidence = () => useQuery({ queryKey: ['evidence'], queryFn: ({ signal }) => api.get<EvidenceResponse>('/evidence', signal), ...STATIC })

/** Debounced so dragging a slider does not fire a request per pixel; the previous result stays on screen meanwhile. */
export function usePredict(scenario: Scenario | null, delay = 350) {
  const s = useDebounced(scenario, delay)
  return useQuery({
    queryKey: ['predict', key(s)],
    queryFn: ({ signal }) => api.post<PredictionResult>('/predict', { scenario: s, n_draws: N_DRAWS }, signal),
    enabled: !!s, placeholderData: keepPreviousData, staleTime: Infinity, retry: false,
  })
}

export function useCompare(a: Scenario | null, b: Scenario | null, delay = 350) {
  const sa = useDebounced(a, delay), sb = useDebounced(b, delay)
  return useQuery({
    queryKey: ['compare', key(sa), key(sb)],
    queryFn: ({ signal }) => api.post<CompareResult>('/compare', { scenarios: [sa, sb], n_draws: N_DRAWS }, signal),
    enabled: !!sa && !!sb, placeholderData: keepPreviousData, staleTime: Infinity, retry: false,
  })
}

export function useRecommend(scenario: Scenario | null, reserve = 0.2, delay = 500) {
  const s = useDebounced(scenario, delay)
  return useQuery({
    queryKey: ['recommend', key(s), reserve],
    queryFn: ({ signal }) => api.post<RecommendResponse>('/recommend', { scenario: s, reserve_fraction: reserve, n_draws: N_DRAWS }, signal),
    enabled: !!s, placeholderData: keepPreviousData, staleTime: Infinity, retry: false,
  })
}

/** Several one-lever variants of a scenario, asked one after another (the server computes a cold one in about 0.25 s and a single worker gains nothing from
 *  parallel calls) so each row can appear as soon as it is ready. Same query keys as `usePredict`, so applying a lever later is already cached. */
export function useLeverSweep(variants: Scenario[], enabled: boolean, delay = 600) {
  const qc = useQueryClient()
  const list = useDebounced(key(variants), delay)
  const arr = (JSON.parse(list) as Scenario[]) ?? []
  return useQueries({
    queries: arr.map((s, i) => {
      const prev = i === 0 ? 'success' : qc.getQueryState(['predict', key(arr[i - 1])])?.status
      return {
        queryKey: ['predict', key(s)], queryFn: ({ signal }: { signal: AbortSignal }) => api.post<PredictionResult>('/predict', { scenario: s, n_draws: N_DRAWS }, signal),
        enabled: enabled && (prev === 'success' || prev === 'error'), placeholderData: keepPreviousData, staleTime: Infinity, retry: false,
      }
    }),
  })
}

/** Whether this server can send the report by email (it needs mail credentials in its environment). */
export function useReportStatus() {
  return useQuery({ queryKey: ['report-status'], queryFn: ({ signal }) => api.get<{ email_enabled: boolean }>('/report/status', signal), staleTime: Infinity, retry: false })
}

const localToday = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }

/** The whole fleet in one call. Only duty classes and bus ages are sent. (Chunking the classes so the first figures appear early comes with the Fleet page.) */
export function useFleetForecast(fleet: Fleet | null, delay = 400) {
  const f = useDebounced(fleet, delay)
  const req = useMemo(() => (f ? toFleetRequest(f, localToday()) : null), [f])
  const k = useMemo(() => key(req), [req])
  return useQuery({
    queryKey: ['fleet', k],
    queryFn: ({ signal }) => api.post<FleetForecast>('/fleet', req, signal),
    enabled: !!req, placeholderData: keepPreviousData, staleTime: Infinity, retry: false,
  })
}
