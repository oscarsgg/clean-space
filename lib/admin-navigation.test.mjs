import assert from 'node:assert/strict'
import test from 'node:test'
import { ADMIN_NAV_GROUPS, SUPERVISOR_NAV_PATHS, routeMatchesNavigation } from './admin-navigation.mjs'

const adminPaths = ADMIN_NAV_GROUPS.flatMap(group => group.items.map(item => item.href))

test('Admin and Supervisor navigation stay isolated and include their own analysis', () => {
  assert.ok(adminPaths.includes('/admin/analisis'))
  assert.ok(SUPERVISOR_NAV_PATHS.includes('/supervisor/analisis'))
  assert.ok(adminPaths.every(path => path.startsWith('/admin/')))
  assert.ok(SUPERVISOR_NAV_PATHS.every(path => path.startsWith('/supervisor/')))
})

test('nested Admin pages keep the correct section active', () => {
  assert.equal(routeMatchesNavigation('/admin/personas/24/permisos', '/admin/personas'), true)
  assert.equal(routeMatchesNavigation('/admin/monitoreo/parametros', '/admin/permisos'), false)
})
