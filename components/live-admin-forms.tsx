'use client'

import Link from 'next/link'
import { useRef, useState, type FormEvent, type ReactNode } from 'react'
import useSWR from 'swr'
import { Cpu, Fingerprint, KeyRound, Mail, MapPin, ShieldCheck, UserRound, Building2, Hash, Tag, Wifi, Copy, Check } from 'lucide-react'
import type { ApiRoom } from '@/lib/api'
import { api } from '@/lib/api'
import { userFacingClientError } from '@/lib/user-facing-errors.mjs'
import { CreationActions, CreationAside, CreationCard, CreationLayout, CreationNotice, CreateConfirmDialog, creationInputClass, creationLabelClass } from '@/components/admin-creation-ui'

type ConfirmState = { open: boolean; title: string; description: string }
const closedConfirm: ConfirmState = { open: false, title: '', description: '' }

function Field({ label, hint, icon, children, className = '' }: { label: string; hint?: string; icon?: ReactNode; children: ReactNode; className?: string }) {
  return <label className={`${creationLabelClass} ${className}`}><span className="flex items-center gap-2">{icon && <span className="text-[#087f7b]">{icon}</span>}{label}</span>{children}{hint && <span className="text-xs font-normal leading-5 text-[#82969d]">{hint}</span>}</label>
}

export function LivePersonForm() {
  const formRef = useRef<HTMLFormElement>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confirm, setConfirm] = useState(closedConfirm)
  const { data: roleData, isLoading: rolesLoading, error: rolesError } = useSWR('person-form-roles', () => api.roles())
  const roles = Array.isArray(roleData) ? roleData.filter((role): role is Record<string, unknown> => Boolean(role && typeof role === 'object' && 'code' in role)) : []

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setSuccess(false)
    setConfirm({ open: true, title: 'Crear persona autorizada', description: 'Confirma que el nombre, correo, rol y credencial RFID sean correctos. La cuenta quedará registrada con el rol seleccionado.' })
  }
  const create = async () => {
    const form = formRef.current
    if (!form) return
    const data = new FormData(form)
    const uid = String(data.get('rfid_uid') ?? '').trim().toUpperCase()
    setSaving(true); setError('')
    try {
      await api.createPerson({ email: String(data.get('email') ?? '').trim(), password: String(data.get('password') ?? ''), full_name: String(data.get('full_name') ?? '').trim(), role_codes: [String(data.get('role_code') || 'PERSONAL_AUTORIZADO')], ...(uid ? { rfid_uid: uid, card_label: String(data.get('card_label') ?? '').trim() } : {}) })
      setConfirm(closedConfirm); setSuccess(true); form.reset()
    } catch (cause) { setConfirm(closedConfirm); setError(userFacingClientError(cause)) } finally { setSaving(false) }
  }

  return <CreationLayout eyebrow="Administración · identidad" title="Registrar persona" description="Crea una cuenta de acceso y, si corresponde, vincula su credencial RFID." backHref="/admin/personas">
    <CreationCard title="Datos de la persona" description="Los campos marcados son necesarios para crear la cuenta." icon={<UserRound className="size-5" />}>
      {success && <div className="mb-5"><CreationNotice tone="success" title="Persona creada">La cuenta y sus datos de acceso ya están registrados. Puedes continuar con permisos o volver al listado.</CreationNotice><Link href="/admin/personas" className="mt-3 inline-flex min-h-10 items-center rounded-xl bg-[#087f7b] px-4 text-sm font-semibold text-white">Ver personas</Link></div>}
      {error && <div className="mb-5"><CreationNotice title="No se pudo crear la persona">{error}</CreationNotice></div>}
      <form ref={formRef} onSubmit={submit} className="grid min-w-0 gap-x-5 gap-y-5 md:grid-cols-2">
        <Field label="Nombre completo" icon={<UserRound className="size-4" />} className="md:col-span-2"><input required name="full_name" minLength={2} maxLength={150} autoComplete="name" placeholder="Ej. Daniela López García" className={creationInputClass} /></Field>
        <Field label="Correo institucional" icon={<Mail className="size-4" />} hint="Se utilizará para iniciar sesión."><input required name="email" type="email" maxLength={254} autoComplete="email" placeholder="nombre@institucion.edu" className={creationInputClass} /></Field>
        <Field label="Contraseña" icon={<KeyRound className="size-4" />} hint="Mínimo 12 caracteres."><input required name="password" minLength={12} maxLength={128} type="password" autoComplete="new-password" placeholder="Define una contraseña segura" className={creationInputClass} /></Field>
        <Field label="Rol" icon={<ShieldCheck className="size-4" />}><select required name="role_code" defaultValue="" disabled={rolesLoading || Boolean(rolesError) || roles.length === 0} className={creationInputClass}><option value="" disabled>{rolesLoading ? 'Cargando roles…' : 'Selecciona un rol'}</option>{roles.map((role) => <option key={String(role.code)} value={String(role.code)}>{String(role.name ?? role.code)}</option>)}</select>{rolesError && <span role="alert" className="text-xs font-normal text-rose-700">No se pudieron consultar los roles. Actualiza la página e inténtalo de nuevo.</span>}{!rolesLoading && !rolesError && roles.length === 0 && <span className="text-xs font-normal text-amber-800">No hay roles disponibles para asignar.</span>}</Field>
        <Field label="UID de tarjeta RFID" icon={<Fingerprint className="size-4" />} hint="Opcional · se normaliza a mayúsculas."><input name="rfid_uid" minLength={4} maxLength={64} autoCapitalize="characters" placeholder="04-A1-B2-C3" className={`${creationInputClass} font-mono`} /></Field>
        <Field label="Etiqueta de tarjeta" icon={<Tag className="size-4" />} hint="Solo se guarda si se indicó un UID."><input name="card_label" maxLength={80} placeholder="Credencial principal" className={creationInputClass} /></Field>
        <div className="md:col-span-2"><CreationActions cancelHref="/admin/personas" submitLabel="Crear persona" saving={saving} disabled={rolesLoading || Boolean(rolesError) || roles.length === 0} /></div>
      </form>
    </CreationCard>
    <CreationAside title="Antes de crear la cuenta"><p>Verifica que el correo pertenezca a la persona y que el rol corresponda a su responsabilidad.</p><div className="rounded-xl border border-[#dce7e8] bg-white p-4"><p className="flex items-center gap-2 font-semibold text-[#36515b]"><Fingerprint className="size-4 text-[#087f7b]" />Credencial RFID</p><p className="mt-2 text-xs leading-5">Puedes omitirla y vincular una tarjeta más adelante desde el perfil de la persona.</p></div><p>La creación no asigna permisos a cuartos por sí sola.</p></CreationAside>
    <CreateConfirmDialog open={confirm.open} title={confirm.title} description={confirm.description} loading={saving} onCancel={() => setConfirm(closedConfirm)} onConfirm={() => void create()} />
  </CreationLayout>
}

