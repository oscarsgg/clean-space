'use client'

import Link from 'next/link'
import { useParams, usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import useSWR from 'swr'
import { Activity, ArrowLeft, Building2, Check, ChevronRight, CircleAlert, LoaderCircle, MapPin, Plus, RefreshCw, Save, Search, SlidersHorizontal, Trash2 } from 'lucide-react'
import { api, type ApiRoom, type ApiRoomParameter } from '@/lib/api'

type RoomForm = Pick<ApiRoom, 'code' | 'name' | 'location' | 'description' | 'access_level' | 'status'>
type ParameterForm = ApiRoomParameter

const inputClass = 'w-full rounded-xl border border-[#dce8eb] bg-white px-3.5 py-3 text-sm text-[#163542] outline-none transition focus:border-[#087f7b] focus:ring-4 focus:ring-[#087f7b]/10'
const labelClass = 'flex flex-col gap-2 text-sm font-medium text-[#29434e]'
const emptyRoom: RoomForm = { code: '', name: '', location: '', description: '', access_level: 'STANDARD', status: 'ACTIVE' }
const unwrap = <T,>(value: T | { data?: T; items?: T }): T => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const record = value as { data?: T; items?: T }
    return (record.data ?? record.items ?? value) as T
  }
  return value as T
}
const message = (error: unknown) => error instanceof Error ? error.message : 'Ocurrió un error al guardar los cambios.'
const statusLabel = (status: string) => status === 'ACTIVE' ? 'Activo' : 'Inactivo'

