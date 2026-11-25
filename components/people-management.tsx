'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import useSWR from 'swr'
import { BadgeCheck, ChevronLeft, ChevronRight, CircleOff, CreditCard, LoaderCircle, Mail, RefreshCw, Search, ShieldCheck, UserRound, UserRoundCheck } from 'lucide-react'
import { api, type ApiPerson } from '@/lib/api'
import { userFacingClientError } from '@/lib/user-facing-errors.mjs'
import { AdminKpi, AdminPageHeader, AdminStatusBadge } from '@/components/admin-ui'

type RoleOption = { code: string; name: string }
const PAGE_SIZE = 9
const inputClass = 'min-h-11 w-full rounded-xl border border-[#dce8eb] bg-white px-3 py-2.5 text-sm text-[#163542] outline-none transition focus:border-[#087f7b] focus:ring-4 focus:ring-[#087f7b]/10 dark:border-[#233a47] dark:bg-[#101e26] dark:text-[#e6f0f2]'

function listFrom(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    for (const key of ['items', 'data', 'results']) if (Array.isArray(record[key])) return listFrom(record[key])
  }
  return []
}

function roleCodes(person: ApiPerson): string[] {
  const raw = (person as Record<string, unknown>).roles ?? (person as Record<string, unknown>).role_codes
  if (!Array.isArray(raw)) return typeof person.role === 'string' && person.role ? [person.role] : []
  return raw.map((role) => typeof role === 'string' ? role : role && typeof role === 'object' ? String((role as Record<string, unknown>).code ?? '') : '').filter(Boolean)
}

