'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import useSWR from 'swr'
import { Activity, Check, ChevronLeft, ChevronRight, CircleAlert, Copy, KeyRound, LoaderCircle, MapPin, RefreshCw, Search, TabletSmartphone, Wifi, WifiOff } from 'lucide-react'
import { api, type ApiRoom } from '@/lib/api'
import { userFacingClientError } from '@/lib/user-facing-errors.mjs'
import { AdminKpi, AdminPageHeader, AdminStatusBadge } from '@/components/admin-ui'

type Device = { id: number; cleanroom_id: number; code: string; type: string; serial_number: string; firmware_version: string | null; status: string; last_seen_at: string | null; rssi: number | null }
const PAGE_SIZE = 8
const fieldClass = 'min-h-11 w-full rounded-xl border border-[#dce8eb] bg-white px-3 py-2.5 text-sm text-[#163542] outline-none transition focus:border-[#087f7b] focus:ring-4 focus:ring-[#087f7b]/10 dark:border-[#233a47] dark:bg-[#101e26] dark:text-[#e6f0f2]'

function rowsFrom(value: unknown): Device[] {
  if (Array.isArray(value)) return value.filter((item): item is Device => Boolean(item && typeof item === 'object' && 'id' in item && 'code' in item))
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    for (const key of ['items', 'data', 'results']) if (Array.isArray(record[key])) return rowsFrom(record[key])
  }
  return []
}

