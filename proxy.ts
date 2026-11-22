import { NextRequest, NextResponse } from 'next/server'
import { requiredRoles } from '@/lib/route-access.mjs'

const SESSION_COOKIE = 'cleanspace_route_session'
const ADMIN = 'ADMINISTRADOR'
const SUPERVISOR = 'SUPERVISOR'

function loginRedirect(request: NextRequest) {
  const login = new URL('/login', request.url)
  login.searchParams.set('next', request.nextUrl.pathname + request.nextUrl.search)
  return NextResponse.redirect(login)
}

function errorPage(request: NextRequest, path: '/403' | '/503', status: number, message?: string) {
  const requestHeaders = new Headers(request.headers)
  if (message) requestHeaders.set('x-cleanspace-error-message', message)
  return NextResponse.rewrite(new URL(path, request.url), {
    status,
    request: { headers: requestHeaders },
    headers: { 'cache-control': 'no-store' },
  })
}

function serviceUnavailable(request: NextRequest, message: string, status = 503) {
  return errorPage(request, '/503', status, message)
}

export async function proxy(request: NextRequest) {
  const rolesRequired = requiredRoles(request.nextUrl.pathname)
  if (rolesRequired === null) return NextResponse.next()

  const token = request.cookies.get(SESSION_COOKIE)?.value
  if (!token) return loginRedirect(request)

  const apiBase = process.env.CLEANSPACE_API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_BASE_URL || (process.env.NODE_ENV === 'development' ? 'http://localhost:8000/api/v1' : '')
  if (!apiBase) return serviceUnavailable(request, 'El servidor de autenticación no está configurado. Contacta al administrador del sistema.')

  try {
    const response = await fetch(`${apiBase.replace(/\/$/, '')}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
    if (response.status === 401) return loginRedirect(request)
    if (!response.ok) return serviceUnavailable(request, 'El servicio de autenticación no respondió correctamente. Intenta de nuevo más tarde.')

    const user = (await response.json()) as { roles?: unknown }
    const roles = Array.isArray(user.roles) ? user.roles.map((role) => String(role).toUpperCase()) : []
    if (rolesRequired.length === 0 || !rolesRequired.some((role) => roles.includes(role))) {
      return errorPage(request, '/403', 403)
    }
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-cleanspace-verified-role', roles.includes(ADMIN) ? ADMIN : SUPERVISOR)
    return NextResponse.next({ request: { headers: requestHeaders } })
  } catch {
    return serviceUnavailable(request, 'No pudimos comunicarnos con el servicio de autenticación. Comprueba que esté disponible e inténtalo de nuevo.')
  }
}

export const config = {
  matcher: ['/admin/:path*', '/supervisor/:path*', '/analisis', '/monitoreo/:path*', '/monitoreo', '/avisos', '/accesos', '/app/admin/:path*', '/app/operador/:path*'],
}
