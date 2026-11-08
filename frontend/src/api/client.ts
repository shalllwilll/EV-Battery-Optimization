import type { LoginResponse } from './types'

const BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? ''
const TOKEN_KEY = 'ph_token'

export class ApiClientError extends Error {
  constructor(public status: number, public code: string, message: string, public fields: { field: string; message: string }[] = []) {
    super(message)
  }
}

let token: string | null = null
try { token = sessionStorage.getItem(TOKEN_KEY) } catch { /* storage blocked: stay signed-out after reload */ }

export const getToken = () => token
export function setToken(t: string | null) {
  token = t
  try { if (t) sessionStorage.setItem(TOKEN_KEY, t); else sessionStorage.removeItem(TOKEN_KEY) } catch { /* ignore */ }
}

export const AUTH_EXPIRED = 'ph:auth-expired'

export async function request<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const headers = new Headers(init.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  let body = init.body
  if (init.json !== undefined) { headers.set('Content-Type', 'application/json'); body = JSON.stringify(init.json) }
  let res: Response
  try {
    res = await fetch(`${BASE}/api/v1${path}`, { ...init, headers, body })
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e
    throw new ApiClientError(0, 'network', 'The service could not be reached. Check that the backend is running, then retry.')
  }
  if (!res.ok) {
    let err: { error?: { code?: string; message?: string; fields?: { field: string; message: string }[] } } = {}
    try { err = await res.json() } catch { /* non-JSON error body */ }
    if (res.status === 401 && token && path !== '/auth/login') { setToken(null); window.dispatchEvent(new Event(AUTH_EXPIRED)) }
    throw new ApiClientError(res.status, err.error?.code ?? 'http_error', err.error?.message ?? `Request failed (${res.status}).`, err.error?.fields ?? [])
  }
  return (await res.json()) as T
}

export const api = {
  login: (username: string, password: string) => request<LoginResponse>('/auth/login', { method: 'POST', json: { username, password } }),
  get: <T,>(path: string, signal?: AbortSignal) => request<T>(path, { signal }),
  post: <T,>(path: string, json: unknown, signal?: AbortSignal) => request<T>(path, { method: 'POST', json, signal }),
}

export async function health(): Promise<{ status: string; model_version: string }> {
  return request('/health')
}
