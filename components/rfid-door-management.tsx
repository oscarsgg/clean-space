'use client'

import { useEffect, useState, type FormEvent } from 'react'
import useSWR from 'swr'
import { CreditCard, LoaderCircle, RefreshCw, Trash2 } from 'lucide-react'
import { api } from '@/lib/api'

export function RfidDoorManagement() {
  const { data: employeesData, mutate: mutateEmployees } = useSWR('rfid-employees', api.employees)
  const { data: roomsData } = useSWR('rfid-rooms', api.rooms)
  const { data: permissionsData, mutate } = useSWR('rfid-door-permissions', () => api.doorPermissions())
  const { data: lastScanned } = useSWR('rfid-last-scanned', api.lastScannedCard, { refreshInterval: 2500 })
  const [uid, setUid] = useState('')
  const [employeeId, setEmployeeId] = useState('')
  const [doorId, setDoorId] = useState('entrada-principal')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [newEmployee, setNewEmployee] = useState({ firstName: '', lastName: '', department: '' })
  const employees = Array.isArray(employeesData) ? employeesData : []
  const permissions = Array.isArray(permissionsData) ? permissionsData : []
  const rooms = Array.isArray(roomsData) ? roomsData : []

  useEffect(() => {
    if (doorId === 'entrada-principal' && !rooms.some((room) => room.id === 1) && rooms[0]) {
      setDoorId(`puerta-${rooms[0].code.toLowerCase()}`)
    }
  }, [doorId, rooms])

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setMessage('')
    try {
      await api.createDoorPermission({ rfid_uid: uid.trim(), employee_id: Number(employeeId), door_id: doorId.trim() })
      await mutate()
      setUid('')
      setMessage('Tarjeta vinculada y permiso de puerta guardado.')
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'No se pudo guardar el permiso RFID.')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: number) => {
    setSaving(true)
    setMessage('')
    try {
      await api.deleteDoorPermission(id)
      await mutate()
      setMessage('Permiso de puerta eliminado.')
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'No se pudo eliminar el permiso.')
    } finally {
      setSaving(false)
    }
  }

  const addEmployee = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setMessage('')
    try {
      const employee = await api.createEmployee(newEmployee)
      await mutateEmployees()
      setEmployeeId(String(employee.id))
      setNewEmployee({ firstName: '', lastName: '', department: '' })
      setMessage('Personal agregado. Ahora puedes vincular su tarjeta.')
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'No se pudo agregar al personal.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--admin-panel-shadow)]">
      <div className="flex items-start gap-3 border-b border-border bg-muted/40 px-5 py-4 sm:px-6">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground"><CreditCard className="size-5" /></span>
        <div><h2 className="font-semibold text-foreground">Tarjetas RFID y puertas</h2><p className="mt-1 text-sm text-muted-foreground">Vincula una tarjeta leída con personal autorizado y habilita una puerta.</p></div>
        <button type="button" aria-label="Actualizar permisos RFID" onClick={() => void mutate()} className="ml-auto rounded-lg p-2 text-muted-foreground hover:bg-muted"><RefreshCw className="size-4" /></button>
      </div>
      <div className="p-5 sm:p-6">
        <form onSubmit={(event) => void submit(event)} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <label className="flex flex-col gap-2 text-xs font-semibold text-foreground">UID de tarjeta
            <div className="flex gap-2"><input required value={uid} onChange={(event) => setUid(event.target.value)} className="min-h-11 min-w-0 flex-1 rounded-xl border border-border bg-background px-3 text-sm" placeholder="Acerca una tarjeta o escribe UID" /><button type="button" disabled={!lastScanned?.uid} onClick={() => setUid(lastScanned?.uid ?? '')} className="rounded-xl border border-border px-3 text-xs">Usar última lectura</button></div>
          </label>
          <label className="flex flex-col gap-2 text-xs font-semibold text-foreground">Personal
            <select required value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} className="min-h-11 rounded-xl border border-border bg-background px-3 text-sm"><option value="">Selecciona persona</option>{employees.filter((employee) => employee.isActive).map((employee) => <option key={employee.id} value={employee.id}>{employee.firstName} {employee.lastName}</option>)}</select>
          </label>
          <label className="flex flex-col gap-2 text-xs font-semibold text-foreground">Puerta
            <select required value={doorId} onChange={(event) => setDoorId(event.target.value)} className="min-h-11 rounded-xl border border-border bg-background px-3 text-sm">{rooms.map((room) => <option key={room.id} value={room.id === 1 ? 'entrada-principal' : `puerta-${room.code.toLowerCase()}`}>{room.name} · {room.code}</option>)}</select>
          </label>
          <button type="submit" disabled={saving || !uid.trim() || !employeeId || !doorId.trim()} className="mt-auto inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60">{saving && <LoaderCircle className="size-4 animate-spin" />}Vincular y autorizar</button>
        </form>
        <details className="mt-4 rounded-xl border border-border bg-muted/25 p-4"><summary className="cursor-pointer text-sm font-semibold text-foreground">Agregar personal al directorio RFID</summary><form onSubmit={(event) => void addEmployee(event)} className="mt-3 grid gap-3 sm:grid-cols-4"><input required aria-label="Nombre" value={newEmployee.firstName} onChange={(event) => setNewEmployee((value) => ({ ...value, firstName: event.target.value }))} className="min-h-10 rounded-lg border border-border bg-background px-3 text-sm" placeholder="Nombre" /><input required aria-label="Apellido" value={newEmployee.lastName} onChange={(event) => setNewEmployee((value) => ({ ...value, lastName: event.target.value }))} className="min-h-10 rounded-lg border border-border bg-background px-3 text-sm" placeholder="Apellido" /><input required aria-label="Departamento" value={newEmployee.department} onChange={(event) => setNewEmployee((value) => ({ ...value, department: event.target.value }))} className="min-h-10 rounded-lg border border-border bg-background px-3 text-sm" placeholder="Departamento" /><button disabled={saving} className="min-h-10 rounded-lg bg-secondary px-3 text-sm font-semibold text-secondary-foreground disabled:opacity-60">Agregar personal</button></form></details>
        {lastScanned?.scanned_at && <p className="mt-3 text-xs text-muted-foreground">Última lectura: <span className="font-mono">{lastScanned.uid ?? '—'}</span> · {lastScanned.authorized ? 'autorizada' : 'sin autorizar'}</p>}
        {message && <p role="status" className="mt-3 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">{message}</p>}
        <div className="mt-5 border-t border-border pt-4">
          <h3 className="text-sm font-semibold text-foreground">Permisos registrados ({permissions.length})</h3>
          {permissions.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">Todavía no hay tarjetas autorizadas para puertas.</p> : <ul className="mt-2 divide-y divide-border">{permissions.map((permission) => <li key={permission.id} className="flex flex-wrap items-center gap-2 py-3 text-sm"><span className="font-semibold text-foreground">{permission.employee_name ?? 'Personal sin asociar'}</span><span className="font-mono text-xs text-muted-foreground">{permission.rfid_uid}</span><span className="rounded-full bg-muted px-2 py-1 text-xs text-foreground">{permission.door_id}</span><span className={`text-xs ${permission.is_active ? 'text-emerald-700' : 'text-muted-foreground'}`}>{permission.is_active ? 'Activo' : 'Inactivo'}</span><button type="button" disabled={saving} aria-label={`Eliminar permiso de ${permission.rfid_uid}`} onClick={() => void remove(permission.id)} className="ml-auto rounded-lg p-2 text-muted-foreground hover:bg-muted disabled:opacity-50"><Trash2 className="size-4" /></button></li>)}</ul>}
        </div>
      </div>
    </section>
  )
}
