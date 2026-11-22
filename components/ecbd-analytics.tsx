'use client'

import { useMemo, useState } from 'react'
import useSWR from 'swr'
import {
  Activity,
  AlertTriangle,
  BarChart3,
  BrainCircuit,
  Database,
  LoaderCircle,
  Play,
  RefreshCw,
  Sparkles,
} from 'lucide-react'
import {
  api,
  type AccessPatternCluster,
  type CorrelationPoint,
  type CorrelationResponse,
  type ModelResultItem,
  type SupervisorSummary,
} from '@/lib/api'
import { useRealtimeEvents } from '@/hooks/use-realtime-events'

type AnomalyItem = {
  id: number
  cleanroom_id: number
  device_id?: number | null
  severity?: string
  message: string
  status?: string
  created_at: string
}

type IndicatorsResponse = {
  total_readings?: number
  total_accesses?: number
  allowed_accesses?: number
  denied_accesses?: number
  active_alerts?: number
}

function normalizeAnomalies(value: unknown): AnomalyItem[] {
  if (Array.isArray(value)) return value as AnomalyItem[]
  if (value && typeof value === 'object') {
    const rec = value as Record<string, unknown>
    for (const key of ['items', 'data', 'results']) {
      if (Array.isArray(rec[key])) return rec[key] as AnomalyItem[]
    }
  }
  return []
}

function formatDateTime(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })
}

function formatShortTime(value?: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
}

function strengthLabel(strength: string) {
  const s = strength.toUpperCase()
  if (s === 'STRONG') return 'Fuerte'
  if (s === 'MODERATE') return 'Moderada'
  if (s === 'WEAK') return 'Débil'
  return strength || 'Sin datos'
}

const CLUSTER_COLORS: Record<string, { fill: string; label: string; dot: string }> = {
  c1: { fill: '#10b981', label: 'C1 · Baja Afluencia', dot: 'bg-emerald-500' },
  c2: { fill: '#0284c7', label: 'C2 · Flujo Moderado', dot: 'bg-sky-500' },
  c3: { fill: '#6366f1', label: 'C3 · Pico de Acceso', dot: 'bg-indigo-500' },
}

