'use client'

import Link from 'next/link'
import { useParams, usePathname, useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import useSWR from 'swr'
import { Activity, ArrowLeft, Building2, Check, ChevronRight, CircleAlert, LoaderCircle, MapPin, Plus, RefreshCw, Save, Search, SlidersHorizontal, Trash2, DoorOpen, ShieldCheck, Layers3, X, Users, LockKeyhole, ExternalLink, ChevronsLeft, ChevronsRight, Pencil, Thermometer, Droplets, Wind, Gauge, Sparkles, ToggleLeft, ArrowDownRight, ArrowUpRight, Bell, CalendarClock, Radio, ChartNoAxesCombined } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api, type AdminSummary, type ApiAccessEvent, type ApiMonitoringAlert, type ApiRoom, type ApiRoomParameter, type ApiSensorReading } from '@/lib/api'
import { userFacingClientError } from '@/lib/user-facing-errors.mjs'
import { AdminPageHeader, AdminStatusBadge } from '@/components/admin-ui'
import { LiveRoomForm } from '@/components/live-admin-forms'
import { aggregateEnvironment, summarizeAccess } from '@/lib/admin-dashboard-metrics.mjs'

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
const message = (error: unknown) => userFacingClientError(error)

function PageHeading({ eyebrow, title, description, backHref }: { eyebrow: string; title: string; description: string; backHref?: string }) {
  return <AdminPageHeader eyebrow={eyebrow} title={title} description={description} backHref={backHref} />
}

function ErrorNotice({ children }: { children: string }) {
  return <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"><CircleAlert className="mt-0.5 size-4 shrink-0" />{children}</div>
}

export function RoomManagement() {
  const pathname = usePathname()
  const params = useParams<{ id?: string }>()
  const router = useRouter()
  if (pathname.endsWith('/nuevo')) return <LiveRoomForm />
  if (params.id && params.id !== 'nuevo') return <RoomDetail roomId={Number(params.id)} />
  return <RoomList onCreate={() => router.push('/admin/cuartos/nuevo')} />
}

