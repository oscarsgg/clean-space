export function summarizeAccess(series = []) {
  const allowed = series.reduce((sum, point) => sum + Number(point.allowed || 0), 0)
  const denied = series.reduce((sum, point) => sum + Number(point.denied || 0), 0)
  const total = allowed + denied
  return { allowed, denied, total, allowedPercent: total ? Math.round((allowed / total) * 100) : null }
}

export function summarizeCompliance(series = []) {
  const comparable = series.reduce((sum, point) => sum + Number(point.limits_sample_count || 0), 0)
  const inRange = series.reduce((sum, point) => sum + Number(point.in_range_count || 0), 0)
  return { comparable, inRange, percent: comparable ? Math.round((inRange / comparable) * 100) : null }
}

export function aggregateEnvironment(series = [], metric, roomId = '') {
  const buckets = new Map()
  series.filter((point) => point.metric === metric && (!roomId || point.cleanroom_id === Number(roomId))).forEach((point) => {
    const bucket = buckets.get(point.date) ?? { date: point.date, weighted: 0, count: 0, min_value: roomId ? point.min_value : null, max_value: roomId ? point.max_value : null }
    bucket.weighted += Number(point.average) * Number(point.count)
    bucket.count += Number(point.count)
    buckets.set(point.date, bucket)
  })
  return [...buckets.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(({ weighted, ...item }) => ({ ...item, average: item.count ? Number((weighted / item.count).toFixed(2)) : 0 }))
}

export function summarizeAlerts(series = [], severities = []) {
  return Object.fromEntries(severities.map((severity) => [
    severity,
    series.reduce((sum, day) => sum + Number(day.by_severity?.[severity] || 0), 0),
  ]))
}
