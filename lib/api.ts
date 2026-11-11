export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000/api/v1'

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

export type ApiRoom = {
  id: number
  code: string
  name: string
  location: string
  description: string
  access_level: string
  status: string
}

export type ApiRoomParameter = {
  id?: number
  cleanroom_id?: number
  metric: string
  min_value: number
  max_value: number
  unit: string
  enabled: boolean
}

const ACCESS_TOKEN_COOKIE = 'cleanspace_access_token'
const REFRESH_TOKEN_COOKIE = 'cleanspace_refresh_token'
const SESSION_EXPIRED_MESSAGE = 'Tu sesión expiró. Inicia sesión nuevamente.'

function getCookie(name: string) {
  if (typeof document === 'undefined') return null
  const cookie = document.cookie
    .split('; ')
    .find((entry) => entry.startsWith(`${name}=`))
  return cookie ? decodeURIComponent(cookie.slice(name.length + 1)) : null
}

function setCookie(name: string, value: string, maxAge = 60 * 60 * 24 * 7) {
  if (typeof document === 'undefined') return
  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax${secure}`
}

function deleteCookie(name: string) {
  if (typeof document === 'undefined') return
  document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0`
}

function getRefreshToken() {
  if (typeof window === 'undefined') return null
  return getCookie(REFRESH_TOKEN_COOKIE) ?? window.localStorage.getItem(REFRESH_TOKEN_COOKIE)
}

export function getAccessToken() {
  if (typeof window === 'undefined') return null
  return getCookie(ACCESS_TOKEN_COOKIE) ?? window.localStorage.getItem(ACCESS_TOKEN_COOKIE)
}

export function redirectToLogin(message = SESSION_EXPIRED_MESSAGE) {
  if (typeof window === 'undefined') return
  clearSession()
  if (typeof window.sessionStorage !== 'undefined') {
    window.sessionStorage.setItem('auth_session_message', message)
  }
  window.location.assign('/login')
}

export function decodeJwtPayload(token: string | null): Record<string, unknown> | null {
  if (!token) return null
  const parts = token.split('.')
  if (parts.length < 2) return null
  try {
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = payload.padEnd(Math.ceil(payload.length / 4) * 4, '=')
    const json = decodeURIComponent(
      atob(padded)
        .split('')
        .map((char) => `%${(`00${char.charCodeAt(0).toString(16)}`).slice(-2)}`)
        .join(''),
    )
    return JSON.parse(json) as Record<string, unknown>
  } catch {
    return null
  }
}

export function getJwtExpiration(token: string | null): number | null {
  const payload = decodeJwtPayload(token)
  const exp = payload?.exp
  if (typeof exp === 'number') return exp
  if (typeof exp === 'string') {
    const parsed = Number(exp)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

export function hasValidAccessToken(token: string | null = getAccessToken()) {
  if (!token) return false
  const exp = getJwtExpiration(token)
  if (exp === null) return true
  return Date.now() / 1000 < exp - 30
}

export function getCurrentUserFromToken() {
  return decodeJwtPayload(getAccessToken())
}

export function saveSession(session: AuthSession) {
  const accessToken = session.access_token
  const expiresIn = Math.max(60, session.expires_in ?? 60 * 60 * 24 * 7)
  setCookie(ACCESS_TOKEN_COOKIE, accessToken, expiresIn)
  if (session.refresh_token) setCookie(REFRESH_TOKEN_COOKIE, session.refresh_token, 60 * 60 * 24 * 30)
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(ACCESS_TOKEN_COOKIE, accessToken)
    if (session.refresh_token) window.localStorage.setItem(REFRESH_TOKEN_COOKIE, session.refresh_token)
  }
}

export function clearSession() {
  deleteCookie(ACCESS_TOKEN_COOKIE)
  deleteCookie(REFRESH_TOKEN_COOKIE)
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(ACCESS_TOKEN_COOKIE)
    window.localStorage.removeItem(REFRESH_TOKEN_COOKIE)
  }
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken()
  if (!refreshToken) return null

  try {
    const refreshed = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })

    if (!refreshed.ok) return null

    const payload = (await refreshed.json()) as AuthSession
    if (!payload.access_token) return null

    saveSession(payload)
    return payload.access_token
  } catch {
    return null
  }
}

