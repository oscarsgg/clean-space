export type AdminNavItem = { href: string; label: string; icon: 'dashboard' | 'rooms' | 'devices' | 'people' | 'permissions' | 'parameters' | 'analytics' }
export const ADMIN_NAV_GROUPS: { label: string; items: AdminNavItem[] }[]
export const SUPERVISOR_NAV_PATHS: string[]
export function routeMatchesNavigation(pathname: string, href: string): boolean