export function DeviceManagement() {
  const { data, error, isLoading, mutate } = useSWR('admin-devices', api.devices)
  const { data: roomData } = useSWR<ApiRoom[]>('device-rooms', api.rooms)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [roomFilter, setRoomFilter] = useState('ALL')
  const [page, setPage] = useState(1)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [newKey, setNewKey] = useState<{ code: string; value: string } | null>(null)
  const devices = rowsFrom(data)
  const rooms = Array.isArray(roomData) ? roomData : []
  const filtered = useMemo(() => devices.filter((device) => `${device.code} ${device.type} ${device.serial_number}`.toLowerCase().includes(query.trim().toLowerCase()) && (statusFilter === 'ALL' || device.status === statusFilter) && (roomFilter === 'ALL' || String(device.cleanroom_id) === roomFilter)), [devices, query, statusFilter, roomFilter])
  const activeCount = devices.filter((device) => device.status === 'ACTIVE').length
  const inactiveCount = devices.filter((device) => device.status === 'INACTIVE').length
  const reportingCount = devices.filter((device) => Boolean(device.last_seen_at)).length
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const pageDevices = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  const setFilter = (setter: (value: string) => void) => (value: string) => { setter(value); setPage(1) }

  const changeStatus = async (device: Device) => {
    const status = device.status === 'INACTIVE' ? 'ACTIVE' : 'INACTIVE'
    if (status === 'INACTIVE' && !window.confirm(`¿Desactivar el dispositivo ${device.code}?`)) return
    setBusyId(device.id); setErrorMessage(''); setSuccessMessage(''); setNewKey(null)
    try {
      await api.updateDevice(device.id, { status })
      await mutate()
      setSuccessMessage(`Dispositivo ${device.code} ${status === 'ACTIVE' ? 'activado' : 'desactivado'}.`)
    } catch (cause) { setErrorMessage(userFacingClientError(cause)) } finally { setBusyId(null) }
  }

  const regenerateKey = async (device: Device) => {
    if (!window.confirm(`¿Rotar la llave del dispositivo ${device.code}? La llave anterior dejará de funcionar y la nueva solo se mostrará una vez.`)) return
    setBusyId(device.id); setErrorMessage(''); setSuccessMessage(''); setNewKey(null)
    try {
      const response = await api.regenerateDeviceKey(device.id) as { api_key?: string }
      if (!response?.api_key) throw new Error('No se pudo obtener la nueva llave.')
      setNewKey({ code: device.code, value: response.api_key })
      setSuccessMessage('Llave regenerada. Solo se mostrará en esta sesión; cópiala ahora y guárdala de forma segura.')
      await mutate()
    } catch (cause) { setErrorMessage(userFacingClientError(cause)) } finally { setBusyId(null) }
  }

  const copyKey = async () => {
    if (!newKey) return
    try { await navigator.clipboard.writeText(newKey.value); setSuccessMessage('Llave copiada al portapapeles.') } catch { setErrorMessage('No se pudo copiar automáticamente. Selecciona y copia la llave manualmente.') }
  }

  const roomName = (id: number) => rooms.find((room) => room.id === id)?.name ?? `Cuarto #${id}`

  return <div className="flex min-w-0 flex-col gap-6">
    <AdminPageHeader eyebrow="Administración · hardware" title="Dispositivos" description="Consulta el estado, la conexión y la asignación de cada equipo registrado." actions={<Link href="/admin/dispositivos/nuevo" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition hover:-translate-y-px hover:brightness-95">Registrar dispositivo</Link>} />

    <section aria-label="Resumen de dispositivos" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <AdminKpi label="Equipos registrados" value={isLoading ? '—' : String(devices.length)} detail="Total en el inventario" icon={<TabletSmartphone aria-hidden="true" className="size-4" />} />
      <AdminKpi label="Activos" value={isLoading ? '—' : String(activeCount)} detail="Estado actual del equipo" icon={<Check aria-hidden="true" className="size-4" />} tone="teal" />
      <AdminKpi label="Inactivos" value={isLoading ? '—' : String(inactiveCount)} detail="Requieren revisión o activación" icon={<WifiOff aria-hidden="true" className="size-4" />} tone={inactiveCount ? 'amber' : 'slate'} />
      <AdminKpi label="Con conexión reportada" value={isLoading ? '—' : String(reportingCount)} detail="Tienen una fecha de última conexión" icon={<Wifi aria-hidden="true" className="size-4" />} tone="blue" />
    </section>

    {errorMessage && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">{errorMessage}</div>}
    {successMessage && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">{successMessage}</div>}
    {newKey && <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-500/30 dark:bg-amber-500/10"><h2 className="font-semibold text-amber-950 dark:text-amber-100">Nueva llave · {newKey.code}</h2><p className="mt-1 text-sm text-amber-900 dark:text-amber-200">La llave completa no se podrá consultar después de cerrar esta vista.</p><div className="mt-3 flex flex-col gap-2 sm:flex-row"><code className="min-w-0 flex-1 break-all rounded-lg border border-amber-200 bg-white p-3 text-xs text-[#163542]">{newKey.value}</code><button type="button" onClick={() => void copyKey()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-amber-300 px-4 py-2 text-sm font-semibold text-amber-950 hover:bg-amber-100 dark:text-amber-100 dark:hover:bg-amber-500/20"><Copy className="size-4" />Copiar llave</button></div></section>}

    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--admin-panel-shadow)]">
      <div className="border-b border-border p-4 sm:p-5">
        <div className="mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-end"><div><h2 className="text-lg font-semibold tracking-tight text-card-foreground">Inventario de equipos</h2><p className="mt-1 text-sm text-muted-foreground">Busca y filtra los dispositivos por sala o estado.</p></div><button type="button" aria-label="Actualizar dispositivos" onClick={() => void mutate()} className="inline-flex min-h-10 w-fit items-center gap-2 rounded-xl border border-border px-3 text-sm font-medium text-foreground transition hover:bg-muted"><RefreshCw className="size-4" />Actualizar</button></div>
        <div className="grid gap-2 md:grid-cols-[minmax(14rem,1fr)_minmax(10rem,0.7fr)_minmax(10rem,0.7fr)]">
          <label className="relative flex min-w-0 items-center"><Search aria-hidden="true" className="absolute left-3 size-4 text-muted-foreground" /><input aria-label="Buscar dispositivos por código, tipo o serie" value={query} onChange={(event) => setFilter(setQuery)(event.target.value)} placeholder="Buscar por código, tipo o serie" className={`${fieldClass} pl-9`} /></label>
          <select aria-label="Filtrar dispositivos por cuarto" value={roomFilter} onChange={(event) => setFilter(setRoomFilter)(event.target.value)} className={fieldClass}><option value="ALL">Todos los cuartos</option>{rooms.map((room) => <option key={room.id} value={room.id}>{room.code}</option>)}</select>
          <select aria-label="Filtrar dispositivos por estado" value={statusFilter} onChange={(event) => setFilter(setStatusFilter)(event.target.value)} className={fieldClass}><option value="ALL">Todos los estados</option><option value="ACTIVE">Activos</option><option value="INACTIVE">Inactivos</option></select>
        </div>
      </div>

      {isLoading ? <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin text-primary" />Cargando dispositivos…</div>
        : error ? <div role="alert" className="m-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">No se pudieron cargar los dispositivos: {userFacingClientError(error)}</div>
          : filtered.length === 0 ? <div className="flex min-h-56 flex-col items-center justify-center px-6 py-10 text-center"><span className="grid size-12 place-items-center rounded-2xl bg-accent text-accent-foreground"><CircleAlert className="size-5" /></span><p className="mt-4 font-semibold text-card-foreground">No hay dispositivos para mostrar</p><p className="mt-1 text-sm text-muted-foreground">Prueba con otra búsqueda o cambia los filtros.</p></div>
            : <>
              <div className="flex items-center justify-between px-4 py-3 text-xs text-muted-foreground sm:px-5"><span><strong className="font-semibold text-foreground">{filtered.length}</strong> {filtered.length === 1 ? 'equipo encontrado' : 'equipos encontrados'}</span><span>Mostrando {Math.min((currentPage - 1) * PAGE_SIZE + 1, filtered.length)}–{Math.min(currentPage * PAGE_SIZE, filtered.length)}</span></div>
              <ul className="grid min-w-0 gap-3 px-4 pb-4 sm:grid-cols-2 sm:px-5 sm:pb-5 xl:grid-cols-3">
                {pageDevices.map((device) => {
                  const active = device.status === 'ACTIVE'
                  return <li key={device.id} className="group relative flex min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-card transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_32px_rgba(16,44,58,0.09)]">
                    <div className={`absolute inset-x-0 top-0 h-1 ${active ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                    <div className="flex items-start justify-between gap-3 p-4 pb-3"><div className="flex min-w-0 items-center gap-3"><span className={`grid size-11 shrink-0 place-items-center rounded-xl ${active ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300' : 'bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300'}`}><TabletSmartphone className="size-5" /></span><div className="min-w-0"><h3 className="truncate font-semibold text-card-foreground">{device.code}</h3><p className="truncate text-xs text-muted-foreground">{device.type}</p></div></div><AdminStatusBadge value={device.status} /></div>
                    <div className="grid flex-1 gap-2 px-4 pb-4">
                      <div className="flex min-w-0 items-center gap-2 rounded-xl bg-muted/70 px-3 py-2.5 text-sm"><MapPin className="size-4 shrink-0 text-primary" /><span className="truncate text-foreground">{roomName(device.cleanroom_id)}</span></div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="min-w-0 rounded-xl border border-border px-3 py-2"><p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Serie</p><p className="mt-1 truncate text-xs font-medium text-card-foreground" title={device.serial_number}>{device.serial_number || 'Sin dato'}</p></div>
                        <div className="min-w-0 rounded-xl border border-border px-3 py-2"><p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Firmware</p><p className="mt-1 truncate text-xs font-medium text-card-foreground">{device.firmware_version || 'Sin dato'}</p></div>
                      </div>
                      <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground"><Activity className="size-3.5 shrink-0 text-primary" /><span className="truncate">{device.last_seen_at ? `Última conexión: ${new Date(device.last_seen_at).toLocaleString('es-MX')}` : 'Sin conexión reportada'}</span></div>
                      {device.rssi !== null && <div className="flex items-center gap-2 text-xs text-muted-foreground"><Wifi className="size-3.5 text-primary" /><span>Señal reportada: <strong className="font-semibold text-foreground">{device.rssi} dBm</strong></span></div>}
                    </div>
                    <div className="flex flex-wrap gap-2 border-t border-border bg-muted/40 p-3"><button type="button" disabled={busyId !== null} onClick={() => void changeStatus(device)} className="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-3 text-xs font-semibold text-foreground transition hover:bg-muted disabled:opacity-60">{busyId === device.id ? <LoaderCircle className="size-4 animate-spin" /> : active ? <WifiOff className="size-3.5" /> : <Wifi className="size-3.5" />}{active ? 'Desactivar' : 'Activar'}</button><button type="button" disabled={busyId !== null} onClick={() => void regenerateKey(device)} className="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary px-3 text-xs font-semibold text-primary-foreground transition hover:brightness-95 disabled:opacity-60"><KeyRound className="size-3.5" />Regenerar llave</button></div>
                  </li>
                })}
              </ul>
              {pageCount > 1 && <nav aria-label="Paginación de dispositivos" className="flex flex-col gap-3 border-t border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-5"><span>Página <strong className="font-semibold text-foreground">{currentPage} de {pageCount}</strong></span><div className="flex items-center gap-2"><button type="button" disabled={currentPage === 1} onClick={() => setPage(Math.max(1, currentPage - 1))} className="inline-flex min-h-10 items-center gap-1 rounded-xl border border-border bg-card px-3 font-semibold text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-45"><ChevronLeft className="size-4" />Anterior</button><button type="button" disabled={currentPage === pageCount} onClick={() => setPage(Math.min(pageCount, currentPage + 1))} className="inline-flex min-h-10 items-center gap-1 rounded-xl border border-border bg-card px-3 font-semibold text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-45">Siguiente<ChevronRight className="size-4" /></button></div></nav>}
            </>}
    </section>
  </div>
}
