'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import { Cpu, CreditCard, Key, LoaderCircle, Radio, RefreshCw, ShieldCheck, Trash2, UserRound } from 'lucide-react'
import { api, type ApiPerson, type ApiRoom } from '@/lib/api'
import { userFacingClientError } from '@/lib/user-facing-errors.mjs'
import { AdminFilterBar, AdminField, AdminStatusBadge, adminInputClass } from '@/components/admin-ui'

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
  const { data: lastScannedCard, mutate: mutateLastScanned } = useSWR('rfid-last-scanned', api.lastScannedCard, { refreshInterval: 2500 })
  const { data: doorPermsData, mutate: mutateDoorPerms } = useSWR('door-permissions', () => api.doorPermissions())
  const { data: employeesData } = useSWR('employees-list', api.employees)

  const [saving, setSaving] = useState(false)
  const [savingDoor, setSavingDoor] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [search, setSearch] = useState('')
  const [filterRoom, setFilterRoom] = useState('')
  const [filterStatus, setFilterStatus] = useState('ALL')

  // IoT Door Permission Form State
  const [rfidUidInput, setRfidUidInput] = useState('')
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('')
  const [selectedDoorId, setSelectedDoorId] = useState('entrada-principal')

  const people = recordsFrom(peopleData) as unknown as ApiPerson[]
  const rooms = Array.isArray(roomsData) ? roomsData : []
  const permissions = recordsFrom(permissionData) as unknown as Permission[]
<<<<<<< HEAD
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
=======
  const doorPermissions = Array.isArray(doorPermsData) ? doorPermsData : []
  const employees = Array.isArray(employeesData) ? employeesData : []

  const visiblePermissions = personId ? permissions.filter((permission) => permission.user_id === personId) : permissions
>>>>>>> 5d87d37 (Conexion con backend, nuevos endpoints y eliminacion de datos estaticos)
  const selectedPerson = people.find((person) => person.id === personId)
  const loading = peopleLoading || roomsLoading || permissionsLoading
  const loadError = peopleError || roomsError || permissionError

  const assignDoorPermission = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!rfidUidInput.trim() || !selectedEmployeeId) {
      setErrorMessage('Selecciona un empleado e ingresa o detecta un UID de tarjeta RFID.')
      return
    }
    setSavingDoor(true)
    setErrorMessage('')
    setSuccessMessage('')
    try {
      try {
        await api.createRfidTag({
          uid: rfidUidInput.trim(),
          employee_id: Number(selectedEmployeeId),
          isActive: true,
        })
      } catch {
        // Ignorar si el tag ya existía previamente
      }

      await api.createDoorPermission({
        rfid_uid: rfidUidInput.trim(),
        door_id: selectedDoorId.trim(),
        employee_id: Number(selectedEmployeeId),
        is_active: true,
      })
      await mutateDoorPerms()
      await mutateLastScanned()
      setSuccessMessage(`Tarjeta ${rfidUidInput.trim()} vinculada a empleado y autorizada para la puerta "${selectedDoorId.trim()}".`)
      setRfidUidInput('')
    } catch (cause) {
      setErrorMessage(cause instanceof Error ? cause.message : 'No se pudo otorgar el permiso de puerta.')
    } finally {
      setSavingDoor(false)
    }
  }

  const removeDoorPermission = async (permId: number) => {
    setSavingDoor(true)
    try {
      await api.deleteDoorPermission(permId)
      await mutateDoorPerms()
      setSuccessMessage('Permiso de puerta física revocado exitosamente.')
    } catch (cause) {
      setErrorMessage(cause instanceof Error ? cause.message : 'No se pudo eliminar el permiso.')
    } finally {
      setSavingDoor(false)
    }
  }

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
      setSuccessMessage('Permiso actualizado.')
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

  return <div className="flex flex-col gap-6">
    <header><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#087f7b]">Administración · control de acceso</p><h1 className="mt-1 text-3xl font-semibold tracking-tight text-[#163542]">Permisos por cuarto</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[#718995]">Crea y administra permisos de personas con vigencia y estado, usando los endpoints reales de FastAPI.</p>{personId && <p className="mt-2 text-sm font-medium text-[#58727c]">Persona: {selectedPerson?.full_name || `#${personId}`}</p>}</header>

    {errorMessage && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{errorMessage}</div>}
    {successMessage && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{successMessage}</div>}

