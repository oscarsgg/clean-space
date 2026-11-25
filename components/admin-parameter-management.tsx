'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { Activity, Check, Droplets, Gauge, Plus, RotateCcw, Save, SlidersHorizontal, Thermometer, Trash2, Wind } from 'lucide-react'
import { AdminButton, AdminEmpty, AdminError, AdminField, AdminLoading, AdminPageHeader, AdminPanel, adminInputClass } from '@/components/admin-ui'
import { api, type ApiRoom, type ApiRoomParameter } from '@/lib/api'
import { userFacingClientError } from '@/lib/user-facing-errors.mjs'

function parameterIcon(metric: string) {
  const name = metric.toLowerCase()
  if (/temp|temperature/.test(name)) return Thermometer
  if (/humidity|humedad|moist/.test(name)) return Droplets
  if (/press|presión|pressure/.test(name)) return Gauge
  if (/particle|partícula|dust/.test(name)) return Wind
  return Activity
}

export function AdminParameterManagement() {
  const { data, error, isLoading } = useSWR<ApiRoom[]>('admin-parameter-rooms', api.rooms)
  const rooms = Array.isArray(data) ? data : []
  const [roomId, setRoomId] = useState('')
  const selected = rooms.find((room) => String(room.id) === roomId)
  return <main className="min-w-0 space-y-6">
    <AdminPageHeader eyebrow="Administración · monitoreo ambiental" title="Parámetros por cuarto" description="Define los rangos de referencia que se usan para interpretar las lecturas ambientales de cada espacio." />
    {error && <AdminError error={error} fallback="No se pudieron cargar los cuartos." />}
    {isLoading ? <AdminLoading label="Cargando cuartos…" /> : rooms.length ? <>
      <section className="rounded-2xl border border-border bg-card p-4 shadow-[var(--admin-panel-shadow)] sm:p-5">
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(16rem,0.8fr)] md:items-center">
          <div><p className="text-xs font-bold uppercase tracking-[0.13em] text-primary">Configuración del espacio</p><h2 className="mt-1 text-base font-semibold text-card-foreground">Elige un cuarto para administrar sus rangos</h2><p className="mt-1 text-sm leading-5 text-muted-foreground">Cada cuarto conserva su propia lista de variables y límites.</p></div>
          <AdminField label="Cuarto limpio"><select className={adminInputClass} value={roomId} onChange={(event) => setRoomId(event.target.value)}><option value="">Seleccionar cuarto</option>{rooms.map((room) => <option key={room.id} value={room.id}>{room.code} · {room.name}</option>)}</select></AdminField>
        </div>
      </section>
      {selected ? <ParameterEditor key={selected.id} room={selected} /> : <div className="flex min-h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/60 px-6 py-10 text-center"><span className="grid size-11 place-items-center rounded-xl bg-accent text-accent-foreground"><SlidersHorizontal className="size-5" /></span><p className="mt-4 text-sm font-semibold text-card-foreground">Selecciona un cuarto para empezar</p><p className="mt-1 max-w-md text-sm leading-6 text-muted-foreground">Aquí podrás revisar, habilitar y ajustar los límites de cada variable ambiental.</p></div>}
    </> : <AdminEmpty title="No hay cuartos disponibles" description="Registra un cuarto antes de definir sus parámetros ambientales." />}
  </main>
}

