'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import { LoaderCircle, RefreshCw, ShieldCheck } from 'lucide-react'
import { api, type ApiPerson, type ApiRoom } from '@/lib/api'

type Permission = {
  id: number
  user_id: number
  cleanroom_id: number
  valid_from: string | null
  valid_until: string | null
  enabled: boolean
}

type Option = { id: number; name: string }

const fieldClass = 'w-full rounded-xl border border-[#dce8eb] bg-white px-3 py-2.5 text-sm text-[#163542] outline-none focus:border-[#087f7b] focus:ring-4 focus:ring-[#087f7b]/10'
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

  const people = recordsFrom(peopleData) as unknown as ApiPerson[]
  const rooms = Array.isArray(roomsData) ? roomsData : []
  const permissions = recordsFrom(permissionData) as unknown as Permission[]
  const visiblePermissions = personId ? permissions.filter((permission) => permission.user_id === personId) : permissions
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

    setSaving(true)
    try {
      await api.createPermission({
        user_id: userId,
        cleanroom_id: cleanroomId,
        valid_from: dateForApi(validFrom),
        valid_until: dateForApi(validUntil),
        enabled: true,
      })
      await mutatePermissions()
      formElement.reset()
      setSuccessMessage('Permiso creado y sincronizado con FastAPI.')
    } catch (cause) {
      setErrorMessage(cause instanceof Error ? cause.message : 'No se pudo guardar el permiso.')
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
      setSuccessMessage('Permiso actualizado.')
    } catch (cause) {
      setErrorMessage(cause instanceof Error ? cause.message : 'No se pudo actualizar el permiso.')
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

  return <div className="flex flex-col gap-6">
    <header><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#087f7b]">Administración · control de acceso</p><h1 className="mt-1 text-3xl font-semibold tracking-tight text-[#163542]">Permisos por cuarto</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[#718995]">Crea y administra permisos de personas con vigencia y estado, usando los endpoints reales de FastAPI.</p>{personId && <p className="mt-2 text-sm font-medium text-[#58727c]">Persona: {selectedPerson?.full_name || `#${personId}`}</p>}</header>

    {errorMessage && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{errorMessage}</div>}
    {successMessage && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{successMessage}</div>}

    <section className="rounded-2xl border border-[#e5edf0] bg-white p-5 shadow-[0_8px_24px_rgba(18,49,66,0.04)] sm:p-6">
      <div className="mb-5 flex items-center gap-3"><div className="flex size-10 items-center justify-center rounded-xl bg-[#eff8f7] text-[#087f7b]"><ShieldCheck className="size-5" /></div><div><h2 className="font-semibold text-[#163542]">Nuevo permiso</h2><p className="text-xs text-[#82969d]">Los límites de vigencia son opcionales.</p></div></div>
      {loadError && <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">No se pudieron cargar las opciones: {loadError instanceof Error ? loadError.message : 'Error de API.'}</div>}
      {personId && !selectedPerson && !peopleLoading && <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">No se encontró esta persona en la respuesta de FastAPI.</div>}
      <form onSubmit={createPermission} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {!personId && <label className="flex flex-col gap-2 text-sm font-medium text-[#29434e]">Persona<select className={fieldClass} required name="user_id" defaultValue="" disabled={peopleLoading || Boolean(peopleError)}><option value="" disabled>Seleccionar persona</option>{people.map((person) => <option key={person.id} value={person.id}>{person.full_name || person.email || `Persona #${person.id}`}{person.status === 'INACTIVE' ? ' · inactiva' : ''}</option>)}</select></label>}
        <label className="flex flex-col gap-2 text-sm font-medium text-[#29434e]">Cuarto<select className={fieldClass} required name="cleanroom_id" defaultValue="" disabled={roomsLoading || Boolean(roomsError)}><option value="" disabled>Seleccionar cuarto</option>{rooms.map((room) => <option key={room.id} value={room.id}>{room.name} · {room.code}</option>)}</select></label>
        <label className="flex flex-col gap-2 text-sm font-medium text-[#29434e]">Válido desde<input className={fieldClass} type="datetime-local" name="valid_from" /></label>
        <label className="flex flex-col gap-2 text-sm font-medium text-[#29434e]">Válido hasta<input className={fieldClass} type="datetime-local" name="valid_until" /></label>
        <div className="flex items-end"><button disabled={saving || loading || (personId !== undefined && !selectedPerson)} className={buttonClass}>{saving && <LoaderCircle className="size-4 animate-spin" />}Crear permiso</button></div>
      </form>
    </section>

    <section className="overflow-hidden rounded-2xl border border-[#e5edf0] bg-white shadow-[0_8px_24px_rgba(18,49,66,0.04)]">
      <div className="flex items-center justify-between border-b border-[#edf2f3] px-5 py-4"><div><h2 className="font-semibold text-[#163542]">Permisos registrados</h2><p className="mt-1 text-xs text-[#82969d]">{visiblePermissions.length} resultados</p></div><button type="button" aria-label="Actualizar permisos" onClick={() => void Promise.all([mutatePermissions(), mutatePeople(), mutateRooms()])} className="rounded-lg p-2 text-[#58727c] hover:bg-[#f3f8f8]"><RefreshCw className="size-4" /></button></div>
      {loading ? <div className="p-8 text-center text-sm text-[#82969d]">Consultando permisos…</div> : loadError ? <div className="p-8 text-center text-sm text-red-700">No se pudo consultar la lista.</div> : visiblePermissions.length === 0 ? <div className="p-8 text-center"><p className="font-medium text-[#29434e]">No hay permisos registrados</p><p className="mt-1 text-sm text-[#82969d]">Crea el primero con el formulario anterior.</p></div> : <ul className="divide-y divide-[#edf2f3]">{visiblePermissions.map((permission) => <PermissionRow key={permission.id} permission={permission} personName={personName(permission.user_id)} roomName={roomName(permission.cleanroom_id)} saving={saving} onSave={(patch) => void updatePermission(permission.id, patch)} />)}</ul>}
    </section>
    <Link href="/admin/personas" className="w-fit text-sm font-semibold text-[#087f7b] hover:underline">Volver a personas</Link>
  </div>
}

function PermissionRow({ permission, personName, roomName, saving, onSave }: { permission: Permission; personName: string; roomName: string; saving: boolean; onSave: (patch: Record<string, unknown>) => void }) {
  const [editing, setEditing] = useState(false)
  const [validFrom, setValidFrom] = useState(dateForInput(permission.valid_from))
  const [validUntil, setValidUntil] = useState(dateForInput(permission.valid_until))
  const [validationError, setValidationError] = useState('')

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

  return <li className="flex flex-col gap-4 px-5 py-4 lg:flex-row lg:items-start">
    <div className="min-w-0 flex-1"><p className="font-semibold text-[#29434e]">{personName}</p><p className="mt-1 text-sm text-[#718995]">{roomName}</p><p className="mt-2 text-xs text-[#82969d]">Vigencia: {displayDate(permission.valid_from)} — {displayDate(permission.valid_until)}</p>
      {editing && <div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="flex flex-col gap-2 text-xs font-medium text-[#58727c]">Válido desde<input className={fieldClass} type="datetime-local" value={validFrom} onChange={(event) => setValidFrom(event.target.value)} /></label><label className="flex flex-col gap-2 text-xs font-medium text-[#58727c]">Válido hasta<input className={fieldClass} type="datetime-local" value={validUntil} onChange={(event) => setValidUntil(event.target.value)} /></label>{validationError && <p role="alert" className="text-xs text-red-700 sm:col-span-2">{validationError}</p>}<div className="flex gap-2 sm:col-span-2"><button type="button" disabled={saving} onClick={save} className={buttonClass}>Guardar vigencia</button><button type="button" onClick={() => setEditing(false)} className="rounded-xl border border-[#dce8eb] px-4 py-2.5 text-sm font-semibold text-[#58727c]">Cancelar</button></div></div>}
    </div>
    <div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${permission.enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{permission.enabled ? 'Activo' : 'Desactivado'}</span><button type="button" disabled={saving} onClick={() => setEditing((current) => !current)} className="rounded-lg border border-[#dce8eb] px-3 py-2 text-xs font-semibold text-[#58727c] hover:bg-[#f7fbfa]">{editing ? 'Cerrar edición' : 'Editar vigencia'}</button><button type="button" disabled={saving} onClick={() => onSave({ enabled: !permission.enabled })} className="rounded-lg border border-[#dce8eb] px-3 py-2 text-xs font-semibold text-[#58727c] hover:bg-[#f7fbfa]">{permission.enabled ? 'Desactivar' : 'Activar'}</button></div>
  </li>
}
