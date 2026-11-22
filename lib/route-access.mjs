const ADMIN = 'ADMINISTRADOR'
const SUPERVISOR = 'SUPERVISOR'

export function requiredRoles(pathname) {
  if (pathname === '/analisis' || pathname === '/supervisor/analisis') return [ADMIN, SUPERVISOR]
  if (pathname === '/monitoreo/parametros') return [ADMIN]
  if (pathname === '/monitoreo' || pathname.startsWith('/monitoreo/') || pathname === '/avisos' || pathname === '/accesos') return [SUPERVISOR]
  if (pathname === '/app/admin' || pathname.startsWith('/app/admin/')) return [ADMIN]
  if (pathname === '/app/operador' || pathname.startsWith('/app/operador/')) return []
  if (pathname === '/admin' || pathname.startsWith('/admin/')) return [ADMIN]
  if (pathname === '/supervisor' || pathname.startsWith('/supervisor/')) return [SUPERVISOR]
  return null
}

export function isForbidden(pathname, roles) {
  const required = requiredRoles(pathname)
  if (required === null) return false
  if (required.length === 0) return true
  const normalized = roles.map((role) => String(role).toUpperCase())
  return !required.some((role) => normalized.includes(role))
}