function ParameterEditor({ room }: { room: ApiRoom }) {
  const { data, error, isLoading, mutate } = useSWR<ApiRoomParameter[]>(['admin-room-parameters', room.id], () => api.roomParameters(room.id))
  const [drafts, setDrafts] = useState<ApiRoomParameter[] | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const parameters = drafts ?? (Array.isArray(data) ? data : [])
  const update = (index: number, key: keyof ApiRoomParameter, value: string | boolean) => {
    setMessage(null)
    setDrafts((current) => (current ?? data ?? []).map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item))
  }
  const cancelEditing = () => { setDrafts(null); setMessage(null) }

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setMessage(null)
    const normalized = parameters.map((item) => ({ ...item, metric: item.metric.trim(), unit: item.unit.trim(), min_value: Number(item.min_value), max_value: Number(item.max_value), cleanroom_id: room.id }))
    const names = normalized.map((item) => item.metric.toLocaleLowerCase())
    if (normalized.some((item) => !item.metric || !item.unit || !Number.isFinite(item.min_value) || !Number.isFinite(item.max_value) || item.min_value >= item.max_value) || new Set(names).size !== names.length) {
      setMessage({ type: 'error', text: 'Revisa los rangos: el mínimo debe ser menor que el máximo, la unidad es obligatoria y las variables no deben repetirse.' })
      return
    }
    setSaving(true)
    try {
      await api.saveRoomParameters(room.id, normalized)
      await mutate()
      setDrafts(null)
      setMessage({ type: 'success', text: 'Los parámetros del cuarto se guardaron correctamente.' })
    } catch (cause) {
      setMessage({ type: 'error', text: userFacingClientError(cause) })
    } finally {
      setSaving(false)
    }
  }

  const add = () => {
    setMessage(null)
    setDrafts([...(drafts ?? data ?? []).map((item) => ({ ...item })), { metric: '', min_value: 0, max_value: 1, unit: '', enabled: true, cleanroom_id: room.id }])
  }
  const remove = (index: number) => {
    setMessage(null)
    setDrafts(parameters.filter((_, itemIndex) => itemIndex !== index))
  }

  return <AdminPanel title={`${room.code} · ${room.name}`} description="Los rangos se aplican a las lecturas de este cuarto. Guarda los cambios para que surtan efecto." className="overflow-hidden">
    {error && <div className="p-5"><AdminError error={error} fallback="No se pudieron consultar los parámetros de este cuarto." /></div>}
    {isLoading ? <div className="p-5"><AdminLoading label="Cargando parámetros…" /></div> : <form onSubmit={submit} className="min-w-0">
      {parameters.length > 0 ? <>
        <div className="hidden grid-cols-[minmax(10rem,1.3fr)_minmax(7rem,0.8fr)_minmax(7rem,0.8fr)_minmax(6rem,0.6fr)_minmax(8rem,auto)_2.5rem] items-center gap-3 bg-muted/40 px-5 py-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground lg:grid lg:px-6"><span>Variable ambiental</span><span>Límite mínimo</span><span>Límite máximo</span><span>Unidad</span><span>Monitoreo</span><span /></div>
        <div className="divide-y divide-border">
          {parameters.map((item, index) => {
            const Icon = parameterIcon(item.metric)
            return <div key={`${item.id ?? item.metric}-${index}`} className={`grid min-w-0 gap-3 px-4 py-4 transition-colors sm:px-5 lg:grid-cols-[minmax(10rem,1.3fr)_minmax(7rem,0.8fr)_minmax(7rem,0.8fr)_minmax(6rem,0.6fr)_minmax(8rem,auto)_2.5rem] lg:items-center lg:px-6 ${item.enabled ? 'bg-card' : 'bg-muted/25'}`}>
              <div className="flex min-w-0 items-center gap-3 sm:col-span-2 lg:col-span-1"><span className={`grid size-10 shrink-0 place-items-center rounded-xl ${item.enabled ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground'}`}><Icon aria-hidden="true" className="size-[18px]" /></span><div className="min-w-0 flex-1"><label className="block text-[10px] font-bold uppercase tracking-wide text-muted-foreground lg:sr-only" htmlFor={`parameter-name-${index}`}>Variable ambiental</label><input id={`parameter-name-${index}`} className={`${adminInputClass} font-semibold`} value={item.metric} maxLength={50} aria-label={`Nombre de variable ${index + 1}`} onChange={(event) => update(index, 'metric', event.target.value)} /></div></div>
              <AdminField label="Límite mínimo" className="min-w-0"><input type="number" step="any" className={`${adminInputClass} tabular-nums`} value={item.min_value} aria-label={`Mínimo de ${item.metric || 'la variable'}`} onChange={(event) => update(index, 'min_value', event.target.value)} /></AdminField>
              <AdminField label="Límite máximo" className="min-w-0"><input type="number" step="any" className={`${adminInputClass} tabular-nums`} value={item.max_value} aria-label={`Máximo de ${item.metric || 'la variable'}`} onChange={(event) => update(index, 'max_value', event.target.value)} /></AdminField>
              <AdminField label="Unidad" className="min-w-0"><input className={adminInputClass} value={item.unit} maxLength={20} aria-label={`Unidad de ${item.metric || 'la variable'}`} onChange={(event) => update(index, 'unit', event.target.value)} /></AdminField>
              <div className="flex min-h-11 items-center justify-between gap-3 rounded-xl bg-muted/40 px-3 text-sm font-medium text-foreground sm:col-span-2 lg:col-span-1"><span>{item.enabled ? 'Monitoreo activo' : 'Monitoreo pausado'}</span><button type="button" role="switch" aria-checked={item.enabled} aria-label={`${item.enabled ? 'Pausar' : 'Activar'} monitoreo de ${item.metric || `variable ${index + 1}`}`} onClick={() => update(index, 'enabled', !item.enabled)} className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full p-1 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${item.enabled ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-600'}`}><span aria-hidden="true" className={`size-5 rounded-full bg-white shadow-sm transition-transform ${item.enabled ? 'translate-x-5' : 'translate-x-0'}`} /></button></div>
              <button type="button" aria-label={`Quitar ${item.metric || `variable ${index + 1}`}`} onClick={() => remove(index)} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:col-span-2 lg:col-span-1"><Trash2 aria-hidden="true" className="size-4" /></button>
            </div>
          })}
        </div>
      </> : <div className="px-4 py-2"><AdminEmpty title="Todavía no hay variables configuradas" description="Agrega las variables que quieras monitorear y define sus límites de referencia." /></div>}
      {message && <div role={message.type === 'success' ? 'status' : 'alert'} className={`mx-4 mt-4 rounded-xl border px-4 py-3 text-sm leading-5 sm:mx-6 ${message.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200' : 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200'}`}>{message.text}</div>}
      <div className="sticky bottom-0 z-10 flex flex-col gap-3 border-t border-border bg-card/95 px-4 py-3 backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:px-6"><p className="text-xs leading-5 text-muted-foreground">{drafts ? 'Cambios pendientes de guardar.' : 'Los cambios se aplican al guardar.'}</p><div className="flex flex-col-reverse gap-2 sm:flex-row">{drafts && <AdminButton type="button" variant="secondary" disabled={saving} onClick={cancelEditing}><RotateCcw aria-hidden="true" className="size-4" />Descartar cambios</AdminButton>}<AdminButton type="button" variant="secondary" disabled={saving} onClick={add}><Plus aria-hidden="true" className="size-4" />Agregar variable</AdminButton><AdminButton type="submit" disabled={saving || !drafts}>{saving ? 'Guardando…' : <><Save aria-hidden="true" className="size-4" />Guardar cambios</>}</AdminButton></div></div>
    </form>}
  </AdminPanel>
}
