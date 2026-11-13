'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import useSWR from 'swr'
import { Copy, LoaderCircle, RefreshCw, Search, TabletSmartphone } from 'lucide-react'
import { api, type ApiRoom } from '@/lib/api'

type Device = { id: number; cleanroom_id: number; code: string; type: string; serial_number: string; firmware_version: string | null; status: string; last_seen_at: string | null; rssi: number | null }
const fieldClass = 'w-full rounded-xl border border-[#dce8eb] bg-white px-3 py-2.5 text-sm text-[#163542] outline-none focus:border-[#087f7b] focus:ring-4 focus:ring-[#087f7b]/10'

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
  const [busyId, setBusyId] = useState<number | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [newKey, setNewKey] = useState<{ code: string; value: string } | null>(null)
  const devices = rowsFrom(data)
  const rooms = Array.isArray(roomData) ? roomData : []
  const filtered = useMemo(() => devices.filter((device) => `${device.code} ${device.type} ${device.serial_number}`.toLowerCase().includes(query.toLowerCase())), [devices, query])
  const activeCount = devices.filter((device) => device.status === 'ACTIVE').length

  const changeStatus = async (device: Device) => {
    const status = device.status === 'INACTIVE' ? 'ACTIVE' : 'INACTIVE'
    setBusyId(device.id); setErrorMessage(''); setSuccessMessage(''); setNewKey(null)
    try {
      await api.updateDevice(device.id, { status })
      await mutate()
      setSuccessMessage(`Dispositivo ${device.code} ${status === 'ACTIVE' ? 'activado' : 'desactivado'}.`)
    } catch (cause) { setErrorMessage(cause instanceof Error ? cause.message : 'No se pudo actualizar el dispositivo.') } finally { setBusyId(null) }
  }

  const regenerateKey = async (device: Device) => {
    setBusyId(device.id); setErrorMessage(''); setSuccessMessage(''); setNewKey(null)
    try {
      const response = await api.regenerateDeviceKey(device.id) as { api_key?: string }
      if (!response?.api_key) throw new Error('La API no devolvió la nueva llave.')
      setNewKey({ code: device.code, value: response.api_key })
      setSuccessMessage('Llave regenerada. Solo se mostrará en esta sesión; cópiala ahora y guárdala de forma segura.')
      await mutate()
    } catch (cause) { setErrorMessage(cause instanceof Error ? cause.message : 'No se pudo regenerar la llave.') } finally { setBusyId(null) }
  }

  const copyKey = async () => {
    if (!newKey) return
    try { await navigator.clipboard.writeText(newKey.value); setSuccessMessage('Llave copiada al portapapeles.') } catch { setErrorMessage('No se pudo copiar automáticamente. Selecciona y copia la llave manualmente.') }
  }

  const roomName = (id: number) => rooms.find((room) => room.id === id)?.name ?? `Cuarto #${id}`

  return <div className="flex flex-col gap-6">
    <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#087f7b]">Administración · hardware</p><h1 className="mt-1 text-3xl font-semibold tracking-tight text-[#163542]">Dispositivos</h1><p className="mt-2 text-sm text-[#718995]">Administra asignación, estado y credenciales de dispositivos registrados.</p></div><Link href="/admin/dispositivos/nuevo" className="w-fit rounded-xl bg-[#087f7b] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#066c69]">Nuevo dispositivo</Link></header>
    <div className="grid gap-3 sm:grid-cols-3"><Summary label="Registrados" value={isLoading ? '—' : String(devices.length)} /><Summary label="Activos" value={isLoading ? '—' : String(activeCount)} /><Summary label="Fuente" value="API CleanSpace" /></div>
    {errorMessage && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{errorMessage}</div>}{successMessage && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{successMessage}</div>}
    {newKey && <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5"><h2 className="font-semibold text-amber-950">Nueva llave · {newKey.code}</h2><p className="mt-1 text-sm text-amber-900">La llave completa no se puede recuperar después de cerrar esta vista.</p><div className="mt-3 flex flex-col gap-2 sm:flex-row"><code className="min-w-0 flex-1 break-all rounded-lg border border-amber-200 bg-white p-3 text-xs text-[#163542]">{newKey.value}</code><button type="button" onClick={() => void copyKey()} className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-300 px-4 py-2 text-sm font-semibold text-amber-950 hover:bg-amber-100"><Copy className="size-4" />Copiar llave</button></div></section>}
    <section className="overflow-hidden rounded-2xl border border-[#e5edf0] bg-white shadow-[0_8px_24px_rgba(18,49,66,0.04)]"><div className="flex flex-col gap-3 border-b border-[#edf2f3] p-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-semibold text-[#163542]">Inventario</h2><p className="mt-1 text-xs text-[#82969d]">{filtered.length} resultados</p></div><div className="flex gap-2"><label className="relative flex min-w-0 flex-1 items-center sm:w-64"><Search aria-hidden="true" className="absolute left-3 size-4 text-[#82969d]" /><input aria-label="Buscar dispositivos" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Código, tipo o serie" className={`${fieldClass} pl-9`} /></label><button type="button" aria-label="Actualizar dispositivos" onClick={() => void mutate()} className="rounded-lg p-2 text-[#58727c] hover:bg-[#f3f8f8]"><RefreshCw className="size-4" /></button></div></div>
      {isLoading ? <div className="p-10 text-center text-sm text-[#82969d]">Consultando dispositivos…</div> : error ? <div role="alert" className="p-8 text-sm text-red-700">No se pudieron cargar: {error instanceof Error ? error.message : 'Error de API.'}</div> : filtered.length === 0 ? <div className="p-10 text-center"><div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-[#eff8f7] text-[#087f7b]"><TabletSmartphone className="size-5" /></div><p className="mt-3 font-semibold text-[#29434e]">No hay dispositivos para mostrar</p><p className="mt-1 text-sm text-[#82969d]">Cambia la búsqueda o registra el primer dispositivo.</p></div> : <ul className="divide-y divide-[#edf2f3]">{filtered.map((device) => <li key={device.id} className="flex flex-col gap-4 px-5 py-4 lg:flex-row lg:items-center"><div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#eff8f7] text-[#087f7b]"><TabletSmartphone className="size-5" /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-[#29434e]">{device.code}</p><span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${device.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{device.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}</span></div><p className="mt-1 text-sm text-[#718995]">{device.type} · Serie {device.serial_number}</p><p className="mt-1 text-xs text-[#82969d]">{roomName(device.cleanroom_id)}{device.firmware_version ? ` · Firmware ${device.firmware_version}` : ''}{device.last_seen_at ? ` · Última conexión ${new Date(device.last_seen_at).toLocaleString('es-MX')}` : ' · Sin conexión reportada'}</p></div><div className="flex flex-wrap gap-2"><button type="button" disabled={busyId !== null} onClick={() => void changeStatus(device)} className="rounded-lg border border-[#dce8eb] px-3 py-2 text-xs font-semibold text-[#58727c] hover:bg-[#f7fbfa] disabled:opacity-60">{busyId === device.id ? <LoaderCircle className="size-4 animate-spin" /> : device.status === 'ACTIVE' ? 'Desactivar' : 'Activar'}</button><button type="button" disabled={busyId !== null} onClick={() => void regenerateKey(device)} className="rounded-lg border border-[#dce8eb] px-3 py-2 text-xs font-semibold text-[#58727c] hover:bg-[#f7fbfa] disabled:opacity-60">Regenerar llave</button></div></li>)}</ul>}
    </section>
  </div>
}

function Summary({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl border border-[#e5edf0] bg-white p-4"><p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#82969d]">{label}</p><p className="mt-2 text-xl font-semibold text-[#163542]">{value}</p></div> }