async function request<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set('Content-Type', 'application/json')

  const isPublicAuthRequest = path === '/auth/login' || path === '/auth/refresh'

  if (!isPublicAuthRequest) {
    let token = getAccessToken()
    if (!token) {
      if (typeof window !== 'undefined') redirectToLogin()
      throw new Error(SESSION_EXPIRED_MESSAGE)
    }

    if (!hasValidAccessToken(token)) {
      const refreshedToken = await refreshAccessToken()
      if (!refreshedToken) {
        if (typeof window !== 'undefined') redirectToLogin()
        throw new Error(SESSION_EXPIRED_MESSAGE)
      }
      token = refreshedToken
    }

    headers.set('Authorization', `Bearer ${token}`)
  }

  const response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers })

  if (isPublicAuthRequest) {
    if (!response.ok) {
      const detail = await response.text()
      throw new Error(detail || `API request failed (${response.status})`)
    }
    if (response.status === 204) return undefined as T
    return response.json() as Promise<T>
  }

  if (response.status === 401 && retry && typeof window !== 'undefined') {
    const refreshedToken = await refreshAccessToken()
    if (refreshedToken) {
      headers.set('Authorization', `Bearer ${refreshedToken}`)
      const retried = await fetch(`${API_BASE_URL}${path}`, { ...init, headers })
      if (retried.ok) {
        if (retried.status === 204) return undefined as T
        return retried.json() as Promise<T>
      }
      if (retried.status === 401) {
        redirectToLogin()
        throw new Error(SESSION_EXPIRED_MESSAGE)
      }
    }

    redirectToLogin()
    throw new Error(SESSION_EXPIRED_MESSAGE)
  }

  if (!response.ok) {
    const detail = await response.text()
    if (response.status === 401) {
      redirectToLogin()
    }
    throw new Error(detail || `API request failed (${response.status})`)
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export const api = {
  login: (email: string, password: string) => request<AuthSession>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  me: () => request<Record<string, unknown>>('/auth/me'),
  logout: () => request<void>('/auth/logout', { method: 'POST', body: JSON.stringify({ refresh_token: getRefreshToken() }) }),
  people: (params = '') => request<ApiPerson[] | { items?: ApiPerson[]; data?: ApiPerson[] }>(`/personas${params}`),
  createPerson: (data: Record<string, unknown>) => request<ApiPerson>('/personas', { method: 'POST', body: JSON.stringify(data) }),
  updatePerson: (id: number, data: Record<string, unknown>) => request<ApiPerson>(`/personas/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deletePerson: (id: number) => request<void>(`/personas/${id}`, { method: 'DELETE' }),
  roles: () => request<unknown>('/roles'),
  rooms: () => request<ApiRoom[]>('/cuartos'),
  room: (id: number) => request<ApiRoom>(`/cuartos/${id}`),
  createRoom: (data: Omit<ApiRoom, 'id'>) => request<ApiRoom>('/cuartos', { method: 'POST', body: JSON.stringify(data) }),
  updateRoom: (id: number, data: Partial<Omit<ApiRoom, 'id' | 'code'>>) => request<ApiRoom>(`/cuartos/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteRoom: (id: number) => request<void>(`/cuartos/${id}`, { method: 'DELETE' }),
  roomParameters: (id: number) => request<ApiRoomParameter[]>(`/cuartos/${id}/parametros`),
  saveRoomParameters: (id: number, data: ApiRoomParameter[]) => request<ApiRoomParameter[]>(`/cuartos/${id}/parametros`, { method: 'PUT', body: JSON.stringify(data) }),
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
