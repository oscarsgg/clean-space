'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { Plus, Save, Trash2 } from 'lucide-react'
import { AdminButton, AdminEmpty, AdminError, AdminField, AdminLoading, AdminPageHeader, AdminPanel, adminInputClass } from '@/components/admin-ui'
import { api, type ApiRoom, type ApiRoomParameter } from '@/lib/api'
import { userFacingClientError } from '@/lib/user-facing-errors.mjs'

export function AdminParameterManagement() {
  const { data, error, isLoading } = useSWR<ApiRoom[]>('admin-parameter-rooms', api.rooms)
  const rooms = Array.isArray(data) ? data : []
  const [roomId, setRoomId] = useState('')
  const selected = rooms.find((room) => String(room.id) === roomId)
  return <main className="space-y-6">
    <AdminPageHeader eyebrow="Accesos y rangos · configuración" title="Parámetros ambientales" description="Define los límites de comparación por cuarto. Estos rangos ayudan a interpretar lecturas almacenadas y no certifican el estado físico del espacio." />
    {error && <AdminError error={error} fallback="No se pudieron cargar los cuartos." />}
    {isLoading ? <AdminLoading label="Consultando cuartos…" /> : rooms.length ? <>
      <section className="max-w-sm"><AdminField label="Cuarto limpio"><select className={adminInputClass} value={roomId} onChange={(event) => setRoomId(event.target.value)}><option value="">Seleccionar cuarto</option>{rooms.map((room) => <option key={room.id} value={room.id}>{room.code} · {room.name}</option>)}</select></AdminField></section>
      {selected && <ParameterEditor key={selected.id} room={selected} />}
    </> : <AdminEmpty title="No hay cuartos disponibles" description="Registra un cuarto antes de definir sus parámetros ambientales." />}
  </main>
}

function ParameterEditor({ room }: { room: ApiRoom }) {
  const { data, error, isLoading, mutate } = useSWR<ApiRoomParameter[]>(['admin-room-parameters', room.id], () => api.roomParameters(room.id))
  const [drafts, setDrafts] = useState<ApiRoomParameter[] | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const parameters = drafts ?? (Array.isArray(data) ? data : [])
  const update = (index: number, key: keyof ApiRoomParameter, value: string | boolean) => setDrafts((current) => (current ?? data ?? []).map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item))
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setMessage('')
    const normalized = parameters.map((item) => ({ ...item, metric: item.metric.trim(), unit: item.unit.trim(), min_value: Number(item.min_value), max_value: Number(item.max_value), cleanroom_id: room.id }))
    const names = normalized.map((item) => item.metric.toLowerCase())
    if (normalized.some((item) => !item.metric || !item.unit || !Number.isFinite(item.min_value) || !Number.isFinite(item.max_value) || item.min_value >= item.max_value) || new Set(names).size !== names.length) {
      setMessage('Revisa las variables: no deben repetirse, la unidad es obligatoria y el mínimo debe ser menor al máximo.')
      return
    }
    setSaving(true)
    try { await api.saveRoomParameters(room.id, normalized); await mutate(); setDrafts(null); setMessage('Parámetros guardados.') }
    catch (cause) { setMessage(userFacingClientError(cause)) }
    finally { setSaving(false) }
  }
  const add = () => setDrafts([...(drafts ?? data ?? []), { metric: '', min_value: 0, max_value: 1, unit: '', enabled: true, cleanroom_id: room.id }])
  return <AdminPanel title={`${room.code} · ${room.name}`} description="Los límites se comparan solo con lecturas que coinciden en métrica y unidad.">
    {error && <div className="p-5"><AdminError error={error} fallback="No se pudieron consultar los parámetros de este cuarto." /></div>}
    {isLoading ? <div className="p-5"><AdminLoading label="Cargando límites…" /></div> : <form onSubmit={submit} className="space-y-4 p-4 sm:p-6">
      {parameters.length ? parameters.map((item, index) => <div key={`${item.id ?? item.metric}-${index}`} className="grid gap-3 rounded-xl border border-border bg-muted/40 p-4 sm:grid-cols-[1.2fr_1fr_1fr_0.8fr_auto_auto] sm:items-end">
        <AdminField label="Variable"><input className={adminInputClass} value={item.metric} maxLength={50} onChange={(event) => update(index, 'metric', event.target.value)} /></AdminField>
        <AdminField label="Mínimo"><input type="number" step="any" className={adminInputClass} value={item.min_value} onChange={(event) => update(index, 'min_value', event.target.value)} /></AdminField>
        <AdminField label="Máximo"><input type="number" step="any" className={adminInputClass} value={item.max_value} onChange={(event) => update(index, 'max_value', event.target.value)} /></AdminField>
        <AdminField label="Unidad"><input className={adminInputClass} value={item.unit} maxLength={20} onChange={(event) => update(index, 'unit', event.target.value)} /></AdminField>
        <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={item.enabled} onChange={(event) => update(index, 'enabled', event.target.checked)} />Habilitado</label>
        <AdminButton type="button" variant="secondary" aria-label={`Quitar ${item.metric || 'variable'}`} onClick={() => setDrafts(parameters.filter((_, itemIndex) => itemIndex !== index))}><Trash2 aria-hidden="true" className="size-4" /></AdminButton>
      </div>) : <AdminEmpty title="Sin parámetros configurados" description="Agrega la primera variable y define sus límites de referencia." />}
      {message && <p role={message === 'Parámetros guardados.' ? 'status' : 'alert'} className="text-sm text-muted-foreground">{message}</p>}
      <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-between"><AdminButton type="button" variant="secondary" onClick={add}><Plus aria-hidden="true" className="size-4" />Agregar variable</AdminButton><AdminButton type="submit" disabled={saving}>{saving ? 'Guardando…' : <><Save aria-hidden="true" className="size-4" />Guardar límites</>}</AdminButton></div>
    </form>}
  </AdminPanel>
}
