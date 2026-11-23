import assert from 'node:assert/strict'
import test from 'node:test'
import { statusPresentation } from './admin-statuses.mjs'

test('localizes common operational statuses with a semantic tone', () => {
  assert.deepEqual(statusPresentation('ACTIVE'), { code: 'ACTIVE', label: 'Activo', tone: 'success' })
  assert.deepEqual(statusPresentation('INACTIVE'), { code: 'INACTIVE', label: 'Inactivo', tone: 'neutral' })
  assert.deepEqual(statusPresentation('OFFLINE'), { code: 'OFFLINE', label: 'Sin conexión', tone: 'warning' })
  assert.deepEqual(statusPresentation('EXPIRED'), { code: 'EXPIRED', label: 'Vencido', tone: 'warning' })
  assert.deepEqual(statusPresentation('CRITICAL', 'severity'), { code: 'CRITICAL', label: 'Crítica', tone: 'danger' })
  assert.deepEqual(statusPresentation('ACKNOWLEDGED'), { code: 'ACKNOWLEDGED', label: 'Atendido', tone: 'success' })
})

test('unknown future states stay visible with a neutral readable label', () => {
  assert.deepEqual(statusPresentation('WAITING_FOR_REVIEW'), { code: 'WAITING_FOR_REVIEW', label: 'Waiting For Review', tone: 'neutral' })
  assert.deepEqual(statusPresentation(''), { code: '', label: 'Sin estado', tone: 'neutral' })
})
