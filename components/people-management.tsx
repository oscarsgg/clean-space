'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import useSWR from 'swr'
import { LoaderCircle, RefreshCw, Search, ShieldCheck, UserRound } from 'lucide-react'
import { api, type ApiPerson } from '@/lib/api'
import { userFacingClientError } from '@/lib/user-facing-errors.mjs'
import { AdminKpi, AdminPageHeader, AdminStatusBadge } from '@/components/admin-ui'

type RoleOption = { code: string; name: string }
const inputClass = 'w-full rounded-xl border border-[#dce8eb] bg-white px-3 py-2.5 text-sm text-[#163542] outline-none focus:border-[#087f7b] focus:ring-4 focus:ring-[#087f7b]/10'

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
  if (!Array.isArray(raw)) return []
  return raw.map((role) => typeof role === 'string' ? role : role && typeof role === 'object' ? String((role as Record<string, unknown>).code ?? '') : '').filter(Boolean)
}

export function PeopleManagement() {
  const { data, error, isLoading, mutate } = useSWR('admin-people', () => api.people('?page=1&size=100'))
  const { data: roleData } = useSWR('admin-roles', api.roles)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [busyId, setBusyId] = useState<number | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const people = listFrom(data) as unknown as ApiPerson[]
  const roles = listFrom(roleData) as unknown as RoleOption[]
  const filtered = useMemo(() => people.filter((person) => `${person.full_name ?? ''} ${person.email ?? ''} ${roleCodes(person).join(' ')}`.toLowerCase().includes(query.toLowerCase()) && (statusFilter === 'ALL' || person.status === statusFilter)), [people, query, statusFilter])
  const activeCount = people.filter((person) => person.status === 'ACTIVE').length

  const setStatus = async (person: ApiPerson) => {
    const status = person.status === 'INACTIVE' ? 'ACTIVE' : 'INACTIVE'
    if (status === 'INACTIVE' && !window.confirm(`¿Desactivar la cuenta de ${person.full_name || person.email}?`)) return
    setBusyId(person.id)
    setErrorMessage('')
    setSuccessMessage('')
    try {
      await api.updatePerson(person.id, { status })
      await mutate()
      setSuccessMessage(`${person.full_name} ahora está ${status === 'ACTIVE' ? 'activa' : 'inactiva'}.`)
    } catch (cause) {
      setErrorMessage(userFacingClientError(cause))
    } finally {
      setBusyId(null)
    }
  }

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
}
