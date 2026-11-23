'use client'

import { useMemo, useState } from 'react'
import useSWR from 'swr'
import { Activity, AlertTriangle, ArrowUpRight, Building2, Droplets, Radio, Users } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AdminEmpty, AdminError, AdminField, AdminKpi, AdminLoading, AdminPanel, AdminStatusBadge, adminInputClass } from '@/components/admin-ui'
import { api, type AdminSummary } from '@/lib/api'
import { aggregateEnvironment, summarizeAccess, summarizeAlerts, summarizeCompliance } from '@/lib/admin-dashboard-metrics.mjs'

const SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const
const SEVERITY_COLORS: Record<string, string> = { LOW: '#0284c7', MEDIUM: '#d97706', HIGH: '#e11d48', CRITICAL: '#7f1d1d' }
const dateLabel = (date: string) => new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short' }).format(new Date(`${date}T12:00:00`))

function periodQuery(days: number, room: string) {
  const end = new Date()
  const start = new Date(end.getTime() - days * 86400000)
  const query = new URLSearchParams({ start_at: start.toISOString(), end_at: end.toISOString() })
  if (room) query.set('cleanroom_id', room)
  return `?${query.toString()}`
}

export function AdminDashboard() {
  const [days, setDays] = useState(30)
  const [room, setRoom] = useState('')
  const [metric, setMetric] = useState('')
  const query = useMemo(() => periodQuery(days, room), [days, room])
  const { data, error, isLoading } = useSWR<AdminSummary>(['admin-summary', query], ([, value]: [string, string]) => api.adminSummary(value))
  const environment = data?.environment_series ?? []
  const metrics = [...new Set(environment.map((point) => point.metric))].sort()
  const selectedMetric = metrics.includes(metric) ? metric : metrics[0] ?? ''
  const selectedEnvironment = environment.filter((point) => point.metric === selectedMetric && (!room || point.cleanroom_id === Number(room)))
  const environmentChart = useMemo(() => aggregateEnvironment(environment, selectedMetric, room), [environment, selectedMetric, room])
  const accessSeries = data?.access_series ?? []
  const alertSeries = data?.alert_series ?? []
  const alertData = alertSeries.map((day) => {
    const point: Record<string, string | number> = { date: day.date }
    SEVERITIES.forEach((severity) => { point[severity] = day.by_severity[severity] ?? 0 })
    return point
  })
  const accessSummary = summarizeAccess(accessSeries)
  const complianceSummary = summarizeCompliance(environment)
  const { accessCount, allowedCount } = { accessCount: accessSummary.total, allowedCount: accessSummary.allowed }
  const { sampleCount, inRangeCount } = { sampleCount: complianceSummary.comparable, inRangeCount: complianceSummary.inRange }
  const allowedRate = accessSummary.allowedPercent
  const compliance = complianceSummary.percent === null ? '—' : `${complianceSummary.percent}%`
  const formatPeriod = (value?: string | null) => value ? new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(value)) : ''
  const periodLabel = data?.period ? `${formatPeriod(data.period.start_at)} – ${formatPeriod(data.period.end_at)} UTC` : `${days} días · incluye hoy`
  const alertTotals = summarizeAlerts(alertSeries, [...SEVERITIES])
  const alertCounts = SEVERITIES.map((severity) => ({ severity, count: alertTotals[severity] }))
  const environmentAverage = environmentChart.length && environmentChart[0].count ? Number((environmentChart.reduce((sum, point) => sum + point.average * point.count, 0) / environmentChart.reduce((sum, point) => sum + point.count, 0)).toFixed(2)) : null

  return <main className="space-y-6 sm:space-y-8">
    <header className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
      <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Administración · panorama operativo</p><h1 className="mt-1 text-3xl font-semibold tracking-[-0.035em] text-foreground sm:text-4xl">Resumen de operación</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Accesos, condiciones ambientales y alertas según los registros recibidos por CleanSpace.</p></div>
      <div className="grid grid-cols-1 gap-3 rounded-2xl border border-border bg-card p-3 shadow-sm sm:grid-cols-2 lg:min-w-[24rem]">
        <AdminField label="Periodo"><select aria-label="Periodo" value={days} onChange={(event) => setDays(Number(event.target.value))} className={adminInputClass}><option value={7}>Últimos 7 días</option><option value={30}>Últimos 30 días</option><option value={90}>Últimos 90 días</option></select></AdminField>
        <AdminField label="Cuarto"><select aria-label="Cuarto limpio" value={room} onChange={(event) => setRoom(event.target.value)} className={adminInputClass}><option value="">Todos los cuartos</option>{(data?.rooms ?? []).map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></AdminField>
      </div>
    </header>

    {error && <AdminError error={error} fallback="No se pudo cargar el resumen operativo. Inténtalo de nuevo." />}
    {isLoading && !data ? <AdminLoading label="Preparando el resumen del periodo…" /> : data && <>
      <section aria-label="Indicadores del periodo" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <AdminKpi label="Accesos permitidos" value={allowedRate === null ? '—' : `${allowedRate}%`} detail={`${allowedCount.toLocaleString('es-MX')} de ${accessCount.toLocaleString('es-MX')} eventos · ${periodLabel}`} icon={<ArrowUpRight className="size-4" />} tone="teal" />
        <AdminKpi label="Lecturas en rango" value={compliance} detail={sampleCount ? `${inRangeCount.toLocaleString('es-MX')} de ${sampleCount.toLocaleString('es-MX')} lecturas con límites compatibles` : 'Sin muestras comparables con límites configurados'} icon={<Activity className="size-4" />} tone="blue" />
        <AdminKpi label="Alertas activas" value={String(data.active_alerts)} detail={`Snapshot actual · ${room ? 'cuarto filtrado' : 'todos los cuartos administrados'}`} icon={<AlertTriangle className="size-4" />} tone={data.active_alerts ? 'rose' : 'slate'} />
        <AdminKpi label="Lecturas recibidas" value={data.readings.toLocaleString('es-MX')} detail={`Durante ${periodLabel.toLowerCase()}`} icon={<Droplets className="size-4" />} tone="blue" />
        <AdminKpi label="Personas activas" value={data.active_people.toLocaleString('es-MX')} detail="Cuentas habilitadas registradas" icon={<Users className="size-4" />} tone="slate" />
      </section>

      <section className="grid min-w-0 gap-5 xl:grid-cols-2">
        <AdminPanel title="Decisiones de acceso" description={`Eventos permitidos y denegados · ${periodLabel}`}>
          {accessSeries.length ? <div className="p-4 sm:p-5"><div className="h-64 w-full" role="img" aria-label="Gráfica de accesos permitidos y denegados por día"><ResponsiveContainer width="100%" height="100%"><LineChart data={accessSeries} margin={{ top: 8, right: 10, bottom: 0, left: -18 }} accessibilityLayer><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e8eff0" /><XAxis dataKey="date" tickFormatter={dateLabel} tickLine={false} axisLine={false} minTickGap={24} fontSize={11} /><YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={11} /><Tooltip labelFormatter={(label) => dateLabel(String(label))} /><Legend /><Line type="monotone" dataKey="allowed" name="Permitidos" stroke="#087f7b" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} /><Line type="monotone" dataKey="denied" name="Denegados" stroke="#e11d48" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} /></LineChart></ResponsiveContainer></div><p className="mt-3 text-xs leading-5 text-muted-foreground">Resumen textual: {allowedCount.toLocaleString('es-MX')} autorizados y {(accessCount - allowedCount).toLocaleString('es-MX')} denegados. Los días sin eventos no generan una muestra.</p></div> : <AdminEmpty title="Sin eventos de acceso" description="No hay registros para el filtro seleccionado. Cambia el periodo o el cuarto para revisar otros datos." />}
        </AdminPanel>

        <AdminPanel title="Actividad de alertas" description={`Alertas generadas por severidad · ${periodLabel}`}>
          {alertData.length ? <div className="p-4 sm:p-5"><div className="h-64 w-full" role="img" aria-label="Gráfica de alertas por nivel de severidad y día"><ResponsiveContainer width="100%" height="100%"><BarChart data={alertData} margin={{ top: 8, right: 10, bottom: 0, left: -18 }} accessibilityLayer><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e8eff0" /><XAxis dataKey="date" tickFormatter={dateLabel} tickLine={false} axisLine={false} minTickGap={24} fontSize={11} /><YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={11} /><Tooltip labelFormatter={(label) => dateLabel(String(label))} /><Legend />{SEVERITIES.map((severity) => <Bar key={severity} dataKey={severity} name={{ LOW: 'Baja', MEDIUM: 'Media', HIGH: 'Alta', CRITICAL: 'Crítica' }[severity]} stackId="alerts" fill={SEVERITY_COLORS[severity]} radius={severity === 'CRITICAL' ? [4, 4, 0, 0] : undefined} />)}</BarChart></ResponsiveContainer></div><p className="mt-3 text-xs leading-5 text-muted-foreground">Resumen textual: {alertCounts.map((item) => `${item.count} ${{ LOW: 'bajas', MEDIUM: 'medias', HIGH: 'altas', CRITICAL: 'críticas' }[item.severity]}`).join(', ')}. Agrupadas por fecha de creación; una alerta activa puede haberse generado antes del periodo.</p></div> : <AdminEmpty title="Sin alertas generadas" description="No hay alertas registradas dentro del periodo y cuarto seleccionados." />}
        </AdminPanel>
      </section>

      <section className="grid min-w-0 gap-5 xl:grid-cols-[1.3fr_0.7fr]">
        <AdminPanel title="Tendencia ambiental" description={`Promedio por día · ${selectedMetric || 'sin métrica disponible'} · ${selectedEnvironment[0]?.unit || 'unidad no informada'}`}>
          {metrics.length > 0 && <div className="px-4 pt-4 sm:px-5"><select id="admin-metric" aria-label="Variable ambiental" value={selectedMetric} onChange={(event) => setMetric(event.target.value)} className={`${adminInputClass} sm:max-w-xs`}>{metrics.map((item) => <option key={item} value={item}>{item}</option>)}</select></div>}
          {environmentChart.length ? <div className="p-4 sm:p-5"><div className="h-64 w-full" role="img" aria-label="Gráfica de promedio ambiental diario"><ResponsiveContainer width="100%" height="100%"><LineChart data={environmentChart} margin={{ top: 8, right: 10, bottom: 0, left: -18 }} accessibilityLayer><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e8eff0" /><XAxis dataKey="date" tickFormatter={dateLabel} tickLine={false} axisLine={false} minTickGap={24} fontSize={11} /><YAxis tickLine={false} axisLine={false} fontSize={11} domain={['auto', 'auto']} /><Tooltip labelFormatter={(label) => dateLabel(String(label))} formatter={(value) => [`${value} ${selectedEnvironment[0]?.unit ?? ''}`, 'Promedio']} /><Legend /><Line type="monotone" dataKey="average" name="Promedio" stroke="#2563eb" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />{room && environmentChart[0]?.min_value !== null && <ReferenceLine y={environmentChart[0]?.min_value ?? undefined} stroke="#d97706" strokeDasharray="4 4" label="Mínimo" />}{room && environmentChart[0]?.max_value !== null && <ReferenceLine y={environmentChart[0]?.max_value ?? undefined} stroke="#e11d48" strokeDasharray="4 4" label="Máximo" />}</LineChart></ResponsiveContainer></div><p className="mt-3 text-xs leading-5 text-muted-foreground">Resumen textual: promedio ponderado {environmentAverage ?? 'sin muestras'} {selectedEnvironment[0]?.unit ?? ''} en {environmentChart.length} días con datos. {room ? `El cuarto filtrado permite comparar límites de ${selectedEnvironment[0]?.unit ?? 'la unidad reportada'}.` : 'Vista agregada. Elige un cuarto para mostrar sus límites de referencia.'} Los promedios no prueban calibración ni certificación.</p></div> : <AdminEmpty title="Sin lecturas ambientales" description="No hay lecturas para la métrica y el intervalo seleccionados." />}
        </AdminPanel>

        <AdminPanel title="Ocupación actual" description="Snapshot al momento de la consulta · independiente del periodo histórico">
          {data.rooms.length ? <div className="p-4 sm:p-5"><div className="h-64 w-full" role="img" aria-label="Comparación de ocupación actual y capacidad por cuarto"><ResponsiveContainer width="100%" height="100%"><BarChart data={data.rooms} layout="vertical" margin={{ top: 4, right: 12, bottom: 0, left: 8 }} accessibilityLayer><CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e8eff0" /><XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} fontSize={11} /><YAxis type="category" dataKey="code" width={58} tickLine={false} axisLine={false} fontSize={11} /><Tooltip /><Legend /><Bar dataKey="current_occupancy" name="Ocupación actual" fill="#087f7b" radius={[0, 4, 4, 0]} /><Bar dataKey="capacity" name="Capacidad registrada" fill="#cbd5e1" radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer></div><p className="mt-3 flex items-start gap-2 text-xs leading-5 text-muted-foreground"><Radio aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />La ocupación depende de los eventos de entrada y salida registrados; valida con la operación del sitio.</p><div className="mt-3 flex flex-wrap gap-2">{data.rooms.slice(0, 6).map((item) => <span key={item.id} className="inline-flex items-center gap-2 rounded-lg border border-border px-2.5 py-1.5 text-xs"><Building2 className="size-3.5 text-primary" />{item.code}<AdminStatusBadge value={item.device_status} /></span>)}</div></div> : <AdminEmpty title="No hay cuartos registrados" description="Registra un cuarto para consultar capacidad y ocupación reportada." />}
        </AdminPanel>
      </section>
    </>}
  </main>
}
