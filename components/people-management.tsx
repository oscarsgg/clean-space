'use client'

import Link from 'next/link'
import { useMemo, useState, type FormEvent } from 'react'
import useSWR from 'swr'
import {
  CreditCard,
  DoorOpen,
  Key,
  LoaderCircle,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserPlus,
  UserRound,
  X,
} from 'lucide-react'
import { api, type ApiPerson } from '@/lib/api'
import { userFacingClientError } from '@/lib/user-facing-errors.mjs'
import { AdminKpi, AdminPageHeader, AdminStatusBadge } from '@/components/admin-ui'

type RoleOption = { code: string; name: string }

const inputClass =
  'w-full rounded-xl border border-[#dce8eb] bg-white px-3.5 py-2.5 text-sm text-[#163542] outline-none transition-all placeholder:text-[#94adb8] focus:border-[#087f7b] focus:ring-4 focus:ring-[#087f7b]/10 dark:border-[#233a47] dark:bg-[#13222b] dark:text-[#e6f0f2]'
const buttonPrimaryClass =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-[#087f7b] px-4 py-2.5 text-sm font-semibold text-white shadow transition hover:bg-[#066c69] disabled:opacity-60 dark:bg-[#0d9488] dark:hover:bg-[#0f766e]'

function listFrom(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    for (const key of ['items', 'data', 'results']) {
      if (Array.isArray(record[key])) return listFrom(record[key])
    }
  }
  return []
}

function roleCodes(person: ApiPerson): string[] {
  const raw = (person as Record<string, unknown>).roles ?? (person as Record<string, unknown>).role_codes
  if (!Array.isArray(raw)) return []
  return raw
    .map((role) =>
      typeof role === 'string'
        ? role
        : role && typeof role === 'object'
          ? String((role as Record<string, unknown>).code ?? '')
          : ''
    )
    .filter(Boolean)
}