export function EcbdAnalytics() {
  const [selectedRoomId, setSelectedRoomId] = useState<number | undefined>(undefined)
  const [periodDays, setPeriodDays] = useState(30)
  const analyticsQuery = useMemo(() => {
    const end = new Date()
    const start = new Date(end.getTime() - periodDays * 86400000)
    const params = new URLSearchParams({ start_at: start.toISOString(), end_at: end.toISOString() })
    if (selectedRoomId) params.set('cleanroom_id', String(selectedRoomId))
    return `?${params.toString()}`
  }, [periodDays, selectedRoomId])

  const { data: summary } = useSWR<SupervisorSummary>('supervisor-summary', api.supervisorSummary)
  const {
    data: correlation,
    isLoading: corrLoading,
    mutate: mutateCorrelation,
  } = useSWR<CorrelationResponse>(
    ['ecbd-correlation', selectedRoomId ?? 'all'],
    () => api.analytics.correlation(selectedRoomId),
  )
  const {
    data: patternsRaw,
    isLoading: patternsLoading,
    mutate: mutatePatterns,
  } = useSWR<AccessPatternCluster[]>(['ecbd-patterns', analyticsQuery], () => api.analytics.accessPatterns(analyticsQuery))
  const {
    data: anomaliesRaw,
    isLoading: anomaliesLoading,
    mutate: mutateAnomalies,
  } = useSWR(['ecbd-anomalies', analyticsQuery], () => api.analytics.anomalies(analyticsQuery))
  const {
    data: metricsRaw,
    isLoading: metricsLoading,
    mutate: mutateMetrics,
  } = useSWR<ModelResultItem[]>('ecbd-metrics', api.analytics.metrics)
  const {
    data: indicatorsRaw,
    mutate: mutateIndicators,
  } = useSWR(['ecbd-indicators', analyticsQuery], () => api.analytics.indicators(analyticsQuery))
  const { data: readingsRaw, isLoading: readingsLoading } = useSWR(['ecbd-series', analyticsQuery], () => api.analytics.series(analyticsQuery))

  useRealtimeEvents({
    mutateKeys: ['ecbd-correlation', 'ecbd-patterns', 'ecbd-anomalies', 'ecbd-metrics', 'ecbd-indicators'],
  })

  const [hoveredCorrIdx, setHoveredCorrIdx] = useState<number | null>(null)
  const [hoveredClusterIdx, setHoveredClusterIdx] = useState<number | null>(null)
  const [actionBusy, setActionBusy] = useState<'etl' | 'train' | null>(null)
  const [actionMessage, setActionMessage] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)

  const rooms = summary?.rooms ?? []
  const points = useMemo(() => correlation?.points ?? [], [correlation])
  const patterns = useMemo(() => (Array.isArray(patternsRaw) ? patternsRaw : []), [patternsRaw])
  const anomalies = useMemo(() => normalizeAnomalies(anomaliesRaw), [anomaliesRaw])
  const modelResults = useMemo(() => (Array.isArray(metricsRaw) ? metricsRaw : []), [metricsRaw])
  const indicators = (indicatorsRaw && typeof indicatorsRaw === 'object' ? indicatorsRaw : {}) as IndicatorsResponse
  const readings = Array.isArray(readingsRaw) ? readingsRaw as { recorded_at: string; metric: string; unit: string; value: number }[] : []

  const runEtl = async () => {
    setActionBusy('etl')
    setActionMessage(null)
    try {
      const res = await api.analytics.runEtl()
      setActionMessage({
        tone: 'ok',
        text: `Pipeline ETL ejecutado (${res.processed_readings} lecturas y ${res.processed_accesses} accesos procesados).`,
      })
      void mutateCorrelation()
      void mutatePatterns()
      void mutateIndicators()
    } catch (cause) {
      setActionMessage({
        tone: 'err',
        text: cause instanceof Error ? cause.message : 'No se pudo ejecutar el pipeline ETL.',
      })
    } finally {
      setActionBusy(null)
    }
  }

  const trainModel = async () => {
    setActionBusy('train')
    setActionMessage(null)
    try {
      await api.analytics.trainModel()
      setActionMessage({
        tone: 'ok',
        text: 'Modelo IsolationForest entrenado y métricas actualizadas en PostgreSQL.',
      })
      void mutateMetrics()
      void mutateAnomalies()
    } catch (cause) {
      setActionMessage({
        tone: 'err',
        text: cause instanceof Error ? cause.message : 'No se pudo entrenar el modelo.',
      })
    } finally {
      setActionBusy(null)
    }
  }

  const refreshAll = () => {
    void mutateCorrelation()
    void mutatePatterns()
    void mutateAnomalies()
    void mutateMetrics()
    void mutateIndicators()
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#087f7b] dark:text-[#2dd4bf]">
            Módulo ECBD · analítica en vivo
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-[#102d3b] dark:text-[#e6f0f2]">
            Extracción de conocimiento y modelos predictivos
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm text-[#718995] dark:text-[#94adb8]">
            Correlación ocupación vs partículas PM2.5, agrupamiento horario KMeans y detección de anomalías IsolationForest.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select aria-label="Periodo de análisis" value={periodDays} onChange={event => setPeriodDays(Number(event.target.value))} className="rounded-xl border border-[#dce8eb] bg-white px-3 py-2 text-xs font-medium dark:border-[#233a47] dark:bg-[#101e26]"><option value={7}>7 días</option><option value={30}>30 días</option><option value={90}>90 días</option></select>
          <select
            aria-label="Filtrar análisis por cuarto limpio"
            value={selectedRoomId ?? ''}
            onChange={(event) => setSelectedRoomId(event.target.value ? Number(event.target.value) : undefined)}
            className="rounded-xl border border-[#dce8eb] bg-white px-3 py-2 text-xs font-medium text-[#29434e] outline-none focus:border-[#087f7b] dark:border-[#233a47] dark:bg-[#101e26] dark:text-[#e6f0f2]"
          >
            <option value="">Todas las salas</option>
            {rooms.map((room) => (
              <option key={room.id} value={room.id}>
                {room.code} · {room.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            disabled={actionBusy !== null}
            onClick={() => void runEtl()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#dce8eb] bg-white px-3.5 py-2 text-xs font-semibold text-[#29434e] transition hover:bg-[#f4f9f8] disabled:opacity-50 dark:border-[#233a47] dark:bg-[#101e26] dark:text-[#e6f0f2] dark:hover:bg-[#182b36]"
          >
            {actionBusy === 'etl' ? <LoaderCircle className="size-3.5 animate-spin" /> : <Play className="size-3.5 text-[#087f7b]" />}
            Ejecutar ETL
          </button>

          <button
            type="button"
            disabled={actionBusy !== null}
            onClick={() => void trainModel()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#087f7b] px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-[#066c69] disabled:opacity-50"
          >
            {actionBusy === 'train' ? <LoaderCircle className="size-3.5 animate-spin" /> : <BrainCircuit className="size-3.5" />}
            Entrenar IsolationForest
          </button>

          <button
            type="button"
            onClick={refreshAll}
            aria-label="Actualizar analítica"
            className="rounded-xl border border-[#dce8eb] bg-white p-2 text-[#58727c] transition hover:bg-[#f4f9f8] dark:border-[#233a47] dark:bg-[#101e26] dark:text-[#94adb8] dark:hover:bg-[#182b36]"
          >
            <RefreshCw className="size-4" />
          </button>
        </div>
      </div>

      {actionMessage && (
        <div
          role={actionMessage.tone === 'err' ? 'alert' : 'status'}
          className={`rounded-2xl border px-4 py-3 text-sm ${
            actionMessage.tone === 'err'
              ? 'border-red-200 bg-red-50 text-red-800 dark:border-red-500/30 dark:bg-red-950/40 dark:text-red-200'
              : 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-950/40 dark:text-emerald-200'
          }`}
        >
          {actionMessage.text}
        </div>
      )}

      {/* Indicadores globales */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <IndicatorCard label="Lecturas totales" value={String(indicators.total_readings ?? 0)} icon={<Database className="size-4" />} />
        <IndicatorCard label="Accesos analizados" value={String(indicators.total_accesses ?? 0)} icon={<Activity className="size-4" />} />
        <IndicatorCard label="Rechazos registrados" value={String(indicators.denied_accesses ?? 0)} icon={<AlertTriangle className="size-4" />} />
        <IndicatorCard label="Alertas activas" value={String(indicators.active_alerts ?? 0)} icon={<Sparkles className="size-4" />} />
      </section>

      <section className="rounded-2xl border border-[#e5edf0] bg-white p-5 shadow-[0_8px_24px_rgba(18,49,66,0.04)] dark:border-[#1e3340] dark:bg-[#101e26]">
        <div><h2 className="text-base font-semibold">Serie de lecturas ambientales</h2><p className="mt-1 text-xs text-[#82969d]">Métrica y unidad se conservan por lectura; máximo de 1,000 registros para el filtro aplicado.</p></div>
        {readingsLoading ? <div className="py-8 text-center text-sm text-[#718995]">Cargando serie…</div> : readings.length === 0 ? <div className="py-8 text-center text-sm text-[#718995]">No hay lecturas ambientales en este periodo y cuarto.</div> : <div className="mt-4 max-h-64 overflow-auto">{readings.slice(-100).map((reading, index) => <div key={`${reading.recorded_at}-${index}`} className="grid grid-cols-[7rem_1fr_auto] items-center gap-3 border-b border-[#edf2f3] py-2 text-xs dark:border-[#1e3340]"><span className="text-[#82969d]">{formatDateTime(reading.recorded_at)}</span><span className="font-medium">{reading.metric}</span><b>{reading.value} {reading.unit}</b></div>)}</div>}
      </section>

      {/* Gráficas SVG principales */}
      <section className="grid gap-6 lg:grid-cols-2">
        {/* Gráfica 1: Correlación Ocupación vs PM2.5 */}
        <div className="flex flex-col justify-between rounded-2xl border border-[#e5edf0] bg-white p-5 shadow-[0_8px_24px_rgba(18,49,66,0.04)] dark:border-[#1e3340] dark:bg-[#101e26]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-[#163542] dark:text-[#e6f0f2]">
                1. Correlación: Ocupación vs PM2.5
              </h2>
              <p className="mt-0.5 text-xs text-[#82969d] dark:text-[#94adb8]">
                Impacto de la presencia humana sobre partículas finas con umbral normativo
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="rounded-lg border border-[#087f7b]/25 bg-[#eff8f7] px-2.5 py-1 font-mono text-xs font-semibold text-[#087f7b] dark:border-[#2dd4bf]/30 dark:bg-[#13313b] dark:text-[#5eead4]">
                r = {correlation?.coefficient_r !== null && correlation?.coefficient_r !== undefined
                  ? correlation.coefficient_r.toFixed(2)
                  : '—'} · {strengthLabel(correlation?.strength ?? '')}
              </span>
            </div>
          </div>

          <div className="mt-4">
            {corrLoading ? (
              <div className="flex h-56 items-center justify-center gap-2 text-xs text-[#718995] dark:text-[#94adb8]">
                <LoaderCircle className="size-4 animate-spin" />
                Calculando correlación…
              </div>
            ) : points.length < 2 ? (
              <div className="flex h-56 items-center justify-center rounded-xl border border-dashed border-[#dce8eb] text-xs text-[#82969d] dark:border-[#233a47] dark:text-[#94adb8]">
                Se requieren al menos 2 mediciones sincronizadas para trazar la correlación.
              </div>
            ) : (
              <CorrelationSvgChart
                points={points}
                threshold={correlation?.pm25_max_threshold ?? null}
                hoveredIndex={hoveredCorrIdx}
                onHover={setHoveredCorrIdx}
              />
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#edf2f3] pt-3 text-[11px] text-[#718995] dark:border-[#1e3340] dark:text-[#94adb8]">
            <div className="flex flex-wrap items-center gap-4">
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm bg-[#087f7b] dark:bg-[#2dd4bf]" />
                Ocupación (personas)
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm bg-amber-500" />
                PM2.5 (p/m³)
              </span>
              {correlation?.pm25_max_threshold != null && (
                <span className="inline-flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
                  <span className="w-3 border-t-2 border-dashed border-rose-500" />
                  Umbral máx: {correlation.pm25_max_threshold} p/m³
                </span>
              )}
            </div>
            <span>{points.length} puntos</span>
          </div>
        </div>

        {/* Gráfica 2: KMeans Patrones por Hora */}
        <div className="flex flex-col justify-between rounded-2xl border border-[#e5edf0] bg-white p-5 shadow-[0_8px_24px_rgba(18,49,66,0.04)] dark:border-[#1e3340] dark:bg-[#101e26]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-[#163542] dark:text-[#e6f0f2]">
                2. Patrones de acceso por turnos (KMeans)
              </h2>
              <p className="mt-0.5 text-xs text-[#82969d] dark:text-[#94adb8]">
                Agrupamiento no supervisado de accesos según franja horaria
              </p>
            </div>
            <span className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300">
              k = 3 clusters
            </span>
          </div>

          <div className="mt-4">
            {patternsLoading ? (
              <div className="flex h-56 items-center justify-center gap-2 text-xs text-[#718995] dark:text-[#94adb8]">
                <LoaderCircle className="size-4 animate-spin" />
                Ejecutando agrupamiento KMeans…
              </div>
            ) : patterns.length === 0 ? (
              <div className="flex h-56 items-center justify-center rounded-xl border border-dashed border-[#dce8eb] text-xs text-[#82969d] dark:border-[#233a47] dark:text-[#94adb8]">
                Sin suficientes eventos horarios para agrupar.
              </div>
            ) : (
              <KmeansSvgChart
                patterns={patterns}
                hoveredIndex={hoveredClusterIdx}
                onHover={setHoveredClusterIdx}
              />
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-4 border-t border-[#edf2f3] pt-3 text-[11px] text-[#718995] dark:border-[#1e3340] dark:text-[#94adb8]">
            {Object.entries(CLUSTER_COLORS).map(([key, cfg]) => (
              <span key={key} className="inline-flex items-center gap-1.5">
                <span className={`size-2.5 rounded-full ${cfg.dot}`} />
                {cfg.label}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Anomalías IsolationForest + Métricas ModelResult */}
      <section className="grid gap-6 lg:grid-cols-2">
        {/* Anomalías */}
        <div className="rounded-2xl border border-[#e5edf0] bg-white p-5 shadow-[0_8px_24px_rgba(18,49,66,0.04)] dark:border-[#1e3340] dark:bg-[#101e26]">
          <div className="flex items-center justify-between border-b border-[#edf2f3] pb-3.5 dark:border-[#1e3340]">
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-xl bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                <AlertTriangle className="size-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-[#163542] dark:text-[#e6f0f2]">
                  Anomalías detectadas (IsolationForest)
                </h2>
                <p className="text-xs text-[#82969d] dark:text-[#94adb8]">
                  Desviaciones ambientales fuera de rango normativo
                </p>
              </div>
            </div>
            <span className="font-mono text-xs font-semibold text-[#58727c] dark:text-[#94adb8]">
              {anomalies.length} registros
            </span>
          </div>

          <div className="mt-4 max-h-80 space-y-2.5 overflow-y-auto pr-1">
            {anomaliesLoading ? (
              <div className="flex items-center justify-center gap-2 py-8 text-xs text-[#718995] dark:text-[#94adb8]">
                <LoaderCircle className="size-4 animate-spin" />
                Consultando anomalías…
              </div>
            ) : anomalies.length === 0 ? (
              <p className="py-8 text-center text-xs text-[#82969d] dark:text-[#94adb8]">
                No se registran anomalías ambientales.
              </p>
            ) : (
              anomalies.slice(0, 25).map((item) => (
                <div
                  key={item.id}
                  className="flex items-start justify-between gap-3 rounded-xl border border-[#edf2f3] bg-[#f8fbfb] p-3 text-xs dark:border-[#1e3340] dark:bg-[#0d1820]"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                          item.severity === 'CRITICAL'
                            ? 'bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300'
                            : 'bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300'
                        }`}
                      >
                        {item.severity ?? 'ALERTA'}
                      </span>
                      <span className="font-mono text-[11px] text-[#718995] dark:text-[#94adb8]">
                        Cuarto #{item.cleanroom_id}
                      </span>
                    </div>
                    <p className="mt-1.5 font-semibold text-[#163542] dark:text-[#e6f0f2]">
                      {item.message}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="text-[10px] font-semibold text-[#087f7b] dark:text-[#5eead4]">
                      {item.status ?? 'ACTIVE'}
                    </span>
                    <p className="mt-0.5 font-mono text-[10px] text-[#82969d]">
                      {formatDateTime(item.created_at)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Métricas ModelResult */}
        <div className="rounded-2xl border border-[#e5edf0] bg-white p-5 shadow-[0_8px_24px_rgba(18,49,66,0.04)] dark:border-[#1e3340] dark:bg-[#101e26]">
          <div className="flex items-center justify-between border-b border-[#edf2f3] pb-3.5 dark:border-[#1e3340]">
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-xl bg-[#eff8f7] text-[#087f7b] dark:bg-[#13313b] dark:text-[#5eead4]">
                <BarChart3 className="size-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-[#163542] dark:text-[#e6f0f2]">
                  Historial de entrenamiento (ModelResult)
                </h2>
                <p className="text-xs text-[#82969d] dark:text-[#94adb8]">
                  Resultados persistidos de scikit-learn sobre telemetría
                </p>
              </div>
            </div>
            <span className="font-mono text-xs font-semibold text-[#58727c] dark:text-[#94adb8]">
              {modelResults.length} corridas
            </span>
          </div>

          <div className="mt-4 max-h-80 space-y-2.5 overflow-y-auto pr-1">
            {metricsLoading ? (
              <div className="flex items-center justify-center gap-2 py-8 text-xs text-[#718995] dark:text-[#94adb8]">
                <LoaderCircle className="size-4 animate-spin" />
                Cargando métricas de modelos…
              </div>
            ) : modelResults.length === 0 ? (
              <p className="py-8 text-center text-xs text-[#82969d] dark:text-[#94adb8]">
                Aún no hay entrenamientos registrados. Usa “Entrenar IsolationForest”.
              </p>
            ) : (
              modelResults.map((run) => {
                let parsed: Record<string, unknown> = {}
                try {
                  parsed = JSON.parse(run.result_json) as Record<string, unknown>
                } catch {
                  parsed = { raw: run.result_json }
                }

                return (
                  <div
                    key={run.id}
                    className="rounded-xl border border-[#edf2f3] bg-[#f8fbfb] p-3.5 text-xs dark:border-[#1e3340] dark:bg-[#0d1820]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="rounded-md bg-[#eff8f7] px-2 py-0.5 font-mono text-[11px] font-semibold text-[#087f7b] dark:bg-[#13313b] dark:text-[#5eead4]">
                        {run.model_type}
                      </span>
                      <span className="font-mono text-[11px] text-[#82969d] dark:text-[#94adb8]">
                        {formatDateTime(run.trained_at)}
                      </span>
                    </div>
                    <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {Object.entries(parsed).slice(0, 6).map(([k, v]) => (
                        <div key={k} className="rounded-lg bg-white px-2.5 py-1.5 dark:bg-[#101e26]">
                          <p className="text-[10px] text-[#82969d] dark:text-[#94adb8]">{k}</p>
                          <p className="font-mono font-semibold text-[#163542] dark:text-[#e6f0f2]">
                            {typeof v === 'number' ? Number(v.toFixed(4)) : String(v)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </section>
    </div>
  )
}

function IndicatorCard({
  label,
  value,
  icon,
}: {
  label: string
  value: string
  icon: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-[#e5edf0] bg-white p-4 shadow-[0_8px_24px_rgba(18,49,66,0.04)] dark:border-[#1e3340] dark:bg-[#101e26]">
      <div className="flex items-center justify-between text-[#82969d] dark:text-[#94adb8]">
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em]">{label}</span>
        {icon}
      </div>
      <p className="mt-1.5 text-2xl font-bold text-[#163542] dark:text-[#e6f0f2]">{value}</p>
    </div>
  )
}

function CorrelationSvgChart({
  points,
  threshold,
  hoveredIndex,
  onHover,
}: {
  points: CorrelationPoint[]
  threshold: number | null
  hoveredIndex: number | null
  onHover: (idx: number | null) => void
}) {
  const width = 560
  const height = 220
  const padLeft = 42
  const padRight = 38
  const padTop = 18
  const padBottom = 26
  const plotW = width - padLeft - padRight
  const plotH = height - padTop - padBottom

  const maxOcc = Math.max(8, ...points.map((p) => p.occupancy))
  const maxPmVal = Math.max(
    threshold ? threshold + 20 : 200,
    ...points.map((p) => p.pm25),
  )
  const minPmVal = Math.min(50, ...points.map((p) => p.pm25))
  const pmRange = Math.max(20, maxPmVal - minPmVal)

  const xAt = (idx: number) =>
    points.length === 1 ? padLeft + plotW / 2 : padLeft + (idx / (points.length - 1)) * plotW
  const yOccAt = (occ: number) => padTop + plotH - (occ / maxOcc) * plotH
  const yPmAt = (pm: number) => padTop + plotH - ((pm - minPmVal) / pmRange) * plotH

  const occPath = points
    .map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${xAt(idx).toFixed(1)} ${yOccAt(pt.occupancy).toFixed(1)}`)
    .join(' ')
  const pmPath = points
    .map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${xAt(idx).toFixed(1)} ${yPmAt(pt.pm25).toFixed(1)}`)
    .join(' ')

  const hovered = hoveredIndex !== null ? points[hoveredIndex] : null

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-56 w-full overflow-visible"
        onMouseLeave={() => onHover(null)}
      >
        {[0, 0.33, 0.66, 1].map((step) => {
          const y = padTop + plotH * step
          const pmTick = Math.round(maxPmVal - pmRange * step)
          const occTick = Math.round(maxOcc * (1 - step))
          return (
            <g key={step}>
              <line
                x1={padLeft}
                y1={y}
                x2={width - padRight}
                y2={y}
                className="stroke-[#e5edf0] dark:stroke-[#1e3340]"
                strokeDasharray="4 4"
              />
              <text
                x={padLeft - 6}
                y={y + 3}
                textAnchor="end"
                className="fill-[#82969d] font-mono text-[10px]"
              >
                {pmTick}
              </text>
              <text
                x={width - padRight + 6}
                y={y + 3}
                textAnchor="start"
                className="fill-[#087f7b] font-mono text-[10px] dark:fill-[#2dd4bf]"
              >
                {occTick} p
              </text>
            </g>
          )
        })}

        {threshold != null && (
          <line
            x1={padLeft}
            y1={yPmAt(threshold)}
            x2={width - padRight}
            y2={yPmAt(threshold)}
            stroke="#f43f5e"
            strokeWidth="1.5"
            strokeDasharray="6 4"
          />
        )}

        <path d={occPath} fill="none" stroke="#087f7b" strokeWidth="2.5" className="dark:stroke-[#2dd4bf]" />
        <path d={pmPath} fill="none" stroke="#f59e0b" strokeWidth="2.5" />

        {points.map((pt, idx) => {
          const x = xAt(idx)
          const yOcc = yOccAt(pt.occupancy)
          const yPm = yPmAt(pt.pm25)
          const isHovered = hoveredIndex === idx

          return (
            <g key={`${pt.timestamp}-${idx}`}>
              {isHovered && (
                <line
                  x1={x}
                  y1={padTop}
                  x2={x}
                  y2={padTop + plotH}
                  className="stroke-[#94adb8]/50"
                  strokeDasharray="3 3"
                />
              )}
              <circle
                cx={x}
                cy={yOcc}
                r={isHovered ? 5 : 3.2}
                className="fill-[#087f7b] dark:fill-[#2dd4bf]"
              />
              <circle
                cx={x}
                cy={yPm}
                r={isHovered ? 5 : 3.2}
                fill="#f59e0b"
              />
              <rect
                x={x - plotW / Math.max(points.length * 2, 12)}
                y={padTop}
                width={plotW / Math.max(points.length, 6)}
                height={plotH}
                fill="transparent"
                onMouseEnter={() => onHover(idx)}
              />
            </g>
          )
        })}

        {points.length > 0 && (
          <>
            <text x={padLeft} y={height - 6} className="fill-[#82969d] font-mono text-[10px]">
              {formatShortTime(points[0].timestamp)}
            </text>
            <text
              x={width - padRight}
              y={height - 6}
              textAnchor="end"
              className="fill-[#82969d] font-mono text-[10px]"
            >
              {formatShortTime(points[points.length - 1].timestamp)}
            </text>
          </>
        )}
      </svg>

      {hovered && (
        <div className="pointer-events-none absolute top-1 right-1 rounded-xl border border-[#dce8eb] bg-white/95 px-3 py-2 text-[11px] shadow-md dark:border-[#233a47] dark:bg-[#101e26]/95">
          <p className="font-mono text-[#718995] dark:text-[#94adb8]">
            {formatShortTime(hovered.timestamp)}
          </p>
          <p className="font-semibold text-[#087f7b] dark:text-[#2dd4bf]">
            Ocupación: {hovered.occupancy} personas
          </p>
          <p className="font-semibold text-amber-600 dark:text-amber-300">
            PM2.5: {hovered.pm25} p/m³
          </p>
        </div>
      )}
    </div>
  )
}

function KmeansSvgChart({
  patterns,
  hoveredIndex,
  onHover,
}: {
  patterns: AccessPatternCluster[]
  hoveredIndex: number | null
  onHover: (idx: number | null) => void
}) {
  const width = 560
  const height = 220
  const padLeft = 34
  const padRight = 14
  const padTop = 18
  const padBottom = 28
  const plotW = width - padLeft - padRight
  const plotH = height - padTop - padBottom

  const maxCount = Math.max(10, ...patterns.map((p) => p.count))
  const slotW = plotW / Math.max(patterns.length, 1)
  const barW = Math.max(10, Math.min(30, slotW - 8))
  const hovered = hoveredIndex !== null ? patterns[hoveredIndex] : null

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-56 w-full overflow-visible"
        onMouseLeave={() => onHover(null)}
      >
        {[0, 0.5, 1].map((step) => {
          const y = padTop + plotH * step
          const tick = Math.round(maxCount * (1 - step))
          return (
            <g key={step}>
              <line
                x1={padLeft}
                y1={y}
                x2={width - padRight}
                y2={y}
                className="stroke-[#e5edf0] dark:stroke-[#1e3340]"
                strokeDasharray="4 4"
              />
              <text
                x={padLeft - 6}
                y={y + 3}
                textAnchor="end"
                className="fill-[#82969d] font-mono text-[10px]"
              >
                {tick}
              </text>
            </g>
          )
        })}

        {patterns.map((item, idx) => {
          const barH = Math.max(4, (item.count / maxCount) * plotH)
          const x = padLeft + idx * slotW + (slotW - barW) / 2
          const y = padTop + plotH - barH
          const fill = CLUSTER_COLORS[item.cluster]?.fill ?? '#087f7b'
          const isHovered = hoveredIndex === idx

          return (
            <g key={`${item.hour}-${idx}`} onMouseEnter={() => onHover(idx)}>
              <rect
                x={x}
                y={y}
                width={barW}
                height={barH}
                rx="4"
                fill={fill}
                opacity={isHovered ? 1 : 0.85}
              />
              <text
                x={x + barW / 2}
                y={padTop + plotH + 16}
                textAnchor="middle"
                className="fill-[#718995] font-mono text-[10px] dark:fill-[#94adb8]"
              >
                {String(item.hour).padStart(2, '0')}h
              </text>
            </g>
          )
        })}
      </svg>

      {hovered && (
        <div className="pointer-events-none absolute top-1 right-1 rounded-xl border border-[#dce8eb] bg-white/95 px-3 py-2 text-[11px] shadow-md dark:border-[#233a47] dark:bg-[#101e26]/95">
          <p className="font-mono font-semibold text-[#163542] dark:text-[#e6f0f2]">
            {String(hovered.hour).padStart(2, '0')}:00 h · {hovered.count} accesos
          </p>
          <p className="text-[#087f7b] dark:text-[#2dd4bf]">
            {hovered.cluster_label} ({hovered.cluster.toUpperCase()})
          </p>
        </div>
      )}
    </div>
  )
}
