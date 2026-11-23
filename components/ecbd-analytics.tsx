'use client'

import { useMemo, useState } from 'react'
import useSWR from 'swr'
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  BrainCircuit,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  CircleHelp,
  Clock3,
  Database,
  DoorOpen,
  LoaderCircle,
  RefreshCw,
  Sparkles,
  Thermometer,
  Users,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { AdminKpi, AdminPanel, AdminStatusBadge, adminInputClass } from '@/components/admin-ui'
import { api, type AccessPatternCluster, type AnalyticsEtlResult, type ModelResultItem, type SupervisorRoomSummary, type SupervisorSummary } from '@/lib/api'
import { useRealtimeEvents } from '@/hooks/use-realtime-events'

type AnomalyAlert = {
  id: number
  cleanroom_id: number
  severity?: string
  message: string
  status?: string
  created_at: string
}

type ModelAnomaly = {
  reading_id: number
  cleanroom_id: number
  metric: string
  value: number
  unit: string
  recorded_at: string
  anomaly_score: number
}

type ModelSummary = {
  run_id: number | null
  prepared_rows: number
  training_rows: number
  unusable_rows: number
  groups_total: number
  groups_trained: number
  groups_skipped: number
  anomalies_detected: number
  anomalies_available: number
  anomalies_truncated: boolean
  anomaly_rate: number
  contamination: number | null
  status: string
  metrics_included: string[]
  evaluation: { mean_jaccard: number | null; seed_count: number; uses_ground_truth_labels: boolean } | null
  anomalies: ModelAnomaly[]
}

type IndicatorsResponse = {
  total_readings?: number
  total_accesses?: number
  allowed_accesses?: number
  denied_accesses?: number
  active_alerts?: number
}

const CLUSTER_TONES: Record<string, string> = { c1: '#0b8b7c', c2: '#3476a3', c3: '#d97706' }
const METRIC_LABELS: Record<string, string> = {
  temperature: 'Temperatura', temp: 'Temperatura', humidity: 'Humedad', pm25: 'Partículas PM2.5',
  pressure: 'Presión', particles: 'Partículas',
}

function asArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[]
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    for (const key of ['items', 'data', 'results']) if (Array.isArray(record[key])) return record[key] as T[]
  }
  return []
}

function parseModelResult(result: ModelResultItem): ModelSummary {
  let raw: Record<string, unknown> = {}
  try {
    const parsed: unknown = typeof result.result_json === 'string' ? JSON.parse(result.result_json) : result.result_json
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) raw = parsed as Record<string, unknown>
  } catch {
    raw = {}
  }

  const anomalies = Array.isArray(raw.anomalies)
    ? raw.anomalies.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object' && !Array.isArray(item))).map((item) => ({
        reading_id: Number(item.reading_id) || 0,
        cleanroom_id: Number(item.cleanroom_id) || 0,
        metric: String(item.metric ?? 'unknown'),
        value: Number(item.value) || 0,
        unit: String(item.unit ?? ''),
        recorded_at: String(item.recorded_at ?? ''),
        anomaly_score: Number(item.anomaly_score) || 0,
      }))
    : []
  const parameters = raw.parameters && typeof raw.parameters === 'object' ? raw.parameters as Record<string, unknown> : {}
  const evaluation = raw.evaluation && typeof raw.evaluation === 'object' ? raw.evaluation as Record<string, unknown> : null
  const meanJaccard = evaluation?.mean_jaccard
  const contamination = parameters.contamination

  return {
    run_id: Number(raw.run_id) || null,
    prepared_rows: Number(raw.prepared_rows) || 0,
    training_rows: Number(raw.training_rows) || 0,
    unusable_rows: Number(raw.unusable_rows) || 0,
    groups_total: Number(raw.groups_total) || 0,
    groups_trained: Number(raw.groups_trained) || 0,
    groups_skipped: Array.isArray(raw.groups_skipped) ? raw.groups_skipped.length : Number(raw.groups_skipped) || 0,
    anomalies_detected: Number(raw.anomalies_detected) || 0,
    anomalies_available: Number(raw.anomalies_available) || anomalies.length,
    anomalies_truncated: Boolean(raw.anomalies_truncated),
    anomaly_rate: Number(raw.anomaly_rate) || 0,
    contamination: typeof contamination === 'number' && Number.isFinite(contamination) ? contamination : null,
    status: String(raw.status ?? 'unknown'),
    metrics_included: Array.isArray(raw.metrics_included) ? raw.metrics_included.map(String) : [],
    evaluation: evaluation
      ? {
          mean_jaccard: typeof meanJaccard === 'number' && Number.isFinite(meanJaccard) ? meanJaccard : null,
          seed_count: Number(evaluation.seed_count) || 0,
          uses_ground_truth_labels: Boolean(evaluation.uses_ground_truth_labels),
        }
      : null,
    anomalies,
  }
}

function formatDateTime(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })
}

function formatShortDate(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })
}

function formatTime(value?: string | null) {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
}

function percentage(value: number) {
  return `${(value <= 1 ? value * 100 : value).toLocaleString('es-MX', { maximumFractionDigits: 1 })}%`
}