export function PeopleManagement() {
  const [activeTab, setActiveTab] = useState<'workers' | 'system'>('workers')

  // Data for Trabajadores (Personal Autorizado)
  const {
    data: employeesData,
    error: employeesError,
    isLoading: employeesLoading,
    mutate: mutateEmployees,
  } = useSWR('employees-list', api.employees)
  const { data: rfidTagsData, mutate: mutateRfidTags } = useSWR('rfid-tags-list', api.rfidTags)
  const { data: doorPermsData, mutate: mutateDoorPerms } = useSWR('door-permissions-list', () => api.doorPermissions())
  const { data: lastScannedCard } = useSWR('rfid-last-scanned', api.lastScannedCard, { refreshInterval: 2500 })

  // Data for Cuentas del Sistema (Admins & Supervisores)
  const {
    data: peopleData,
    error: peopleError,
    isLoading: peopleLoading,
    mutate: mutatePeople,
  } = useSWR('admin-people', () => api.people('?page=1&size=100'))
  const { data: roleData } = useSWR('admin-roles', api.roles)

  const [query, setQuery] = useState('')
<<<<<<< HEAD
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [busyId, setBusyId] = useState<number | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const people = listFrom(data) as unknown as ApiPerson[]
  const roles = listFrom(roleData) as unknown as RoleOption[]
  const filtered = useMemo(() => people.filter((person) => `${person.full_name ?? ''} ${person.email ?? ''} ${roleCodes(person).join(' ')}`.toLowerCase().includes(query.toLowerCase()) && (statusFilter === 'ALL' || person.status === statusFilter)), [people, query, statusFilter])
  const activeCount = people.filter((person) => person.status === 'ACTIVE').length
=======
  const [showAddWorker, setShowAddWorker] = useState(true)
  const [savingWorker, setSavingWorker] = useState(false)
  const [busyWorkerId, setBusyWorkerId] = useState<number | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
>>>>>>> 5d87d37 (Conexion con backend, nuevos endpoints y eliminacion de datos estaticos)

  // Form state for adding a new worker
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [department, setDepartment] = useState('')
  const [cardUid, setCardUid] = useState('')
  const [doorId, setDoorId] = useState('entrada-principal')

  // Quick card assignment modal state
  const [assigningWorker, setAssigningWorker] = useState<{ id: number; name: string } | null>(null)
  const [assignCardUid, setAssignCardUid] = useState('')
  const [assignDoorId, setAssignDoorId] = useState('entrada-principal')

  const employees = Array.isArray(employeesData) ? employeesData : []
  const rfidTags = Array.isArray(rfidTagsData) ? rfidTagsData : []
  const doorPermissions = Array.isArray(doorPermsData) ? doorPermsData : []

  const systemPeople = listFrom(peopleData) as unknown as ApiPerson[]
  const systemRoles = listFrom(roleData) as unknown as RoleOption[]

  // Map employee tags and door access
  const tagsByEmployee = useMemo(() => {
    const map = new Map<number, string[]>()
    for (const tag of rfidTags) {
      if (tag.employee_id && tag.isActive) {
        const list = map.get(tag.employee_id) ?? []
        list.push(tag.uid)
        map.set(tag.employee_id, list)
      }
    }
    return map
  }, [rfidTags])

  const doorsByEmployee = useMemo(() => {
    const map = new Map<number, string[]>()
    for (const perm of doorPermissions) {
      if (perm.employee_id && perm.is_active) {
        const list = map.get(perm.employee_id) ?? []
        if (!list.includes(perm.door_id)) list.push(perm.door_id)
        map.set(perm.employee_id, list)
      }
    }
    return map
  }, [doorPermissions])

  // Filtered lists
  const filteredEmployees = useMemo(() => {
    const term = query.trim().toLowerCase()
    return employees.filter((emp) => {
      const uids = tagsByEmployee.get(emp.id)?.join(' ') ?? ''
      const text = `${emp.firstName} ${emp.lastName} ${emp.department} ${uids}`.toLowerCase()
      return text.includes(term)
    })
  }, [employees, query, tagsByEmployee])

  const filteredSystem = useMemo(() => {
    const term = query.trim().toLowerCase()
    return systemPeople.filter((person) => {
      const text = `${person.full_name ?? ''} ${person.email ?? ''} ${roleCodes(person).join(' ')}`.toLowerCase()
      return text.includes(term)
    })
  }, [systemPeople, query])

  // Add Worker Handler
  const handleCreateWorker = async (event: FormEvent) => {
    event.preventDefault()
    if (!firstName.trim() || !lastName.trim() || !department.trim()) {
      setErrorMessage('Por favor ingresa nombre, apellidos y departamento.')
      return
    }
    setSavingWorker(true)
    setErrorMessage('')
    setSuccessMessage('')

    try {
      const created = await api.createEmployee({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        department: department.trim(),
        isActive: true,
      })

      if (cardUid.trim()) {
        const cleanUid = cardUid.trim().toUpperCase().replace(/\s+/g, '')
        try {
          await api.createRfidTag({
            uid: cleanUid,
            employee_id: created.id,
            isActive: true,
          })
        } catch {
          // Tag could already exist, proceed to link and authorize
        }

        try {
          await api.createDoorPermission({
            rfid_uid: cleanUid,
            door_id: doorId.trim() || 'entrada-principal',
            employee_id: created.id,
            is_active: true,
          })
        } catch {
          // If permission fails, continue
        }
      }

      await Promise.all([mutateEmployees(), mutateRfidTags(), mutateDoorPerms()])
      setSuccessMessage(`Trabajador "${firstName.trim()} ${lastName.trim()}" registrado y autorizado correctamente.`)
      setFirstName('')
      setLastName('')
      setDepartment('')
      setCardUid('')
      setShowAddWorker(false)
    } catch (cause) {
      setErrorMessage(cause instanceof Error ? cause.message : 'No se pudo registrar la persona.')
    } finally {
      setSavingWorker(false)
    }
  }

  // Quick Card Assignment Handler
  const handleAssignCard = async (event: FormEvent) => {
    event.preventDefault()
    if (!assigningWorker || !assignCardUid.trim()) return
    setSavingWorker(true)
    setErrorMessage('')
    setSuccessMessage('')

    try {
      const cleanUid = assignCardUid.trim()
      try {
        await api.createRfidTag({
          uid: cleanUid,
          employee_id: assigningWorker.id,
          isActive: true,
        })
      } catch {
        // Tag exists, permission endpoint will link it
      }

      await api.createDoorPermission({
        rfid_uid: cleanUid,
        door_id: assignDoorId.trim() || 'entrada-principal',
        employee_id: assigningWorker.id,
        is_active: true,
      })

      await Promise.all([mutateEmployees(), mutateRfidTags(), mutateDoorPerms()])
      setSuccessMessage(`Tarjeta ${cleanUid} asignada exitosamente a ${assigningWorker.name}.`)
      setAssigningWorker(null)
      setAssignCardUid('')
    } catch (cause) {
      setErrorMessage(cause instanceof Error ? cause.message : 'No se pudo asignar la tarjeta.')
    } finally {
      setSavingWorker(false)
    }
  }

  // Toggle Worker Active State
  const toggleWorkerStatus = async (emp: (typeof employees)[0]) => {
    setBusyWorkerId(emp.id)
    setErrorMessage('')
    setSuccessMessage('')
    try {
      await api.updateEmployee(emp.id, { isActive: !emp.isActive })
      await mutateEmployees()
      setSuccessMessage(`Estado de ${emp.firstName} ${emp.lastName} actualizado a ${!emp.isActive ? 'Activo' : 'Inactivo'}.`)
    } catch (cause) {
      setErrorMessage(cause instanceof Error ? cause.message : 'No se pudo actualizar el estado.')
    } finally {
      setBusyWorkerId(null)
    }
  }

  // Delete Worker
  const handleDeleteWorker = async (emp: (typeof employees)[0]) => {
    if (!window.confirm(`¿Seguro que deseas eliminar a ${emp.firstName} ${emp.lastName}? Sus permisos quedarán revocados.`)) {
      return
    }
    setBusyWorkerId(emp.id)
    setErrorMessage('')
    setSuccessMessage('')
    try {
      await api.deleteEmployee(emp.id)
      await Promise.all([mutateEmployees(), mutateRfidTags(), mutateDoorPerms()])
      setSuccessMessage(`Trabajador ${emp.firstName} ${emp.lastName} eliminado correctamente.`)
    } catch (cause) {
      setErrorMessage(cause instanceof Error ? cause.message : 'No se pudo eliminar el trabajador.')
    } finally {
      setBusyWorkerId(null)
    }
  }

  // Toggle System User Status
  const setSystemUserStatus = async (person: ApiPerson) => {
    const status = person.status === 'INACTIVE' ? 'ACTIVE' : 'INACTIVE'
<<<<<<< HEAD
    if (status === 'INACTIVE' && !window.confirm(`¿Desactivar la cuenta de ${person.full_name || person.email}?`)) return
    setBusyId(person.id)
=======
    setBusyWorkerId(person.id)
>>>>>>> 5d87d37 (Conexion con backend, nuevos endpoints y eliminacion de datos estaticos)
    setErrorMessage('')
    setSuccessMessage('')
    try {
      await api.updatePerson(person.id, { status })
      await mutatePeople()
      setSuccessMessage(`${person.full_name} ahora está ${status === 'ACTIVE' ? 'activa' : 'inactiva'}.`)
    } catch (cause) {
      setErrorMessage(userFacingClientError(cause))
    } finally {
      setBusyWorkerId(null)
    }
  }

<<<<<<< HEAD
  return <div className="flex flex-col gap-6">
    <AdminPageHeader eyebrow="Administración · identidad" title="Personas autorizadas" description="Consulta personas, roles y estado; administra vigencias desde la pantalla de permisos." actions={<Link href="/admin/personas/nueva" className="inline-flex min-h-11 items-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:-translate-y-px hover:brightness-95">Nueva persona</Link>} />
    <div className="grid gap-3 sm:grid-cols-3"><Summary label="Personas registradas" value={isLoading ? '—' : String(people.length)} /><Summary label="Activas" value={isLoading ? '—' : String(activeCount)} /><Summary label="Roles cargados" value={roles.length ? String(roles.length) : '—'} /></div>
    {errorMessage && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{errorMessage}</div>}{successMessage && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{successMessage}</div>}
    <section className="overflow-hidden rounded-2xl border border-[#e5edf0] bg-white shadow-[0_8px_24px_rgba(18,49,66,0.04)]"><div className="flex flex-col gap-3 border-b border-[#edf2f3] p-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-semibold text-[#163542]">Directorio</h2><p className="mt-1 text-xs text-[#82969d]">{filtered.length} resultados</p></div><div className="grid gap-2 sm:grid-cols-[minmax(12rem,1fr)_10rem_auto]"><label className="relative flex min-w-0 items-center"><Search aria-hidden="true" className="absolute left-3 size-4 text-[#82969d]" /><input aria-label="Buscar personas" className={`${inputClass} pl-9`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nombre, correo o rol" /></label><select aria-label="Filtrar personas por estado" className={inputClass} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="ALL">Todos los estados</option><option value="ACTIVE">Activas</option><option value="INACTIVE">Inactivas</option></select><button type="button" aria-label="Actualizar personas" onClick={() => void mutate()} className="rounded-lg p-2 text-[#58727c] hover:bg-[#f3f8f8]"><RefreshCw className="size-4" /></button></div></div>
      {isLoading ? <div className="p-10 text-center text-sm text-[#82969d]">Consultando personas…</div> : error ? <div role="alert" className="p-8 text-sm text-red-700">No se pudieron cargar personas: {userFacingClientError(error)}</div> : filtered.length === 0 ? <div className="p-10 text-center"><div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-[#eff8f7] text-[#087f7b]"><UserRound className="size-5" /></div><p className="mt-3 font-semibold text-[#29434e]">No hay personas para mostrar</p><p className="mt-1 text-sm text-[#82969d]">Cambia el filtro o registra una persona.</p></div> : <ul className="divide-y divide-[#edf2f3]">{filtered.map((person) => <PersonRow key={person.id} person={person} roles={roles} busy={busyId === person.id} onStatus={() => void setStatus(person)} />)}</ul>}
    </section>
  </div>
}

function PersonRow({ person, roles, busy, onStatus }: { person: ApiPerson; roles: RoleOption[]; busy: boolean; onStatus: () => void }) {
  const roleNames = roleCodes(person).map((code) => roles.find((role) => role.code === code)?.name ?? code)
  return <li className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center"><div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#eff8f7] text-[#087f7b]"><UserRound className="size-5" /></div><div className="min-w-0 flex-1"><p className="truncate font-semibold text-[#29434e]">{person.full_name}</p><p className="truncate text-sm text-[#82969d]">{person.email}</p><div className="mt-2 flex flex-wrap gap-1.5">{roleNames.length ? roleNames.map((name) => <span key={name} className="rounded-full bg-[#eff8f7] px-2.5 py-1 text-[11px] font-medium text-[#087f7b]">{name}</span>) : <span className="text-xs text-[#82969d]">Sin roles</span>}</div></div><AdminStatusBadge value={person.status} /><div className="flex flex-wrap gap-2"><Link href={`/admin/personas/${person.id}/permisos`} className="inline-flex items-center gap-1.5 rounded-lg border border-[#dce8eb] px-3 py-2 text-xs font-semibold text-[#58727c] hover:bg-[#f7fbfa]"><ShieldCheck className="size-3.5" />Permisos</Link><button type="button" disabled={busy} onClick={onStatus} className="rounded-lg border border-[#dce8eb] px-3 py-2 text-xs font-semibold text-[#58727c] hover:bg-[#f7fbfa] disabled:opacity-60">{busy ? <LoaderCircle className="size-4 animate-spin" /> : person.status === 'ACTIVE' ? 'Desactivar' : 'Activar'}</button></div></li>
}

function Summary({ label, value }: { label: string; value: string }) {
  return <AdminKpi label={label} value={value} detail="Directorio actual" icon={<UserRound aria-hidden="true" className="size-4" />} />
=======
  return (
    <div className="flex flex-col gap-6">
      {/* Encabezado */}
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#087f7b] dark:text-[#2dd4bf]">
            Administración · Identidad y Control de Acceso
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-[#163542] dark:text-[#e6f0f2]">
            Personas autorizadas
          </h1>
          <p className="mt-2 text-sm text-[#718995] dark:text-[#94adb8]">
            Gestiona a los trabajadores con acceso a cuartos limpios, asigna sus tarjetas y administra sus permisos.
          </p>
        </div>

        {activeTab === 'workers' ? (
          <button
            type="button"
            onClick={() => setShowAddWorker((prev) => !prev)}
            className={buttonPrimaryClass}
          >
            {showAddWorker ? <X className="size-4" /> : <UserPlus className="size-4" />}
            {showAddWorker ? 'Ocultar formulario' : 'Registrar nuevo trabajador'}
          </button>
        ) : (
          <Link href="/admin/personas/nueva" className={buttonPrimaryClass}>
            <Plus className="size-4" />
            Nueva cuenta de sistema
          </Link>
        )}
      </header>

      {/* Selector de Pestañas: Personal y Trabajadores vs Cuentas del Sistema */}
      <div className="flex border-b border-[#dce8eb] dark:border-[#233a47]">
        <button
          type="button"
          onClick={() => {
            setActiveTab('workers')
            setQuery('')
          }}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition ${
            activeTab === 'workers'
              ? 'border-[#087f7b] text-[#087f7b] dark:border-[#2dd4bf] dark:text-[#2dd4bf]'
              : 'border-transparent text-[#718995] hover:text-[#163542] dark:text-[#94adb8] dark:hover:text-[#e6f0f2]'
          }`}
        >
          <UserRound className="size-4" />
          Personal y trabajadores ({employees.length})
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTab('system')
            setQuery('')
          }}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition ${
            activeTab === 'system'
              ? 'border-[#087f7b] text-[#087f7b] dark:border-[#2dd4bf] dark:text-[#2dd4bf]'
              : 'border-transparent text-[#718995] hover:text-[#163542] dark:text-[#94adb8] dark:hover:text-[#e6f0f2]'
          }`}
        >
          <ShieldCheck className="size-4" />
          Cuentas del sistema (Admin y Supervisores) ({systemPeople.length})
        </button>
      </div>

      {/* Alertas de retroalimentación */}
      {errorMessage && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-300">
          {errorMessage}
        </div>
      )}
      {successMessage && (
        <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-300">
          {successMessage}
        </div>
      )}

      {/* PESTAÑA 1: PERSONAL AUTORIZADO (TRABAJADORES) */}
      {activeTab === 'workers' && (
        <div className="flex flex-col gap-6">
          {/* Formulario desplegable para agregar nuevo trabajador */}
          {showAddWorker && (
            <section className="rounded-2xl border-2 border-[#087f7b]/30 bg-[#eff8f7]/60 p-5 shadow-sm dark:border-[#2dd4bf]/30 dark:bg-[#13313b]/40">
              <div className="flex items-center justify-between border-b border-[#087f7b]/15 pb-3 dark:border-[#2dd4bf]/20">
                <div className="flex items-center gap-2">
                  <div className="flex size-9 items-center justify-center rounded-xl bg-[#087f7b] text-white">
                    <UserPlus className="size-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-[#163542] dark:text-[#e6f0f2]">
                      Registrar nuevo trabajador autorizado
                    </h2>
                    <p className="text-xs text-[#718995] dark:text-[#94adb8]">
                      Registra los datos del trabajador, vincula su tarjeta de acceso y autoriza la entrada al cuarto limpio.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddWorker(false)}
                  className="rounded-lg p-1 text-[#718995] hover:bg-black/5 dark:text-[#94adb8]"
                >
                  <X className="size-5" />
                </button>
              </div>

              <form onSubmit={handleCreateWorker} className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <label className="flex flex-col gap-1.5 text-xs font-semibold text-[#29434e] dark:text-[#e6f0f2]">
                  Nombre(s)
                  <input
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Ej: Carlos o Andrea"
                    className={inputClass}
                  />
                </label>

                <label className="flex flex-col gap-1.5 text-xs font-semibold text-[#29434e] dark:text-[#e6f0f2]">
                  Apellidos
                  <input
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Ej: Mendez Silva"
                    className={inputClass}
                  />
                </label>

                <label className="flex flex-col gap-1.5 text-xs font-semibold text-[#29434e] dark:text-[#e6f0f2]">
                  Área / Departamento
                  <input
                    required
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="Ej: Control de Calidad, Operaciones, etc."
                    className={inputClass}
                  />
                </label>

                <div className="flex flex-col gap-1.5 text-xs font-semibold text-[#29434e] sm:col-span-2 dark:text-[#e6f0f2]">
                  <div className="flex items-center justify-between">
                    <span>Código de tarjeta RFID (UID)</span>
                    {lastScannedCard?.uid && (
                      <button
                        type="button"
                        onClick={() => setCardUid(lastScannedCard.uid ?? '')}
                        className="text-[11px] font-semibold text-[#087f7b] hover:underline dark:text-[#2dd4bf]"
                      >
                        Usar tarjeta detectada: {lastScannedCard.uid}
                      </button>
                    )}
                  </div>
                  <input
                    value={cardUid}
                    onChange={(e) => setCardUid(e.target.value)}
                    placeholder="Ej: A1B2C3D4 o CARD-EMP-005"
                    className={inputClass}
                  />
                </div>

                <label className="flex flex-col gap-1.5 text-xs font-semibold text-[#29434e] dark:text-[#e6f0f2]">
                  Puerta de acceso
                  <input
                    value={doorId}
                    onChange={(e) => setDoorId(e.target.value)}
                    required
                    className={inputClass}
                  />
                </label>

                <div className="flex items-end sm:col-span-2 lg:col-span-3">
                  <button
                    type="submit"
                    disabled={savingWorker}
                    className={buttonPrimaryClass}
                  >
                    {savingWorker && <LoaderCircle className="size-4 animate-spin" />}
                    Guardar trabajador y autorizar acceso
                  </button>
                </div>
              </form>
            </section>
          )}

          {/* Modal rápido para asignar tarjeta a un trabajador existente */}
          {assigningWorker && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
              <div className="w-full max-w-md rounded-2xl border border-[#dce8eb] bg-white p-5 shadow-2xl dark:border-[#233a47] dark:bg-[#101e26]">
                <div className="flex items-center justify-between border-b border-[#edf2f3] pb-3 dark:border-[#1e3340]">
                  <h3 className="font-bold text-[#163542] dark:text-[#e6f0f2]">
                    Asignar tarjeta a {assigningWorker.name}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setAssigningWorker(null)}
                    className="p-1 text-[#82969d] hover:text-[#163542]"
                  >
                    <X className="size-5" />
                  </button>
                </div>

                <form onSubmit={handleAssignCard} className="mt-4 flex flex-col gap-4">
                  {lastScannedCard?.uid && (
                    <div className="flex items-center justify-between rounded-xl bg-[#eff8f7] p-2.5 text-xs dark:bg-[#13313b]">
                      <span className="text-[#58727c] dark:text-[#94adb8]">
                        Tarjeta en lector: <code className="font-mono font-bold text-[#163542] dark:text-[#e6f0f2]">{lastScannedCard.uid}</code>
                      </span>
                      <button
                        type="button"
                        onClick={() => setAssignCardUid(lastScannedCard.uid ?? '')}
                        className="rounded bg-[#087f7b] px-2 py-1 font-semibold text-white dark:bg-[#0d9488]"
                      >
                        Usar
                      </button>
                    </div>
                  )}

                  <label className="flex flex-col gap-1.5 text-xs font-semibold text-[#29434e] dark:text-[#e6f0f2]">
                    Código UID de la tarjeta
                    <input
                      required
                      value={assignCardUid}
                      onChange={(e) => setAssignCardUid(e.target.value)}
                      placeholder="Ej: A1B2C3D4"
                      className={inputClass}
                    />
                  </label>

                  <label className="flex flex-col gap-1.5 text-xs font-semibold text-[#29434e] dark:text-[#e6f0f2]">
                    Puerta autorizada
                    <input
                      required
                      value={assignDoorId}
                      onChange={(e) => setAssignDoorId(e.target.value)}
                      className={inputClass}
                    />
                  </label>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setAssigningWorker(null)}
                      className="rounded-xl border border-[#dce8eb] px-4 py-2 text-xs font-semibold text-[#58727c] dark:border-[#233a47] dark:text-[#94adb8]"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={savingWorker}
                      className={buttonPrimaryClass}
                    >
                      {savingWorker && <LoaderCircle className="size-3.5 animate-spin" />}
                      Asignar tarjeta
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Tabla de trabajadores */}
          <section className="overflow-hidden rounded-2xl border border-[#e5edf0] bg-white shadow-[0_8px_24px_rgba(18,49,66,0.04)] dark:border-[#1e3340] dark:bg-[#101e26]">
            <div className="flex flex-col gap-3 border-b border-[#edf2f3] p-4 sm:flex-row sm:items-center sm:justify-between dark:border-[#1e3340]">
              <div>
                <h2 className="font-semibold text-[#163542] dark:text-[#e6f0f2]">
                  Directorio de personal autorizado
                </h2>
                <p className="mt-0.5 text-xs text-[#82969d] dark:text-[#94adb8]">
                  {filteredEmployees.length} trabajadores registrados
                </p>
              </div>

              <div className="flex items-center gap-2">
                <label className="relative flex min-w-0 flex-1 items-center sm:w-64">
                  <Search className="absolute left-3 size-4 text-[#82969d]" />
                  <input
                    aria-label="Buscar personas"
                    className={`${inputClass} pl-9`}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Nombre, departamento o tarjeta..."
                  />
                </label>
                <button
                  type="button"
                  aria-label="Actualizar"
                  onClick={() => {
                    void mutateEmployees()
                    void mutateRfidTags()
                    void mutateDoorPerms()
                  }}
                  className="rounded-lg p-2 text-[#58727c] hover:bg-[#f3f8f8] dark:text-[#94adb8] dark:hover:bg-[#132834]"
                >
                  <RefreshCw className="size-4" />
                </button>
              </div>
            </div>

            {employeesLoading ? (
              <div className="p-10 text-center text-sm text-[#82969d]">Cargando personal autorizado…</div>
            ) : employeesError ? (
              <div role="alert" className="p-8 text-sm text-red-700">
                No se pudo cargar el personal: {employeesError instanceof Error ? employeesError.message : 'Error de API'}
              </div>
            ) : filteredEmployees.length === 0 ? (
              <div className="p-10 text-center">
                <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-[#eff8f7] text-[#087f7b] dark:bg-[#13313b] dark:text-[#2dd4bf]">
                  <UserRound className="size-5" />
                </div>
                <p className="mt-3 font-semibold text-[#29434e] dark:text-[#e6f0f2]">No hay personas que coincidan</p>
                <p className="mt-1 text-sm text-[#82969d] dark:text-[#94adb8]">Registra un trabajador para autorizar su acceso.</p>
              </div>
            ) : (
              <ul className="divide-y divide-[#edf2f3] dark:divide-[#1e3340]">
                {filteredEmployees.map((emp) => {
                  const assignedTags = tagsByEmployee.get(emp.id) ?? []
                  const assignedDoors = doorsByEmployee.get(emp.id) ?? []
                  const isBusy = busyWorkerId === emp.id

                  return (
                    <li key={emp.id} className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center">
                      <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[#eff8f7] text-[#087f7b] dark:bg-[#13313b] dark:text-[#2dd4bf]">
                        <UserRound className="size-6" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-[#163542] dark:text-[#e6f0f2]">
                            {emp.firstName} {emp.lastName}
                          </p>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              emp.isActive
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300'
                                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                            }`}
                          >
                            {emp.isActive ? 'Activo' : 'Inactivo'}
                          </span>
                        </div>

                        <p className="text-xs text-[#718995] dark:text-[#94adb8]">{emp.department}</p>

                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          {assignedTags.length > 0 ? (
                            assignedTags.map((uid) => (
                              <span
                                key={uid}
                                className="inline-flex items-center gap-1 rounded-lg border border-[#dce8eb] bg-[#f8fbfa] px-2 py-0.5 font-mono text-[11px] font-semibold text-[#163542] dark:border-[#233a47] dark:bg-[#13222b] dark:text-[#e6f0f2]"
                              >
                                <CreditCard className="size-3 text-[#087f7b] dark:text-[#2dd4bf]" />
                                {uid}
                              </span>
                            ))
                          ) : (
                            <button
                              type="button"
                              onClick={() => setAssigningWorker({ id: emp.id, name: `${emp.firstName} ${emp.lastName}` })}
                              className="inline-flex items-center gap-1 rounded-lg border border-dashed border-[#087f7b]/40 px-2 py-0.5 text-[11px] font-semibold text-[#087f7b] hover:bg-[#eff8f7] dark:border-[#2dd4bf]/40 dark:text-[#2dd4bf] dark:hover:bg-[#13313b]"
                            >
                              <Plus className="size-3" />
                              Asignar tarjeta
                            </button>
                          )}

                          {assignedDoors.length > 0 && (
                            <span className="inline-flex items-center gap-1 text-[11px] text-[#82969d] dark:text-[#94adb8]">
                              <DoorOpen className="size-3" />
                              {assignedDoors.join(', ')}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setAssigningWorker({ id: emp.id, name: `${emp.firstName} ${emp.lastName}` })}
                          className="rounded-lg border border-[#dce8eb] px-3 py-1.5 text-xs font-semibold text-[#58727c] hover:bg-[#f7fbfa] dark:border-[#233a47] dark:text-[#94adb8] dark:hover:bg-[#132834]"
                        >
                          Vincular tarjeta
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => void toggleWorkerStatus(emp)}
                          className="rounded-lg border border-[#dce8eb] px-3 py-1.5 text-xs font-semibold text-[#58727c] hover:bg-[#f7fbfa] disabled:opacity-60 dark:border-[#233a47] dark:text-[#94adb8] dark:hover:bg-[#132834]"
                        >
                          {isBusy ? <LoaderCircle className="size-3.5 animate-spin" /> : emp.isActive ? 'Desactivar' : 'Activar'}
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => void handleDeleteWorker(emp)}
                          className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded"
                          title="Eliminar trabajador"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </div>
      )}

      {/* PESTAÑA 2: CUENTAS DEL SISTEMA (ADMINISTRADORES Y SUPERVISORES) */}
      {activeTab === 'system' && (
        <div className="flex flex-col gap-6">
          <section className="overflow-hidden rounded-2xl border border-[#e5edf0] bg-white shadow-[0_8px_24px_rgba(18,49,66,0.04)] dark:border-[#1e3340] dark:bg-[#101e26]">
            <div className="flex flex-col gap-3 border-b border-[#edf2f3] p-4 sm:flex-row sm:items-center sm:justify-between dark:border-[#1e3340]">
              <div>
                <h2 className="font-semibold text-[#163542] dark:text-[#e6f0f2]">
                  Cuentas con acceso al portal
                </h2>
                <p className="mt-0.5 text-xs text-[#82969d] dark:text-[#94adb8]">
                  Administradores y supervisores institucionales
                </p>
              </div>

              <div className="flex items-center gap-2">
                <label className="relative flex min-w-0 flex-1 items-center sm:w-64">
                  <Search className="absolute left-3 size-4 text-[#82969d]" />
                  <input
                    aria-label="Buscar usuarios"
                    className={`${inputClass} pl-9`}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Nombre o correo..."
                  />
                </label>
                <button
                  type="button"
                  aria-label="Actualizar"
                  onClick={() => void mutatePeople()}
                  className="rounded-lg p-2 text-[#58727c] hover:bg-[#f3f8f8] dark:text-[#94adb8] dark:hover:bg-[#132834]"
                >
                  <RefreshCw className="size-4" />
                </button>
              </div>
            </div>

            {peopleLoading ? (
              <div className="p-10 text-center text-sm text-[#82969d]">Cargando cuentas…</div>
            ) : peopleError ? (
              <div role="alert" className="p-8 text-sm text-red-700">
                No se pudieron cargar las cuentas del sistema.
              </div>
            ) : (
              <ul className="divide-y divide-[#edf2f3] dark:divide-[#1e3340]">
                {filteredSystem.map((person) => {
                  const roles = roleCodes(person).map(
                    (code) => systemRoles.find((r) => r.code === code)?.name ?? code
                  )
                  const isBusy = busyWorkerId === person.id

                  return (
                    <li key={person.id} className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#eff8f7] text-[#087f7b] dark:bg-[#13313b] dark:text-[#2dd4bf]">
                        <ShieldCheck className="size-5" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-[#163542] dark:text-[#e6f0f2]">
                          {person.full_name || 'Usuario'}
                        </p>
                        <p className="text-xs text-[#82969d] dark:text-[#94adb8]">{person.email}</p>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {roles.map((r) => (
                            <span
                              key={r}
                              className="rounded-full bg-[#eff8f7] px-2 py-0.5 text-[10px] font-bold text-[#087f7b] dark:bg-[#13313b] dark:text-[#2dd4bf]"
                            >
                              {r}
                            </span>
                          ))}
                        </div>
                      </div>

                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                          person.status === 'ACTIVE'
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                        }`}
                      >
                        {person.status === 'ACTIVE' ? 'Activa' : 'Inactiva'}
                      </span>

                      <div className="flex items-center gap-2">
                        <Link
                          href={`/admin/personas/${person.id}/permisos`}
                          className="rounded-lg border border-[#dce8eb] px-3 py-1.5 text-xs font-semibold text-[#58727c] hover:bg-[#f7fbfa] dark:border-[#233a47] dark:text-[#94adb8] dark:hover:bg-[#132834]"
                        >
                          Permisos
                        </Link>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => void setSystemUserStatus(person)}
                          className="rounded-lg border border-[#dce8eb] px-3 py-1.5 text-xs font-semibold text-[#58727c] hover:bg-[#f7fbfa] disabled:opacity-60 dark:border-[#233a47] dark:text-[#94adb8] dark:hover:bg-[#132834]"
                        >
                          {isBusy ? <LoaderCircle className="size-3.5 animate-spin" /> : person.status === 'ACTIVE' ? 'Desactivar' : 'Activar'}
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  )
>>>>>>> 5d87d37 (Conexion con backend, nuevos endpoints y eliminacion de datos estaticos)
}
