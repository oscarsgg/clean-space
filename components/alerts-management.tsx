'use client'

import useSWR from 'swr'
import { AlertTriangle, Bell, Check, LoaderCircle, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { api } from '@/lib/api'

type AlertRecord = {
  id: number
  cleanroom_id: number
  device_id: number | null
  type: string
  severity: string
  message: string
  status: string
  created_at: string
  acknowledged_at: string | null
}

function recordsFrom(value: unknown): AlertRecord[] {
  if (Array.isArray(value)) return value.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object' && 'id' in item && 'message' in item)).map((item) => item as unknown as AlertRecord)
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    for (const key of ['items', 'data', 'results']) if (Array.isArray(record[key])) return recordsFrom(record[key])
  }
  return []
}

function formatDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Fecha no disponible' : date.toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })
}

export function AlertsManagement() {
  const { data, error, isLoading, mutate } = useSWR('operational-alerts', api.notices)
  const [acknowledgingId, setAcknowledgingId] = useState<number | null>(null)
  const [actionError, setActionError] = useState('')
  const [success, setSuccess] = useState('')
  const alerts = recordsFrom(data)
  const activeAlerts = alerts.filter((alert) => alert.status === 'ACTIVE')

  const acknowledge = async (id: number) => {
    setAcknowledgingId(id)
    setActionError('')
    setSuccess('')
    try {
      await api.acknowledgeNotice(id)
      await mutate()
      setSuccess('Aviso atendido y actualizado.')
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'No se pudo atender el aviso.')
    } finally {
      setAcknowledgingId(null)
    }
  }

  return <div className="flex flex-col gap-6">
    <header><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#087f7b]">Supervisión · monitoreo</p><h1 className="mt-1 text-3xl font-semibold tracking-tight text-[#163542]">Avisos</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[#718995]">Revisa alertas ambientales y confirma su atención. Las acciones actualizan el estado en FastAPI.</p></header>
    <div className="grid gap-3 sm:grid-cols-3"><Summary label="Avisos recibidos" value={isLoading ? '—' : String(alerts.length)} /><Summary label="Activos" value={isLoading ? '—' : String(activeAlerts.length)} /><Summary label="Fuente" value="API CleanSpace" /></div>
    {actionError && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{actionError}</div>}
    {success && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{success}</div>}
    <section className="overflow-hidden rounded-2xl border border-[#e5edf0] bg-white shadow-[0_8px_24px_rgba(18,49,66,0.04)]">
      <div className="flex items-center justify-between border-b border-[#edf2f3] px-5 py-4"><div><h2 className="font-semibold text-[#163542]">Historial de avisos</h2><p className="mt-1 text-xs text-[#82969d]">Orden recibido del servidor</p></div><button type="button" aria-label="Actualizar avisos" onClick={() => void mutate()} className="rounded-lg p-2 text-[#58727c] hover:bg-[#f3f8f8]"><RefreshCw className="size-4" /></button></div>
      {isLoading ? <div className="flex items-center justify-center gap-2 p-10 text-sm text-[#82969d]"><LoaderCircle className="size-4 animate-spin" />Consultando avisos…</div> : error ? <div role="alert" className="p-8 text-sm text-red-700">No se pudieron consultar avisos: {error instanceof Error ? error.message : 'Error de API.'}</div> : alerts.length === 0 ? <div className="p-10 text-center"><div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-[#eff8f7] text-[#087f7b]"><Bell className="size-5" /></div><h3 className="mt-3 font-semibold text-[#29434e]">No hay avisos</h3><p className="mt-1 text-sm text-[#82969d]">Cuando la API registre una alerta, aparecerá aquí.</p></div> : <ul className="divide-y divide-[#edf2f3]">{alerts.map((alert) => <li key={alert.id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between"><div className="flex min-w-0 gap-3"><div className={`mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl ${alert.status === 'ACTIVE' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>{alert.status === 'ACTIVE' ? <AlertTriangle className="size-5" /> : <Check className="size-5" />}</div><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-[#29434e]">{alert.message}</h3><span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${alert.severity === 'CRITICAL' || alert.severity === 'HIGH' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>{alert.severity || 'NORMAL'}</span></div><p className="mt-1 text-xs text-[#82969d]">Cuarto #{alert.cleanroom_id}{alert.device_id ? ` · Dispositivo #${alert.device_id}` : ''} · {formatDate(alert.created_at)}</p><p className="mt-1 text-xs text-[#82969d]">Tipo: {alert.type} · Estado: {alert.status}</p>{alert.acknowledged_at && <p className="mt-1 text-xs text-emerald-700">Atendido: {formatDate(alert.acknowledged_at)}</p>}</div></div>{alert.status === 'ACTIVE' && <button type="button" disabled={acknowledgingId !== null} onClick={() => void acknowledge(alert.id)} className="inline-flex w-fit shrink-0 items-center gap-2 rounded-xl bg-[#087f7b] px-3.5 py-2.5 text-xs font-semibold text-white transition hover:bg-[#066c69] disabled:opacity-60">{acknowledgingId === alert.id ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />}Atender aviso</button>}</li>)}</ul>}
    </section>
  </div>
}

function Summary({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-[#e5edf0] bg-white p-4"><p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#82969d]">{label}</p><p className="mt-2 text-xl font-semibold text-[#163542]">{value}</p></div>
}
