export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:8000/api/v1'

export type AuthSession = {
  access_token: string
  refresh_token?: string
  token_type?: string
  expires_in?: number
}

export type ApiPerson = {
  id: number
  name?: string
  full_name?: string
  email?: string
  role?: string
  status?: string
  rfid_card_id?: number | null
  [key: string]: unknown
}

function getAccessToken() {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem('cleanspace_access_token')
}

export function saveSession(session: AuthSession) {
  window.localStorage.setItem('cleanspace_access_token', session.access_token)
  if (session.refresh_token) window.localStorage.setItem('cleanspace_refresh_token', session.refresh_token)
}

export function clearSession() {
  window.localStorage.removeItem('cleanspace_access_token')
  window.localStorage.removeItem('cleanspace_refresh_token')
}

async function request<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set('Content-Type', 'application/json')
  const token = getAccessToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers })
  if (response.status === 401 && retry && typeof window !== 'undefined') {
    const refreshToken = window.localStorage.getItem('cleanspace_refresh_token')
    if (refreshToken) {
      const refreshed = await fetch(`${API_BASE_URL}/auth/refresh`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: refreshToken }) })
      if (refreshed.ok) { saveSession(await refreshed.json()); return request<T>(path, init, false) }
    }
    clearSession()
    window.location.assign('/login')
  }
  if (!response.ok) {
    const detail = await response.text()
    throw new Error(detail || `API request failed (${response.status})`)
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export const api = {
  login: (email: string, password: string) => request<AuthSession>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  me: () => request<Record<string, unknown>>('/auth/me'),
  logout: () => request<void>('/auth/logout', { method: 'POST', body: JSON.stringify({ refresh_token: typeof window !== 'undefined' ? window.localStorage.getItem('cleanspace_refresh_token') : null }) }),
  people: (params = '') => request<ApiPerson[] | { items?: ApiPerson[]; data?: ApiPerson[] }>(`/personas${params}`),
  createPerson: (data: Record<string, unknown>) => request<ApiPerson>('/personas', { method: 'POST', body: JSON.stringify(data) }),
}