export function PeopleManagement() {
  const { data, error, isLoading, mutate } = useSWR('admin-people', () => api.people('?page=1&size=100'))
  const { data: roleData } = useSWR('admin-roles', api.roles)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [page, setPage] = useState(1)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const people = listFrom(data) as unknown as ApiPerson[]
  const roles = listFrom(roleData) as unknown as RoleOption[]
  const filtered = useMemo(() => people.filter((person) => `${person.full_name ?? person.name ?? ''} ${person.email ?? ''} ${roleCodes(person).join(' ')}`.toLowerCase().includes(query.trim().toLowerCase()) && (statusFilter === 'ALL' || person.status === statusFilter)), [people, query, statusFilter])
  const activeCount = people.filter((person) => person.status === 'ACTIVE').length
  const inactiveCount = people.filter((person) => person.status === 'INACTIVE').length
  const credentialCount = people.filter((person) => person.rfid_card_id !== null && person.rfid_card_id !== undefined).length
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const pagePeople = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const setFilter = (setter: (value: string) => void) => (value: string) => { setter(value); setPage(1) }

  const setStatus = async (person: ApiPerson) => {
    const status = person.status === 'INACTIVE' ? 'ACTIVE' : 'INACTIVE'
    if (status === 'INACTIVE' && !window.confirm(`¿Desactivar la cuenta de ${person.full_name || person.email}?`)) return
    setBusyId(person.id)
    setErrorMessage('')
    setSuccessMessage('')
    try {
      await api.updatePerson(person.id, { status })
      await mutate()
      setSuccessMessage(`${person.full_name || person.name || person.email} ahora está ${status === 'ACTIVE' ? 'activa' : 'inactiva'}.`)
    } catch (cause) {
      setErrorMessage(userFacingClientError(cause))
    } finally {
      setBusyId(null)
    }
  }

  return <div className="flex min-w-0 flex-col gap-6">
    <AdminPageHeader eyebrow="Administración · identidad" title="Personas autorizadas" description="Consulta cuentas, roles y credenciales RFID. Administra permisos y estado desde cada ficha." actions={<Link href="/admin/personas/nueva" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition hover:-translate-y-px hover:brightness-95"><UserRoundCheck aria-hidden="true" className="size-4" />Registrar persona</Link>} />

    <section aria-label="Resumen de personas" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <AdminKpi label="Personas consultadas" value={isLoading ? '—' : String(people.length)} detail="Registros recibidos del directorio" icon={<UserRound aria-hidden="true" className="size-4" />} />
      <AdminKpi label="Cuentas activas" value={isLoading ? '—' : String(activeCount)} detail="Entre las personas consultadas" icon={<BadgeCheck aria-hidden="true" className="size-4" />} tone="teal" />
      <AdminKpi label="Cuentas inactivas" value={isLoading ? '—' : String(inactiveCount)} detail="Entre las personas consultadas" icon={<CircleOff aria-hidden="true" className="size-4" />} tone={inactiveCount ? 'amber' : 'slate'} />
      <AdminKpi label="Con tarjeta RFID" value={isLoading ? '—' : String(credentialCount)} detail="Tienen una credencial vinculada" icon={<CreditCard aria-hidden="true" className="size-4" />} tone="blue" />
    </section>

    {errorMessage && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">{errorMessage}</div>}
    {successMessage && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">{successMessage}</div>}

    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--admin-panel-shadow)]">
      <div className="border-b border-border p-4 sm:p-5">
        <div className="mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-end"><div><h2 className="text-lg font-semibold tracking-tight text-card-foreground">Directorio de personas</h2><p className="mt-1 text-sm text-muted-foreground">Busca por nombre, correo o rol y filtra por estado.</p></div><button type="button" aria-label="Actualizar personas" onClick={() => void mutate()} className="inline-flex min-h-10 w-fit items-center gap-2 rounded-xl border border-border px-3 text-sm font-medium text-foreground transition hover:bg-muted"><RefreshCw className="size-4" />Actualizar</button></div>
        <div className="grid gap-2 md:grid-cols-[minmax(14rem,1fr)_minmax(11rem,0.55fr)]">
          <label className="relative flex min-w-0 items-center"><Search aria-hidden="true" className="absolute left-3 size-4 text-muted-foreground" /><input aria-label="Buscar personas por nombre, correo o rol" className={`${inputClass} pl-9`} value={query} onChange={(event) => setFilter(setQuery)(event.target.value)} placeholder="Buscar por nombre, correo o rol" /></label>
          <select aria-label="Filtrar personas por estado" className={inputClass} value={statusFilter} onChange={(event) => setFilter(setStatusFilter)(event.target.value)}><option value="ALL">Todos los estados</option><option value="ACTIVE">Activas</option><option value="INACTIVE">Inactivas</option></select>
        </div>
      </div>

      {isLoading ? <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin text-primary" />Cargando personas…</div>
        : error ? <div role="alert" className="m-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">No se pudieron cargar las personas: {userFacingClientError(error)}</div>
          : filtered.length === 0 ? <div className="flex min-h-56 flex-col items-center justify-center px-6 py-10 text-center"><span className="grid size-12 place-items-center rounded-2xl bg-accent text-accent-foreground"><UserRound className="size-5" /></span><p className="mt-4 font-semibold text-card-foreground">No hay personas para mostrar</p><p className="mt-1 text-sm text-muted-foreground">Cambia la búsqueda o el filtro de estado.</p></div>
            : <>
              <div className="flex items-center justify-between px-4 py-3 text-xs text-muted-foreground sm:px-5"><span><strong className="font-semibold text-foreground">{filtered.length}</strong> {filtered.length === 1 ? 'persona encontrada' : 'personas encontradas'}</span><span>Mostrando {Math.min((currentPage - 1) * PAGE_SIZE + 1, filtered.length)}–{Math.min(currentPage * PAGE_SIZE, filtered.length)}</span></div>
              <ul className="grid min-w-0 gap-3 px-4 pb-4 sm:grid-cols-2 sm:px-5 sm:pb-5 xl:grid-cols-3">
                {pagePeople.map((person) => <PersonCard key={person.id} person={person} roles={roles} busy={busyId === person.id} onStatus={() => void setStatus(person)} />)}
              </ul>
              {pageCount > 1 && <nav aria-label="Paginación de personas" className="flex flex-col gap-3 border-t border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-5"><span>Página <strong className="font-semibold text-foreground">{currentPage} de {pageCount}</strong></span><div className="flex items-center gap-2"><button type="button" disabled={currentPage === 1} onClick={() => setPage(Math.max(1, currentPage - 1))} className="inline-flex min-h-10 items-center gap-1 rounded-xl border border-border bg-card px-3 font-semibold text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-45"><ChevronLeft className="size-4" />Anterior</button><button type="button" disabled={currentPage === pageCount} onClick={() => setPage(Math.min(pageCount, currentPage + 1))} className="inline-flex min-h-10 items-center gap-1 rounded-xl border border-border bg-card px-3 font-semibold text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-45">Siguiente<ChevronRight className="size-4" /></button></div></nav>}
            </>}
    </section>
  </div>
}

function PersonCard({ person, roles, busy, onStatus }: { person: ApiPerson; roles: RoleOption[]; busy: boolean; onStatus: () => void }) {
  const roleNames = roleCodes(person).map((code) => roles.find((role) => role.code === code)?.name ?? code)
  const name = person.full_name || person.name || 'Persona sin nombre'
  const hasCredential = person.rfid_card_id !== null && person.rfid_card_id !== undefined
  return <li className="group relative flex min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-card transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_32px_rgba(16,44,58,0.09)]">
    <div className={`absolute inset-x-0 top-0 h-1 ${person.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`} />
    <div className="flex items-start gap-3 p-4 pb-3"><span className="grid size-11 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground"><UserRound className="size-5" /></span><div className="min-w-0 flex-1"><h3 className="truncate font-semibold text-card-foreground" title={name}>{name}</h3><p className="mt-0.5 flex min-w-0 items-center gap-1.5 truncate text-xs text-muted-foreground"><Mail className="size-3.5 shrink-0" />{person.email || 'Sin correo registrado'}</p></div><AdminStatusBadge value={person.status} /></div>
    <div className="flex flex-1 flex-col gap-3 px-4 pb-4">
      <div><p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Roles</p><div className="flex min-h-7 flex-wrap gap-1.5">{roleNames.length ? roleNames.map((role) => <span key={role} className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/70 px-2.5 py-1 text-[11px] font-medium text-foreground"><ShieldCheck className="size-3 text-primary" />{role}</span>) : <span className="text-xs text-muted-foreground">Sin roles asignados</span>}</div></div>
      <div className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs ${hasCredential ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300' : 'bg-muted text-muted-foreground'}`}><CreditCard className="size-4 shrink-0" /><span className="font-medium">{hasCredential ? 'Credencial RFID vinculada' : 'Sin credencial RFID'}</span>{hasCredential && <BadgeCheck className="ml-auto size-4 shrink-0" />}</div>
    </div>
    <div className="grid grid-cols-2 gap-2 border-t border-border bg-muted/40 p-3"><Link href={`/admin/personas/${person.id}/permisos`} className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-3 text-xs font-semibold text-foreground transition hover:bg-muted"><ShieldCheck className="size-3.5" />Ver permisos</Link><button type="button" disabled={busy} onClick={onStatus} className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-primary px-3 text-xs font-semibold text-primary-foreground transition hover:brightness-95 disabled:opacity-60">{busy ? <LoaderCircle className="size-4 animate-spin" /> : person.status === 'ACTIVE' ? <CircleOff className="size-3.5" /> : <BadgeCheck className="size-3.5" />}{person.status === 'ACTIVE' ? 'Desactivar' : 'Activar'}</button></div>
  </li>
}
