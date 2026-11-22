import assert from 'node:assert/strict'
import test from 'node:test'
import { isForbidden, requiredRoles } from './route-access.mjs'

test('Admin and Supervisor share analysis routes', () => {
  for (const pathname of ['/analisis', '/supervisor/analisis']) {
    assert.equal(isForbidden(pathname, ['ADMINISTRADOR']), false)
    assert.equal(isForbidden(pathname, ['SUPERVISOR']), false)
  }
})

test('exclusive routes reject the other role', () => {
  assert.equal(isForbidden('/admin/personas', ['SUPERVISOR']), true)
  assert.equal(isForbidden('/supervisor/avisos', ['ADMINISTRADOR']), true)
  assert.equal(isForbidden('/monitoreo/parametros', ['SUPERVISOR']), true)
})

test('legacy routes keep their role policy and unprotected pages stay public', () => {
  assert.deepEqual(requiredRoles('/monitoreo/historico'), ['SUPERVISOR'])
  assert.deepEqual(requiredRoles('/avisos'), ['SUPERVISOR'])
  assert.deepEqual(requiredRoles('/acceso/cuarto-01'), null)
  assert.equal(isForbidden('/app/operador', ['PERSONAL_AUTORIZADO']), true)
})