function RoomList({ onCreate }: { onCreate: () => void }) {
  const { data, error, isLoading, mutate } = useSWR<ApiRoom[]>('rooms', api.rooms)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(9)
  const rooms = Array.isArray(data) ? data : []
  const filtered = rooms.filter((room) => `${room.name} ${room.code} ${room.location} ${room.iso_class ?? ''} ${room.access_level}`.toLowerCase().includes(query.toLowerCase()) && (statusFilter === 'ALL' || room.status === statusFilter))
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const visibleRooms = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const firstVisible = filtered.length ? (currentPage - 1) * pageSize + 1 : 0
  const lastVisible = Math.min(currentPage * pageSize, filtered.length)
  const activeCount = rooms.filter((room) => room.status === 'ACTIVE').length
  const inactiveCount = rooms.filter((room) => room.status !== 'ACTIVE').length
  const capacityCount = rooms.filter((room) => typeof room.capacity === 'number' && room.capacity > 0).length

  return <div className="flex flex-col gap-6">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><PageHeading eyebrow="Administración · espacios" title="Cuartos limpios" description="Administra los espacios, consulta su configuración ambiental y mantén los datos sincronizados con la API." /><button onClick={onCreate} className="flex w-fit min-h-11 shrink-0 items-center gap-2 rounded-xl bg-[#087f7b] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[#066c69] active:translate-y-0"><Plus className="size-4" />Nuevo cuarto</button></div>
    <section aria-label="Resumen de cuartos" className="grid overflow-hidden rounded-2xl border border-[#dce7e8] bg-white shadow-[0_12px_34px_rgba(16,44,58,0.045)] sm:grid-cols-2 xl:grid-cols-4">
      <Summary label="Total de cuartos" value={isLoading ? '—' : String(rooms.length)} detail="Espacios registrados" icon={<Building2 className="size-4" />} />
      <Summary label="En operación" value={isLoading ? '—' : String(activeCount)} detail={`${rooms.length ? Math.round(activeCount / rooms.length * 100) : 0}% del inventario`} icon={<Activity className="size-4" />} />
      <Summary label="Fuera de operación" value={isLoading ? '—' : String(inactiveCount)} detail="Requieren revisión de estado" icon={<DoorOpen className="size-4" />} />
      <Summary label="Con capacidad definida" value={isLoading ? '—' : String(capacityCount)} detail="Capacidad mayor a cero" icon={<Layers3 className="size-4" />} />
    </section>
    <section className="overflow-hidden rounded-2xl border border-[#dce7e8] bg-white shadow-[0_12px_34px_rgba(16,44,58,0.045)]">
      <div className="border-b border-[#e9efef] px-5 py-5 sm:px-6"><div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center"><div><div className="flex items-center gap-2"><span className="grid size-9 place-items-center rounded-xl bg-[#e6f4f1] text-[#087f7b]"><Building2 className="size-4" /></span><div><h2 className="text-base font-semibold tracking-tight text-[#163542]">Inventario de cuartos</h2><p className="mt-0.5 text-sm text-[#718995]">Busca por nombre, código, ubicación o clase.</p></div></div></div><div className="flex flex-col gap-2 sm:flex-row"><label className="relative flex min-w-0 items-center sm:w-72"><Search aria-hidden="true" className="absolute left-3 size-4 text-[#82969d]" /><input aria-label="Buscar cuartos" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1) }} placeholder="Buscar cuarto…" className={`${inputClass} min-h-11 pl-9`} />{query && <button aria-label="Limpiar búsqueda" onClick={() => setQuery('')} className="absolute right-2 grid size-8 place-items-center rounded-lg text-[#82969d] hover:bg-[#eef3f3]"><X className="size-4" /></button>}</label><button onClick={() => void mutate()} aria-label="Actualizar lista" className="flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-[#dce8eb] px-3 text-sm font-semibold text-[#58727c] transition hover:bg-[#f4f9f8]"><RefreshCw className="size-4" /><span className="sm:hidden">Actualizar</span></button></div></div>
        <div className="mt-5 flex gap-2 overflow-x-auto pb-0.5" role="group" aria-label="Filtrar cuartos por estado">{[['ALL', `Todos · ${rooms.length}`], ['ACTIVE', `Activos · ${activeCount}`], ['INACTIVE', `Inactivos · ${inactiveCount}`]].map(([value, label]) => <button key={value} onClick={() => { setStatusFilter(value); setPage(1) }} aria-pressed={statusFilter === value} className={`min-h-9 whitespace-nowrap rounded-full border px-3.5 text-xs font-semibold transition ${statusFilter === value ? 'border-[#087f7b] bg-[#087f7b] text-white' : 'border-[#dce7e8] bg-white text-[#58727c] hover:border-[#9cbab8] hover:bg-[#f7fbfa]'}`}>{label}</button>)}</div>
      </div>
      <div className="flex items-center justify-between px-5 py-3 text-xs text-[#718995] sm:px-6"><span>{query || statusFilter !== 'ALL' ? `${filtered.length} de ${rooms.length} cuartos` : `${rooms.length} ${rooms.length === 1 ? 'cuarto' : 'cuartos'}`}</span><span className="hidden sm:inline">Vista de tarjetas <ChevronRight className="ml-1 inline size-3" /></span></div>
      {error ? <div className="p-5"><ErrorNotice>{message(error)}</ErrorNotice></div> : isLoading ? <Loading /> : filtered.length === 0 ? <div className="p-10 text-center"><div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-[#eff8f7] text-[#087f7b]"><Building2 className="size-5" /></div><h3 className="mt-3 font-semibold text-[#29434e]">{query || statusFilter !== 'ALL' ? 'No hay cuartos para mostrar' : 'Aún no hay cuartos'}</h3><p className="mt-1 text-sm text-[#82969d]">{query || statusFilter !== 'ALL' ? 'Ajusta la búsqueda o cambia el filtro de estado.' : 'Registra el primer cuarto limpio para comenzar.'}</p>{!query && statusFilter === 'ALL' && <button onClick={onCreate} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#087f7b] px-4 py-2.5 text-sm font-semibold text-white"><Plus className="size-4" />Crear cuarto</button>}</div> : <ul className="grid list-none gap-4 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-3">{visibleRooms.map((room) => {
        const accessLabel = room.access_level === 'HIGH_SECURITY' ? 'Alta seguridad' : room.access_level === 'RESTRICTED' ? 'Restringido' : 'Estándar'
        const active = room.status === 'ACTIVE'
        return <li key={room.id} className="min-w-0"><article className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-[#dce7e8] bg-white shadow-[0_4px_18px_rgba(16,44,58,0.04)] transition duration-200 hover:-translate-y-0.5 hover:border-[#b6cfcc] hover:shadow-[0_14px_30px_rgba(16,44,58,0.09)]">
          <div className={`absolute inset-x-0 top-0 h-1 ${active ? 'bg-[#0b8b7c]' : 'bg-[#a7b6bb]'}`} />
          <div className="flex items-start justify-between gap-3 p-5 pb-4"><div className="flex min-w-0 items-center gap-3"><span className={`grid size-12 shrink-0 place-items-center rounded-2xl ${active ? 'bg-[#e8f5f1] text-[#087f7b]' : 'bg-[#f0f3f3] text-[#73858b]'}`}><Building2 className="size-5" /></span><div className="min-w-0"><p className="truncate text-[11px] font-bold uppercase tracking-[0.14em] text-[#84979d]">{room.code}</p><h3 className="mt-1 truncate text-lg font-semibold tracking-[-0.025em] text-[#163542]">{room.name}</h3></div></div><AdminStatusBadge value={room.status} /></div>
          <div className="px-5"><p className="flex min-h-5 items-center gap-2 truncate text-sm text-[#607780]"><MapPin className="size-4 shrink-0 text-[#91a5ab]" />{room.location || 'Ubicación sin definir'}</p></div>
          <dl className="mt-5 grid grid-cols-2 gap-px overflow-hidden border-y border-[#edf2f3] bg-[#edf2f3]"><div className="bg-white px-5 py-3.5"><dt className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.11em] text-[#91a2a7]"><LockKeyhole className="size-3" />Acceso</dt><dd className="mt-1.5 truncate text-sm font-semibold text-[#36515b]">{accessLabel}</dd></div><div className="bg-white px-5 py-3.5"><dt className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.11em] text-[#91a2a7]"><Layers3 className="size-3" />Clase ISO</dt><dd className="mt-1.5 truncate text-sm font-semibold text-[#36515b]">{room.iso_class || 'Sin definir'}</dd></div></dl>
          <div className="flex flex-1 items-center justify-between gap-3 px-5 py-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.11em] text-[#91a2a7]">Capacidad</p><p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-[#36515b]">{typeof room.capacity === 'number' && room.capacity > 0 ? <><Users className="size-4 text-[#087f7b]" />{room.capacity} personas</> : <span className="font-medium text-[#91a2a7]">Sin capacidad registrada</span>}</p></div><span className={`inline-flex items-center gap-1.5 text-xs font-medium ${active ? 'text-[#087f7b]' : 'text-[#718995]'}`}><span className={`size-1.5 rounded-full ${active ? 'bg-[#0b9b80]' : 'bg-[#9aabb0]'}`} />{active ? 'En operación' : 'Inactivo'}</span></div>
          <div className="flex gap-2 border-t border-[#edf2f3] bg-[#fbfcfc] p-4"><Link href={`/admin/cuartos/${room.id}`} className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-[#087f7b] px-3 text-sm font-semibold text-white transition hover:bg-[#066c69] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#087f7b]">Abrir ficha<ExternalLink aria-hidden="true" className="size-3.5" /></Link><Link href={`/admin/cuartos/${room.id}#editar`} aria-label={`Editar ${room.name}`} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[#dce7e8] bg-white px-3 text-sm font-semibold text-[#58727c] transition hover:border-[#b7cfcc] hover:bg-[#f5f9f8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#087f7b]">Editar</Link></div>
        </article></li>
      })}</ul>}
      {!isLoading && !error && filtered.length > 0 && <div className="flex flex-col gap-4 border-t border-[#e9efef] bg-[#fbfcfc] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"><div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[#82969d]"><span>Mostrando <strong className="font-semibold text-[#36515b]">{firstVisible}–{lastVisible}</strong> de <strong className="font-semibold text-[#36515b]">{filtered.length}</strong> cuartos</span><label className="flex items-center gap-2">Por página<select aria-label="Cuartos por página" value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1) }} className="min-h-9 rounded-lg border border-[#dce7e8] bg-white px-2 text-xs font-semibold text-[#36515b] focus-visible:outline-2 focus-visible:outline-[#087f7b]"><option value={6}>6</option><option value={9}>9</option><option value={18}>18</option></select></label></div><nav aria-label="Paginación de cuartos" className="flex items-center gap-1.5"><button type="button" aria-label="Página anterior" disabled={currentPage === 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="grid size-9 place-items-center rounded-lg border border-[#dce7e8] bg-white text-[#58727c] transition hover:bg-[#f0f6f5] disabled:cursor-not-allowed disabled:opacity-40"><ChevronsLeft className="size-4" /></button><button type="button" aria-label="Anterior" disabled={currentPage === 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="min-h-9 rounded-lg border border-[#dce7e8] bg-white px-3 text-xs font-semibold text-[#58727c] transition hover:bg-[#f0f6f5] disabled:cursor-not-allowed disabled:opacity-40">Anterior</button><span aria-live="polite" className="min-w-16 px-1 text-center text-xs font-semibold tabular-nums text-[#36515b]">{currentPage} / {pageCount}</span><button type="button" aria-label="Siguiente" disabled={currentPage === pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))} className="min-h-9 rounded-lg border border-[#dce7e8] bg-white px-3 text-xs font-semibold text-[#58727c] transition hover:bg-[#f0f6f5] disabled:cursor-not-allowed disabled:opacity-40">Siguiente</button><button type="button" aria-label="Última página" disabled={currentPage === pageCount} onClick={() => setPage(pageCount)} className="grid size-9 place-items-center rounded-lg border border-[#dce7e8] bg-white text-[#58727c] transition hover:bg-[#f0f6f5] disabled:cursor-not-allowed disabled:opacity-40"><ChevronsRight className="size-4" /></button></nav><span className="hidden items-center gap-1.5 text-xs text-[#82969d] xl:inline-flex"><ShieldCheck className="size-3.5 text-[#087f7b]" />Datos de configuración</span></div>}
    </section>
  </div>
}

function Summary({ label, value, detail, icon }: { label: string; value: string; detail: string; icon: React.ReactNode }) {
  return <div className="flex min-w-0 items-center gap-3 border-b border-[#e9efef] p-4 last:border-b-0 sm:border-r sm:p-5 sm:last:border-r-0 xl:border-b-0"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#edf6f4] text-[#087f7b]">{icon}</span><div className="min-w-0"><p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#718995]">{label}</p><p className="mt-1 flex items-baseline gap-2"><span className="text-2xl font-semibold leading-none tracking-[-0.04em] tabular-nums text-[#163542]">{value}</span><span className="truncate text-xs text-[#82969d]">{detail}</span></p></div></div>
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
  const toggleParameter = async (parameter: ParameterForm) => {
    const current = Array.isArray(params) ? params : []
    const next = current.map((item) => item.metric === parameter.metric ? { ...item, enabled: !item.enabled } : item)
    setSavingParams(true); setErrorMessage('')
    try { await api.saveRoomParameters(roomId, next); await mutateParams() } catch (cause) { setErrorMessage(message(cause)) } finally { setSavingParams(false) }
  }
  const parameterIcon = (metric: string) => {
    const name = metric.toLowerCase()
    if (/temp|temperature/.test(name)) return Thermometer
    if (/humidity|humedad|moist/.test(name)) return Droplets
    if (/press|presión|pressure/.test(name)) return Gauge
    if (/particle|partícula|dust/.test(name)) return Wind
    return Sparkles
  }
  const enabledParameters = Array.isArray(params) ? params.filter((parameter) => parameter.enabled).length : 0

  return <div className="flex flex-col gap-6">
    <PageHeading eyebrow="Administración · ficha de espacio" title={room.name} description="Consulta y actualiza los datos del cuarto y sus rangos de monitoreo." backHref="/admin/cuartos" />
    {errorMessage && <ErrorNotice>{errorMessage}</ErrorNotice>}
    <RoomInsights roomId={roomId} />
    <section className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)]">
    <section className="overflow-hidden rounded-2xl border border-[#dce7e8] bg-white shadow-[0_12px_34px_rgba(16,44,58,0.045)]">
      <div className="flex flex-col justify-between gap-4 border-b border-[#e9efef] px-5 py-5 sm:flex-row sm:items-center sm:px-6"><div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-xl bg-[#e8f4f1] text-[#087f7b]"><SlidersHorizontal className="size-5" /></span><div><div className="flex flex-wrap items-center gap-2"><h2 className="text-base font-semibold tracking-tight text-[#163542]">Parámetros ambientales</h2>{!paramsLoading && !paramsError && <span className="rounded-full bg-[#edf6f4] px-2.5 py-1 text-[11px] font-semibold text-[#087f7b]">{enabledParameters} activos · {Array.isArray(params) ? params.length : 0} variables</span>}</div><p className="mt-1 text-sm text-[#718995]">Rangos usados para evaluar las lecturas de este cuarto.</p></div></div><div className="flex items-center gap-2">{!paramsInitialized && !paramsLoading && !paramsError && <button type="button" onClick={initializeDrafts} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#dce7e8] bg-white px-3.5 text-sm font-semibold text-[#36515b] transition hover:bg-[#f5f9f8]"><Pencil className="size-4" />Editar rangos</button>}{paramsInitialized && <span className="inline-flex items-center gap-1.5 rounded-full bg-[#fff7e7] px-2.5 py-1.5 text-xs font-semibold text-[#9a6412]"><Pencil className="size-3.5" />Editando</span>}</div></div>
      {paramsError ? <div className="p-5"><ErrorNotice>{message(paramsError)}</ErrorNotice></div> : paramsLoading ? <Loading /> : <form onSubmit={saveParameters}>
        {!paramsInitialized && Array.isArray(params) && params.length > 0 && <div className="hidden grid-cols-[minmax(0,1.4fr)_minmax(8rem,0.75fr)_minmax(8rem,0.75fr)_auto] gap-4 bg-[#f8fbfa] px-6 py-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#8a9da3] sm:grid"><span>Variable</span><span>Límite mínimo</span><span>Límite máximo</span><span className="text-right">Monitoreo</span></div>}
        <div className="divide-y divide-[#edf2f3]">{drafts.map((parameter, index) => {
          const MetricIcon = parameterIcon(parameter.metric)
          return <article key={`${parameter.id ?? parameter.metric}-${index}`} className={`grid gap-4 px-5 py-5 transition sm:grid-cols-[minmax(0,1.4fr)_minmax(8rem,0.75fr)_minmax(8rem,0.75fr)_auto] sm:items-center sm:px-6 ${!parameter.enabled && !paramsInitialized ? 'bg-[#fbfcfc]' : 'bg-white'}`}>
            <div className="flex min-w-0 items-center gap-3"><span className={`grid size-10 shrink-0 place-items-center rounded-xl ${parameter.enabled ? 'bg-[#eaf5f2] text-[#087f7b]' : 'bg-[#f0f3f3] text-[#8a9da3]'}`}><MetricIcon className="size-[18px]" /></span><div className="min-w-0"><label className="block text-sm font-semibold text-[#29434e]">{paramsInitialized ? <input aria-label={`Nombre de variable ${index + 1}`} className={`${inputClass} min-h-10 max-w-64`} required value={parameter.metric} onChange={(event) => updateDraft(index, 'metric', event.target.value)} /> : <span className="truncate">{parameter.metric}</span>}</label><p className="mt-1 text-xs text-[#82969d]">Unidad: {paramsInitialized ? <input aria-label={`Unidad de ${parameter.metric || 'la variable'}`} className="h-7 w-24 rounded-md border border-[#dce8eb] bg-white px-2 text-xs text-[#36515b] focus-visible:outline-2 focus-visible:outline-[#087f7b]" required value={parameter.unit} onChange={(event) => updateDraft(index, 'unit', event.target.value)} /> : parameter.unit}</p></div></div>
            <label className="flex items-center justify-between gap-3 text-xs font-medium text-[#82969d] sm:block"><span className="sm:hidden">Mínimo</span>{paramsInitialized ? <input aria-label={`Mínimo de ${parameter.metric}`} className={`${inputClass} min-h-10 tabular-nums`} required type="number" step="any" value={parameter.min_value} onChange={(event) => updateDraft(index, 'min_value', event.target.value)} /> : <span className="text-base font-semibold tabular-nums text-[#36515b]">{parameter.min_value} <span className="text-xs font-medium text-[#82969d]">{parameter.unit}</span></span>}</label>
            <label className="flex items-center justify-between gap-3 text-xs font-medium text-[#82969d] sm:block"><span className="sm:hidden">Máximo</span>{paramsInitialized ? <input aria-label={`Máximo de ${parameter.metric}`} className={`${inputClass} min-h-10 tabular-nums`} required type="number" step="any" value={parameter.max_value} onChange={(event) => updateDraft(index, 'max_value', event.target.value)} /> : <span className="text-base font-semibold tabular-nums text-[#36515b]">{parameter.max_value} <span className="text-xs font-medium text-[#82969d]">{parameter.unit}</span></span>}</label>
            <div className="flex items-center justify-between gap-3 border-t border-[#edf2f3] pt-3 sm:border-0 sm:pt-0"><span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${parameter.enabled ? 'text-[#087f7b]' : 'text-[#82969d]'}`}><span className={`size-1.5 rounded-full ${parameter.enabled ? 'bg-[#0b9b80]' : 'bg-[#a6b4b8]'}`} />{parameter.enabled ? 'Monitoreo activo' : 'Desactivado'}</span><button type="button" role="switch" aria-checked={parameter.enabled} aria-label={`${parameter.enabled ? 'Desactivar' : 'Activar'} monitoreo de ${parameter.metric}`} disabled={savingParams || paramsInitialized} onClick={() => void toggleParameter(parameter)} className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full p-1 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#087f7b] disabled:cursor-not-allowed disabled:opacity-60 ${parameter.enabled ? 'bg-[#087f7b]' : 'bg-[#b8c5c8]'}`}><span className={`size-5 rounded-full bg-white shadow-sm transition-transform ${parameter.enabled ? 'translate-x-5' : 'translate-x-0'}`} /></button></div>
          </article>
        })}</div>
        {paramsInitialized && drafts.length === 0 && <p className="px-6 py-12 text-center text-sm text-[#718995]">Aún no hay variables. Agrega una para definir límites de monitoreo.</p>}
        {!paramsInitialized && Array.isArray(params) && params.length === 0 && <div className="px-6 py-12 text-center"><span className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#edf6f4] text-[#087f7b]"><ToggleLeft className="size-6" /></span><h3 className="mt-3 text-sm font-semibold text-[#29434e]">Sin variables configuradas</h3><p className="mt-1 text-sm text-[#82969d]">Añade rangos para evaluar las lecturas ambientales de este cuarto.</p><button type="button" onClick={initializeDrafts} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#087f7b] px-4 text-sm font-semibold text-white hover:bg-[#066c69]"><Plus className="size-4" />Añadir variable</button></div>}
        {paramsInitialized && <div className="flex flex-col gap-3 border-t border-[#e9efef] bg-[#fbfcfc] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"><button type="button" onClick={() => setParameterDrafts((current) => [...current, { metric: '', min_value: 0, max_value: 0, unit: '', enabled: true }])} className="inline-flex min-h-10 w-fit items-center gap-2 rounded-xl border border-[#dce7e8] bg-white px-3.5 text-sm font-semibold text-[#58727c] hover:bg-[#f5f9f8]"><Plus className="size-4" />Agregar variable</button><div className="flex flex-col-reverse gap-2 sm:flex-row"><button type="button" onClick={() => setParamsInitialized(false)} className="min-h-10 rounded-xl border border-[#dce7e8] bg-white px-4 text-sm font-semibold text-[#58727c] hover:bg-[#f5f9f8]">Cancelar</button><button type="submit" disabled={savingParams || drafts.some((item) => !item.metric.trim() || !item.unit.trim() || !Number.isFinite(Number(item.min_value)) || !Number.isFinite(Number(item.max_value)) || Number(item.min_value) >= Number(item.max_value))} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#087f7b] px-4 text-sm font-semibold text-white transition hover:bg-[#066c69] disabled:opacity-55">{savingParams ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />}{savingParams ? 'Guardando…' : 'Guardar rangos'}</button></div></div>}
        {!paramsInitialized && Array.isArray(params) && params.length > 0 && <div className="border-t border-[#e9efef] px-5 py-3 text-xs text-[#82969d] sm:px-6">Los interruptores guardan el estado de monitoreo directamente.</div>}
      </form>}
    </section>
    <RoomRecentAccesses roomId={roomId} />
    </section>
  </div>
}

function RoomRecentAccesses({ roomId }: { roomId: number }) {
  const accessQuery = `?page=1&size=6&cleanroom_id=${roomId}`
  const { data: accesses, error, isLoading } = useSWR<ApiAccessEvent[]>(['room-accesses', roomId], () => api.accesses(accessQuery))
  const date = (value: string) => new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value))

  return <article className="min-w-0 overflow-hidden rounded-2xl border border-[#dce7e8] bg-white shadow-[0_8px_24px_rgba(16,44,58,0.04)]"><div className="flex items-center gap-3 border-b border-[#e9efef] px-5 py-4"><span className="grid size-10 place-items-center rounded-xl bg-[#e8f4f1] text-[#087f7b]"><Radio className="size-5" /></span><div><h2 className="text-sm font-semibold text-[#163542]">Accesos recientes</h2><p className="mt-0.5 text-xs text-[#82969d]">Últimos movimientos del cuarto</p></div></div>{error ? <div className="p-4"><ErrorNotice>{message(error)}</ErrorNotice></div> : isLoading ? <Loading /> : (accesses ?? []).length ? <ul className="divide-y divide-[#edf2f3]">{accesses?.map((event) => <li key={event.id} className="flex items-center justify-between gap-3 px-5 py-3.5"><div className="min-w-0"><p className="truncate text-sm font-semibold text-[#36515b]">{event.direction === 'ENTRY' ? 'Entrada' : event.direction === 'EXIT' ? 'Salida' : event.event_type}</p><p className="mt-1 text-xs text-[#82969d]">{event.user_id ? `Usuario #${event.user_id}` : 'Usuario sin identificar'} · {date(event.occurred_at)}</p></div><AdminStatusBadge value={event.result} /></li>)}</ul> : <InsightEmpty title="Sin accesos recientes" description="No se encontraron eventos de acceso para este cuarto." />}</article>
}

function RoomInsights({ roomId }: { roomId: number }) {
  const [selectedMetric, setSelectedMetric] = useState('')
  const query = useMemo(() => {
    const end = new Date()
    const start = new Date(end.getTime() - 30 * 86400000)
    return new URLSearchParams({ cleanroom_id: String(roomId), start_at: start.toISOString(), end_at: end.toISOString() }).toString()
  }, [roomId])
  const { data, error, isLoading } = useSWR<AdminSummary>(['room-insights', query], ([, params]: [string, string]) => api.adminSummary(`?${params}`))
  const historyQuery = `?page=1&size=6&cleanroom_id=${roomId}`
  const alertsQuery = `?cleanroom_id=${roomId}`
  const { data: readings, error: readingsError, isLoading: readingsLoading } = useSWR<ApiSensorReading[]>(['room-readings', roomId], () => api.monitoringHistory(historyQuery))
  const { data: alerts, error: alertsError, isLoading: alertsLoading } = useSWR<ApiMonitoringAlert[]>(['room-alerts', roomId], () => api.notices(alertsQuery))
  const metrics = [...new Set((data?.environment_series ?? []).map((point) => point.metric))].sort()
  const metric = metrics.includes(selectedMetric) ? selectedMetric : metrics[0] ?? ''
  const environmentChart = useMemo(() => aggregateEnvironment(data?.environment_series ?? [], metric, String(roomId)), [data?.environment_series, metric, roomId])
  const accessSummary = summarizeAccess(data?.access_series ?? [])
  const allowedRate = accessSummary.total ? Math.round(accessSummary.allowed / accessSummary.total * 100) : null
  const roomSummary = data?.rooms?.[0]
  const date = (value: string) => new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
  const day = (value: string) => new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`))
  const visibleAlerts = (alerts ?? []).filter((alert) => alert.cleanroom_id === roomId).slice(0, 5)

  return <div className="flex flex-col gap-5">
    {error && <ErrorNotice>{message(error)}</ErrorNotice>}
    <section aria-label="Indicadores de los últimos 30 días" className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
      <InsightKpi label="Lecturas" value={isLoading ? '—' : Number(data?.readings ?? 0).toLocaleString('es-MX')} detail="últimos 30 días" icon={<Activity className="size-4" />} />
      <InsightKpi label="Accesos" value={isLoading ? '—' : Number(data?.total_events ?? 0).toLocaleString('es-MX')} detail="eventos registrados" icon={<Radio className="size-4" />} />
      <InsightKpi label="Permitidos" value={isLoading ? '—' : allowedRate === null ? '—' : `${allowedRate}%`} detail={accessSummary.total ? `${accessSummary.allowed} de ${accessSummary.total}` : 'sin eventos'} icon={<ArrowUpRight className="size-4" />} />
      <InsightKpi label="Denegados" value={isLoading ? '—' : Number(data?.denied ?? 0).toLocaleString('es-MX')} detail="en el periodo" icon={<ArrowDownRight className="size-4" />} />
      <InsightKpi label="Alertas activas" value={isLoading ? '—' : Number(data?.active_alerts ?? 0).toLocaleString('es-MX')} detail="estado actual" icon={<Bell className="size-4" />} tone={data?.active_alerts ? 'amber' : 'teal'} />
      <InsightKpi label="Ocupación" value={isLoading ? '—' : roomSummary ? `${roomSummary.current_occupancy} / ${roomSummary.capacity}` : '—'} detail="personas / capacidad" icon={<Users className="size-4" />} />
    </section>

    <section className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(18rem,0.85fr)]">
      <article className="overflow-hidden rounded-2xl border border-[#dce7e8] bg-white shadow-[0_8px_24px_rgba(16,44,58,0.04)]"><div className="flex flex-col justify-between gap-3 border-b border-[#e9efef] px-5 py-4 sm:flex-row sm:items-center sm:px-6"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-[#e8f4f1] text-[#087f7b]"><ChartNoAxesCombined className="size-5" /></span><div><h2 className="text-sm font-semibold text-[#163542]">Tendencia ambiental</h2><p className="mt-0.5 text-xs text-[#82969d]">Promedio diario · últimos 30 días</p></div></div>{metrics.length > 1 && <label className="flex items-center gap-2 text-xs font-medium text-[#718995]">Variable<select aria-label="Variable ambiental" value={metric} onChange={(event) => setSelectedMetric(event.target.value)} className="min-h-9 rounded-lg border border-[#dce7e8] bg-white px-2.5 text-xs font-semibold text-[#36515b] focus-visible:outline-2 focus-visible:outline-[#087f7b]">{metrics.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>}</div>
        {isLoading ? <Loading /> : environmentChart.length ? <div className="p-4 sm:p-5"><div className="h-64 w-full" role="img" aria-label={`Tendencia de ${metric} para este cuarto durante los últimos 30 días`}><ResponsiveContainer width="100%" height="100%"><LineChart data={environmentChart} margin={{ top: 12, right: 12, bottom: 0, left: -18 }} accessibilityLayer><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e8eff0" /><XAxis dataKey="date" tickFormatter={day} tickLine={false} axisLine={false} minTickGap={24} fontSize={11} /><YAxis tickLine={false} axisLine={false} fontSize={11} domain={['auto', 'auto']} /><Tooltip labelFormatter={(label) => day(String(label))} formatter={(value) => [`${value} ${data?.environment_series?.find((point) => point.metric === metric)?.unit ?? ''}`, 'Promedio diario']} />{environmentChart[0]?.min_value !== null && environmentChart[0]?.min_value !== undefined && <ReferenceLine y={environmentChart[0].min_value} stroke="#d97706" strokeDasharray="4 4" label="Mínimo" />}{environmentChart[0]?.max_value !== null && environmentChart[0]?.max_value !== undefined && <ReferenceLine y={environmentChart[0].max_value} stroke="#e11d48" strokeDasharray="4 4" label="Máximo" />}<Line type="monotone" dataKey="average" name="Promedio" stroke="#087f7b" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} /></LineChart></ResponsiveContainer></div><p className="mt-2 text-xs text-[#82969d]">{environmentChart.reduce((sum, point) => sum + point.count, 0).toLocaleString('es-MX')} muestras en {environmentChart.length} días con lecturas. Las líneas de límite aparecen cuando la unidad coincide con la configuración activa.</p></div> : <InsightEmpty title="Sin lecturas ambientales" description="No hay muestras para graficar en este cuarto durante los últimos 30 días." />}
      </article>
      <article className="overflow-hidden rounded-2xl border border-[#dce7e8] bg-white shadow-[0_8px_24px_rgba(16,44,58,0.04)]"><div className="flex items-center gap-3 border-b border-[#e9efef] px-5 py-4 sm:px-6"><span className="grid size-10 place-items-center rounded-xl bg-[#eef4fa] text-[#3476a3]"><Activity className="size-5" /></span><div><h2 className="text-sm font-semibold text-[#163542]">Actividad de acceso</h2><p className="mt-0.5 text-xs text-[#82969d]">Eventos por día · últimos 30 días</p></div></div>{isLoading ? <Loading /> : (data?.access_series?.length ?? 0) > 0 ? <div className="p-4 sm:p-5"><div className="h-64 w-full" role="img" aria-label="Gráfica de accesos permitidos y denegados por día"><ResponsiveContainer width="100%" height="100%"><BarChart data={data?.access_series ?? []} margin={{ top: 8, right: 4, bottom: 0, left: -22 }} accessibilityLayer><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e8eff0" /><XAxis dataKey="date" tickFormatter={day} tickLine={false} axisLine={false} minTickGap={22} fontSize={10} /><YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={10} /><Tooltip labelFormatter={(label) => day(String(label))} /><Bar dataKey="allowed" name="Permitidos" stackId="access" fill="#0b8b7c" radius={[3, 3, 0, 0]} /><Bar dataKey="denied" name="Denegados" stackId="access" fill="#e05b55" radius={[3, 3, 0, 0]} /></BarChart></ResponsiveContainer></div><div className="mt-2 flex gap-4 text-xs text-[#718995]"><span><i className="mr-1.5 inline-block size-2 rounded-full bg-[#0b8b7c]" />Permitidos</span><span><i className="mr-1.5 inline-block size-2 rounded-full bg-[#e05b55]" />Denegados</span></div></div> : <InsightEmpty title="Sin eventos de acceso" description="No se registraron accesos para este cuarto en el periodo." />}</article>
    </section>

    <section className="grid gap-5 xl:grid-cols-3">
      <article className="overflow-hidden rounded-2xl border border-[#dce7e8] bg-white shadow-[0_8px_24px_rgba(16,44,58,0.04)] xl:col-span-2"><div className="flex items-center justify-between border-b border-[#e9efef] px-5 py-4 sm:px-6"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-[#edf4fb] text-[#3476a3]"><CalendarClock className="size-5" /></span><div><h2 className="text-sm font-semibold text-[#163542]">Lecturas recientes</h2><p className="mt-0.5 text-xs text-[#82969d]">Últimas muestras recibidas por la API</p></div></div><span className="text-xs font-medium text-[#82969d]">{(readings ?? []).length} registros</span></div>{readingsError ? <div className="p-5"><ErrorNotice>{message(readingsError)}</ErrorNotice></div> : readingsLoading ? <Loading /> : (readings ?? []).length ? <div className="overflow-x-auto"><table className="w-full min-w-[34rem] text-left"><thead className="bg-[#f8fbfa] text-[10px] uppercase tracking-[0.12em] text-[#8a9da3]"><tr><th className="px-6 py-3 font-bold">Variable</th><th className="px-4 py-3 font-bold">Lectura</th><th className="px-4 py-3 font-bold">Dispositivo</th><th className="px-6 py-3 text-right font-bold">Recibida</th></tr></thead><tbody className="divide-y divide-[#edf2f3]">{(readings ?? []).map((reading) => <tr key={reading.id} className="transition hover:bg-[#fbfdfc]"><td className="px-6 py-3.5 text-sm font-semibold text-[#36515b]">{reading.metric}</td><td className="px-4 py-3.5 text-sm tabular-nums text-[#36515b]">{reading.value} <span className="text-xs text-[#82969d]">{reading.unit}</span></td><td className="px-4 py-3.5 text-xs font-medium text-[#718995]">#{reading.device_id}</td><td className="px-6 py-3.5 text-right text-xs tabular-nums text-[#718995]">{date(reading.recorded_at)}</td></tr>)}</tbody></table></div> : <InsightEmpty title="Sin lecturas registradas" description="Cuando el cuarto reciba telemetría, aquí aparecerán las muestras más recientes." />}</article>
      <article className="overflow-hidden rounded-2xl border border-[#dce7e8] bg-white shadow-[0_8px_24px_rgba(16,44,58,0.04)]"><div className="flex items-center gap-3 border-b border-[#e9efef] px-5 py-4"><span className="grid size-10 place-items-center rounded-xl bg-[#fff4e8] text-[#b7721c]"><Bell className="size-5" /></span><div><h2 className="text-sm font-semibold text-[#163542]">Alertas recientes</h2><p className="mt-0.5 text-xs text-[#82969d]">Estado actual del cuarto</p></div></div>{alertsError ? <div className="p-4"><ErrorNotice>{message(alertsError)}</ErrorNotice></div> : alertsLoading ? <Loading /> : visibleAlerts.length ? <ul className="divide-y divide-[#edf2f3]">{visibleAlerts.map((alert) => <li key={alert.id} className="px-5 py-3.5"><div className="flex items-center justify-between gap-3"><AdminStatusBadge value={alert.severity} kind="severity" /><span className="text-[11px] text-[#91a2a7]">{date(alert.created_at)}</span></div><p className="mt-2 text-sm font-medium leading-5 text-[#36515b]">{alert.message}</p><p className="mt-1 text-xs text-[#82969d]">{alert.status === 'ACTIVE' ? 'Pendiente de atención' : alert.status === 'ACKNOWLEDGED' ? 'Atendida' : alert.status}</p></li>)}</ul> : <InsightEmpty title="Sin alertas recientes" description="No hay avisos registrados para este cuarto." />}</article>
    </section>
  </div>
}

function InsightKpi({ label, value, detail, icon, tone = 'teal' }: { label: string; value: string; detail: string; icon: React.ReactNode; tone?: 'teal' | 'amber' }) {
  return <article className="min-w-0 rounded-2xl border border-[#dce7e8] bg-white p-4 shadow-[0_4px_18px_rgba(16,44,58,0.035)]"><div className="flex items-center justify-between gap-2"><p className="truncate text-[10px] font-bold uppercase tracking-[0.11em] text-[#82969d]">{label}</p><span className={`grid size-8 shrink-0 place-items-center rounded-lg ${tone === 'amber' ? 'bg-[#fff5e8] text-[#b7721c]' : 'bg-[#eaf5f2] text-[#087f7b]'}`}>{icon}</span></div><p className="mt-3 text-2xl font-semibold leading-none tracking-[-0.04em] tabular-nums text-[#163542]">{value}</p><p className="mt-2 truncate text-[11px] text-[#82969d]">{detail}</p></article>
}

function InsightEmpty({ title, description }: { title: string; description: string }) {
  return <div className="flex min-h-36 flex-col items-center justify-center px-6 py-8 text-center"><span className="grid size-10 place-items-center rounded-xl bg-[#f0f5f4] text-[#82969d]"><Activity className="size-4" /></span><p className="mt-3 text-sm font-semibold text-[#36515b]">{title}</p><p className="mt-1 max-w-xs text-xs leading-5 text-[#82969d]">{description}</p></div>
}

function Loading() {
  return <div className="flex min-h-40 items-center justify-center gap-3 rounded-2xl border border-[#e5edf0] bg-white text-sm text-[#718995]"><LoaderCircle className="size-4 animate-spin" />Cargando información del cuarto…</div>
}