export function LiveRoomForm() {
  const formRef = useRef<HTMLFormElement>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [createdRoom, setCreatedRoom] = useState<{ id: number; name: string; code: string } | null>(null)
  const [confirm, setConfirm] = useState(closedConfirm)
  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); setError(''); setCreatedRoom(null); setConfirm({ open: true, title: 'Registrar cuarto limpio', description: 'Confirma los datos base y el nivel de acceso antes de guardar el nuevo espacio.' }) }
  const create = async () => { const form = formRef.current; if (!form) return; const data = new FormData(form); setSaving(true); setError(''); try { const room = await api.createRoom({ code: String(data.get('code') ?? '').trim(), name: String(data.get('name') ?? '').trim(), location: String(data.get('location') ?? '').trim(), description: String(data.get('description') ?? '').trim(), access_level: String(data.get('access_level') ?? 'STANDARD'), status: String(data.get('status') ?? 'ACTIVE') }); setConfirm(closedConfirm); setCreatedRoom({ id: room.id, name: room.name, code: room.code }); form.reset() } catch (cause) { setConfirm(closedConfirm); setError(userFacingClientError(cause)) } finally { setSaving(false) } }
  return <CreationLayout eyebrow="Administración · espacios" title="Registrar cuarto" description="Da de alta un espacio y define su ubicación, clasificación de acceso y estado inicial." backHref="/admin/cuartos"><CreationCard title="Información del espacio" description="Los datos pueden completarse o actualizarse desde la ficha del cuarto." icon={<Building2 className="size-5" />}>
    {createdRoom && <div className="mb-5"><CreationNotice tone="success" title={`Cuarto ${createdRoom.code} creado`}>{createdRoom.name} ya está registrado. Puedes abrir su ficha para configurar parámetros y dispositivos.</CreationNotice><div className="mt-3 flex flex-wrap gap-2"><Link href={`/admin/cuartos/${createdRoom.id}`} className="inline-flex min-h-10 items-center rounded-xl bg-[#087f7b] px-4 text-sm font-semibold text-white">Abrir ficha</Link><Link href="/admin/cuartos" className="inline-flex min-h-10 items-center rounded-xl border border-[#dce7e8] px-4 text-sm font-semibold text-[#526c75]">Ver inventario</Link></div></div>}{error && <div className="mb-5"><CreationNotice title="No se pudo crear el cuarto">{error}</CreationNotice></div>}
    <form ref={formRef} onSubmit={submit} className="grid min-w-0 gap-x-5 gap-y-5 md:grid-cols-2"><Field label="Código del cuarto" icon={<Hash className="size-4" />} hint="Identificador único y corto."><input required name="code" minLength={1} maxLength={50} autoComplete="off" placeholder="Ej. CL-01" className={`${creationInputClass} font-mono`} /></Field><Field label="Nombre" icon={<Building2 className="size-4" />}><input required name="name" minLength={2} maxLength={120} placeholder="Ej. Producción estéril" className={creationInputClass} /></Field><Field label="Ubicación" icon={<MapPin className="size-4" />} hint="Edificio, piso o zona."><input name="location" maxLength={150} placeholder="Edificio A · Planta baja" className={creationInputClass} /></Field><Field label="Nivel de acceso" icon={<ShieldCheck className="size-4" />}><select name="access_level" defaultValue="STANDARD" className={creationInputClass}><option value="STANDARD">Estándar</option><option value="RESTRICTED">Restringido</option><option value="HIGH_SECURITY">Alta seguridad</option></select></Field><Field label="Descripción" hint="Contexto útil para quienes administran el espacio." className="md:col-span-2"><textarea name="description" maxLength={1000} rows={3} placeholder="Uso, condiciones o notas del cuarto" className={`${creationInputClass} min-h-28 resize-y py-3`} /></Field><Field label="Estado inicial" icon={<Wifi className="size-4" />}><select name="status" defaultValue="ACTIVE" className={creationInputClass}><option value="ACTIVE">Activo</option><option value="INACTIVE">Inactivo</option></select></Field><div className="md:col-span-2"><CreationActions cancelHref="/admin/cuartos" submitLabel="Crear cuarto" saving={saving} /></div></form>
  </CreationCard><CreationAside title="Configuración del espacio"><p>El cuarto aparecerá en el inventario y podrá recibir permisos, dispositivos y lecturas.</p><div className="rounded-xl border border-[#dce7e8] bg-white p-4"><p className="font-semibold text-[#36515b]">Después del registro</p><p className="mt-2 text-xs leading-5">Abre su ficha para definir rangos ambientales y consultar actividad vinculada.</p></div><p>El código y el nombre son obligatorios; la ubicación y descripción pueden añadirse después.</p></CreationAside><CreateConfirmDialog open={confirm.open} title={confirm.title} description={confirm.description} loading={saving} onCancel={() => setConfirm(closedConfirm)} onConfirm={() => void create()} /></CreationLayout>
}

