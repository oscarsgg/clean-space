'use client'

import { useMemo, useState } from 'react'
import useSWR from 'swr'
import {
  Activity,
  AlertTriangle,
  Bot,
  CheckCircle2,
  DoorOpen,
  Download,
  FileText,
  LoaderCircle,
  Lock,
  Radio,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Unlock,
  Users,
  Wind,
} from 'lucide-react'
import {
  api,
  type AgentDecision,
  type AgentReport,
  type SupervisorRoomSummary,
  type SupervisorSummary,
} from '@/lib/api'
import { userFacingClientError } from '@/lib/user-facing-errors.mjs'
import { useRealtimeEvents } from '@/hooks/use-realtime-events'
import { AgentConsole } from '@/components/agent-drawer'

function normalizeDecisions(value: unknown): AgentDecision[] {
  if (Array.isArray(value)) return value as AgentDecision[]
  if (value && typeof value === 'object' && Array.isArray((value as { items?: unknown }).items)) {
    return (value as { items: AgentDecision[] }).items
  }
  return []
}

function normalizeReports(value: unknown): AgentReport[] {
  if (Array.isArray(value)) return value as AgentReport[]
  if (value && typeof value === 'object' && Array.isArray((value as { items?: unknown }).items)) {
    return (value as { items: AgentReport[] }).items
  }
  return []
}

function formatDateTime(value?: string | null) {
  if (!value) return 'Fecha no disponible'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Fecha no disponible'
  return date.toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })
}

const METRIC_LABELS: Record<string, string> = {
  temperature: 'Temperatura',
  humidity: 'Humedad',
  pm25: 'PM2.5',
  pressure: 'Presión',
}

function decisionStyle(decisionType: string) {
  const type = decisionType.toUpperCase()
  if (type === 'ALLOW') {
    return {
      badge: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30',
      label: 'ALLOW',
    }
  }
  if (type === 'DENY') {
    return {
      badge: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30',
      label: 'DENY',
    }
  }
  if (type === 'LOCK') {
    return {
      badge: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30',
      label: 'LOCK',
    }
  }
  if (type === 'COMMAND') {
    return {
      badge: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-500/15 dark:text-indigo-300 dark:border-indigo-500/30',
      label: 'COMMAND',
    }
  }
  return {
    badge: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:border-sky-500/30',
    label: type || 'ALERT',
  }
}

