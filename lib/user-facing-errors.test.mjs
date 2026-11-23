import assert from 'node:assert/strict'
import test from 'node:test'
import { userFacingApiError, userFacingClientError } from './user-facing-errors.mjs'

test('API errors are translated into actionable Spanish messages', () => {
  assert.match(userFacingApiError(401, '{"detail":"Not authenticated"}'), /sesión venció/i)
  assert.match(userFacingApiError(422, '{"detail":[{"loc":["body","name"],"msg":"Field required"}]}'), /formulario/i)
  assert.match(userFacingApiError(503, '{"detail":"API_ERROR: timeout"}'), /más tarde/i)
  assert.match(userFacingApiError(500, 'Traceback: secret implementation detail'), /más tarde/i)
})

test('safe domain messages remain useful and technical client failures are hidden', () => {
  assert.equal(userFacingApiError(400, '{"detail":"El código ya está registrado."}'), 'El código ya está registrado.')
  assert.match(userFacingClientError(new Error('Failed to fetch')), /conexión/i)
})
