'use client'

import { useRef, useState, type FormEvent } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import { CalendarClock, ChevronLeft, ChevronRight, DoorOpen, LoaderCircle, RefreshCw, Search, ShieldCheck, UserRound } from 'lucide-react'
import { api, type ApiPerson, type ApiRoom } from '@/lib/api'
import { userFacingClientError } from '@/lib/user-facing-errors.mjs'
import { AdminFilterBar, AdminField, AdminStatusBadge, adminInputClass } from '@/components/admin-ui'
import { CreateConfirmDialog } from '@/components/admin-creation-ui'

type Permission = {
  id: number
  user_id: number
  cleanroom_id: number
  valid_from: string | null
  valid_until: string | null
  enabled: boolean
}

type Option = { id: number; name: string }
const PAGE_SIZE = 8

const fieldClass = 'min-h-11 w-full min-w-0 rounded-xl border border-[#cfdcde] bg-white px-3.5 text-sm text-[#163542] outline-none transition placeholder:text-[#91a3a8] focus:border-[#087f7b] focus:ring-4 focus:ring-[#087f7b]/10 disabled:cursor-not-allowed disabled:bg-[#f4f7f7] disabled:opacity-60 dark:border-[#2b4350] dark:bg-[#101e26] dark:text-[#e6f0f2] dark:placeholder:text-[#78919b] dark:disabled:bg-[#15242e]'
const buttonClass = 'inline-flex items-center justify-center gap-2 rounded-xl bg-[#087f7b] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#066c69] disabled:cursor-not-allowed disabled:opacity-60'

function recordsFrom(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    for (const key of ['items', 'data', 'results']) if (Array.isArray(record[key])) return recordsFrom(record[key])
  }
  return []
}

