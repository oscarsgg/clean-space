import assert from 'node:assert/strict'
import test from 'node:test'
import { aggregateEnvironment, summarizeAccess, summarizeAlerts, summarizeCompliance } from './admin-dashboard-metrics.mjs'

test('access summary handles empty data and derives a true event percentage', () => {
  assert.deepEqual(summarizeAccess([]), { allowed: 0, denied: 0, total: 0, allowedPercent: null })
  assert.deepEqual(summarizeAccess([{ allowed: 3, denied: 1 }, { allowed: 1, denied: 1 }]), { allowed: 4, denied: 2, total: 6, allowedPercent: 67 })
})

test('environment compliance only divides by comparable samples', () => {
  assert.deepEqual(summarizeCompliance([]), { comparable: 0, inRange: 0, percent: null })
  assert.deepEqual(summarizeCompliance([{ limits_sample_count: 7, in_range_count: 6 }, { limits_sample_count: 0, in_range_count: 0 }]), { comparable: 7, inRange: 6, percent: 86 })
})

test('environment averages are weighted, sorted, and omit shared limits for mixed rooms', () => {
  const rows = [
    { date: '2026-11-02', cleanroom_id: 1, metric: 'temp', average: 20, count: 1, min_value: 18, max_value: 22 },
    { date: '2026-11-01', cleanroom_id: 1, metric: 'temp', average: 10, count: 3, min_value: 18, max_value: 22 },
    { date: '2026-11-01', cleanroom_id: 2, metric: 'temp', average: 30, count: 1, min_value: 28, max_value: 32 },
  ]
  assert.deepEqual(aggregateEnvironment(rows, 'temp', '1'), [
    { date: '2026-11-01', count: 3, min_value: 18, max_value: 22, average: 10 },
    { date: '2026-11-02', count: 1, min_value: 18, max_value: 22, average: 20 },
  ])
  assert.deepEqual(aggregateEnvironment(rows, 'temp', ''), [
    { date: '2026-11-01', count: 4, min_value: null, max_value: null, average: 15 },
    { date: '2026-11-02', count: 1, min_value: null, max_value: null, average: 20 },
  ])
})

test('alert totals include only observed severity counts', () => {
  assert.deepEqual(summarizeAlerts([{ by_severity: { HIGH: 1 } }, { by_severity: { HIGH: 2, LOW: 3 } }], ['LOW', 'HIGH', 'CRITICAL']), { LOW: 3, HIGH: 3, CRITICAL: 0 })
})