<<<<<<< HEAD
    <section className="rounded-2xl border border-[#e5edf0] bg-white p-5 shadow-[0_8px_24px_rgba(18,49,66,0.04)] sm:p-6">
      <div className="mb-5 flex items-center gap-3"><div className="flex size-10 items-center justify-center rounded-xl bg-[#eff8f7] text-[#087f7b]"><ShieldCheck className="size-5" /></div><div><h2 className="font-semibold text-[#163542]">Nuevo permiso</h2><p className="text-xs text-[#82969d]">Los límites de vigencia son opcionales.</p></div></div>
      {loadError && <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">No se pudieron cargar las opciones: {userFacingClientError(loadError)}</div>}
      {personId && !selectedPerson && !peopleLoading && <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">No se encontró esta persona en la respuesta de FastAPI.</div>}
      <form onSubmit={createPermission} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {!personId && <label className="flex flex-col gap-2 text-sm font-medium text-[#29434e]">Persona<select className={fieldClass} required name="user_id" defaultValue="" disabled={peopleLoading || Boolean(peopleError)}><option value="" disabled>Seleccionar persona</option>{people.map((person) => <option key={person.id} value={person.id}>{person.full_name || person.email || `Persona #${person.id}`}{person.status === 'INACTIVE' ? ' · inactiva' : ''}</option>)}</select></label>}
        <label className="flex flex-col gap-2 text-sm font-medium text-[#29434e]">Cuarto<select className={fieldClass} required name="cleanroom_id" defaultValue="" disabled={roomsLoading || Boolean(roomsError)}><option value="" disabled>Seleccionar cuarto</option>{rooms.map((room) => <option key={room.id} value={room.id}>{room.name} · {room.code}</option>)}</select></label>
        <label className="flex flex-col gap-2 text-sm font-medium text-[#29434e]">Válido desde<input className={fieldClass} type="datetime-local" name="valid_from" /></label>
        <label className="flex flex-col gap-2 text-sm font-medium text-[#29434e]">Válido hasta<input className={fieldClass} type="datetime-local" name="valid_until" /></label>
        <div className="flex items-end"><button disabled={saving || loading || (personId !== undefined && !selectedPerson)} className={buttonClass}>{saving && <LoaderCircle className="size-4 animate-spin" />}Crear permiso</button></div>
=======
    {/* Asistente de lectura de tarjetas */}
    <section className="rounded-2xl border-2 border-[#087f7b]/30 bg-[#eff8f7]/70 p-5 shadow-sm dark:border-[#2dd4bf]/30 dark:bg-[#13313b]/40">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[#087f7b] text-white shadow-md">
            <CreditCard className="size-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-[#102d3b] dark:text-[#e6f0f2]">
                Lectura de tarjeta reciente
              </h2>
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300">
                Lector conectado
              </span>
            </div>
            <p className="mt-0.5 text-xs text-[#58727c] dark:text-[#94adb8]">
              {lastScannedCard?.uid ? (
                <span>
                  Tarjeta detectada en <strong>{lastScannedCard.door_id || 'entrada-principal'}</strong>: <code className="rounded bg-black/10 px-1.5 py-0.5 font-mono font-bold dark:bg-white/10">{lastScannedCard.uid}</code> ({lastScannedCard.authorized ? 'Acceso concedido' : 'Tarjeta no registrada'})
                </span>
              ) : (
                'Pasa una tarjeta por el lector para detectarla automáticamente y autorizar su acceso.'
              )}
            </p>
          </div>
        </div>

        {lastScannedCard?.uid && (
          <button
            type="button"
            onClick={() => setRfidUidInput(lastScannedCard.uid ?? '')}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#087f7b] px-4 py-2.5 text-xs font-bold text-white shadow transition hover:bg-[#066c69]"
          >
            <CreditCard className="size-4" />
            Asignar tarjeta: {lastScannedCard.uid}
          </button>
        )}
      </div>

      {/* Formulario para autorizar acceso */}
      <form onSubmit={assignDoorPermission} className="mt-5 grid gap-3 border-t border-[#087f7b]/15 pt-4 sm:grid-cols-4 dark:border-[#2dd4bf]/20">
        <label className="flex flex-col gap-1.5 text-xs font-semibold text-[#29434e] dark:text-[#e6f0f2]">
          Empleado
          <select
            value={selectedEmployeeId}
            onChange={(e) => setSelectedEmployeeId(e.target.value)}
            required
            className={fieldClass}
          >
            <option value="">Selecciona un empleado…</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.firstName} {emp.lastName} ({emp.department})
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5 text-xs font-semibold text-[#29434e] dark:text-[#e6f0f2]">
          Código UID de tarjeta
          <input
            value={rfidUidInput}
            onChange={(e) => setRfidUidInput(e.target.value)}
            placeholder="Ej: A1B2C3D4 o CARD-01"
            required
            className={fieldClass}
          />
        </label>

        <label className="flex flex-col gap-1.5 text-xs font-semibold text-[#29434e] dark:text-[#e6f0f2]">
          Puerta
          <input
            value={selectedDoorId}
            onChange={(e) => setSelectedDoorId(e.target.value)}
            required
            className={fieldClass}
          />
        </label>

        <div className="flex items-end">
          <button
            type="submit"
            disabled={savingDoor}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#087f7b] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#066c69] disabled:opacity-60 shadow"
          >
            {savingDoor && <LoaderCircle className="size-3.5 animate-spin" />}
            Autorizar acceso
          </button>
        </div>
>>>>>>> 5d87d37 (Conexion con backend, nuevos endpoints y eliminacion de datos estaticos)
      </form>

      {/* Lista de personal con acceso autorizado */}
      <div className="mt-4 overflow-hidden rounded-xl border border-[#dce8eb] bg-white text-xs dark:border-[#1e3340] dark:bg-[#101e26]">
        <div className="flex items-center justify-between border-b border-[#edf2f3] px-3.5 py-2.5 font-semibold text-[#163542] dark:border-[#1e3340] dark:text-[#e6f0f2]">
          <span>Personal con acceso autorizado ({doorPermissions.length})</span>
          <button
            type="button"
            onClick={() => void mutateDoorPerms()}
            className="text-[11px] text-[#087f7b] hover:underline dark:text-[#2dd4bf]"
          >
            Recargar
          </button>
        </div>
        {doorPermissions.length === 0 ? (
          <p className="p-4 text-center text-xs text-[#82969d]">No hay permisos asignados para esta puerta.</p>
        ) : (
          <ul className="divide-y divide-[#edf2f3] dark:divide-[#1e3340] max-h-56 overflow-y-auto">
            {doorPermissions.map((dp) => (
              <li key={dp.id} className="flex items-center justify-between px-3.5 py-2.5">
                <div className="flex items-center gap-3">
                  <div className="flex size-7 items-center justify-center rounded-lg bg-[#eff8f7] text-[#087f7b] dark:bg-[#13313b] dark:text-[#2dd4bf]">
                    <UserRound className="size-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-[#163542] dark:text-[#e6f0f2]">
                        {dp.employee_name || 'Tarjeta registrada'}
                      </span>
                      {dp.department && (
                        <span className="text-[11px] text-[#82969d] dark:text-[#94adb8]">
                          ({dp.department})
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-[#718995] dark:text-[#94adb8]">
                      <span>Tarjeta: <code className="font-mono font-bold text-[#163542] dark:text-[#e6f0f2]">{dp.rfid_uid}</code></span>
                      <span>•</span>
                      <span>Puerta: {dp.door_id}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${dp.is_active ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300' : 'bg-slate-100 text-slate-600'}`}>
                    {dp.is_active ? 'Activa' : 'Inactiva'}
                  </span>
                  <button
                    type="button"
                    onClick={() => void removeDoorPermission(dp.id)}
                    className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded"
                    title="Revocar permiso"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>

<<<<<<< HEAD
    <section className="overflow-hidden rounded-2xl border border-[#e5edf0] bg-white shadow-[0_8px_24px_rgba(18,49,66,0.04)]">
      <div className="flex items-center justify-between border-b border-[#edf2f3] px-5 py-4"><div><h2 className="font-semibold text-[#163542]">Permisos registrados</h2><p className="mt-1 text-xs text-[#82969d]">{visiblePermissions.length} resultados</p></div><button type="button" aria-label="Actualizar permisos" onClick={() => void Promise.all([mutatePermissions(), mutatePeople(), mutateRooms()])} className="rounded-lg p-2 text-[#58727c] hover:bg-[#f3f8f8]"><RefreshCw className="size-4" /></button></div>
      <AdminFilterBar className="m-4">
        <AdminField label="Buscar persona o cuarto" className="min-w-[14rem] flex-1"><input className={adminInputClass} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nombre, correo, código…" /></AdminField>
        {!personId && <AdminField label="Cuarto" className="sm:min-w-52"><select className={adminInputClass} value={filterRoom} onChange={(event) => setFilterRoom(event.target.value)}><option value="">Todos los cuartos</option>{rooms.map((room) => <option key={room.id} value={room.id}>{room.code} · {room.name}</option>)}</select></AdminField>}
        <AdminField label="Vigencia y estado" className="sm:min-w-48"><select className={adminInputClass} value={filterStatus} onChange={(event) => setFilterStatus(event.target.value)}><option value="ALL">Todos</option><option value="ACTIVE">Vigente y activo</option><option value="SCHEDULED">Programado</option><option value="EXPIRED">Vencido</option><option value="INACTIVE">Deshabilitado</option></select></AdminField>
      </AdminFilterBar>
      {loading ? <div className="p-8 text-center text-sm text-[#82969d]">Consultando permisos…</div> : loadError ? <div className="p-8 text-center text-sm text-red-700">No se pudo consultar la lista.</div> : visiblePermissions.length === 0 ? <div className="p-8 text-center"><p className="font-medium text-[#29434e]">No hay permisos registrados</p><p className="mt-1 text-sm text-[#82969d]">Crea el primero con el formulario anterior.</p></div> : <ul className="divide-y divide-[#edf2f3]">{visiblePermissions.map((permission) => <PermissionRow key={permission.id} permission={permission} personName={personName(permission.user_id)} roomName={roomName(permission.cleanroom_id)} saving={saving} onSave={(patch) => void updatePermission(permission.id, patch)} />)}</ul>}
    </section>
    <Link href="/admin/personas" className="w-fit text-sm font-semibold text-[#087f7b] hover:underline">Volver a personas</Link>
=======
    {personId && (
      <>
        <section className="rounded-2xl border border-[#e5edf0] bg-white p-5 shadow-[0_8px_24px_rgba(18,49,66,0.04)] sm:p-6 dark:border-[#1e3340] dark:bg-[#101e26]">
          <div className="mb-5 flex items-center gap-3"><div className="flex size-10 items-center justify-center rounded-xl bg-[#eff8f7] text-[#087f7b]"><ShieldCheck className="size-5" /></div><div><h2 className="font-semibold text-[#163542]">Vigencia por cuarto</h2><p className="text-xs text-[#82969d]">Los límites de vigencia son opcionales.</p></div></div>
          {loadError && <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">No se pudieron cargar las opciones: {loadError instanceof Error ? loadError.message : 'Error de API.'}</div>}
          {!selectedPerson && !peopleLoading && <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">No se encontró esta persona en la respuesta de FastAPI.</div>}
          <form onSubmit={createPermission} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <label className="flex flex-col gap-2 text-sm font-medium text-[#29434e]">Cuarto<select className={fieldClass} required name="cleanroom_id" defaultValue="" disabled={roomsLoading || Boolean(roomsError)}><option value="" disabled>Seleccionar cuarto</option>{rooms.map((room) => <option key={room.id} value={room.id}>{room.name} · {room.code}</option>)}</select></label>
            <label className="flex flex-col gap-2 text-sm font-medium text-[#29434e]">Válido desde<input className={fieldClass} type="datetime-local" name="valid_from" /></label>
            <label className="flex flex-col gap-2 text-sm font-medium text-[#29434e]">Válido hasta<input className={fieldClass} type="datetime-local" name="valid_until" /></label>
            <div className="flex items-end"><button disabled={saving || loading || !selectedPerson} className={buttonClass}>{saving && <LoaderCircle className="size-4 animate-spin" />}Guardar vigencia</button></div>
          </form>
        </section>

        <section className="overflow-hidden rounded-2xl border border-[#e5edf0] bg-white shadow-[0_8px_24px_rgba(18,49,66,0.04)] dark:border-[#1e3340] dark:bg-[#101e26]">
          <div className="flex items-center justify-between border-b border-[#edf2f3] px-5 py-4"><div><h2 className="font-semibold text-[#163542]">Vigencias registradas</h2><p className="mt-1 text-xs text-[#82969d]">{visiblePermissions.length} resultados</p></div><button type="button" aria-label="Actualizar vigencias" onClick={() => void Promise.all([mutatePermissions(), mutatePeople(), mutateRooms()])} className="rounded-lg p-2 text-[#58727c] hover:bg-[#f3f8f8]"><RefreshCw className="size-4" /></button></div>
          {loading ? <div className="p-8 text-center text-sm text-[#82969d]">Consultando vigencias…</div> : loadError ? <div className="p-8 text-center text-sm text-red-700">No se pudo consultar la lista.</div> : visiblePermissions.length === 0 ? <div className="p-8 text-center"><p className="font-medium text-[#29434e]">No hay vigencias registradas</p><p className="mt-1 text-sm text-[#82969d]">Crea la primera con el formulario anterior.</p></div> : <ul className="divide-y divide-[#edf2f3]">{visiblePermissions.map((permission) => <PermissionRow key={permission.id} permission={permission} personName={personName(permission.user_id)} roomName={roomName(permission.cleanroom_id)} saving={saving} onSave={(patch) => void updatePermission(permission.id, patch)} />)}</ul>}
        </section>
      </>
    )}
    <Link href="/admin/personas" className="w-fit text-sm font-semibold text-[#087f7b] hover:underline">Volver a personal autorizado</Link>
>>>>>>> 5d87d37 (Conexion con backend, nuevos endpoints y eliminacion de datos estaticos)
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
    <div className="flex flex-wrap items-center gap-2"><AdminStatusBadge value={!permission.enabled ? 'INACTIVE' : permission.valid_until && new Date(permission.valid_until) <= new Date() ? 'EXPIRED' : permission.valid_from && new Date(permission.valid_from) > new Date() ? 'SCHEDULED' : 'ACTIVE'} /><button type="button" disabled={saving} onClick={() => setEditing((current) => !current)} className="rounded-lg border border-[#dce8eb] px-3 py-2 text-xs font-semibold text-[#58727c] hover:bg-[#f7fbfa]">{editing ? 'Cerrar edición' : 'Editar vigencia'}</button><button type="button" disabled={saving} onClick={() => onSave({ enabled: !permission.enabled })} className="rounded-lg border border-[#dce8eb] px-3 py-2 text-xs font-semibold text-[#58727c] hover:bg-[#f7fbfa]">{permission.enabled ? 'Desactivar' : 'Activar'}</button></div>
  </li>
}
