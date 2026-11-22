'use client'

import { useMemo, useState } from 'react'
import useSWR from 'swr'
import { Activity, AlertTriangle, Building2, Radio, Users } from 'lucide-react'
import { api } from '@/lib/api'

function periodQuery(days: number, room: string) {
  const end = new Date()
  const start = new Date(end.getTime() - days * 86400000)
  const query = new URLSearchParams({ start_at: start.toISOString(), end_at: end.toISOString() })
  if (room) query.set('cleanroom_id', room)
  return `?${query.toString()}`
}

export function AdminDashboard() {
  const [days, setDays] = useState(7)
  const [room, setRoom] = useState('')
  const query = useMemo(() => periodQuery(days, room), [days, room])
  const { data, error, isLoading } = useSWR(['admin-summary', query], ([, q]) => api.adminSummary(q))
  const max = Math.max(1, ...(data?.access_series ?? []).map((x) => x.allowed + x.denied))
  return <main className="space-y-6">
    <header className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-widest text-teal-700">Administración · panorama global</p><h1 className="mt-1 text-3xl font-semibold">Resumen operativo</h1><p className="mt-2 text-sm text-slate-500">Indicadores agregados del periodo seleccionado.</p></div>
      <div className="flex gap-2"><select aria-label="Periodo" value={days} onChange={e => setDays(Number(e.target.value))} className="rounded-xl border bg-white px-3 py-2 text-sm"><option value={7}>7 días</option><option value={30}>30 días</option><option value={90}>90 días</option></select><select aria-label="Cuarto limpio" value={room} onChange={e => setRoom(e.target.value)} className="rounded-xl border bg-white px-3 py-2 text-sm"><option value="">Todos los cuartos</option>{(data?.rooms ?? []).map(r => <option key={r.id} value={r.id}>{r.code}</option>)}</select></div></header>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">No se pudo cargar el resumen: {error.message}</p>}
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">{[[Building2,'Cuartos',data?.cleanrooms],[Users,'Personas activas',data?.active_people],[Radio,'Dispositivos',data?.devices],[Activity,'Lecturas',data?.readings],[AlertTriangle,'Avisos activos',data?.active_alerts]].map(([Icon,label,value]: any) => <article key={label} className="rounded-2xl border bg-white p-4"><div className="flex justify-between text-xs font-semibold uppercase text-slate-500">{label}<Icon className="size-4"/></div><p className="mt-2 text-2xl font-bold">{isLoading ? '—' : value ?? 0}</p></article>)}</section>
    <section className="grid gap-5 xl:grid-cols-2"><article className="rounded-2xl border bg-white p-5"><h2 className="font-semibold">Accesos por día</h2><p className="text-xs text-slate-500">Permitidos y denegados · periodo filtrado</p>{!isLoading && !data?.access_series?.length ? <p className="py-12 text-center text-sm text-slate-500">Sin eventos en el periodo.</p> : <div className="mt-5 flex h-48 items-end gap-2 overflow-x-auto">{(data?.access_series ?? []).map(d => <div key={d.date} className="flex h-full min-w-7 flex-1 flex-col justify-end gap-1 text-center"><div title={`Permitidos: ${d.allowed}`} className="mx-auto w-3/4 rounded-t bg-teal-600" style={{height:`${Math.max(3,d.allowed/max*80)}%`}}/><div title={`Denegados: ${d.denied}`} className="mx-auto w-3/4 bg-rose-400" style={{height:`${Math.max(d.denied?3:0,d.denied/max*80)}%`}}/><span className="text-[9px] text-slate-500">{d.date.slice(5)}</span></div>)}</div>}<div className="mt-3 flex gap-4 text-xs"><span className="text-teal-700">■ Permitidos</span><span className="text-rose-500">■ Denegados</span></div></article>
      <article className="rounded-2xl border bg-white p-5"><h2 className="font-semibold">Estado de dispositivos</h2><p className="text-xs text-slate-500">Conteo actual por estado reportado</p>{(data?.device_status ?? []).length ? <div className="mt-5 space-y-4">{data!.device_status.map(s => <div key={s.status}><div className="mb-1 flex justify-between text-sm"><span>{s.status}</span><b>{s.count}</b></div><div className="h-2 rounded-full bg-slate-100"><div className="h-full rounded-full bg-sky-600" style={{width:`${Math.min(100,s.count/Math.max(1,data!.devices)*100)}%`}}/></div></div>)}</div> : <p className="py-12 text-center text-sm text-slate-500">Sin dispositivos para mostrar.</p>}</article></section>
    <section className="rounded-2xl border bg-white p-5"><h2 className="font-semibold">Comparativo por cuarto</h2><div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{(data?.rooms ?? []).map(r => <div key={r.id} className="rounded-xl bg-slate-50 p-4"><div className="flex justify-between"><b>{r.code}</b><span className="text-xs text-slate-500">{r.iso_class}</span></div><div className="mt-3 text-sm">Ocupación <b>{r.current_occupancy}/{r.capacity}</b></div><div className="mt-2 h-2 rounded-full bg-slate-200"><div className="h-full rounded-full bg-teal-600" style={{width:`${Math.min(100,r.capacity?100*r.current_occupancy/r.capacity:0)}%`}}/></div><p className="mt-2 text-xs text-slate-500">Dispositivo: {r.device_status ?? 'sin reporte'}</p></div>)}</div>{!isLoading && !data?.rooms?.length && <p className="py-8 text-center text-sm text-slate-500">Sin cuartos para mostrar.</p>}</section>
  </main>
}
