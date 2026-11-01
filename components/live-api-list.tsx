'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, LoaderCircle, RefreshCw } from 'lucide-react'
import { api } from '@/lib/api'

type Loader = () => Promise<unknown>

type Props = {
  title: string
  eyebrow: string
  description: string
  loader: Loader
  actionHref?: string
  actionLabel?: string
}

function rowsFrom(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    for (const key of ['items', 'data', 'results', 'records']) if (Array.isArray(record[key])) return rowsFrom(record[key])
    return [record]
  }
  return []
}

function labelFor(row: Record<string, unknown>, index: number) { return String(row.name ?? row.full_name ?? row.code ?? row.metric ?? row.command ?? row.id ?? `Registro ${index + 1}`) }

export function LiveApiList({ title, eyebrow, description, loader, actionHref, actionLabel }: Props) {
  const [data, setData] = useState<unknown>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const rows = useMemo(() => rowsFrom(data), [data])
  const load = async () => { setLoading(true); setError(''); try { setData(await loader()) } catch (cause) { setError(cause instanceof Error ? cause.message : 'No fue posible consultar la API.') } finally { setLoading(false) } }
  useEffect(() => { void load() }, [])
  return <div className="flex flex-col gap-6"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-sm font-medium text-[#0d9691]">{eyebrow}</p><h1 className="mt-1 text-3xl font-semibold tracking-tight text-[#102d3b]">{title}</h1><p className="mt-1 text-sm text-[#718995]">{description}</p></div>{actionHref && <a href={actionHref} className="w-fit rounded-xl bg-[#087f7b] px-4 py-2.5 text-sm font-semibold text-white">{actionLabel ?? 'Crear'}</a>}</div><section className="overflow-hidden rounded-2xl border border-[#e5edf0] bg-white shadow-[0_8px_24px_rgba(18,49,66,0.04)]"><div className="flex items-center justify-between border-b border-[#edf2f3] px-5 py-4"><h2 className="font-semibold text-[#163542]">Datos de FastAPI</h2><button onClick={() => void load()} aria-label="Actualizar datos" className="rounded-lg p-2 text-[#58727c] hover:bg-[#f3f8f8]"><RefreshCw className="size-4" /></button></div>{loading ? <div className="flex items-center justify-center gap-2 p-12 text-sm text-[#718995]"><LoaderCircle className="size-4 animate-spin" />Consultando API...</div> : error ? <div className="flex items-start gap-3 p-8 text-sm text-red-700"><AlertCircle className="size-5 shrink-0" /><div><p className="font-semibold">No se pudo cargar este recurso</p><p className="mt-1">{error}</p><p className="mt-2 text-xs">Confirma que FastAPI esté disponible en http://127.0.0.1:8000.</p></div></div> : rows.length === 0 ? <p className="p-10 text-sm text-[#718995]">La API no devolvió registros.</p> : <div className="divide-y divide-[#edf2f3]">{rows.map((row, index) => <div key={`${labelFor(row, index)}-${index}`} className="flex items-center gap-4 px-5 py-4"><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-[#29434e]">{labelFor(row, index)}</p><p className="mt-1 text-xs text-[#93a4aa]">{String(row.status ?? row.type ?? row.email ?? row.location ?? 'Sin detalle')}</p></div><span className="rounded-full bg-[#e9f4f3] px-2.5 py-1 text-[11px] font-semibold text-[#087f7b]">{String(row.status ?? 'Disponible')}</span></div>)}</div>}</section></div>
}

export function PendingIntegration({ title, description }: { title: string; description: string }) { return <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6"><p className="text-sm font-semibold text-amber-900">{title}</p><p className="mt-2 text-sm leading-relaxed text-amber-800">{description}</p></div> }

export const liveLoaders = { rooms: api.rooms, devices: api.devices, accesses: api.accesses, monitoring: api.monitoringHistory, notices: api.notices, anomalies: api.analytics.anomalies, indicators: api.analytics.indicators, patterns: api.analytics.accessPatterns, adminSummary: api.adminSummary }
