export const ADMIN_NAV_GROUPS = [
  { label: 'Inicio', items: [{ href: '/admin/dashboard', label: 'Resumen', icon: 'dashboard' }] },
  { label: 'Administración', items: [
    { href: '/admin/cuartos', label: 'Cuartos limpios', icon: 'rooms' },
    { href: '/admin/dispositivos', label: 'Dispositivos', icon: 'devices' },
    { href: '/admin/personas', label: 'Personas autorizadas', icon: 'people' },
  ] },
  { label: 'Accesos y rangos', items: [
    { href: '/admin/permisos', label: 'Permisos', icon: 'permissions' },
    { href: '/admin/monitoreo/parametros', label: 'Parámetros ambientales', icon: 'parameters' },
  ] },
  { label: 'Datos', items: [{ href: '/admin/analisis', label: 'Análisis', icon: 'analytics' }] },
]

export const SUPERVISOR_NAV_PATHS = [
  '/supervisor/dashboard', '/supervisor/accesos', '/supervisor/monitoreo',
  '/supervisor/monitoreo/historico', '/supervisor/avisos', '/supervisor/analisis',
]

export function routeMatchesNavigation(pathname, href) {
  return pathname === href || pathname.startsWith(`${href}/`)
}