export function LiveDeviceForm() {
  const formRef = useRef<HTMLFormElement>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [created, setCreated] = useState<{ code: string; key: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const [confirm, setConfirm] = useState(closedConfirm)
  const { data: roomData, isLoading: roomsLoading, error: roomsError } = useSWR<ApiRoom[]>('new-device-rooms', () => api.rooms())
  const rooms = Array.isArray(roomData) ? roomData : []
  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); setError(''); setCreated(null); setConfirm({ open: true, title: 'Registrar dispositivo', description: 'Verifica el cuarto asignado, el código y el número de serie. La llave de API solo se mostrará al finalizar.' }) }
  const create = async () => { const form = formRef.current; if (!form) return; const data = new FormData(form); setSaving(true); setError(''); setCreated(null); try { const result = await api.createDevice({ cleanroom_id: Number(data.get('cleanroom_id')), code: String(data.get('code') ?? '').trim(), type: String(data.get('type') ?? '').trim(), serial_number: String(data.get('serial_number') ?? '').trim() }) as { code?: string; api_key?: string }; if (!result.api_key) throw new Error('El dispositivo se creó, pero la API no devolvió su llave. Regenera una desde el inventario.'); setCreated({ code: result.code ?? String(data.get('code')), key: result.api_key }); setConfirm(closedConfirm); form.reset() } catch (cause) { setConfirm(closedConfirm); setError(userFacingClientError(cause)) } finally { setSaving(false) } }
  const copyKey = async () => { if (!created) return; try { await navigator.clipboard.writeText(created.key); setCopied(true); window.setTimeout(() => setCopied(false), 1800) } catch { setError('No se pudo copiar la llave. Selecciónala y cópiala manualmente.') } }
  return <CreationLayout eyebrow="Administración · hardware" title="Registrar dispositivo" description="Vincula un equipo al cuarto donde operará. Su llave de API aparecerá una sola vez al crearlo." backHref="/admin/dispositivos"><CreationCard title="Datos del dispositivo" description="Usa los identificadores impresos en el equipo para evitar errores de vinculación." icon={<Cpu className="size-5" />}>
    {created && <div className="mb-5 space-y-3"><CreationNotice tone="success" title={`Dispositivo ${created.code} registrado`}>Guarda la llave ahora: no volverá a mostrarse en esta pantalla.</CreationNotice><div className="rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="text-xs font-bold uppercase tracking-wide text-amber-900">Llave de API · visible una sola vez</p><div className="mt-2 flex flex-col gap-2 sm:flex-row"><code className="min-w-0 flex-1 break-all rounded-lg border border-amber-200 bg-white p-3 text-xs text-[#163542]">{created.key}</code><button type="button" onClick={() => void copyKey()} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-amber-300 bg-white px-3 text-sm font-semibold text-amber-950 hover:bg-amber-100">{copied ? <Check className="size-4" /> : <Copy className="size-4" />}{copied ? 'Copiada' : 'Copiar llave'}</button></div></div><Link href="/admin/dispositivos" className="inline-flex min-h-10 items-center rounded-xl bg-[#087f7b] px-4 text-sm font-semibold text-white">Ir al inventario</Link></div>}{error && <div className="mb-5"><CreationNotice title="No se pudo crear el dispositivo">{error}</CreationNotice></div>}
    <form ref={formRef} onSubmit={submit} className="grid min-w-0 gap-x-5 gap-y-5 md:grid-cols-2"><Field label="Cuarto asignado" icon={<Building2 className="size-4" />}><select required name="cleanroom_id" defaultValue="" disabled={roomsLoading || Boolean(roomsError) || rooms.length === 0} className={creationInputClass}><option value="" disabled>{roomsLoading ? 'Cargando cuartos…' : 'Selecciona un cuarto'}</option>{rooms.map((room) => <option key={room.id} value={room.id}>{room.name} · {room.code}</option>)}</select>{roomsError && <span role="alert" className="text-xs font-normal text-rose-700">No se pudieron cargar los cuartos. Actualiza la página.</span>}{!roomsLoading && !roomsError && rooms.length === 0 && <span className="text-xs font-normal text-amber-800">Registra un cuarto antes de vincular un dispositivo.</span>}</Field><Field label="Código del dispositivo" icon={<Hash className="size-4" />}><input required name="code" maxLength={80} autoComplete="off" placeholder="Ej. ESP32-CL01" className={`${creationInputClass} font-mono`} /></Field><Field label="Tipo de equipo" icon={<Cpu className="size-4" />}><input required name="type" maxLength={100} placeholder="Ej. ESP32" className={creationInputClass} /></Field><Field label="Número de serie" icon={<Tag className="size-4" />}><input required name="serial_number" maxLength={120} autoComplete="off" placeholder="Número impreso en el equipo" className={`${creationInputClass} font-mono`} /></Field><div className="md:col-span-2"><CreationActions cancelHref="/admin/dispositivos" submitLabel="Crear dispositivo" saving={saving} disabled={roomsLoading || Boolean(roomsError) || rooms.length === 0} /></div></form>
  </CreationCard><CreationAside title="Vinculación y credenciales"><p>El dispositivo quedará asociado al cuarto que selecciones y usará su código para autenticarse.</p><div className="rounded-xl border border-[#dce7e8] bg-white p-4"><p className="flex items-center gap-2 font-semibold text-[#36515b]"><KeyRound className="size-4 text-[#087f7b]" />Protege la llave</p><p className="mt-2 text-xs leading-5">Cópiala al entorno del firmware y guárdala en un gestor seguro. No la compartas en capturas o chats.</p></div><div className="rounded-xl border border-[#dce7e8] bg-white p-4"><p className="font-semibold text-[#36515b]">API del dispositivo</p><p className="mt-2 text-xs leading-5">La autenticación y el envío de lecturas se realizan con los endpoints de IoT disponibles.</p></div></CreationAside><CreateConfirmDialog open={confirm.open} title={confirm.title} description={confirm.description} loading={saving} onCancel={() => setConfirm(closedConfirm)} onConfirm={() => void create()} /></CreationLayout>
}
