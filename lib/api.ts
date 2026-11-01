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
  updatePerson: (id: number, data: Record<string, unknown>) => request<ApiPerson>(`/personas/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deletePerson: (id: number) => request<void>(`/personas/${id}`, { method: 'DELETE' }),
  roles: () => request<unknown>('/roles'),
  rooms: () => request<unknown>('/cuartos'),
  createRoom: (data: Record<string, unknown>) => request<unknown>('/cuartos', { method: 'POST', body: JSON.stringify(data) }),
  updateRoom: (id: number, data: Record<string, unknown>) => request<unknown>(`/cuartos/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteRoom: (id: number) => request<void>(`/cuartos/${id}`, { method: 'DELETE' }),
  roomParameters: (id: number) => request<unknown>(`/cuartos/${id}/parametros`),
  saveRoomParameters: (id: number, data: unknown[]) => request<unknown>(`/cuartos/${id}/parametros`, { method: 'PUT', body: JSON.stringify(data) }),
  devices: () => request<unknown>('/dispositivos'),
  device: (id: number) => request<unknown>(`/dispositivos/${id}`),
  createDevice: (data: Record<string, unknown>) => request<unknown>('/dispositivos', { method: 'POST', body: JSON.stringify(data) }),
  updateDevice: (id: number, data: Record<string, unknown>) => request<unknown>(`/dispositivos/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteDevice: (id: number) => request<void>(`/dispositivos/${id}`, { method: 'DELETE' }),
  cards: () => request<unknown>('/tarjetas'),
  addCard: (personId: number, data: Record<string, unknown>) => request<unknown>(`/personas/${personId}/tarjetas`, { method: 'POST', body: JSON.stringify(data) }),
  permissions: () => request<unknown>('/permisos'),
  createPermission: (data: Record<string, unknown>) => request<unknown>('/permisos', { method: 'POST', body: JSON.stringify(data) }),
  updatePermission: (id: number, data: Record<string, unknown>) => request<unknown>(`/permisos/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  accesses: () => request<unknown>('/accesos'),
  monitoringHistory: () => request<unknown>('/monitoreo/historico'),
  notices: () => request<unknown>('/avisos'),
  acknowledgeNotice: (id: number) => request<unknown>(`/avisos/${id}/acknowledge`, { method: 'PATCH' }),
  analytics: {
    anomalies: () => request<unknown>('/analitica/anomalias'),
    indicators: () => request<unknown>('/analitica/indicadores'),
    series: (params = '') => request<unknown>(`/analitica/series${params}`),
    accessPatterns: () => request<unknown>('/analitica/patrones-acceso'),
    metrics: () => request<unknown>('/analitica/modelo/metricas'),
  },
  adminSummary: () => request<unknown>('/dashboard/admin/summary'),
}