function metricLabel(metric: string) {
  return METRIC_LABELS[metric.toLowerCase()] ?? metric.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function roomLabel(roomId: number, rooms: SupervisorRoomSummary[]) {
  const room = rooms.find((item) => item.id === roomId)
  return room ? `${room.code} · ${room.name}` : `Cuarto #${roomId}`
}

export function EcbdAnalytics({ variant = 'supervisor' }: { variant?: 'admin' | 'supervisor' }) {
  const [selectedRoomId, setSelectedRoomId] = useState<number | undefined>()
  const [periodDays, setPeriodDays] = useState(30)
  const [readingMetric, setReadingMetric] = useState('')
  const [alertsPage, setAlertsPage] = useState(1)
  const [flaggedReadingsPage, setFlaggedReadingsPage] = useState(1)
  const [etlSummary, setEtlSummary] = useState<AnalyticsEtlResult | null>(null)
  const [actionBusy, setActionBusy] = useState<'review' | 'analysis' | 'refresh' | null>(null)
  const [actionMessage, setActionMessage] = useState<{ tone: 'success' | 'warning' | 'error'; text: string } | null>(null)

  const analyticsQuery = useMemo(() => {
    const end = new Date()
    const start = new Date(end.getTime() - periodDays * 86400000)
    const params = new URLSearchParams({ start_at: start.toISOString(), end_at: end.toISOString() })
    if (selectedRoomId) params.set('cleanroom_id', String(selectedRoomId))
    return `?${params.toString()}`
  }, [periodDays, selectedRoomId])

  const { data: summary, error: summaryError, isLoading: summaryLoading } = useSWR<SupervisorSummary>('supervisor-summary', () => api.supervisorSummary())
  const { data: correlation, error: correlationError, isLoading: correlationLoading, mutate: mutateCorrelation } = useSWR(['ecbd-correlation', selectedRoomId ?? 'all'], () => api.analytics.correlation(selectedRoomId))
  const { data: patternsRaw, error: patternsError, isLoading: patternsLoading, mutate: mutatePatterns } = useSWR(['ecbd-patterns', analyticsQuery], () => api.analytics.accessPatterns(analyticsQuery))
  const { data: anomaliesRaw, error: anomaliesError, isLoading: anomaliesLoading, mutate: mutateAnomalies } = useSWR(['ecbd-anomalies', analyticsQuery], () => api.analytics.anomalies(analyticsQuery))
  const { data: metricsRaw, error: metricsError, isLoading: metricsLoading, mutate: mutateMetrics } = useSWR(['ecbd-metrics', analyticsQuery], () => api.analytics.metrics(analyticsQuery))
  const { data: indicatorsRaw, error: indicatorsError, isLoading: indicatorsLoading, mutate: mutateIndicators } = useSWR(['ecbd-indicators', analyticsQuery], () => api.analytics.indicators(analyticsQuery))
  const { data: readingsRaw, error: readingsError, isLoading: readingsLoading, mutate: mutateReadings } = useSWR(['ecbd-series', analyticsQuery], () => api.analytics.series(analyticsQuery))

  useRealtimeEvents({ mutateKeys: ['ecbd-correlation', 'ecbd-patterns', 'ecbd-anomalies', 'ecbd-metrics', 'ecbd-indicators', 'ecbd-series'] })

  const rooms = Array.isArray(summary?.rooms) ? summary.rooms : []
  const points = useMemo(() => correlation?.points ?? [], [correlation])
  const patterns = useMemo(() => asArray<AccessPatternCluster>(patternsRaw), [patternsRaw])
  const anomalies = useMemo(() => asArray<AnomalyAlert>(anomaliesRaw), [anomaliesRaw])
  const modelResults = useMemo(() => asArray<ModelResultItem>(metricsRaw), [metricsRaw])
  const latestModel = modelResults[0]
  const latestSummary = useMemo(() => latestModel ? parseModelResult(latestModel) : null, [latestModel])
  const indicators = (indicatorsRaw && typeof indicatorsRaw === 'object' ? indicatorsRaw : {}) as IndicatorsResponse
  const readings = useMemo(() => asArray<{ recorded_at: string; metric: string; unit: string; value: number }>(readingsRaw), [readingsRaw])
  const readingOptions = useMemo(() => [...new Map(readings.map((item) => [`${item.metric}::${item.unit}`, { key: `${item.metric}::${item.unit}`, metric: item.metric, unit: item.unit }])).values()], [readings])
  const activeReadingKey = readingOptions.some((option) => option.key === readingMetric) ? readingMetric : readingOptions[0]?.key ?? ''
  const selectedReading = readingOptions.find((option) => option.key === activeReadingKey)
  const readingChart = readings.filter((item) => `${item.metric}::${item.unit}` === activeReadingKey).slice(-150)
  const trainingHistory = [...modelResults].reverse().map((result) => {
    const parsed = parseModelResult(result)
    return { date: result.trained_at, detected: parsed.anomalies_detected, rows: parsed.training_rows, rate: parsed.anomaly_rate * 100 }
  })
  const allowedRate = indicators.total_accesses ? Math.round(((indicators.allowed_accesses ?? 0) / indicators.total_accesses) * 100) : null
  const alertsPageCount = Math.max(1, Math.ceil(anomalies.length / 3))
  const currentAlertsPage = Math.min(alertsPage, alertsPageCount)
  const visibleAlerts = anomalies.slice((currentAlertsPage - 1) * 3, currentAlertsPage * 3)
  const flaggedReadings = latestSummary?.anomalies ?? []
  const flaggedReadingsPageCount = Math.max(1, Math.ceil(flaggedReadings.length / 3))
  const currentFlaggedReadingsPage = Math.min(flaggedReadingsPage, flaggedReadingsPageCount)
  const visibleFlaggedReadings = flaggedReadings.slice((currentFlaggedReadingsPage - 1) * 3, currentFlaggedReadingsPage * 3)
  const pageHasError = indicatorsError || summaryError

  const refreshAll = async () => {
    setActionBusy('refresh')
    try {
      await Promise.all([mutateCorrelation(), mutatePatterns(), mutateAnomalies(), mutateMetrics(), mutateIndicators(), mutateReadings()])
    } finally {
      setActionBusy(null)
    }
  }

  const reviewRecords = async () => {
    setActionBusy('review')
    setActionMessage(null)
    setEtlSummary(null)
    try {
      const result = await api.analytics.runEtl(analyticsQuery)
      setEtlSummary(result)
      const prepared = result.quality.readings.prepared + result.quality.access_events.prepared
      const excluded = result.quality.readings.rejected + result.quality.access_events.rejected
      const sourceRows = result.sources.reduce((total, source) => total + source.source_rows, 0)
      setActionMessage({
        tone: prepared === 0 ? 'warning' : 'success',
        text: sourceRows === 0
          ? 'La preparación terminó, pero no había registros en el periodo seleccionado.'
          : prepared === 0
            ? `Se revisaron ${sourceRows.toLocaleString('es-MX')} registros, pero ninguno pasó las validaciones de calidad.`
            : `Preparación completada: ${prepared.toLocaleString('es-MX')} registros guardados en el conjunto preparado${excluded ? `; ${excluded.toLocaleString('es-MX')} se apartaron por problemas de calidad` : ''}.`,
      })
    } catch {
      setActionMessage({ tone: 'error', text: 'No se pudieron revisar los registros. Inténtalo de nuevo en unos momentos.' })
    } finally {
      setActionBusy(null)
    }
  }

  const analyzeReadings = async () => {
    setActionBusy('analysis')
    setActionMessage(null)
    try {
      let preparedRun = etlSummary
      if (!preparedRun) {
        preparedRun = await api.analytics.runEtl(analyticsQuery)
        setEtlSummary(preparedRun)
      }
      const result = await api.analytics.trainModel(preparedRun.run_id)
      const parsed = parseModelResult(result)
      const message = parsed.status === 'insufficient_data'
        ? `El conjunto ${preparedRun.run_id} no tiene grupos suficientes para analizar. Se prepararon ${parsed.prepared_rows.toLocaleString('es-MX')} lecturas; cada cuarto y variable necesita al menos 5.`
        : `Análisis actualizado desde el conjunto ${preparedRun.run_id}: ${parsed.training_rows.toLocaleString('es-MX')} lecturas en ${parsed.groups_trained} grupos; ${parsed.anomalies_detected.toLocaleString('es-MX')} candidatas para revisar (${percentage(parsed.anomaly_rate)} según el umbral configurado).`
      setActionMessage({ tone: parsed.status === 'insufficient_data' ? 'warning' : 'success', text: message })
      setFlaggedReadingsPage(1)
      await Promise.all([mutateMetrics(), mutateAnomalies()])
    } catch {
      setActionMessage({ tone: 'error', text: 'No se pudo completar el análisis. Inténtalo de nuevo en unos momentos.' })
    } finally {
      setActionBusy(null)
    }
  }

  return <div className={`flex min-w-0 flex-col gap-6 ${variant === 'admin' ? 'admin-analytics' : ''}`} data-analytics-variant={variant}>
    <header className="overflow-hidden rounded-3xl border border-[#d7e6e4] bg-[linear-gradient(125deg,#eaf6f3_0%,#f8fbfa_58%,#eff5f7_100%)] p-5 shadow-[0_12px_34px_rgba(16,44,58,0.035)] sm:p-7">
      <div className="flex flex-col justify-between gap-6 xl:flex-row xl:items-end">
        <div className="min-w-0 max-w-3xl"><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#087f7b]">{variant === 'admin' ? 'Administración · análisis' : 'Supervisión · análisis'}</p><h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-[#102d3b] sm:text-4xl">Análisis de lecturas y accesos</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[#5f7880]">Explora cambios ambientales, horarios de acceso y alertas de los cuartos seleccionados.</p></div>
        <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:min-w-[34rem]">
          <label className="flex min-w-0 flex-col gap-1.5 text-xs font-semibold text-[#526c75]"><span className="flex items-center gap-1.5"><CalendarDays className="size-3.5 text-[#087f7b]" />Periodo</span><select aria-label="Periodo de análisis" value={periodDays} onChange={(event) => { setPeriodDays(Number(event.target.value)); setAlertsPage(1); setEtlSummary(null) }} className={adminInputClass}><option value={7}>Últimos 7 días</option><option value={30}>Últimos 30 días</option><option value={90}>Últimos 90 días</option></select></label>
          <label className="flex min-w-0 flex-col gap-1.5 text-xs font-semibold text-[#526c75]"><span className="flex items-center gap-1.5"><Users className="size-3.5 text-[#087f7b]" />Cuarto</span><select aria-label="Filtrar análisis por cuarto limpio" value={selectedRoomId ?? ''} onChange={(event) => { setSelectedRoomId(event.target.value ? Number(event.target.value) : undefined); setAlertsPage(1); setEtlSummary(null) }} className={adminInputClass}><option value="">Todos los cuartos</option>{rooms.map((room) => <option key={room.id} value={room.id}>{room.code} · {room.name}</option>)}</select></label>
        </div>
      </div>
      <div className="mt-5 flex flex-col gap-3 border-t border-[#cfe0dd] pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-2 text-xs leading-5 text-[#617a82]"><CircleHelp className="size-4 shrink-0 text-[#087f7b]" />El periodo y el cuarto seleccionado delimitan las tendencias, alertas y preparación de registros.</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={actionBusy !== null} onClick={() => void reviewRecords()} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[#d2e0df] bg-white px-3.5 text-xs font-semibold text-[#36515b] transition hover:bg-[#f4f9f8] disabled:opacity-55">{actionBusy === 'review' ? <LoaderCircle className="size-4 animate-spin" /> : <Database className="size-4 text-[#087f7b]" />}{actionBusy === 'review' ? 'Preparando datos…' : 'Preparar datos'}</button>
          <button type="button" disabled={actionBusy !== null} onClick={() => void analyzeReadings()} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#087f7b] px-3.5 text-xs font-semibold text-white shadow-sm transition hover:-translate-y-px hover:bg-[#066c69] disabled:opacity-55">{actionBusy === 'analysis' ? <LoaderCircle className="size-4 animate-spin" /> : <BrainCircuit className="size-4" />}{actionBusy === 'analysis' ? (etlSummary ? 'Analizando conjunto…' : 'Preparando y analizando…') : 'Analizar lecturas'}</button>
          <button type="button" disabled={actionBusy !== null} onClick={() => void refreshAll()} aria-label="Actualizar análisis" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[#d2e0df] bg-white px-3 text-xs font-semibold text-[#526c75] transition hover:bg-[#f4f9f8] disabled:opacity-55"><RefreshCw className={`size-4 ${actionBusy === 'refresh' ? 'animate-spin' : ''}`} /><span className="sm:hidden">Actualizar</span></button>
        </div>
      </div>
    </header>

    {actionMessage && <div role={actionMessage.tone === 'error' ? 'alert' : 'status'} className={`flex items-start gap-3 rounded-2xl border px-4 py-3.5 text-sm leading-5 ${actionMessage.tone === 'error' ? 'border-rose-200 bg-rose-50 text-rose-900' : actionMessage.tone === 'warning' ? 'border-amber-200 bg-amber-50 text-amber-950' : 'border-emerald-200 bg-emerald-50 text-emerald-900'}`}><span className="mt-0.5">{actionMessage.tone === 'success' ? <CheckCircle2 className="size-4" /> : <AlertTriangle className="size-4" />}</span>{actionMessage.text}</div>}
    {pageHasError && <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">No se pudieron cargar algunos indicadores. Actualiza la pantalla e inténtalo de nuevo.</div>}

    {etlSummary && <AdminPanel title="Datos preparados" description={`Ejecución ${etlSummary.run_id} · ${formatDateTime(etlSummary.completed_at)} · periodo ${formatShortDate(etlSummary.scope.start_at)}–${formatShortDate(etlSummary.scope.end_at)}`}>
      <div className="grid gap-3 p-5 sm:grid-cols-2 sm:p-6">
        {etlSummary.sources.map((source) => {
          const quality = source.name === 'sensor_readings' ? etlSummary.quality.readings : etlSummary.quality.access_events
          return <div key={source.name} className="rounded-2xl border border-[#e4ecec] bg-[#f8fbfa] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#82969d]">{source.type}</p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <ResultMetric label="Registros revisados" value={source.source_rows.toLocaleString('es-MX')} />
              <ResultMetric label="Registros preparados" value={quality.prepared.toLocaleString('es-MX')} />
            </div>
            <p className={`mt-3 text-xs leading-5 ${quality.rejected ? 'text-amber-800' : 'text-[#617a82]'}`}>
              {quality.rejected ? `${quality.rejected.toLocaleString('es-MX')} apartados por calidad; ${quality.duplicate_candidates.toLocaleString('es-MX')} duplicados detectados.` : 'No se encontraron registros que debieran apartarse.'}
            </p>
            {Object.keys(quality.rejected_by_reason).length > 0 && <ul className="mt-2 space-y-1 text-xs text-[#82969d]">{Object.entries(quality.rejected_by_reason).map(([reason, count]) => <li key={reason} className="flex justify-between gap-3"><span>{reason.replaceAll('_', ' ')}</span><span className="font-semibold tabular-nums">{count.toLocaleString('es-MX')}</span></li>)}</ul>}
          </div>
        })}
        <p className="sm:col-span-2 text-xs leading-5 text-[#82969d]">Las lecturas originales se conservan. Este conjunto preparado guarda su periodo, transformaciones y relación con cada registro de origen para poder consultar cómo se obtuvo.</p>
      </div>
    </AdminPanel>}

    <section aria-label="Indicadores del periodo" className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
      <AdminKpi label="Lecturas ambientales" value={indicatorsLoading ? '—' : Number(indicators.total_readings ?? 0).toLocaleString('es-MX')} detail={`En los últimos ${periodDays} días`} icon={<Activity className="size-4" />} tone="blue" />
      <AdminKpi label="Accesos registrados" value={indicatorsLoading ? '—' : Number(indicators.total_accesses ?? 0).toLocaleString('es-MX')} detail={`En los últimos ${periodDays} días`} icon={<DoorOpen className="size-4" />} tone="teal" />
      <AdminKpi label="Accesos permitidos" value={indicatorsLoading ? '—' : allowedRate === null ? '—' : `${allowedRate}%`} detail={`${Number(indicators.allowed_accesses ?? 0).toLocaleString('es-MX')} eventos autorizados`} icon={<ArrowUpRight className="size-4" />} tone="teal" />
      <AdminKpi label="Accesos rechazados" value={indicatorsLoading ? '—' : Number(indicators.denied_accesses ?? 0).toLocaleString('es-MX')} detail="Intentos no autorizados" icon={<ArrowDownRight className="size-4" />} tone="rose" />
      <AdminKpi label="Alertas activas" value={indicatorsLoading ? '—' : Number(indicators.active_alerts ?? 0).toLocaleString('es-MX')} detail="Pendientes de atención" icon={<Sparkles className="size-4" />} tone={indicators.active_alerts ? 'amber' : 'slate'} />
    </section>

    <section className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.85fr)]">
      <AdminPanel title="Tendencia ambiental" description={`Lecturas de ${selectedReading ? metricLabel(selectedReading.metric).toLowerCase() : 'una variable'} · últimos ${periodDays} días`}>
        {readingOptions.length > 0 && <div className="px-5 pt-4 sm:px-6"><label className="flex max-w-sm flex-col gap-1.5 text-xs font-semibold text-[#526c75]">Variable ambiental<select aria-label="Variable ambiental" value={activeReadingKey} onChange={(event) => setReadingMetric(event.target.value)} className={adminInputClass}>{readingOptions.map((option) => <option key={option.key} value={option.key}>{metricLabel(option.metric)} · {option.unit}</option>)}</select></label></div>}
        {readingsLoading ? <div className="flex min-h-64 items-center justify-center gap-2 text-sm text-[#718995]"><LoaderCircle className="size-4 animate-spin" />Cargando lecturas…</div> : readingsError ? <AnalyticsEmpty title="No se pudieron cargar las lecturas" detail="Actualiza el análisis para intentarlo de nuevo." error /> : readingChart.length === 0 ? <AnalyticsEmpty title="Aún no hay lecturas" detail="Cuando los cuartos registren mediciones, aquí podrás ver su tendencia." /> : <div className="p-4 sm:p-5"><div className="h-64 w-full" role="img" aria-label={`Gráfica de ${selectedReading ? metricLabel(selectedReading.metric) : 'lecturas'} en el periodo seleccionado`}><ResponsiveContainer width="100%" height="100%"><LineChart data={readingChart} margin={{ top: 8, right: 10, bottom: 0, left: -18 }} accessibilityLayer><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e8eff0" /><XAxis dataKey="recorded_at" tickFormatter={formatTime} tickLine={false} axisLine={false} minTickGap={28} fontSize={10} /><YAxis tickLine={false} axisLine={false} fontSize={10} domain={['auto', 'auto']} /><Tooltip labelFormatter={(label) => formatDateTime(String(label))} formatter={(value) => [`${value} ${selectedReading?.unit ?? ''}`, selectedReading ? metricLabel(selectedReading.metric) : 'Lectura']} /><Line type="monotone" dataKey="value" name="Lectura" stroke="#087f7b" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} /></LineChart></ResponsiveContainer></div><p className="mt-3 text-xs leading-5 text-[#82969d]">Se muestran las {readingChart.length} mediciones más recientes de esta variable. Los días sin registros no se rellenan.</p></div>}
      </AdminPanel>

      <AdminPanel title="Ocupación y partículas" description="Relación entre personas dentro del cuarto y lecturas PM2.5">
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-4 sm:px-6"><span className="rounded-full border border-[#d8e9e4] bg-[#eff8f5] px-3 py-1.5 text-xs font-semibold text-[#087f7b]">Asociación {correlation?.coefficient_r == null ? '—' : correlation.coefficient_r.toFixed(2)} · {correlation?.strength ? correlation.strength.toLowerCase() : 'sin datos'}</span><span className="text-xs text-[#82969d]">{points.length} lecturas sincronizadas</span></div>
        {correlationLoading ? <div className="flex min-h-64 items-center justify-center gap-2 text-sm text-[#718995]"><LoaderCircle className="size-4 animate-spin" />Preparando comparación…</div> : correlationError ? <AnalyticsEmpty title="No se pudo calcular la relación" detail="Actualiza el análisis para volver a intentarlo." error /> : points.length < 2 ? <AnalyticsEmpty title="Faltan datos sincronizados" detail="Se necesitan al menos dos lecturas de partículas con su ocupación correspondiente." /> : <div className="p-4 sm:p-5"><div className="h-64 w-full" role="img" aria-label="Gráfica de dispersión entre ocupación y partículas PM2.5"><ResponsiveContainer width="100%" height="100%"><ScatterChart margin={{ top: 12, right: 12, bottom: 8, left: -10 }} accessibilityLayer><CartesianGrid strokeDasharray="3 3" stroke="#e8eff0" /><XAxis type="number" dataKey="occupancy" name="Personas dentro" allowDecimals={false} tickLine={false} axisLine={false} fontSize={10} label={{ value: 'Personas dentro', position: 'insideBottom', offset: -4, fontSize: 10 }} /><YAxis type="number" dataKey="pm25" name="PM2.5" unit=" p/m³" tickLine={false} axisLine={false} fontSize={10} /><Tooltip cursor={{ strokeDasharray: '3 3' }} formatter={(value, name) => [name === 'PM2.5' ? `${value} p/m³` : value, name]} labelFormatter={() => 'Lectura sincronizada'} />{correlation?.pm25_max_threshold != null && <ReferenceLine y={correlation.pm25_max_threshold} stroke="#d97706" strokeDasharray="5 4" label={{ value: 'Límite configurado', fill: '#b7721c', fontSize: 10 }} />}<Scatter name="Lecturas" data={points} fill="#087f7b" fillOpacity={0.72} /></ScatterChart></ResponsiveContainer></div><p className="mt-3 text-xs leading-5 text-[#82969d]">La asociación describe cómo varían juntas las mediciones; no demuestra que una cause la otra. Esta comparación usa el historial disponible del cuarto.</p></div>}
      </AdminPanel>
    </section>

    <section className="grid min-w-0 gap-5 xl:grid-cols-2">
      <AdminPanel title="Horarios de acceso" description={`Cantidad de eventos por hora del día · últimos ${periodDays} días`}>
        {patternsLoading ? <div className="flex min-h-64 items-center justify-center gap-2 text-sm text-[#718995]"><LoaderCircle className="size-4 animate-spin" />Agrupando horarios…</div> : patternsError ? <AnalyticsEmpty title="No se pudieron cargar los horarios" detail="Actualiza el análisis para intentarlo de nuevo." error /> : patterns.length === 0 ? <AnalyticsEmpty title="Sin eventos para comparar" detail="El gráfico aparecerá cuando haya accesos registrados en el periodo." /> : <div className="p-4 sm:p-5"><div className="h-64 w-full" role="img" aria-label="Gráfica de accesos por hora agrupados por nivel de afluencia"><ResponsiveContainer width="100%" height="100%"><BarChart data={patterns} margin={{ top: 8, right: 8, bottom: 0, left: -18 }} accessibilityLayer><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e8eff0" /><XAxis dataKey="hour" tickFormatter={(hour) => `${String(hour).padStart(2, '0')}:00`} tickLine={false} axisLine={false} minTickGap={18} fontSize={10} /><YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={10} /><Tooltip labelFormatter={(hour) => `${String(hour).padStart(2, '0')}:00 h`} formatter={(value, _name, item) => [value, item.payload.cluster_label]} /><Bar dataKey="count" name="Accesos" radius={[5, 5, 0, 0]}>{patterns.map((item, index) => <Cell key={`${item.hour}-${index}`} fill={CLUSTER_TONES[item.cluster] ?? '#087f7b'} />)}</Bar></BarChart></ResponsiveContainer></div><div className="mt-3 flex flex-wrap gap-2">{[['c1', 'Menor afluencia'], ['c2', 'Afluencia media'], ['c3', 'Hora pico']].map(([key, label]) => <span key={key} className="inline-flex items-center gap-2 rounded-full border border-[#e4ecec] px-2.5 py-1.5 text-[11px] text-[#617a82]"><span className="size-2 rounded-full" style={{ backgroundColor: CLUSTER_TONES[key] }} />{label}</span>)}</div></div>}
      </AdminPanel>

      <AdminPanel title="Alertas ambientales" description={`Avisos por lecturas fuera de los límites del cuarto · ${periodDays} días`}>
        {anomaliesLoading ? <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-[#718995]"><LoaderCircle className="size-4 animate-spin" />Buscando alertas…</div> : anomaliesError ? <AnalyticsEmpty title="No se pudieron cargar las alertas" detail="Actualiza el análisis para intentarlo de nuevo." error /> : anomalies.length === 0 ? <AnalyticsEmpty title="No hay alertas en este periodo" detail="No se han registrado lecturas fuera de los límites configurados." /> : <div><ul className="divide-y divide-[#edf2f3]">{visibleAlerts.map((item) => <li key={item.id} className="flex items-start justify-between gap-3 px-5 py-3.5 sm:px-6"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><AdminStatusBadge value={item.severity} kind="severity" /><span className="text-xs font-medium text-[#526c75]">{roomLabel(item.cleanroom_id, rooms)}</span></div><p className="mt-2 text-sm leading-5 text-[#36515b]">{item.message}</p><p className="mt-1 text-xs text-[#82969d]">{formatDateTime(item.created_at)}</p></div><span className="shrink-0 text-xs font-semibold text-[#617a82]">{item.status === 'ACTIVE' ? 'Pendiente' : item.status === 'ACKNOWLEDGED' ? 'Atendida' : item.status ?? 'Registrada'}</span></li>)}</ul>{anomalies.length > 3 && <RecordPagination page={currentAlertsPage} pageCount={alertsPageCount} total={anomalies.length} onPageChange={setAlertsPage} label="alertas" />}</div>}
      </AdminPanel>
    </section>

    <section className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)]">
      <AdminPanel title="Último análisis" description={latestModel ? `Conjunto ${latestSummary?.run_id ?? 'anterior'} · ${formatDateTime(latestModel.trained_at)} · alcance definido al preparar los datos` : 'Los resultados aparecerán después de analizar un conjunto preparado.'}>
        {metricsLoading ? <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-[#718995]"><LoaderCircle className="size-4 animate-spin" />Cargando resultados…</div> : metricsError ? <AnalyticsEmpty title="No se pudieron cargar los resultados" detail="Actualiza el análisis para intentarlo de nuevo." error /> : !latestModel || !latestSummary ? <AnalyticsEmpty title="Todavía no hay resultados" detail="Prepara un conjunto y usa “Analizar lecturas” para revisarlo." /> : latestSummary.status === 'insufficient_data' ? <div className="p-5 sm:p-6"><div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><p className="font-semibold">No hay grupos con suficientes lecturas</p><p className="mt-1 leading-5">El conjunto contiene {latestSummary.prepared_rows.toLocaleString('es-MX')} lecturas preparadas. Se requieren al menos 5 dentro de cada combinación de cuarto, variable y unidad.</p>{latestSummary.groups_skipped > 0 && <p className="mt-2">{latestSummary.groups_skipped} grupos quedaron fuera por tamaño.</p>}</div></div> : <div className="p-5 sm:p-6"><div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><ResultMetric label="Lecturas analizadas" value={latestSummary.training_rows.toLocaleString('es-MX')} /><ResultMetric label="Candidatas señaladas" value={latestSummary.anomalies_detected.toLocaleString('es-MX')} tone="amber" /><ResultMetric label="Proporción señalada" value={percentage(latestSummary.anomaly_rate)} /><ResultMetric label="Grupos evaluados" value={`${latestSummary.groups_trained}/${latestSummary.groups_total}`} /></div><div className="mt-4 flex flex-wrap items-center gap-2"><span className="text-xs text-[#82969d]">Variables incluidas</span>{latestSummary.metrics_included.length ? latestSummary.metrics_included.map((metric) => <span key={metric} className="rounded-full bg-[#eff6f5] px-2.5 py-1 text-[11px] font-medium text-[#365d5b]">{metricLabel(metric)}</span>) : <span className="text-xs text-[#82969d]">Sin detalle de variables</span>}</div>{latestSummary.groups_skipped > 0 && <p className="mt-3 text-xs text-amber-800">{latestSummary.groups_skipped} grupos omitidos por tener menos de 5 lecturas. {latestSummary.unusable_rows} registros preparados no pudieron usarse.</p>}<div className="mt-4 rounded-xl border border-[#e4ecec] bg-[#f8fbfa] p-3.5"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-semibold text-[#36515b]">Estabilidad entre ejecuciones</p><span className="text-sm font-semibold tabular-nums text-[#087f7b]">{latestSummary.evaluation?.mean_jaccard == null ? '—' : percentage(latestSummary.evaluation.mean_jaccard)}</span></div><p className="mt-1 text-xs leading-5 text-[#82969d]">Coincidencia de lecturas señaladas al repetir el modelo con {latestSummary.evaluation?.seed_count || 3} semillas. Es una medida de consistencia, no de precisión; no hay etiquetas confirmadas para medir aciertos.</p></div><p className="mt-3 text-xs leading-5 text-[#82969d]">El modelo marca candidatas según el umbral configurado ({latestSummary.contamination === null ? 'sin detalle' : percentage(latestSummary.contamination)}). Una lectura señalada requiere revisión contextual y no confirma por sí sola una falla.</p></div>}
      </AdminPanel>

      <AdminPanel title="Lecturas señaladas" description={latestSummary?.anomalies_truncated ? `Mostrando las ${latestSummary.anomalies_available.toLocaleString('es-MX')} candidatas con puntuación más baja de ${latestSummary.anomalies_detected.toLocaleString('es-MX')}.` : 'Mediciones más atípicas dentro del conjunto analizado'}>
        {metricsLoading ? <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-[#718995]"><LoaderCircle className="size-4 animate-spin" />Cargando resultados…</div> : !latestSummary || latestSummary.status === 'insufficient_data' ? <AnalyticsEmpty title="No hay lecturas para mostrar" detail="Completa un análisis cuando haya suficientes mediciones." /> : latestSummary.anomalies.length === 0 ? <AnalyticsEmpty title="No se señalaron lecturas" detail="El último análisis no encontró valores atípicos." /> : <div><ul className="divide-y divide-[#edf2f3]">{visibleFlaggedReadings.map((item) => <li key={item.reading_id} className="flex items-start justify-between gap-3 px-5 py-3.5 sm:px-6"><div className="min-w-0"><p className="text-sm font-semibold text-[#36515b]">{metricLabel(item.metric)} <span className="font-medium tabular-nums">{item.value} {item.unit}</span></p><p className="mt-1 truncate text-xs text-[#82969d]">{roomLabel(item.cleanroom_id, rooms)} · {formatDateTime(item.recorded_at)}</p></div><span className="shrink-0 rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-semibold text-amber-800">Revisar</span></li>)}</ul>{flaggedReadings.length > 3 && <RecordPagination page={currentFlaggedReadingsPage} pageCount={flaggedReadingsPageCount} total={flaggedReadings.length} onPageChange={setFlaggedReadingsPage} label="lecturas señaladas" />}</div>}
      </AdminPanel>
    </section>

    <AdminPanel title="Historial de análisis" description="Comparación entre las últimas ejecuciones del análisis">
      {metricsLoading ? <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-[#718995]"><LoaderCircle className="size-4 animate-spin" />Cargando historial…</div> : metricsError ? <AnalyticsEmpty title="No se pudo cargar el historial" detail="Actualiza el análisis para intentarlo de nuevo." error /> : modelResults.length === 0 ? <AnalyticsEmpty title="Sin análisis anteriores" detail="Cuando ejecutes un análisis, aquí podrás comparar sus resultados." /> : <div className="p-5 sm:p-6"><div className="flex items-center gap-2 text-sm font-semibold text-[#36515b]"><BarChart3 className="size-4 text-[#087f7b]" />Valores señalados por ejecución</div>{trainingHistory.length > 1 ? <div className="mt-4 h-56 w-full" role="img" aria-label="Gráfica de valores señalados en cada análisis"><ResponsiveContainer width="100%" height="100%"><BarChart data={trainingHistory} margin={{ top: 8, right: 10, bottom: 0, left: -18 }} accessibilityLayer><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e8eff0" /><XAxis dataKey="date" tickFormatter={formatShortDate} tickLine={false} axisLine={false} minTickGap={24} fontSize={10} /><YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={10} /><Tooltip labelFormatter={(label) => formatDateTime(String(label))} formatter={(value, name) => [value, name === 'detected' ? 'Valores señalados' : 'Lecturas revisadas']} /><Legend formatter={(value) => value === 'detected' ? 'Valores señalados' : 'Lecturas revisadas'} /><Bar dataKey="detected" name="detected" fill="#d97706" radius={[4, 4, 0, 0]} /><Bar dataKey="rows" name="rows" fill="#0b8b7c" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div> : <div className="mt-4 flex min-h-24 items-center justify-center rounded-xl border border-dashed border-[#dce7e8] text-sm text-[#82969d]">Se necesita otra ejecución para mostrar la comparación.</div>}<div className="mt-5 divide-y divide-[#edf2f3] rounded-xl border border-[#e7eeee]">{[...modelResults].slice(0, 8).map((run) => { const parsed = parseModelResult(run); return <div key={run.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex min-w-0 items-center gap-2"><span className={`size-2 shrink-0 rounded-full ${parsed.status === 'insufficient_data' ? 'bg-amber-500' : 'bg-emerald-500'}`} /><span className="truncate text-sm font-medium text-[#36515b]">{parsed.status === 'insufficient_data' ? 'Lecturas insuficientes' : `${parsed.anomalies_detected.toLocaleString('es-MX')} valores señalados`}</span></div><div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#82969d]"><span>{parsed.training_rows.toLocaleString('es-MX')} lecturas revisadas</span>{parsed.status !== 'insufficient_data' && <span>{percentage(parsed.anomaly_rate)}</span>}<time dateTime={run.trained_at}>{formatDateTime(run.trained_at)}</time></div></div> })}</div></div>}
    </AdminPanel>
  </div>
}


function RecordPagination({ page, pageCount, total, onPageChange, label }: { page: number; pageCount: number; total: number; onPageChange: (page: number) => void; label: string }) {
  const first = (page - 1) * 3 + 1
  const last = Math.min(page * 3, total)
  const buttonClass = 'inline-flex min-h-9 items-center gap-1 rounded-lg border border-[#dce7e8] bg-white px-2.5 text-xs font-semibold text-[#526c75] transition hover:bg-[#f4f9f8] disabled:pointer-events-none disabled:opacity-45'

  return <nav aria-label={`Paginación de ${label}`} className="flex flex-col gap-2 border-t border-[#edf2f3] px-5 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
    <span className="text-xs text-[#82969d]">Mostrando <span className="font-semibold tabular-nums text-[#526c75]">{first}–{last}</span> de {total}</span>
    <div className="flex items-center gap-2">
      <button type="button" aria-label={`Página anterior de ${label}`} disabled={page <= 1} onClick={() => onPageChange(page - 1)} className={buttonClass}><ChevronLeft className="size-3.5" />Anterior</button>
      <span aria-live="polite" className="min-w-12 text-center text-xs font-medium tabular-nums text-[#617a82]">{page} / {pageCount}</span>
      <button type="button" aria-label={`Página siguiente de ${label}`} disabled={page >= pageCount} onClick={() => onPageChange(page + 1)} className={buttonClass}>Siguiente<ChevronRight className="size-3.5" /></button>
    </div>
  </nav>
}

function ResultMetric({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'amber' }) {
  return <div className={`min-w-0 rounded-xl border p-3.5 ${tone === 'amber' ? 'border-amber-200 bg-amber-50/70' : 'border-[#e4ecec] bg-[#f8fbfa]'}`}><p className="text-[10px] font-bold uppercase leading-4 tracking-[0.1em] text-[#82969d]">{label}</p><p className={`mt-2 text-2xl font-semibold leading-none tracking-[-0.04em] tabular-nums ${tone === 'amber' ? 'text-amber-800' : 'text-[#163542]'}`}>{value}</p></div>
}

function AnalyticsEmpty({ title, detail, error = false }: { title: string; detail: string; error?: boolean }) {
  return <div className="flex min-h-48 flex-col items-center justify-center px-6 py-8 text-center"><span className={`grid size-10 place-items-center rounded-xl ${error ? 'bg-rose-50 text-rose-600' : 'bg-[#f0f5f4] text-[#82969d]'}`}>{error ? <AlertTriangle className="size-4" /> : <Clock3 className="size-4" />}</span><p className="mt-3 text-sm font-semibold text-[#36515b]">{title}</p><p className="mt-1 max-w-sm text-xs leading-5 text-[#82969d]">{detail}</p></div>
}
