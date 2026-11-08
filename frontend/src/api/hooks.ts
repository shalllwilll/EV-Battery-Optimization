import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { api, health } from './client'
import type { CompareResult, EvidenceResponse, PredictionResult, PresetsResponse, RecommendResponse, Scenario, ZonesResponse } from './types'
import { useDebounced } from '../lib/useDebounced'

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