function dateForInput(value: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

function dateForApi(value: string) {
  return value ? new Date(value).toISOString() : null
}

function displayDate(value: string | null) {
  if (!value) return 'Sin límite'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Fecha inválida' : date.toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })
}

export function AccessPermissionManagement({ personId }: { personId?: number }) {
  const { data: peopleData, error: peopleError, isLoading: peopleLoading, mutate: mutatePeople } = useSWR('permission-people', () => api.people('?page=1&size=100'))
  const { data: roomsData, error: roomsError, isLoading: roomsLoading, mutate: mutateRooms } = useSWR<ApiRoom[]>('permission-rooms', api.rooms)
  const { data: permissionData, error: permissionError, isLoading: permissionsLoading, mutate: mutatePermissions } = useSWR('access-permissions', api.permissions)
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [search, setSearch] = useState('')
  const [filterRoom, setFilterRoom] = useState('')
  const [filterStatus, setFilterStatus] = useState('ALL')
  const [page, setPage] = useState(1)
  const [confirmCreate, setConfirmCreate] = useState(false)
  const pendingPermission = useRef<{ form: HTMLFormElement; userId: number; cleanroomId: number; validFrom: string; validUntil: string } | null>(null)

  const people = recordsFrom(peopleData) as unknown as ApiPerson[]
  const rooms = Array.isArray(roomsData) ? roomsData : []
  const permissions = recordsFrom(permissionData) as unknown as Permission[]
  const statusCode = (permission: Permission) => !permission.enabled ? 'INACTIVE' : permission.valid_until && new Date(permission.valid_until) <= new Date() ? 'EXPIRED' : permission.valid_from && new Date(permission.valid_from) > new Date() ? 'SCHEDULED' : 'ACTIVE'
  const visiblePermissions = permissions.filter((permission) => {
    if (personId && permission.user_id !== personId) return false
    if (filterRoom && String(permission.cleanroom_id) !== filterRoom) return false
    if (filterStatus !== 'ALL' && statusCode(permission) !== filterStatus) return false
    const person = people.find((item) => item.id === permission.user_id)
    const room = rooms.find((item) => item.id === permission.cleanroom_id)
    const haystack = `${person?.full_name ?? person?.name ?? person?.email ?? ''} ${room?.name ?? ''} ${room?.code ?? ''}`.toLocaleLowerCase()
    return !search || haystack.includes(search.toLocaleLowerCase())
  })
  const pageCount = Math.max(1, Math.ceil(visiblePermissions.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const pagePermissions = visiblePermissions.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const selectedPerson = people.find((person) => person.id === personId)
  const loading = peopleLoading || roomsLoading || permissionsLoading
  const loadError = peopleError || roomsError || permissionError

  const createPermission = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage('')
    setSuccessMessage('')
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    const userId = personId ?? Number(form.get('user_id'))
    const cleanroomId = Number(form.get('cleanroom_id'))
    const validFrom = String(form.get('valid_from') ?? '')
    const validUntil = String(form.get('valid_until') ?? '')
    const start = validFrom ? new Date(validFrom) : null
    const end = validUntil ? new Date(validUntil) : null

    if (!Number.isInteger(userId) || !Number.isInteger(cleanroomId)) {
      setErrorMessage('Selecciona una persona y un cuarto válidos.')
      return
    }
    if (start && end && end <= start) {
      setErrorMessage('La fecha final debe ser posterior a la fecha de inicio.')
      return
    }

    pendingPermission.current = { form: formElement, userId, cleanroomId, validFrom, validUntil }
    setConfirmCreate(true)
  }

  const confirmPermission = async () => {
    const pending = pendingPermission.current
    if (!pending) return
    setSaving(true)
    try {
      await api.createPermission({
        user_id: pending.userId,
        cleanroom_id: pending.cleanroomId,
        valid_from: dateForApi(pending.validFrom),
        valid_until: dateForApi(pending.validUntil),
        enabled: true,
      })
      await mutatePermissions()
      pending.form.reset()
      pendingPermission.current = null
      setConfirmCreate(false)
      setSuccessMessage('Permiso de acceso creado correctamente.')
    } catch (cause) {
      setConfirmCreate(false)
      setErrorMessage(userFacingClientError(cause))
    } finally {
      setSaving(false)
    }
  }

  const updatePermission = async (id: number, patch: Record<string, unknown>) => {
    setErrorMessage('')
    setSuccessMessage('')
    setSaving(true)
    try {
      await api.updatePermission(id, patch)
      await mutatePermissions()
      setSuccessMessage('Los cambios del permiso se guardaron correctamente.')
    } catch (cause) {
      setErrorMessage(userFacingClientError(cause))
    } finally {
      setSaving(false)
    }
  }

  const personName = (id: number) => {
    const person = people.find((item) => item.id === id)
    return person?.full_name || person?.name || person?.email || `Persona #${id}`
  }
  const roomName = (id: number) => {
    const room = rooms.find((item) => item.id === id)
    return room ? `${room.name} · ${room.code}` : `Cuarto #${id}`
  }

  return <div className="flex min-w-0 flex-col gap-6">
    <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div className="min-w-0"><p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Administración · control de acceso</p><h1 className="mt-1 text-3xl font-semibold tracking-[-0.035em] text-foreground sm:text-[2.15rem]">Permisos por cuarto</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Asigna a cada persona acceso a un cuarto y define cuándo estará vigente.</p>{personId && <p className="mt-2 inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground"><UserRound className="size-4" />{selectedPerson?.full_name || selectedPerson?.name || `Persona #${personId}`}</p>}</div>{personId && <Link href="/admin/personas" className="inline-flex min-h-10 w-fit items-center rounded-xl border border-border bg-card px-3.5 text-sm font-semibold text-foreground transition hover:bg-muted">Volver al directorio</Link>}</header>

    {errorMessage && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">{errorMessage}</div>}
    {successMessage && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">{successMessage}</div>}

    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--admin-panel-shadow)]">
      <div className="flex items-start gap-3 border-b border-border bg-muted/40 px-5 py-4 sm:px-6"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground"><ShieldCheck className="size-5" /></span><div><p className="text-xs font-bold uppercase tracking-[0.13em] text-primary">Nueva asignación</p><h2 className="mt-0.5 text-lg font-semibold tracking-tight text-card-foreground">Conceder acceso a un cuarto</h2><p className="mt-1 text-sm text-muted-foreground">Las fechas son opcionales. Si las dejas vacías, el permiso no tendrá límite de vigencia.</p></div></div>
      <div className="p-5 sm:p-6">
      {loadError && <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">No se pudieron cargar las opciones: {userFacingClientError(loadError)}</div>}
      {personId && !selectedPerson && !peopleLoading && <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">No encontramos a esta persona en el directorio cargado.</div>}
      <form onSubmit={createPermission} className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {!personId && <label className="flex min-w-0 flex-col gap-2 text-sm font-semibold text-foreground xl:col-span-2"><span className="inline-flex items-center gap-2"><UserRound className="size-4 text-primary" />Persona autorizada</span><select className={fieldClass} required name="user_id" defaultValue="" disabled={peopleLoading || Boolean(peopleError)}><option value="" disabled>Selecciona una persona</option>{people.map((person) => <option key={person.id} value={person.id}>{person.full_name || person.name || person.email || `Persona #${person.id}`}{person.status === 'INACTIVE' ? ' · inactiva' : ''}</option>)}</select></label>}
        <label className="flex min-w-0 flex-col gap-2 text-sm font-semibold text-foreground xl:col-span-2"><span className="inline-flex items-center gap-2"><DoorOpen className="size-4 text-primary" />Cuarto de acceso</span><select className={fieldClass} required name="cleanroom_id" defaultValue="" disabled={roomsLoading || Boolean(roomsError)}><option value="" disabled>Selecciona un cuarto</option>{rooms.map((room) => <option key={room.id} value={room.id}>{room.name} · {room.code}</option>)}</select></label>
        <label className="flex min-w-0 flex-col gap-2 text-sm font-semibold text-foreground"><span className="inline-flex items-center gap-2"><CalendarClock className="size-4 text-primary" />Vigente desde <span className="font-normal text-muted-foreground">(opcional)</span></span><input className={fieldClass} type="datetime-local" name="valid_from" /></label>
        <label className="flex min-w-0 flex-col gap-2 text-sm font-semibold text-foreground"><span className="inline-flex items-center gap-2"><CalendarClock className="size-4 text-primary" />Vigente hasta <span className="font-normal text-muted-foreground">(opcional)</span></span><input className={fieldClass} type="datetime-local" name="valid_until" /></label>
        <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:col-span-2 sm:flex-row sm:justify-end xl:col-span-4"><button type="reset" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border bg-card px-4 text-sm font-semibold text-foreground transition hover:bg-muted">Limpiar formulario</button><button disabled={saving || loading || (personId !== undefined && !selectedPerson) || Boolean(loadError) || people.length === 0 || rooms.length === 0} className={`${buttonClass} min-h-11 w-full sm:w-auto`}>{saving && <LoaderCircle className="size-4 animate-spin" />}Revisar y crear permiso</button></div>
      </form>
      </div>
    </section>
    <CreateConfirmDialog open={confirmCreate} title="Crear permiso de acceso" description={`Confirma la asignación para ${personId ? selectedPerson?.full_name ?? `persona #${personId}` : 'la persona seleccionada'} en el cuarto indicado. La vigencia puede ser ilimitada si dejaste las fechas vacías.`} loading={saving} onCancel={() => { setConfirmCreate(false); pendingPermission.current = null }} onConfirm={() => void confirmPermission()} />

    <section className="overflow-hidden rounded-2xl border border-[#e5edf0] bg-white shadow-[0_8px_24px_rgba(18,49,66,0.04)]">
      <div className="flex items-center justify-between border-b border-[#edf2f3] px-5 py-4"><div><h2 className="font-semibold text-[#163542]">Permisos registrados</h2><p className="mt-1 text-xs text-[#82969d]">{visiblePermissions.length} resultados</p></div><button type="button" aria-label="Actualizar permisos" onClick={() => void Promise.all([mutatePermissions(), mutatePeople(), mutateRooms()])} className="rounded-lg p-2 text-[#58727c] hover:bg-[#f3f8f8]"><RefreshCw className="size-4" /></button></div>
      <AdminFilterBar className="m-4">
        <AdminField label="Buscar persona o cuarto" className="min-w-[14rem] flex-1"><span className="relative flex items-center"><Search aria-hidden="true" className="absolute left-3 size-4 text-muted-foreground" /><input className={`${adminInputClass} pl-9`} value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder="Nombre, correo o código" /></span></AdminField>
        {!personId && <AdminField label="Cuarto" className="sm:min-w-52"><select className={adminInputClass} value={filterRoom} onChange={(event) => { setFilterRoom(event.target.value); setPage(1) }}><option value="">Todos los cuartos</option>{rooms.map((room) => <option key={room.id} value={room.id}>{room.code} · {room.name}</option>)}</select></AdminField>}
        <AdminField label="Vigencia y estado" className="sm:min-w-48"><select className={adminInputClass} value={filterStatus} onChange={(event) => { setFilterStatus(event.target.value); setPage(1) }}><option value="ALL">Todos</option><option value="ACTIVE">Vigente y activo</option><option value="SCHEDULED">Programado</option><option value="EXPIRED">Vencido</option><option value="INACTIVE">Deshabilitado</option></select></AdminField>
      </AdminFilterBar>
      {!loading && !loadError && visiblePermissions.length > 0 && <div className="flex items-center justify-between px-5 pb-3 text-xs text-muted-foreground"><span>Mostrando <strong className="font-semibold text-foreground">{Math.min((currentPage - 1) * PAGE_SIZE + 1, visiblePermissions.length)}–{Math.min(currentPage * PAGE_SIZE, visiblePermissions.length)}</strong> de <strong className="font-semibold text-foreground">{visiblePermissions.length}</strong></span>{pageCount > 1 && <span>Página {currentPage} de {pageCount}</span>}</div>}
      {loading ? <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin text-primary" />Cargando permisos…</div> : loadError ? <div className="m-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">No se pudo cargar el directorio. Revisa la conexión e inténtalo de nuevo.</div> : visiblePermissions.length === 0 ? <div className="flex min-h-44 flex-col items-center justify-center px-6 py-8 text-center"><span className="grid size-10 place-items-center rounded-xl bg-accent text-accent-foreground"><ShieldCheck className="size-5" /></span><p className="mt-3 font-semibold text-card-foreground">No hay permisos que coincidan</p><p className="mt-1 text-sm text-muted-foreground">Ajusta la búsqueda o los filtros, o crea un permiso nuevo.</p></div> : <ul className="grid gap-2 px-4 pb-4 sm:px-5">{pagePermissions.map((permission) => <PermissionRow key={permission.id} permission={permission} personName={personName(permission.user_id)} roomName={roomName(permission.cleanroom_id)} saving={saving} onSave={(patch) => void updatePermission(permission.id, patch)} />)}</ul>}
      {!loading && !loadError && pageCount > 1 && <nav aria-label="Paginación de permisos" className="flex flex-col gap-3 border-t border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-5"><span>Permisos <strong className="font-semibold text-foreground">{currentPage} / {pageCount}</strong></span><div className="flex items-center gap-2"><button type="button" disabled={currentPage === 1} onClick={() => setPage(Math.max(1, currentPage - 1))} className="inline-flex min-h-10 items-center gap-1 rounded-xl border border-border bg-card px-3 font-semibold text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-45"><ChevronLeft className="size-4" />Anterior</button><button type="button" disabled={currentPage === pageCount} onClick={() => setPage(Math.min(pageCount, currentPage + 1))} className="inline-flex min-h-10 items-center gap-1 rounded-xl border border-border bg-card px-3 font-semibold text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-45">Siguiente<ChevronRight className="size-4" /></button></div></nav>}
    </section>
  </div>
}

function PermissionRow({ permission, personName, roomName, saving, onSave }: { permission: Permission; personName: string; roomName: string; saving: boolean; onSave: (patch: Record<string, unknown>) => void }) {
  const [editing, setEditing] = useState(false)
  const [validFrom, setValidFrom] = useState(dateForInput(permission.valid_from))
  const [validUntil, setValidUntil] = useState(dateForInput(permission.valid_until))
  const [validationError, setValidationError] = useState('')
  const status = !permission.enabled ? 'INACTIVE' : permission.valid_until && new Date(permission.valid_until) <= new Date() ? 'EXPIRED' : permission.valid_from && new Date(permission.valid_from) > new Date() ? 'SCHEDULED' : 'ACTIVE'

  const save = () => {
    const start = validFrom ? new Date(validFrom) : null
    const end = validUntil ? new Date(validUntil) : null
    if (start && end && end <= start) {
      setValidationError('La fecha final debe ser posterior a la fecha inicial.')
      return
    }
    setValidationError('')
    onSave({ valid_from: dateForApi(validFrom), valid_until: dateForApi(validUntil) })
    setEditing(false)
  }

  return <li className="min-w-0 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-muted/25">
    <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-center">
      <div className="flex min-w-0 items-center gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground"><UserRound className="size-4" /></span><div className="min-w-0"><p className="truncate text-sm font-semibold text-card-foreground" title={personName}>{personName}</p><p className="mt-1 flex min-w-0 items-center gap-1.5 truncate text-xs text-muted-foreground"><DoorOpen className="size-3.5 shrink-0 text-primary" />{roomName}</p></div></div>
      <div className="min-w-0 rounded-lg bg-muted/60 px-3 py-2"><p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Vigencia</p><p className="mt-1 truncate text-xs font-medium text-foreground">{!permission.valid_from && !permission.valid_until ? 'Sin límite' : <>{displayDate(permission.valid_from)} <span className="text-muted-foreground">hasta</span> {displayDate(permission.valid_until)}</>}</p></div>
      <div className="flex flex-wrap items-center gap-2"><AdminStatusBadge value={status} /><button type="button" disabled={saving} onClick={() => setEditing((current) => !current)} className="inline-flex min-h-10 items-center justify-center rounded-lg border border-border bg-card px-3 text-xs font-semibold text-foreground transition hover:bg-muted disabled:opacity-50">{editing ? 'Cerrar' : 'Editar fechas'}</button><button type="button" role="switch" aria-checked={permission.enabled} aria-label={`${permission.enabled ? 'Deshabilitar' : 'Habilitar'} permiso de ${personName} en ${roomName}`} disabled={saving} onClick={() => onSave({ enabled: !permission.enabled })} className="group inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-xs font-semibold text-foreground transition hover:bg-muted disabled:cursor-wait disabled:opacity-50"><span aria-hidden="true" className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${permission.enabled ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-600'}`}><span className={`inline-block size-4 rounded-full bg-white shadow-sm transition-transform ${permission.enabled ? 'translate-x-6' : 'translate-x-1'}`} /></span><span className="min-w-[4.5rem] text-left">{saving ? 'Guardando…' : permission.enabled ? 'Habilitado' : 'Deshabilitado'}</span></button></div>
    </div>
    {editing && <div className="mt-4 grid gap-3 rounded-xl border border-border bg-muted/30 p-4 sm:grid-cols-2"><label className="flex min-w-0 flex-col gap-2 text-xs font-semibold text-foreground">Vigente desde<input className={adminInputClass} type="datetime-local" value={validFrom} onChange={(event) => setValidFrom(event.target.value)} /></label><label className="flex min-w-0 flex-col gap-2 text-xs font-semibold text-foreground">Vigente hasta<input className={adminInputClass} type="datetime-local" value={validUntil} onChange={(event) => setValidUntil(event.target.value)} /></label>{validationError && <p role="alert" className="text-xs text-red-700 sm:col-span-2">{validationError}</p>}<div className="flex flex-col-reverse gap-2 sm:col-span-2 sm:flex-row sm:justify-end"><button type="button" onClick={() => { setEditing(false); setValidationError(''); setValidFrom(dateForInput(permission.valid_from)); setValidUntil(dateForInput(permission.valid_until)) }} className="inline-flex min-h-10 items-center justify-center rounded-xl border border-border bg-card px-4 text-sm font-semibold text-foreground">Cancelar</button><button type="button" disabled={saving} onClick={save} className={buttonClass}>{saving && <LoaderCircle className="size-4 animate-spin" />}Guardar vigencia</button></div></div>}
  </li>
}