function PageHeading({ eyebrow, title, description, backHref }: { eyebrow: string; title: string; description: string; backHref?: string }) {
  return <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
    {backHref && <Link href={backHref} aria-label="Volver a cuartos limpios" className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-[#dce8eb] bg-white text-[#58727c] transition hover:bg-[#f4f9f8]"><ArrowLeft className="size-4" /></Link>}
    <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#087f7b]">{eyebrow}</p><h1 className="mt-1 text-3xl font-semibold tracking-tight text-[#163542]">{title}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[#718995]">{description}</p></div>
  </div>
}

function ErrorNotice({ children }: { children: string }) {
  return <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"><CircleAlert className="mt-0.5 size-4 shrink-0" />{children}</div>
}

export function RoomManagement() {
  const pathname = usePathname()
  const params = useParams<{ id?: string }>()
  const router = useRouter()
  if (pathname.endsWith('/nuevo')) return <RoomCreate />
  if (params.id && params.id !== 'nuevo') return <RoomDetail roomId={Number(params.id)} />
  return <RoomList onCreate={() => router.push('/admin/cuartos/nuevo')} />
}

function RoomList({ onCreate }: { onCreate: () => void }) {
  const { data, error, isLoading, mutate } = useSWR<ApiRoom[]>('rooms', api.rooms)
  const [query, setQuery] = useState('')
  const rooms = Array.isArray(data) ? data : []
  const filtered = rooms.filter((room) => `${room.name} ${room.code} ${room.location}`.toLowerCase().includes(query.toLowerCase()))
  const activeCount = rooms.filter((room) => room.status === 'ACTIVE').length

  return <div className="flex flex-col gap-6">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><PageHeading eyebrow="Administración · espacios" title="Cuartos limpios" description="Administra los espacios, consulta su configuración ambiental y mantén los datos sincronizados con la API." /><button onClick={onCreate} className="flex w-fit shrink-0 items-center gap-2 rounded-xl bg-[#087f7b] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#066c69]"><Plus className="size-4" />Nuevo cuarto</button></div>
    <div className="grid gap-3 sm:grid-cols-3"><Summary label="Cuartos registrados" value={isLoading ? '—' : String(rooms.length)} icon={<Building2 className="size-4" />} /><Summary label="Activos" value={isLoading ? '—' : String(activeCount)} icon={<Activity className="size-4" />} /><Summary label="Fuente de datos" value="API CleanSpace" icon={<RefreshCw className="size-4" />} /></div>
    <section className="overflow-hidden rounded-2xl border border-[#e5edf0] bg-white shadow-[0_8px_24px_rgba(18,49,66,0.04)]">
      <div className="flex flex-col gap-3 border-b border-[#edf2f3] p-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-semibold text-[#163542]">Espacios registrados</h2><p className="mt-1 text-xs text-[#82969d]">Abre un cuarto para ver su ficha y parámetros.</p></div><div className="flex gap-2"><label className="relative flex min-w-0 flex-1 items-center sm:w-64"><Search aria-hidden="true" className="absolute left-3 size-4 text-[#82969d]" /><input aria-label="Buscar cuartos" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nombre, código…" className={`${inputClass} pl-9`} /></label><button onClick={() => void mutate()} aria-label="Actualizar lista" className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-[#dce8eb] text-[#58727c] hover:bg-[#f4f9f8]"><RefreshCw className="size-4" /></button></div></div>
      {error ? <div className="p-5"><ErrorNotice>{message(error)}</ErrorNotice></div> : isLoading ? <Loading /> : filtered.length === 0 ? <div className="p-10 text-center"><div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-[#eff8f7] text-[#087f7b]"><Building2 className="size-5" /></div><h3 className="mt-3 font-semibold text-[#29434e]">{query ? 'Sin resultados' : 'Aún no hay cuartos'}</h3><p className="mt-1 text-sm text-[#82969d]">{query ? 'Prueba con otro nombre, código o ubicación.' : 'Registra el primer cuarto limpio para comenzar.'}</p>{!query && <button onClick={onCreate} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#087f7b] px-4 py-2.5 text-sm font-semibold text-white"><Plus className="size-4" />Crear cuarto</button>}</div> : <ul className="divide-y divide-[#edf2f3]">{filtered.map((room) => <li key={room.id}><Link href={`/admin/cuartos/${room.id}`} className="flex items-center gap-4 px-5 py-4 transition hover:bg-[#f7fbfa] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#087f7b]"><div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#e9f4f3] text-[#087f7b]"><Building2 className="size-5" /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-[#29434e]">{room.name}</p><span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${room.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{statusLabel(room.status)}</span></div><p className="mt-1 text-xs text-[#82969d]">{room.code} <span aria-hidden="true">·</span> {room.location || 'Sin ubicación'}</p></div><span className="hidden rounded-lg bg-[#f5f9f9] px-3 py-2 text-xs font-medium text-[#58727c] sm:block">{room.access_level || 'STANDARD'}</span><ChevronRight aria-hidden="true" className="size-4 shrink-0 text-[#a6b7bc]" /></Link></li>)}</ul>}
    </section>
  </div>
}

function Summary({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return <div className="flex items-center gap-3 rounded-2xl border border-[#e5edf0] bg-white p-4"><div className="flex size-9 items-center justify-center rounded-xl bg-[#eff8f7] text-[#087f7b]">{icon}</div><div><p className="text-xs text-[#82969d]">{label}</p><p className="mt-1 text-sm font-semibold text-[#29434e]">{value}</p></div></div>
}

function RoomCreate() {
  const router = useRouter()
  const [form, setForm] = useState<RoomForm>(emptyRoom)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const set = (key: keyof RoomForm, value: string) => setForm((current) => ({ ...current, [key]: value }))
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setSaving(true); setError('')
    try {
      const room = await api.createRoom(form)
      router.push(`/admin/cuartos/${room.id}`)
    } catch (cause) { setError(message(cause)) } finally { setSaving(false) }
  }
  return <div className="flex flex-col gap-6"><PageHeading eyebrow="Administración · espacios" title="Registrar cuarto" description="Completa la información base del espacio. Puedes configurar sus rangos ambientales después de crearlo." backHref="/admin/cuartos" /><form onSubmit={submit} className="max-w-3xl rounded-2xl border border-[#e5edf0] bg-white p-5 shadow-[0_8px_24px_rgba(18,49,66,0.04)] sm:p-7"><div className="grid gap-5 sm:grid-cols-2"><label className={labelClass}>Código del cuarto<input className={inputClass} required minLength={1} maxLength={50} value={form.code} onChange={(event) => set('code', event.target.value)} placeholder="Ej. CL-01" autoComplete="off" /></label><label className={labelClass}>Nombre<input className={inputClass} required minLength={1} maxLength={120} value={form.name} onChange={(event) => set('name', event.target.value)} placeholder="Ej. Producción estéril" /></label><label className={labelClass}>Ubicación<input className={inputClass} maxLength={150} value={form.location} onChange={(event) => set('location', event.target.value)} placeholder="Edificio, piso o zona" /></label><label className={labelClass}>Nivel de acceso<select className={inputClass} value={form.access_level} onChange={(event) => set('access_level', event.target.value)}><option value="STANDARD">Estándar</option><option value="RESTRICTED">Restringido</option><option value="HIGH_SECURITY">Alta seguridad</option></select></label><label className={`${labelClass} sm:col-span-2`}>Descripción<textarea className={`${inputClass} min-h-28 resize-y`} maxLength={1000} value={form.description} onChange={(event) => set('description', event.target.value)} placeholder="Uso, condiciones o notas del cuarto" /></label><label className={labelClass}>Estado<select className={inputClass} value={form.status} onChange={(event) => set('status', event.target.value)}><option value="ACTIVE">Activo</option><option value="INACTIVE">Inactivo</option></select></label></div>{error && <div className="mt-5"><ErrorNotice>{error}</ErrorNotice></div>}<div className="mt-7 flex flex-col-reverse gap-3 border-t border-[#edf2f3] pt-5 sm:flex-row sm:justify-end"><Link href="/admin/cuartos" className="rounded-xl border border-[#dce8eb] px-4 py-3 text-center text-sm font-semibold text-[#58727c] hover:bg-[#f7fbfa]">Cancelar</Link><button disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#087f7b] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60">{saving ? <LoaderCircle className="size-4 animate-spin" /> : <Plus className="size-4" />}{saving ? 'Creando…' : 'Crear cuarto'}</button></div></form></div>
}

function RoomDetail({ roomId }: { roomId: number }) {
  const router = useRouter()
  const { data: room, error, isLoading, mutate } = useSWR<ApiRoom>(Number.isInteger(roomId) ? ['room', roomId] : null, () => api.room(roomId))
  const { data: params, error: paramsError, isLoading: paramsLoading, mutate: mutateParams } = useSWR<ApiRoomParameter[]>(Number.isInteger(roomId) ? ['room-parameters', roomId] : null, () => api.roomParameters(roomId))
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<RoomForm | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [savingParams, setSavingParams] = useState(false)
  const [parameterDrafts, setParameterDrafts] = useState<ParameterForm[]>([])
  const [paramsInitialized, setParamsInitialized] = useState(false)

  if (isLoading) return <Loading />
  if (error || !room) return <div className="flex flex-col gap-5"><PageHeading eyebrow="Cuartos limpios" title="No se pudo abrir el cuarto" description="Comprueba que el cuarto exista y que tu usuario tenga acceso." backHref="/admin/cuartos" /><ErrorNotice>{message(error)}</ErrorNotice><button onClick={() => void mutate()} className="w-fit rounded-xl border border-[#dce8eb] px-4 py-2.5 text-sm font-semibold text-[#58727c]">Reintentar</button></div>

  const beginEdit = () => { setForm({ code: room.code, name: room.name, location: room.location ?? '', description: room.description ?? '', access_level: room.access_level ?? 'STANDARD', status: room.status ?? 'ACTIVE' }); setEditing(true); setErrorMessage('') }
  const saveRoom = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!form) return; setSaving(true); setErrorMessage('')
    try { await api.updateRoom(roomId, form); await mutate(); setEditing(false) } catch (cause) { setErrorMessage(message(cause)) } finally { setSaving(false) }
  }
  const deactivate = async () => {
    if (!window.confirm(`¿Desactivar el cuarto “${room.name}”? No se eliminará el historial.`)) return
    setSaving(true); setErrorMessage('')
    try { await api.deleteRoom(roomId); await mutate(); router.push('/admin/cuartos') } catch (cause) { setErrorMessage(message(cause)) } finally { setSaving(false) }
  }
  const drafts = paramsInitialized ? parameterDrafts : (Array.isArray(params) ? params : [])
  const initializeDrafts = () => { setParameterDrafts(Array.isArray(params) ? params.map((item) => ({ ...item })) : []); setParamsInitialized(true) }
  const saveParameters = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const normalized = drafts.map(({ metric, min_value, max_value, unit, enabled }) => ({ metric: metric.trim(), min_value: Number(min_value), max_value: Number(max_value), unit: unit.trim(), enabled }))
    const metrics = normalized.map((item) => item.metric.toLowerCase())
    if (normalized.some((item) => !item.metric || !item.unit || !Number.isFinite(item.min_value) || !Number.isFinite(item.max_value) || item.min_value >= item.max_value) || new Set(metrics).size !== metrics.length) {
      setErrorMessage('Revisa los parámetros: cada variable debe ser única, tener unidad y un mínimo menor que el máximo.')
      return
    }
    setSavingParams(true); setErrorMessage('')
    try { await api.saveRoomParameters(roomId, normalized); await mutateParams(); setParamsInitialized(false) } catch (cause) { setErrorMessage(message(cause)) } finally { setSavingParams(false) }
  }
  const updateDraft = (index: number, key: keyof ParameterForm, value: string | boolean) => setParameterDrafts((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item))

  return <div className="flex flex-col gap-6">
    <PageHeading eyebrow="Administración · ficha de espacio" title={room.name} description="Consulta y actualiza los datos del cuarto y sus rangos de monitoreo." backHref="/admin/cuartos" />
    {errorMessage && <ErrorNotice>{errorMessage}</ErrorNotice>}
    <section className="rounded-2xl border border-[#e5edf0] bg-white p-5 shadow-[0_8px_24px_rgba(18,49,66,0.04)] sm:p-6"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div><div className="flex flex-wrap items-center gap-2"><span className="rounded-lg bg-[#eff8f7] px-2.5 py-1.5 font-mono text-xs font-semibold text-[#087f7b]">{room.code}</span><span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${room.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{statusLabel(room.status)}</span></div><p className="mt-3 flex items-center gap-2 text-sm text-[#718995]"><MapPin className="size-4" />{room.location || 'Ubicación no especificada'}</p><p className="mt-1 text-sm text-[#718995]">Nivel de acceso: <span className="font-medium text-[#29434e]">{room.access_level || 'STANDARD'}</span></p>{room.description && <p className="mt-4 max-w-2xl text-sm leading-6 text-[#58727c]">{room.description}</p>}</div><div className="flex flex-wrap gap-2">{!editing && <><button onClick={beginEdit} className="inline-flex items-center gap-2 rounded-xl border border-[#dce8eb] px-4 py-2.5 text-sm font-semibold text-[#29434e] hover:bg-[#f7fbfa]"><Save className="size-4" />Editar</button>{room.status === 'ACTIVE' && <button disabled={saving} onClick={() => void deactivate()} className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"><Trash2 className="size-4" />Desactivar</button>}</>}</div></div>
      {editing && form && <form onSubmit={saveRoom} className="mt-6 border-t border-[#edf2f3] pt-6"><div className="grid gap-4 sm:grid-cols-2"><label className={labelClass}>Código<input className={`${inputClass} bg-slate-50`} value={form.code} readOnly aria-describedby="code-immutable" /><span id="code-immutable" className="text-xs font-normal text-[#82969d]">El código no se puede cambiar.</span></label><label className={labelClass}>Nombre<input className={inputClass} required maxLength={120} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label className={labelClass}>Ubicación<input className={inputClass} maxLength={150} value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} /></label><label className={labelClass}>Nivel de acceso<select className={inputClass} value={form.access_level} onChange={(event) => setForm({ ...form, access_level: event.target.value })}><option value="STANDARD">Estándar</option><option value="RESTRICTED">Restringido</option><option value="HIGH_SECURITY">Alta seguridad</option></select></label><label className={`${labelClass} sm:col-span-2`}>Descripción<textarea className={`${inputClass} min-h-24 resize-y`} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label><label className={labelClass}>Estado<select className={inputClass} value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option value="ACTIVE">Activo</option><option value="INACTIVE">Inactivo</option></select></label></div><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setEditing(false)} className="rounded-xl border border-[#dce8eb] px-4 py-2.5 text-sm font-semibold text-[#58727c]">Cancelar</button><button disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-[#087f7b] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{saving ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />}{saving ? 'Guardando…' : 'Guardar cambios'}</button></div></form>}
    </section>
    <section className="rounded-2xl border border-[#e5edf0] bg-white shadow-[0_8px_24px_rgba(18,49,66,0.04)]"><div className="flex flex-col justify-between gap-3 border-b border-[#edf2f3] p-5 sm:flex-row sm:items-center"><div className="flex items-center gap-3"><div className="flex size-10 items-center justify-center rounded-xl bg-[#eff8f7] text-[#087f7b]"><SlidersHorizontal className="size-5" /></div><div><h2 className="font-semibold text-[#163542]">Parámetros ambientales</h2><p className="mt-1 text-xs text-[#82969d]">Límites que utiliza el sistema para detectar desviaciones.</p></div></div>{!paramsInitialized && <button onClick={initializeDrafts} className="inline-flex w-fit items-center gap-2 rounded-xl border border-[#dce8eb] px-3 py-2 text-sm font-semibold text-[#58727c] hover:bg-[#f7fbfa]"><Save className="size-4" />Editar parámetros</button>}</div>
      {paramsError ? <div className="p-5"><ErrorNotice>{message(paramsError)}</ErrorNotice></div> : paramsLoading ? <Loading /> : <form onSubmit={saveParameters} className="p-5"><div className="flex flex-col gap-3">{drafts.map((parameter, index) => <div key={`${parameter.metric}-${index}`} className="grid gap-3 rounded-xl bg-[#f7fbfa] p-4 sm:grid-cols-[minmax(0,1.5fr)_1fr_1fr_1fr_auto] sm:items-end"><label className={labelClass}>Variable<input className={inputClass} required value={parameter.metric} disabled={!paramsInitialized} onChange={(event) => updateDraft(index, 'metric', event.target.value)} /></label><label className={labelClass}>Mínimo<input className={inputClass} required type="number" step="any" value={parameter.min_value} disabled={!paramsInitialized} onChange={(event) => updateDraft(index, 'min_value', event.target.value)} /></label><label className={labelClass}>Máximo<input className={inputClass} required type="number" step="any" value={parameter.max_value} disabled={!paramsInitialized} onChange={(event) => updateDraft(index, 'max_value', event.target.value)} /></label><label className={labelClass}>Unidad<input className={inputClass} required value={parameter.unit} disabled={!paramsInitialized} onChange={(event) => updateDraft(index, 'unit', event.target.value)} /></label><label className="flex items-center gap-2 pb-3 text-sm text-[#58727c]"><input type="checkbox" checked={parameter.enabled} disabled={!paramsInitialized} onChange={(event) => updateDraft(index, 'enabled', event.target.checked)} />Activa</label></div>)}{paramsInitialized && drafts.length === 0 && <p className="rounded-xl bg-[#f7fbfa] p-4 text-sm text-[#718995]">Aún no hay parámetros. Agrega una variable para configurar sus límites.</p>}</div>
        {paramsInitialized && <><div className="mt-4 flex flex-col-reverse justify-between gap-3 sm:flex-row"><button type="button" onClick={() => setParameterDrafts((current) => [...current, { metric: '', min_value: 0, max_value: 0, unit: '', enabled: true }])} className="inline-flex w-fit items-center gap-2 rounded-xl border border-[#dce8eb] px-3 py-2 text-sm font-semibold text-[#58727c]"><Plus className="size-4" />Agregar variable</button><div className="flex gap-2"><button type="button" onClick={() => setParamsInitialized(false)} className="rounded-xl border border-[#dce8eb] px-4 py-2.5 text-sm font-semibold text-[#58727c]">Cancelar</button><button disabled={savingParams || drafts.some((item) => !item.metric.trim() || !item.unit.trim() || item.min_value > item.max_value)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#087f7b] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{savingParams ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />}{savingParams ? 'Guardando…' : 'Guardar parámetros'}</button></div></div><p className="mt-3 text-xs text-[#82969d]">La API permite crear y actualizar parámetros; no tiene un endpoint para eliminar variables existentes.</p></>}
      </form>}
    </section>
  </div>
}

function Loading() {
  return <div className="flex min-h-40 items-center justify-center gap-3 rounded-2xl border border-[#e5edf0] bg-white text-sm text-[#718995]"><LoaderCircle className="size-4 animate-spin" />Cargando información del cuarto…</div>
}