export function SupervisorDashboard() {
  const [periodDays, setPeriodDays] = useState(7)
  const [selectedRoom, setSelectedRoom] = useState('')
  const summaryQuery = useMemo(() => {
    const end = new Date()
    const start = new Date(end.getTime() - periodDays * 86400000)
    const params = new URLSearchParams({ start_at: start.toISOString(), end_at: end.toISOString() })
    if (selectedRoom) params.set('cleanroom_id', selectedRoom)
    return `?${params.toString()}`
  }, [periodDays, selectedRoom])
  const {
    data: summary,
    error: summaryError,
    isLoading: summaryLoading,
    mutate: mutateSummary,
  } = useSWR<SupervisorSummary>(['supervisor-summary', summaryQuery], () => api.supervisorSummary(summaryQuery))

  const [decisionFilter, setDecisionFilter] = useState<string>('ALL')
  const {
    data: decisionsRaw,
    isLoading: decisionsLoading,
    mutate: mutateDecisions,
  } = useSWR(['agent-decisions', decisionFilter], () => {
    const query = decisionFilter !== 'ALL' ? `?decision_type=${decisionFilter}&limit=25` : '?limit=25'
    return api.agent.decisions(query)
  })

  const {
    data: reportsRaw,
    isLoading: reportsLoading,
    mutate: mutateReports,
  } = useSWR('agent-reports', api.agent.reports)

  const { status: realtimeStatus } = useRealtimeEvents({
    mutateKeys: ['supervisor-summary', 'agent-decisions'],
  })

  const [commandBusyKey, setCommandBusyKey] = useState<string | null>(null)
  const [commandNotice, setCommandNotice] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)

  const [reportTitle, setReportTitle] = useState('')
  const [reportRoomId, setReportRoomId] = useState('')
  const [creatingReport, setCreatingReport] = useState(false)
  const [exportingKey, setExportingKey] = useState<string | null>(null)
  const [reportNotice, setReportNotice] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)

  const rooms = summary?.rooms ?? []
  const decisions = useMemo(() => normalizeDecisions(decisionsRaw), [decisionsRaw])
  const reports = useMemo(() => normalizeReports(reportsRaw), [reportsRaw])

  const triggerDeviceCommand = async (
    room: SupervisorRoomSummary,
    command: 'bloquear' | 'normal' | 'leer_ahora',
  ) => {
    if (!room.device_id) {
      setCommandNotice({
        tone: 'err',
        text: `El cuarto ${room.code} no tiene un dispositivo IoT vinculado.`,
      })
      return
    }
    const key = `${room.id}-${command}`
    setCommandBusyKey(key)
    setCommandNotice(null)
    try {
      const payload = command === 'bloquear' ? { duration_seconds: 60, source: 'supervisor_dashboard' } : {}
      await api.sendCommand({ device_id: room.device_id, command, payload })
      setCommandNotice({
        tone: 'ok',
        text: `Comando "${command}" enviado al dispositivo ${room.device_code ?? `#${room.device_id}`} (${room.code}).`,
      })
      void mutateSummary()
      void mutateDecisions()
    } catch (cause) {
      setCommandNotice({
        tone: 'err',
        text: userFacingClientError(cause),
      })
    } finally {
      setCommandBusyKey(null)
    }
  }

  const handleCreateReport = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setCreatingReport(true)
    setReportNotice(null)
    try {
      await api.agent.createReport({
        title: reportTitle.trim() || undefined,
        cleanroom_id: reportRoomId ? Number(reportRoomId) : null,
      })
      setReportTitle('')
      setReportNotice({ tone: 'ok', text: 'Reporte operativo generado y almacenado.' })
      await mutateReports()
    } catch (cause) {
      setReportNotice({
        tone: 'err',
        text: userFacingClientError(cause),
      })
    } finally {
      setCreatingReport(false)
    }
  }

  const handleExportReport = async (reportId: number, format: 'json' | 'md' | 'csv') => {
    const key = `${reportId}-${format}`
    setExportingKey(key)
    setReportNotice(null)
    try {
      const file = await api.agent.exportReport(reportId, format)
      const blob = new Blob([file.content], { type: file.contentType })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = file.filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (cause) {
      setReportNotice({
        tone: 'err',
        text: userFacingClientError(cause),
      })
    } finally {
      setExportingKey(null)
    }
  }

  const refreshAll = () => {
    void mutateSummary()
    void mutateDecisions()
    void mutateReports()
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#087f7b] dark:text-[#2dd4bf]">
            Supervisión · centro de control
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-[#102d3b] dark:text-[#e6f0f2]">
            Resumen operativo del supervisor
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm text-[#718995] dark:text-[#94adb8]">
            Monitoreo en vivo de cuartos limpios, decisiones reactivas del agente y generación de reportes auditables.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select aria-label="Periodo de actividad" value={periodDays} onChange={event => setPeriodDays(Number(event.target.value))} className="rounded-xl border border-[#dce8eb] bg-white px-3 py-2 text-xs dark:border-[#233a47] dark:bg-[#101e26]"><option value={7}>7 días</option><option value={30}>30 días</option><option value={90}>90 días</option></select>
          <select aria-label="Cuarto asignado" value={selectedRoom} onChange={event => setSelectedRoom(event.target.value)} className="rounded-xl border border-[#dce8eb] bg-white px-3 py-2 text-xs dark:border-[#233a47] dark:bg-[#101e26]"><option value="">Todos mis cuartos</option>{rooms.map(room => <option key={room.id} value={room.id}>{room.code}</option>)}</select>
          <span
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${
              realtimeStatus === 'connected'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300'
                : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-300'
            }`}
          >
            <span
              className={`size-2 rounded-full ${
                realtimeStatus === 'connected' ? 'animate-pulse bg-emerald-500' : 'bg-amber-500'
              }`}
            />
            {realtimeStatus === 'connected'
              ? 'Stream SSE en vivo'
              : realtimeStatus === 'reconnecting'
                ? 'Reconectando stream…'
                : 'Conectando stream…'}
          </span>

          <button
            type="button"
            onClick={refreshAll}
            className="inline-flex items-center gap-2 rounded-xl border border-[#dce8eb] bg-white px-3.5 py-2 text-xs font-semibold text-[#29434e] transition hover:bg-[#f4f9f8] dark:border-[#233a47] dark:bg-[#101e26] dark:text-[#e6f0f2] dark:hover:bg-[#182b36]"
          >
            <RefreshCw className="size-3.5" />
            Actualizar
          </button>
        </div>
      </div>

      {summaryError && (
        <div
          role="alert"
          className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-950/40 dark:text-red-200"
        >
          No se pudo consultar el resumen de supervisión: {userFacingClientError(summaryError)}
        </div>
      )}

      {/* 6 KPIs globales */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <KpiCard
          label="Eventos totales"
          value={summaryLoading ? '—' : String(summary?.total_events ?? 0)}
          icon={<Activity className="size-4" />}
        />
        <KpiCard
          label="Entradas"
          value={summaryLoading ? '—' : String(summary?.entries ?? 0)}
          tone="emerald"
          icon={<DoorOpen className="size-4" />}
        />
        <KpiCard
          label="Salidas"
          value={summaryLoading ? '—' : String(summary?.exits ?? 0)}
          tone="sky"
          icon={<CheckCircle2 className="size-4" />}
        />
        <KpiCard
          label="Denegados"
          value={summaryLoading ? '—' : String(summary?.denied ?? 0)}
          tone="rose"
          icon={<ShieldAlert className="size-4" />}
        />
        <KpiCard
          label="Ocupación actual"
          value={summaryLoading ? '—' : String(summary?.current_occupancy ?? 0)}
          tone="teal"
          icon={<Users className="size-4" />}
        />
        <KpiCard
          label="Avisos activos"
          value={summaryLoading ? '—' : String(summary?.active_alerts ?? 0)}
          tone={(summary?.active_alerts ?? 0) > 0 ? 'amber' : 'emerald'}
          icon={<AlertTriangle className="size-4" />}
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <article className="rounded-2xl border border-[#e5edf0] bg-white p-5 dark:border-[#1e3340] dark:bg-[#101e26]"><h2 className="font-semibold">Accesos por día</h2><p className="text-xs text-[#718995]">Permitidos y denegados · periodo seleccionado</p>{!summaryLoading && !summary?.access_series?.length ? <p className="py-12 text-center text-sm text-[#718995]">Sin eventos en el periodo.</p> : <div className="mt-5 flex h-44 items-end gap-2 overflow-x-auto">{(summary?.access_series ?? []).map(day => { const max = Math.max(1, ...summary!.access_series!.map(x => x.allowed + x.denied)); return <div key={day.date} className="flex h-full min-w-7 flex-1 flex-col justify-end gap-1 text-center"><div title={`Permitidos ${day.allowed}`} className="mx-auto w-3/4 rounded-t bg-teal-600" style={{height:`${Math.max(3,day.allowed/max*80)}%`}}/><div title={`Denegados ${day.denied}`} className="mx-auto w-3/4 bg-rose-400" style={{height:`${day.denied?Math.max(3,day.denied/max*80):0}%`}}/><span className="text-[9px] text-[#718995]">{day.date.slice(5)}</span></div>})}</div>}</article>
        <article className="rounded-2xl border border-[#e5edf0] bg-white p-5 dark:border-[#1e3340] dark:bg-[#101e26]"><h2 className="font-semibold">Lecturas ambientales recientes</h2><p className="text-xs text-[#718995]">Promedio diario por métrica · hasta 5,000 lecturas</p>{!summaryLoading && !summary?.environment_series?.length ? <p className="py-12 text-center text-sm text-[#718995]">Sin lecturas en el periodo.</p> : <div className="mt-4 max-h-48 space-y-2 overflow-auto">{(summary?.environment_series ?? []).slice(-20).map((reading,index) => <div key={`${reading.date}-${reading.metric}-${index}`} className="flex items-center gap-3 text-xs"><span className="w-24 shrink-0 text-[#718995]">{reading.date.slice(5)} · {reading.metric}</span><div className="h-2 flex-1 rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full rounded-full bg-sky-600" style={{width:`${Math.min(100,Math.max(4,Number(reading.average)))}%`}}/></div><b>{reading.average} {reading.unit}</b></div>)}</div>}</article>
      </section>

      {commandNotice && (
        <div
          role={commandNotice.tone === 'err' ? 'alert' : 'status'}
          className={`rounded-2xl border px-4 py-3 text-sm ${
            commandNotice.tone === 'err'
              ? 'border-red-200 bg-red-50 text-red-800 dark:border-red-500/30 dark:bg-red-950/40 dark:text-red-200'
              : 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-950/40 dark:text-emerald-200'
          }`}
        >
          {commandNotice.text}
        </div>
      )}

      {/* Tarjetas por Cuarto Limpio */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-[#163542] dark:text-[#e6f0f2]">
            Estado por cuarto limpio
          </h2>
          <span className="text-xs text-[#82969d] dark:text-[#94adb8]">
            {rooms.length} {rooms.length === 1 ? 'sala asignada' : 'salas asignadas'}
          </span>
        </div>

        {summaryLoading ? (
          <div className="flex min-h-40 items-center justify-center gap-2 rounded-2xl border border-[#e5edf0] bg-white text-sm text-[#718995] dark:border-[#1e3340] dark:bg-[#101e26] dark:text-[#94adb8]">
            <LoaderCircle className="size-4 animate-spin" />
            Cargando cuartos limpios…
          </div>
        ) : rooms.length === 0 ? (
          <div className="rounded-2xl border border-[#e5edf0] bg-white p-8 text-center text-sm text-[#718995] dark:border-[#1e3340] dark:bg-[#101e26] dark:text-[#94adb8]">
            No hay cuartos limpios asignados a este usuario.
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-2">
            {rooms.map((room) => {
              const occupancyRatio = room.capacity > 0
                ? Math.min(100, Math.round((room.current_occupancy / room.capacity) * 100))
                : 0
              const nearCapacity = room.capacity > 0 && room.current_occupancy >= room.capacity
              const metricEntries = Object.entries(room.metrics ?? {})

              return (
                <article
                  key={room.id}
                  className="flex flex-col justify-between gap-4 rounded-2xl border border-[#e5edf0] bg-white p-5 shadow-[0_8px_24px_rgba(18,49,66,0.04)] dark:border-[#1e3340] dark:bg-[#101e26]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-lg bg-[#eff8f7] px-2.5 py-1 font-mono text-xs font-semibold text-[#087f7b] dark:bg-[#13313b] dark:text-[#5eead4]">
                          {room.code}
                        </span>
                        <span className="rounded-lg bg-[#f2f7f7] px-2.5 py-1 text-xs font-semibold text-[#29434e] dark:bg-[#15242e] dark:text-[#d7e6ea]">
                          {room.iso_class}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                            room.device_status === 'ACTIVE'
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                          }`}
                        >
                          <Radio className="size-3" />
                          {room.device_code ?? 'Sin lector'} · {room.device_status ?? 'INACTIVO'}
                        </span>
                      </div>
                      <h3 className="mt-2 text-lg font-semibold text-[#163542] dark:text-[#e6f0f2]">
                        {room.name}
                      </h3>
                    </div>

                    <div className="text-right">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#82969d] dark:text-[#94adb8]">
                        Aforo
                      </p>
                      <p className={`text-xl font-bold ${nearCapacity ? 'text-amber-600 dark:text-amber-300' : 'text-[#163542] dark:text-[#e6f0f2]'}`}>
                        {room.current_occupancy} / {room.capacity}
                      </p>
                    </div>
                  </div>

                  {/* Barra de ocupación + ocupantes */}
                  <div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-[#edf2f3] dark:bg-[#1e3340]">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          nearCapacity ? 'bg-amber-500' : 'bg-[#087f7b] dark:bg-[#14b8a6]'
                        }`}
                        style={{ width: `${occupancyRatio}%` }}
                      />
                    </div>
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {room.occupants.length === 0 ? (
                        <span className="text-xs text-[#82969d] dark:text-[#94adb8]">
                          Sin personal dentro de la sala
                        </span>
                      ) : (
                        room.occupants.map((occ) => (
                          <span
                            key={`${occ.user_id}-${occ.uid_label}`}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-[#dce8eb] bg-[#f7fbfa] px-2 py-1 text-[11px] font-medium text-[#29434e] dark:border-[#233a47] dark:bg-[#13222b] dark:text-[#d7e6ea]"
                          >
                            <span className="size-1.5 rounded-full bg-emerald-500" />
                            {occ.full_name}
                            <span className="font-mono text-[10px] text-[#718995] dark:text-[#94adb8]">
                              {occ.uid_label}
                            </span>
                          </span>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Métricas ambientales */}
                  <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                    {metricEntries.length === 0 ? (
                      <div className="col-span-full rounded-xl bg-[#f7fbfa] p-3 text-xs text-[#82969d] dark:bg-[#13222b] dark:text-[#94adb8]">
                        Sin lecturas recientes registradas.
                      </div>
                    ) : (
                      metricEntries.map(([metricKey, metric]) => (
                        <div
                          key={metricKey}
                          className={`rounded-xl border p-3 ${
                            metric.in_range
                              ? 'border-[#e5edf0] bg-[#f7fbfa] dark:border-[#1e3340] dark:bg-[#13222b]'
                              : 'border-rose-200 bg-rose-50/70 dark:border-rose-500/30 dark:bg-rose-950/30'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[11px] font-medium text-[#718995] dark:text-[#94adb8]">
                              {METRIC_LABELS[metricKey] ?? metricKey}
                            </span>
                            <Wind
                              className={`size-3.5 ${
                                metric.in_range ? 'text-[#087f7b] dark:text-[#2dd4bf]' : 'text-rose-600 dark:text-rose-400'
                              }`}
                            />
                          </div>
                          <p className="mt-1.5 text-base font-bold text-[#163542] dark:text-[#e6f0f2]">
                            {metric.value !== null ? `${metric.value} ${metric.unit}` : '—'}
                          </p>
                          <p className="mt-0.5 text-[10px] text-[#82969d] dark:text-[#94adb8]">
                            {metric.min_value !== null && metric.max_value !== null
                              ? `Rango ${metric.min_value}–${metric.max_value}`
                              : metric.in_range
                                ? 'En rango'
                                : 'Revisar'}
                          </p>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Botones de comando */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#edf2f3] pt-3 dark:border-[#1e3340]">
                    <span className="text-[11px] text-[#82969d] dark:text-[#94adb8]">
                      Control directo de actuador
                    </span>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={!room.device_id || commandBusyKey !== null}
                        onClick={() => void triggerDeviceCommand(room, 'bloquear')}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 transition hover:bg-amber-100 disabled:opacity-50 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-300 dark:hover:bg-amber-500/25"
                      >
                        {commandBusyKey === `${room.id}-bloquear` ? (
                          <LoaderCircle className="size-3.5 animate-spin" />
                        ) : (
                          <Lock className="size-3.5" />
                        )}
                        Bloquear
                      </button>

                      <button
                        type="button"
                        disabled={!room.device_id || commandBusyKey !== null}
                        onClick={() => void triggerDeviceCommand(room, 'normal')}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-[#dce8eb] bg-white px-3 py-1.5 text-xs font-semibold text-[#29434e] transition hover:bg-[#f4f9f8] disabled:opacity-50 dark:border-[#233a47] dark:bg-[#13222b] dark:text-[#d7e6ea] dark:hover:bg-[#182b36]"
                      >
                        {commandBusyKey === `${room.id}-normal` ? (
                          <LoaderCircle className="size-3.5 animate-spin" />
                        ) : (
                          <Unlock className="size-3.5" />
                        )}
                        Normal
                      </button>

                      <button
                        type="button"
                        disabled={!room.device_id || commandBusyKey !== null}
                        onClick={() => void triggerDeviceCommand(room, 'leer_ahora')}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-[#087f7b] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#066c69] disabled:opacity-50"
                      >
                        {commandBusyKey === `${room.id}-leer_ahora` ? (
                          <LoaderCircle className="size-3.5 animate-spin" />
                        ) : (
                          <Activity className="size-3.5" />
                        )}
                        Leer ahora
                      </button>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>

      {/* Agente Reactivo + Consola Conversacional */}
      <section className="grid gap-6 lg:grid-cols-2">
        {/* Bitácora reactiva */}
        <div className="flex flex-col rounded-2xl border border-[#e5edf0] bg-white p-5 shadow-[0_8px_24px_rgba(18,49,66,0.04)] dark:border-[#1e3340] dark:bg-[#101e26]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#edf2f3] pb-3.5 dark:border-[#1e3340]">
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-xl bg-[#eff8f7] text-[#087f7b] dark:bg-[#13313b] dark:text-[#5eead4]">
                <ShieldCheck className="size-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-[#163542] dark:text-[#e6f0f2]">
                  Decisiones reactivas del agente
                </h2>
                <p className="text-xs text-[#82969d] dark:text-[#94adb8]">
                  Reglas RN-03, RN-08, RN-10 y RN-11 persistidas en PostgreSQL
                </p>
              </div>
            </div>

            <select
              aria-label="Filtrar decisiones por tipo"
              value={decisionFilter}
              onChange={(event) => setDecisionFilter(event.target.value)}
              className="rounded-lg border border-[#dce8eb] bg-[#f7fbfa] px-2.5 py-1.5 text-xs font-medium text-[#29434e] outline-none focus:border-[#087f7b] dark:border-[#233a47] dark:bg-[#13222b] dark:text-[#e6f0f2]"
            >
              <option value="ALL">Todas</option>
              <option value="ALLOW">ALLOW</option>
              <option value="DENY">DENY</option>
              <option value="LOCK">LOCK</option>
              <option value="ALERT">ALERT</option>
              <option value="COMMAND">COMMAND</option>
            </select>
          </div>

          <div className="mt-4 flex max-h-[420px] flex-col gap-2.5 overflow-y-auto pr-1">
            {decisionsLoading ? (
              <div className="flex items-center justify-center gap-2 py-12 text-xs text-[#718995] dark:text-[#94adb8]">
                <LoaderCircle className="size-4 animate-spin" />
                Cargando bitácora de decisiones…
              </div>
            ) : decisions.length === 0 ? (
              <p className="py-10 text-center text-xs text-[#82969d] dark:text-[#94adb8]">
                No hay decisiones registradas con este filtro.
              </p>
            ) : (
              decisions.map((decision) => {
                const style = decisionStyle(decision.decision_type)
                const headline = decision.summary || decision.title || 'Decisión registrada'
                const subtext = decision.detail || (
                  decision.cleanroom_code
                    ? `Sala ${decision.cleanroom_code}${decision.severity ? ` · Severidad ${decision.severity}` : ''}`
                    : decision.severity
                      ? `Severidad ${decision.severity}`
                      : ''
                )
                return (
                  <div
                    key={decision.id}
                    className="rounded-xl border border-[#edf2f3] bg-[#f8fbfb] p-3.5 transition hover:border-[#dce8eb] dark:border-[#1e3340] dark:bg-[#0d1820]"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${style.badge}`}>
                          {style.label}
                        </span>
                        <span className="font-mono text-[11px] font-semibold text-[#087f7b] dark:text-[#2dd4bf]">
                          {decision.rule_code}
                        </span>
                        {decision.cleanroom_code && (
                          <span className="rounded bg-[#eff8f7] px-1.5 py-0.5 font-mono text-[10px] text-[#29434e] dark:bg-[#13313b] dark:text-[#d7e6ea]">
                            {decision.cleanroom_code}
                          </span>
                        )}
                      </div>
                      <span className="font-mono text-[11px] text-[#82969d] dark:text-[#94adb8]">
                        {formatDateTime(decision.created_at)}
                      </span>
                    </div>
                    <p className="mt-1.5 text-sm font-semibold text-[#163542] dark:text-[#e6f0f2]">
                      {headline}
                    </p>
                    {subtext && (
                      <p className="mt-0.5 text-xs leading-relaxed text-[#58727c] dark:text-[#94adb8]">
                        {subtext}
                      </p>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Consola conversacional */}
        <div className="flex flex-col rounded-2xl border border-[#e5edf0] bg-white p-5 shadow-[0_8px_24px_rgba(18,49,66,0.04)] dark:border-[#1e3340] dark:bg-[#101e26]">
          <div className="mb-3 flex items-center gap-2.5 border-b border-[#edf2f3] pb-3.5 dark:border-[#1e3340]">
            <div className="flex size-9 items-center justify-center rounded-xl bg-[#eff8f7] text-[#087f7b] dark:bg-[#13313b] dark:text-[#5eead4]">
              <Bot className="size-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[#163542] dark:text-[#e6f0f2]">
                Consola conversacional del agente
              </h2>
              <p className="text-xs text-[#82969d] dark:text-[#94adb8]">
                Historial persistente con confirmación humana para comandos críticos
              </p>
            </div>
          </div>

          <AgentConsole rooms={rooms} compact />
        </div>
      </section>

      {/* Generador y Exportación de Reportes */}
      <section className="rounded-2xl border border-[#e5edf0] bg-white p-5 shadow-[0_8px_24px_rgba(18,49,66,0.04)] dark:border-[#1e3340] dark:bg-[#101e26]">
        <div className="flex flex-col justify-between gap-4 border-b border-[#edf2f3] pb-4 dark:border-[#1e3340] lg:flex-row lg:items-center">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-[#eff8f7] text-[#087f7b] dark:bg-[#13313b] dark:text-[#5eead4]">
              <FileText className="size-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[#163542] dark:text-[#e6f0f2]">
                Generador y exportación de reportes
              </h2>
              <p className="text-xs text-[#82969d] dark:text-[#94adb8]">
                Consolida ocupación, alertas y decisiones en JSON, Markdown o CSV
              </p>
            </div>
          </div>

          <form onSubmit={handleCreateReport} className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={reportTitle}
              onChange={(event) => setReportTitle(event.target.value)}
              placeholder="Título del reporte (opcional)"
              className="rounded-xl border border-[#dce8eb] bg-[#f9fcfc] px-3 py-2 text-xs text-[#163542] outline-none focus:border-[#087f7b] dark:border-[#233a47] dark:bg-[#0d1820] dark:text-[#e6f0f2]"
            />
            <select
              aria-label="Cuarto del reporte"
              value={reportRoomId}
              onChange={(event) => setReportRoomId(event.target.value)}
              className="rounded-xl border border-[#dce8eb] bg-[#f9fcfc] px-3 py-2 text-xs text-[#29434e] outline-none focus:border-[#087f7b] dark:border-[#233a47] dark:bg-[#0d1820] dark:text-[#e6f0f2]"
            >
              <option value="">Todas las salas</option>
              {rooms.map((room) => (
                <option key={room.id} value={String(room.id)}>
                  {room.code}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={creatingReport}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#087f7b] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#066c69] disabled:opacity-60"
            >
              {creatingReport ? (
                <LoaderCircle className="size-3.5 animate-spin" />
              ) : (
                <FileText className="size-3.5" />
              )}
              Generar reporte
            </button>
          </form>
        </div>

        {reportNotice && (
          <div
            role={reportNotice.tone === 'err' ? 'alert' : 'status'}
            className={`mt-4 rounded-xl border px-3.5 py-2.5 text-xs ${
              reportNotice.tone === 'err'
                ? 'border-red-200 bg-red-50 text-red-800 dark:border-red-500/30 dark:bg-red-950/40 dark:text-red-200'
                : 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-950/40 dark:text-emerald-200'
            }`}
          >
            {reportNotice.text}
          </div>
        )}

        <div className="mt-4">
          {reportsLoading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-xs text-[#718995] dark:text-[#94adb8]">
              <LoaderCircle className="size-4 animate-spin" />
              Cargando reportes…
            </div>
          ) : reports.length === 0 ? (
            <p className="py-6 text-center text-xs text-[#82969d] dark:text-[#94adb8]">
              Aún no se han generado reportes operativos.
            </p>
          ) : (
            <div className="divide-y divide-[#edf2f3] dark:divide-[#1e3340]">
              {reports.slice(0, 8).map((report) => (
                <div
                  key={report.id}
                  className="flex flex-col justify-between gap-3 py-3.5 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-[#163542] dark:text-[#e6f0f2]">
                        {report.title}
                      </p>
                      <span className="rounded-md bg-[#eff8f7] px-2 py-0.5 font-mono text-[10px] font-semibold text-[#087f7b] dark:bg-[#13313b] dark:text-[#5eead4]">
                        #{report.id}
                      </span>
                    </div>
                    {(report.summary_text ?? report.summary) && (
                      <p className="mt-1 line-clamp-2 text-xs text-[#58727c] dark:text-[#94adb8]">
                        {report.summary_text ?? report.summary}
                      </p>
                    )}
                    <p className="mt-1 text-[11px] text-[#82969d] dark:text-[#78909a]">
                      Generado: {formatDateTime(report.created_at)}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-1.5">
                    {(['json', 'md', 'csv'] as const).map((fmt) => {
                      const busy = exportingKey === `${report.id}-${fmt}`
                      return (
                        <button
                          key={fmt}
                          type="button"
                          disabled={exportingKey !== null}
                          onClick={() => void handleExportReport(report.id, fmt)}
                          className="inline-flex items-center gap-1 rounded-lg border border-[#dce8eb] bg-[#f7fbfa] px-2.5 py-1.5 text-[11px] font-semibold uppercase text-[#29434e] transition hover:border-[#087f7b]/40 hover:bg-[#eff8f7] disabled:opacity-50 dark:border-[#233a47] dark:bg-[#13222b] dark:text-[#d7e6ea] dark:hover:bg-[#182b36]"
                        >
                          {busy ? (
                            <LoaderCircle className="size-3 animate-spin" />
                          ) : (
                            <Download className="size-3" />
                          )}
                          {fmt}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

function KpiCard({
  label,
  value,
  icon,
  tone = 'default',
}: {
  label: string
  value: string
  icon: React.ReactNode
  tone?: 'default' | 'emerald' | 'sky' | 'rose' | 'teal' | 'amber'
}) {
  const valueColor =
    tone === 'emerald'
      ? 'text-emerald-700 dark:text-emerald-300'
      : tone === 'sky'
        ? 'text-sky-700 dark:text-sky-300'
        : tone === 'rose'
          ? 'text-rose-700 dark:text-rose-300'
          : tone === 'teal'
            ? 'text-[#087f7b] dark:text-[#2dd4bf]'
            : tone === 'amber'
              ? 'text-amber-700 dark:text-amber-300'
              : 'text-[#163542] dark:text-[#e6f0f2]'

  return (
    <div className="rounded-2xl border border-[#e5edf0] bg-white p-4 shadow-[0_8px_24px_rgba(18,49,66,0.04)] dark:border-[#1e3340] dark:bg-[#101e26]">
      <div className="flex items-center justify-between text-[#82969d] dark:text-[#94adb8]">
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em]">{label}</span>
        {icon}
      </div>
      <p className={`mt-2 text-2xl font-bold tracking-tight ${valueColor}`}>{value}</p>
    </div>
  )
}
