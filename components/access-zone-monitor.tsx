'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import {
  AlertTriangle,
  BellRing,
  CheckCircle2,
  CreditCard,
  DoorOpen,
  Filter,
  LoaderCircle,
  Lock,
  LogOut,
  RefreshCw,
  ScanFace,
  Search,
  ShieldAlert,
  ShieldX,
  UserPlus,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react'
import {
  api,
  type ApiAccessEvent,
  type ApiPerson,
  type SupervisorRoomSummary,
  type SupervisorSummary,
} from '@/lib/api'
import { userFacingClientError } from '@/lib/user-facing-errors.mjs'
import { useRealtimeEvents } from '@/hooks/use-realtime-events'
import {
  AccessSimulatorPanel,
  type SimulatedZoneFeedback,
} from '@/components/access-simulator-panel'

type ZoneAnimState = {
  phase: 'idle' | 'scanning' | 'grant' | 'deny' | 'lockout' | 'anomaly' | 'exit'
  doorOpen: boolean
  reader: 'entry' | 'exit' | null
  scanning: boolean
  walkerVisible: boolean
  walkerX: number
  walkerY: number
  walkerColor: string
  walkerShake: boolean
  statusTitle: string
  statusDetail: string
}

const DEFAULT_ANIM: ZoneAnimState = {
  phase: 'idle',
  doorOpen: false,
  reader: null,
  scanning: false,
  walkerVisible: false,
  walkerX: 200,
  walkerY: 285,
  walkerColor: '#64748b',
  walkerShake: false,
  statusTitle: 'Lector entrada-principal listo · esperando tarjeta',
  statusDetail: 'Validación RFID y facial activa en esclusa Entrada Principal',
}

function occupantSlot(index: number) {
  return {
    x: 52 + (index % 6) * 58,
    y: 98 + Math.floor(index / 6) * 26,
  }
}

function formatTime(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function formatDateTime(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'medium' })
}

const DENIAL_LABELS: Record<string, string> = {
  NO_PERMISSION: 'Sin permiso para esta zona',
  PERSON_INACTIVE: 'Persona inactiva o vigencia vencida',
  CARD_NOT_FOUND: 'Tarjeta no registrada',
  CARD_INACTIVE: 'Tarjeta inactiva o vencida',
  ROOM_FULL: 'Aforo máximo alcanzado',
  unknown_tag: 'Tarjeta RFID no registrada',
  inactive_tag: 'Tarjeta RFID inactiva',
  unassigned_tag: 'Tarjeta sin empleado asignado',
  inactive_employee: 'Trabajador inactivo',
  no_permission_for_door: 'Sin autorización para esta puerta',
  unknown_face: 'Rostro no reconocido en base biométrica',
  no_face_detected: 'Rostro no detectado por la cámara',
  offline_denied: 'Acceso rechazado en modo offline',
}

function playSecurityBeep() {
  if (typeof window === 'undefined') return
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(587.33, ctx.currentTime) // D5
    osc.frequency.setValueAtTime(440, ctx.currentTime + 0.14) // A4
    gain.gain.setValueAtTime(0.18, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.38)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.38)
  } catch {
    // Ignore audio autoplay restrictions
  }
}

export function AccessZoneMonitor() {
  // SWR polling ensures live sync even if SSE reconnects
  const {
    data: summary,
    error: summaryError,
    isLoading: summaryLoading,
    mutate: mutateSummary,
  } = useSWR<SupervisorSummary>('supervisor-summary', api.supervisorSummary, { refreshInterval: 3000 })

  const {
    data: accessesRaw,
    isLoading: accessesLoading,
    mutate: mutateAccesses,
  } = useSWR<ApiAccessEvent[]>('access-events', api.accesses, { refreshInterval: 2500 })

  const { data: peopleRaw } = useSWR('people-lookup', () => api.people())
  const { data: employeesRaw } = useSWR('employees-lookup', api.employees)

  const [zoneStates, setZoneStates] = useState<Record<number, ZoneAnimState>>({})
  const timersRef = useRef<Record<number, ReturnType<typeof setTimeout>[]>>({})

  const [roomFilter, setRoomFilter] = useState<string>('ALL')
  const [resultFilter, setResultFilter] = useState<string>('ALL')
  const [directionFilter, setDirectionFilter] = useState<string>('ALL')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [soundEnabled, setSoundEnabled] = useState(true)

  // Prominent High-Visibility Security Alert
  const [securityAlert, setSecurityAlert] = useState<{
    id: number
    title: string
    doorId: string
    doorName: string
    method: 'RFID' | 'FACIAL'
    personName: string
    uid: string
    reason: string
    time: string
  } | null>(null)

  // Top banner for general live notification
  const [liveNotification, setLiveNotification] = useState<{
    id: number
    title: string
    detail: string
    allowed: boolean
    time: string
    uid: string
  } | null>(null)

  const rooms = summary?.rooms ?? []
  const accesses = useMemo(
    () => (Array.isArray(accessesRaw) ? accessesRaw : []),
    [accessesRaw],
  )

  const peopleById = useMemo(() => {
    const list: ApiPerson[] = Array.isArray(peopleRaw)
      ? peopleRaw
      : peopleRaw && typeof peopleRaw === 'object'
        ? (peopleRaw.items ?? peopleRaw.data ?? [])
        : []
    const map = new Map<number, string>()
    for (const person of list) {
      const label = person.full_name ?? person.name ?? person.email
      if (typeof person.id === 'number' && typeof label === 'string') {
        map.set(person.id, label)
      }
    }
    return map
  }, [peopleRaw])

  const employeeById = useMemo(() => {
    const list = Array.isArray(employeesRaw) ? employeesRaw : []
    const map = new Map<number, string>()
    for (const emp of list) {
      map.set(emp.id, `${emp.firstName} ${emp.lastName}`)
    }
    return map
  }, [employeesRaw])

  const roomById = useMemo(() => {
    const map = new Map<number, SupervisorRoomSummary>()
    for (const room of rooms) {
      map.set(room.id, room)
    }
    return map
  }, [rooms])

  const clearRoomTimers = (roomId: number) => {
    const existing = timersRef.current[roomId] ?? []
    for (const timer of existing) clearTimeout(timer)
    timersRef.current[roomId] = []
  }

  useEffect(() => {
    const allTimers = timersRef.current
    return () => {
      for (const list of Object.values(allTimers)) {
        for (const timer of list) clearTimeout(timer)
      }
    }
  }, [])

  const triggerZoneAnimation = useCallback((event: SimulatedZoneFeedback) => {
    const roomId = event.cleanroomId
    clearRoomTimers(roomId)

    const queueTimer = (delay: number, fn: () => void) => {
      const handle = setTimeout(fn, delay)
      timersRef.current[roomId] = [...(timersRef.current[roomId] ?? []), handle]
    }

    if (event.kind === 'anomaly') {
      setZoneStates((prev) => ({
        ...prev,
        [roomId]: {
          ...DEFAULT_ANIM,
          phase: 'anomaly',
          statusTitle: 'Anomalía de seguridad en esclusa',
          statusDetail: event.detail,
        },
      }))
      queueTimer(4500, () => {
        setZoneStates((prev) => ({ ...prev, [roomId]: DEFAULT_ANIM }))
      })
      return
    }

    if (event.kind === 'exit') {
      setZoneStates((prev) => ({
        ...prev,
        [roomId]: {
          ...DEFAULT_ANIM,
          phase: 'scanning',
          reader: 'exit',
          scanning: true,
          walkerVisible: true,
          walkerX: 190,
          walkerY: 112,
          walkerColor: '#0284c7',
          statusTitle: 'Validando salida en lector…',
          statusDetail: `Identificador ${event.uid}`,
        },
      }))
      queueTimer(350, () => {
        setZoneStates((prev) => ({
          ...prev,
          [roomId]: {
            ...(prev[roomId] ?? DEFAULT_ANIM),
            phase: 'exit',
            doorOpen: true,
            scanning: false,
            walkerX: 200,
            walkerY: 175,
            statusTitle: 'Salida registrada en Entrada Principal',
            statusDetail: event.detail,
          },
        }))
      })
      queueTimer(1100, () => {
        setZoneStates((prev) => ({
          ...prev,
          [roomId]: {
            ...(prev[roomId] ?? DEFAULT_ANIM),
            walkerX: 315,
            walkerY: 288,
          },
        }))
      })
      queueTimer(1700, () => {
        setZoneStates((prev) => ({
          ...prev,
          [roomId]: {
            ...(prev[roomId] ?? DEFAULT_ANIM),
            doorOpen: false,
            walkerVisible: false,
          },
        }))
      })
      queueTimer(3600, () => {
        setZoneStates((prev) => ({ ...prev, [roomId]: DEFAULT_ANIM }))
      })
      return
    }

    const isGrant = event.kind === 'entry-grant'
    const isLock = event.kind === 'lockout'

    setZoneStates((prev) => ({
      ...prev,
      [roomId]: {
        ...DEFAULT_ANIM,
        phase: 'scanning',
        reader: 'entry',
        scanning: true,
        walkerVisible: true,
        walkerX: 195,
        walkerY: 215,
        walkerColor: '#64748b',
        statusTitle: 'Identificando credencial en entrada-principal…',
        statusDetail: `${event.uid}`,
      },
    }))

    queueTimer(450, () => {
      setZoneStates((prev) => ({
        ...prev,
        [roomId]: {
          ...(prev[roomId] ?? DEFAULT_ANIM),
          phase: isGrant ? 'grant' : isLock ? 'lockout' : 'deny',
          doorOpen: isGrant,
          scanning: false,
          walkerColor: isGrant ? '#10b981' : '#f43f5e',
          walkerShake: !isGrant,
          walkerX: isGrant ? 200 : 120,
          walkerY: isGrant ? 120 : 275,
          statusTitle: isGrant
            ? '¡Acceso Concedido en Entrada Principal!'
            : isLock
              ? '¡Esclusa Bloqueada por Seguridad!'
              : '¡Alerta: Acceso Denegado en Entrada Principal!',
          statusDetail: event.detail,
        },
      }))
    })

    if (isGrant) {
      queueTimer(1150, () => {
        setZoneStates((prev) => ({
          ...prev,
          [roomId]: {
            ...(prev[roomId] ?? DEFAULT_ANIM),
            walkerX: 96,
            walkerY: 98,
          },
        }))
      })
    }

    queueTimer(1850, () => {
      setZoneStates((prev) => ({
        ...prev,
        [roomId]: {
          ...(prev[roomId] ?? DEFAULT_ANIM),
          doorOpen: false,
          walkerVisible: false,
          walkerShake: false,
        },
      }))
    })

    queueTimer(4200, () => {
      setZoneStates((prev) => ({ ...prev, [roomId]: DEFAULT_ANIM }))
    })
  }, [])

  const { status: realtimeStatus } = useRealtimeEvents({
    mutateKeys: ['supervisor-summary', 'access-events'],
    onEvent: (eventType, payload) => {
      if (eventType === 'access_event') {
        const direction = String(payload.direction ?? 'ENTRY').toUpperCase()
        const result = String(payload.result ?? 'ALLOWED').toUpperCase()
        const isAllowed = result === 'ALLOWED'
        const method = String(payload.method ?? (payload.event_type === 'FACIAL' ? 'FACIAL' : 'RFID')).toUpperCase() as 'RFID' | 'FACIAL'
        const isFacial = method === 'FACIAL'
        const rawReason = typeof payload.denial_reason === 'string' ? payload.denial_reason : (payload.reason ? String(payload.reason) : '')
        const friendlyReason = DENIAL_LABELS[rawReason] ?? rawReason
        const personName = payload.person_name ? String(payload.person_name) : ''
        const doorId = payload.door_id ? String(payload.door_id) : 'entrada-principal'
        const doorDisplayName = doorId === 'entrada-principal' ? 'Entrada Principal' : doorId
        const uidStr = String(payload.uid ?? payload.rfid_uid ?? '')
        const timeStr = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

        // General Notification Banner
        setLiveNotification({
          id: Date.now(),
          title: isAllowed
            ? (isFacial ? '¡Acceso Facial Concedido!' : '¡Acceso Concedido!')
            : (isFacial ? 'Alerta: Acceso Facial Denegado' : 'Alerta: Acceso Denegado'),
          detail: isFacial
            ? `${personName || 'Rostro no identificado'} en ${doorDisplayName}${friendlyReason ? ` · Motivo: ${friendlyReason}` : ''}`
            : `${personName || (uidStr ? `Tarjeta ${uidStr}` : 'Personal no registrado')} en ${doorDisplayName}${friendlyReason ? ` · Motivo: ${friendlyReason}` : ''}`,
          allowed: isAllowed,
          time: timeStr,
          uid: uidStr,
        })

        // High-Visibility Modal Alert if access was DENIED
        if (!isAllowed) {
          if (soundEnabled) {
            playSecurityBeep()
          }
          setSecurityAlert({
            id: Date.now(),
            title: isFacial
              ? 'ALERTA DE SEGURIDAD: ACCESO FACIAL DENEGADO'
              : 'ALERTA DE SEGURIDAD: ACCESO DENEGADO (RFID)',
            doorId,
            doorName: doorDisplayName,
            method,
            personName: personName || (isFacial ? 'Rostro no identificado' : (uidStr ? `Tarjeta desconocida (${uidStr})` : 'Personal no registrado')),
            uid: uidStr,
            reason: friendlyReason || 'Credencial o tarjeta no autorizada en esta esclusa',
            time: timeStr,
          })
        }

        const cleanroomId = typeof payload.cleanroom_id === 'number' ? payload.cleanroom_id : (rooms[0]?.id ?? 1)
        triggerZoneAnimation({
          cleanroomId,
          kind:
            direction === 'EXIT'
              ? 'exit'
              : isAllowed
                ? 'entry-grant'
                : rawReason === 'LOCKED'
                  ? 'lockout'
                  : 'entry-deny',
          uid: uidStr || `#${payload.event_id ?? ''}`,
          detail: friendlyReason || (isFacial ? 'Verificación facial' : 'Validación de tarjeta'),
        })
      } else if (eventType === 'alert_created') {
        const timeStr = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        const message = String(payload.message ?? 'Alerta de acceso emitida')
        if (soundEnabled) {
          playSecurityBeep()
        }
        setSecurityAlert({
          id: Date.now(),
          title: 'ALERTA DE SEGURIDAD CRÍTICA',
          doorId: 'entrada-principal',
          doorName: 'Entrada Principal',
          method: 'RFID',
          personName: 'Alerta del sistema',
          uid: 'ALERTA',
          reason: message,
          time: timeStr,
        })
        const cleanroomId = typeof payload.cleanroom_id === 'number' ? payload.cleanroom_id : (rooms[0]?.id ?? 1)
        triggerZoneAnimation({
          cleanroomId,
          kind: 'anomaly',
          uid: 'ALERTA',
          detail: message,
        })
      }
    },
  })

  // Resolves the human name for an access event
  const resolvePersonName = useCallback(
    (evt: ApiAccessEvent): string => {
      if (typeof evt.person_name === 'string' && evt.person_name.trim()) {
        return evt.person_name.trim()
      }
      if (typeof evt.user_id === 'number') {
        const found = peopleById.get(evt.user_id)
        if (found) return found
      }
      if (typeof evt.employee_id === 'number') {
        const foundEmp = employeeById.get(evt.employee_id)
        if (foundEmp) return foundEmp
      }
      if (typeof evt.rfid_uid === 'string' && evt.rfid_uid.trim()) {
        return `Tarjeta ${evt.rfid_uid}`
      }
      return 'Personal no registrado'
    },
    [peopleById, employeeById]
  )

  const filteredAccesses = useMemo(() => {
    const term = searchQuery.trim().toLowerCase()
    return accesses.filter((item) => {
      if (roomFilter !== 'ALL' && String(item.cleanroom_id) !== roomFilter) return false
      if (resultFilter !== 'ALL' && item.result.toUpperCase() !== resultFilter) return false
      if (directionFilter !== 'ALL' && item.direction.toUpperCase() !== directionFilter) return false
      if (!term) return true
      const personName = resolvePersonName(item)
      const roomCode = roomById.get(item.cleanroom_id)?.code ?? `Cuarto #${item.cleanroom_id}`
      const doorId = String(item.door_id ?? 'entrada-principal')
      const uidStr = String(item.rfid_uid ?? '')
      const reasonStr = String(item.denial_reason ?? '')
      const hay = `${personName} ${roomCode} ${doorId} ${uidStr} ${reasonStr} ${item.direction} ${item.result}`.toLowerCase()
      return hay.includes(term)
    })
  }, [accesses, roomFilter, resultFilter, directionFilter, searchQuery, resolvePersonName, roomById])

  return (
    <div className="flex flex-col gap-6">
      {/* MODAL DE ALERTA DE SEGURIDAD EN ALTO IMPACTO (ACCESO DENEGADO) */}
      {securityAlert && (
        <div
          role="alertdialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200"
        >
          <div className="w-full max-w-lg rounded-2xl border-2 border-rose-500 bg-white p-6 shadow-2xl dark:bg-[#101e26] dark:border-rose-600">
            {/* Cabecera de Alerta con luz intermitente */}
            <div className="flex items-start justify-between border-b border-rose-200 pb-4 dark:border-rose-900/50">
              <div className="flex items-center gap-3">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-rose-600 text-white shadow-lg shadow-rose-600/30 animate-pulse">
                  <ShieldAlert className="size-7" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-rose-100 px-2.5 py-0.5 font-mono text-[10px] font-bold text-rose-800 uppercase dark:bg-rose-950/80 dark:text-rose-300">
                      Incidencia en tiempo real
                    </span>
                    <span className="font-mono text-xs font-semibold text-rose-600 dark:text-rose-400">
                      {securityAlert.time}
                    </span>
                  </div>
                  <h3 className="mt-1 text-base font-extrabold text-rose-950 dark:text-rose-100">
                    {securityAlert.title}
                  </h3>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSecurityAlert(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-[#182b36] dark:hover:text-slate-200"
                aria-label="Cerrar alerta"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Detalles estructurados del intento de acceso */}
            <div className="mt-4 grid gap-3 rounded-xl bg-rose-50/70 p-4 text-xs dark:bg-rose-950/30">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-rose-900 dark:text-rose-300">Puerta / Esclusa:</span>
                <span className="inline-flex items-center gap-1.5 font-bold text-rose-950 dark:text-rose-100">
                  <DoorOpen className="size-3.5 text-rose-600" />
                  {securityAlert.doorName} ({securityAlert.doorId})
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="font-semibold text-rose-900 dark:text-rose-300">Método de acceso:</span>
                <span className="inline-flex items-center gap-1.5 rounded-md bg-white px-2 py-0.5 font-mono font-bold text-rose-900 shadow-sm dark:bg-[#13222b] dark:text-rose-200">
                  {securityAlert.method === 'FACIAL' ? <ScanFace className="size-3" /> : <CreditCard className="size-3" />}
                  {securityAlert.method}
                </span>
              </div>

              {securityAlert.uid && securityAlert.uid !== 'ALERTA' && (
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-rose-900 dark:text-rose-300">Código UID de tarjeta:</span>
                  <code className="rounded bg-white px-2 py-0.5 font-mono font-bold text-rose-900 shadow-sm dark:bg-[#13222b] dark:text-rose-200">
                    {securityAlert.uid}
                  </code>
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="font-semibold text-rose-900 dark:text-rose-300">Persona / Identidad:</span>
                <span className="font-bold text-rose-950 dark:text-rose-100">{securityAlert.personName}</span>
              </div>

              <div className="border-t border-rose-200/80 pt-2.5 dark:border-rose-900/40">
                <span className="font-semibold text-rose-900 dark:text-rose-300">Motivo del bloqueo:</span>
                <p className="mt-0.5 text-xs font-bold text-rose-800 dark:text-rose-200">
                  {securityAlert.reason}
                </p>
              </div>
            </div>

            {/* Botones de acción rápida */}
            <div className="mt-5 flex flex-wrap items-center justify-end gap-2.5">
              {securityAlert.uid && securityAlert.uid !== 'ALERTA' && !securityAlert.uid.startsWith('FACE-') && (
                <Link
                  href="/admin/personas"
                  onClick={() => setSecurityAlert(null)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[#087f7b] bg-[#087f7b]/10 px-3.5 py-2 text-xs font-semibold text-[#087f7b] transition hover:bg-[#087f7b]/20 dark:border-[#2dd4bf] dark:text-[#2dd4bf]"
                >
                  <UserPlus className="size-3.5" />
                  Asignar tarjeta en Personas
                </Link>
              )}
              <button
                type="button"
                onClick={() => setSecurityAlert(null)}
                className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-rose-600/30 transition hover:bg-rose-700"
              >
                Entendido / Descartar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notificación en vivo flotante de acceso físico */}
      {liveNotification && (
        <div
          role="alert"
          className={`flex items-center justify-between gap-3 rounded-2xl border p-4 shadow-lg transition-all ${
            liveNotification.allowed
              ? 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-950/70 dark:text-emerald-200'
              : 'border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-500/40 dark:bg-rose-950/70 dark:text-rose-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`flex size-10 shrink-0 items-center justify-center rounded-xl text-white ${
                liveNotification.allowed ? 'bg-emerald-600' : 'bg-rose-600'
              }`}
            >
              {liveNotification.allowed ? <CheckCircle2 className="size-6" /> : <ShieldX className="size-6" />}
            </div>
            <div>
              <p className="text-sm font-bold flex items-center gap-2">
                {liveNotification.title}
                <span className="font-mono text-xs font-normal opacity-80">({liveNotification.time})</span>
              </p>
              <p className="text-xs opacity-90">{liveNotification.detail}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setLiveNotification(null)}
            className="rounded-lg p-1.5 opacity-70 hover:opacity-100 font-bold"
            aria-label="Cerrar notificación"
          >
            ✕
          </button>
        </div>
      )}

      {/* Encabezado */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#087f7b] dark:text-[#2dd4bf]">
            Supervisión · Control de Acceso Físico
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-[#102d3b] dark:text-[#e6f0f2]">
            Monitoreo de esclusas y accesos
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm text-[#718995] dark:text-[#94adb8]">
            Planos 2D en vivo de esclusas, estado de la Entrada Principal y bitácora unificada conectada a lectores IoT y cámaras.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setSoundEnabled((prev) => !prev)}
            title={soundEnabled ? 'Silenciar alertas sonoras' : 'Activar alertas sonoras'}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#dce8eb] bg-white px-3 py-1.5 text-xs font-semibold text-[#29434e] transition hover:bg-[#f4f9f8] dark:border-[#233a47] dark:bg-[#101e26] dark:text-[#e6f0f2]"
          >
            {soundEnabled ? <Volume2 className="size-3.5 text-[#087f7b]" /> : <VolumeX className="size-3.5 text-slate-400" />}
            {soundEnabled ? 'Sonido activo' : 'Silenciado'}
          </button>

          <span
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${
              realtimeStatus === 'connected'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300'
                : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-300'
            }`}
          >
            <span
              className={`size-2 rounded-full ${
                realtimeStatus === 'connected' ? 'animate-pulse bg-emerald-500' : 'bg-amber-500'
              }`}
            />
            {realtimeStatus === 'connected' ? 'Esclusas sincronizadas' : 'Sincronizando…'}
          </span>

          <button
            type="button"
            onClick={() => {
              void mutateSummary()
              void mutateAccesses()
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-[#dce8eb] bg-white px-3.5 py-2 text-xs font-semibold text-[#29434e] transition hover:bg-[#f4f9f8] dark:border-[#233a47] dark:bg-[#101e26] dark:text-[#e6f0f2] dark:hover:bg-[#182b36]"
          >
            <RefreshCw className="size-3.5" />
            Actualizar
          </button>
        </div>
      </div>

      {/* KPIs rápidos */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <MiniStat label="Eventos" value={summaryLoading ? '—' : String(summary?.total_events ?? 0)} />
        <MiniStat label="Entradas" value={summaryLoading ? '—' : String(summary?.entries ?? 0)} accent="emerald" />
        <MiniStat label="Salidas" value={summaryLoading ? '—' : String(summary?.exits ?? 0)} accent="sky" />
        <MiniStat label="Denegados" value={summaryLoading ? '—' : String(summary?.denied ?? 0)} accent="rose" />
        <MiniStat label="Personas dentro" value={summaryLoading ? '—' : String(summary?.current_occupancy ?? 0)} accent="teal" />
      </section>

      {/* Simulador de acceso */}
      {process.env.NEXT_PUBLIC_ENABLE_ACCESS_SIMULATOR !== 'false' && rooms.length > 0 && (
        <AccessSimulatorPanel rooms={rooms} onSimulationEvent={triggerZoneAnimation} />
      )}

      {summaryError && (
        <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-950/40 dark:text-red-200">
          No se pudieron cargar las zonas de acceso: {userFacingClientError(summaryError)}
        </div>
      )}

      {/* Planos 2D dinámicos por cada Cleanroom con identificación explícita de Entrada Principal */}
      {summaryLoading ? (
        <div className="flex min-h-48 items-center justify-center gap-2 rounded-2xl border border-[#e5edf0] bg-white text-sm text-[#718995] dark:border-[#1e3340] dark:bg-[#101e26] dark:text-[#94adb8]">
          <LoaderCircle className="size-4 animate-spin" />
          Cargando planos de esclusas…
        </div>
      ) : (
        <section className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          {rooms.map((room, roomIndex) => {
            const anim = zoneStates[room.id] ?? DEFAULT_ANIM
            const accentHex = roomIndex % 2 === 0 ? '#087f7b' : '#4f46e5'
            const accentBright = roomIndex % 2 === 0 ? '#2dd4bf' : '#818cf8'

            // Room specific door identification
            const doorIdCode = room.door_id ?? (room.id === 1 ? 'entrada-principal' : `puerta-${room.code.toLowerCase()}`)
            const doorDisplayName = room.door_name ?? (room.id === 1 ? 'Entrada Principal' : `Puerta ${room.name}`)

            // Filter recent logs for this room
            const roomLogs = accesses
              .filter((evt) => evt.cleanroom_id === room.id || (room.id === 1 && evt.door_id === 'entrada-principal'))
              .slice(0, 4)

            const tempMetric = room.metrics?.temperature
            const humMetric = room.metrics?.humidity
            const pmMetric = room.metrics?.pm25
            const pressMetric = room.metrics?.pressure

            const isDenied = anim.phase === 'deny' || anim.phase === 'lockout'

            const ledColor =
              anim.phase === 'grant'
                ? '#10b981'
                : anim.phase === 'exit'
                  ? '#38bdf8'
                  : isDenied
                    ? '#f43f5e'
                    : anim.phase === 'anomaly'
                      ? '#f59e0b'
                      : '#64748b'

            const statusBorder =
              anim.phase === 'grant'
                ? 'border-emerald-300 bg-emerald-50/70 dark:border-emerald-500/50 dark:bg-emerald-950/40'
                : anim.phase === 'exit'
                  ? 'border-sky-300 bg-sky-50/70 dark:border-sky-500/50 dark:bg-sky-950/40'
                  : isDenied
                    ? 'border-rose-400 bg-rose-50 dark:border-rose-500 dark:bg-rose-950/60'
                    : anim.phase === 'anomaly'
                      ? 'border-amber-300 bg-amber-50/70 dark:border-amber-500/50 dark:bg-amber-950/40'
                      : 'border-[#dce8eb] bg-[#f7fbfa] dark:border-[#1e3340] dark:bg-[#13222b]'

            return (
              <article
                key={room.id}
                className={`flex flex-col justify-between overflow-hidden rounded-2xl border transition-all ${
                  isDenied
                    ? 'border-rose-400 shadow-[0_8px_30px_rgba(244,63,94,0.15)] ring-2 ring-rose-500/20'
                    : 'border-[#e5edf0] bg-white shadow-[0_8px_24px_rgba(18,49,66,0.04)] dark:border-[#1e3340] dark:bg-[#101e26]'
                }`}
              >
                <div>
                  {/* Encabezado del Cuarto y Puerta */}
                  <div className="flex items-center justify-between border-b border-[#edf2f3] px-5 py-4 dark:border-[#1e3340]">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="rounded-md bg-[#eff8f7] px-2 py-0.5 font-mono font-bold text-[#087f7b] dark:bg-[#13313b] dark:text-[#5eead4]">
                          {room.code}
                        </span>
                        <span className="rounded-md bg-[#f2f7f7] px-2 py-0.5 font-semibold text-[#29434e] dark:bg-[#15242e] dark:text-[#d7e6ea]">
                          {room.iso_class}
                        </span>
                        {/* Identificación explícita de la puerta */}
                        <span className="inline-flex items-center gap-1 rounded-md bg-[#e6f4f3] px-2 py-0.5 font-semibold text-[#087f7b] dark:bg-[#13313b] dark:text-[#2dd4bf]">
                          <DoorOpen className="size-3" />
                          Puerta: {doorDisplayName}
                        </span>
                      </div>
                      <h2 className="mt-1.5 text-lg font-bold text-[#163542] dark:text-[#e6f0f2]">
                        {room.name}
                      </h2>
                    </div>

                    <div className="text-right">
                      <p className="text-xs text-[#82969d] dark:text-[#94adb8]">Ocupación</p>
                      <p className="text-base font-bold text-[#163542] dark:text-[#e6f0f2]">
                        {room.current_occupancy} / {room.capacity}
                      </p>
                    </div>
                  </div>

                  {/* Grid: Plano 2D + Estado y métricas */}
                  <div className="grid md:grid-cols-[1.15fr_1fr]">
                    <div className="border-b border-[#edf2f3] bg-[#f4f9f8] p-4 md:border-r md:border-b-0 dark:border-[#1e3340] dark:bg-[#0b141a]">
                      <svg
                        viewBox="0 0 400 320"
                        className="h-auto w-full"
                        role="img"
                        aria-label={`Plano 2D de esclusa ${room.code} - ${doorDisplayName}`}
                      >
                        <defs>
                          <g id={`person-icon-${room.id}`}>
                            <circle cx="0" cy="-9" r="6" />
                            <path d="M-11 12 Q-11 -2 0 -2 Q11 -2 11 12 Z" />
                          </g>
                        </defs>

                        {/* Zona limpia superior */}
                        <rect
                          x="10"
                          y="10"
                          width="380"
                          height="140"
                          rx="10"
                          className="fill-[#e6f4f3] dark:fill-[#0f2a2e]"
                          stroke={accentHex}
                          strokeWidth="2"
                        />
                        <text
                          x="22"
                          y="28"
                          className="fill-[#29434e] dark:fill-[#94a3b8]"
                          fontSize="10"
                          fontWeight="700"
                        >
                          CUARTO LIMPIO {room.iso_class} · {room.code}
                        </text>

                        {/* Bancos / estaciones */}
                        <rect x="40" y="42" width="80" height="24" rx="4" className="fill-[#cfe6e4] dark:fill-[#1e293b]" />
                        <rect x="160" y="42" width="80" height="24" rx="4" className="fill-[#cfe6e4] dark:fill-[#1e293b]" />
                        <rect x="280" y="42" width="80" height="24" rx="4" className="fill-[#cfe6e4] dark:fill-[#1e293b]" />

                        {/* Ocupantes dentro */}
                        <g>
                          {room.occupants.map((occ, idx) => {
                            const pos = occupantSlot(idx)
                            return (
                              <g key={`${occ.user_id}-${idx}`} transform={`translate(${pos.x},${pos.y})`}>
                                <use
                                  href={`#person-icon-${room.id}`}
                                  fill={accentBright}
                                  stroke={accentHex}
                                  strokeWidth="1"
                                  opacity="0.92"
                                />
                              </g>
                            )
                          })}
                        </g>

                        {/* Pasillo / área gris inferior */}
                        <rect
                          x="10"
                          y="162"
                          width="380"
                          height="148"
                          rx="10"
                          className="fill-[#e9eff1] stroke-[#cbd8dc] dark:fill-[#111827] dark:stroke-[#1f2937]"
                        />
                        <text
                          x="22"
                          y="298"
                          className="fill-[#58727c] dark:fill-[#64748b]"
                          fontSize="10"
                        >
                          Pasillo de vestidor · Área gris
                        </text>

                        {/* Muros y puerta corrediza */}
                        <rect x="10" y="150" width="145" height="12" className="fill-[#94a9b1] dark:fill-[#334155]" />
                        <rect x="245" y="150" width="145" height="12" className="fill-[#94a9b1] dark:fill-[#334155]" />

                        {/* Indicador de nombre de puerta física */}
                        <g transform="translate(148, 134)">
                          <rect width="104" height="14" rx="3" fill="#0f172a" opacity="0.85" />
                          <text x="52" y="10" textAnchor="middle" fill="#38bdf8" fontSize="8" fontWeight="700" fontFamily="monospace">
                            PUERTA: {doorIdCode}
                          </text>
                        </g>

                        {/* Puertas corredizas o alerta de bloqueo */}
                        {isDenied ? (
                          <g>
                            <rect
                              x="145"
                              y="150"
                              width="110"
                              height="12"
                              rx="2"
                              fill="#f43f5e"
                              className="animate-pulse"
                            />
                            <text
                              x="200"
                              y="159"
                              textAnchor="middle"
                              fill="#ffffff"
                              fontSize="8"
                              fontWeight="800"
                              fontFamily="sans-serif"
                            >
                              ¡BLOQUEADA / DENEGADO!
                            </text>
                          </g>
                        ) : (
                          <g className={anim.doorOpen ? 'airlock-open' : ''}>
                            <rect
                              className="airlock-door-l"
                              x="155"
                              y="152"
                              width="45"
                              height="8"
                              fill="#38bdf8"
                              opacity="0.8"
                            />
                            <rect
                              className="airlock-door-r"
                              x="200"
                              y="152"
                              width="45"
                              height="8"
                              fill="#38bdf8"
                              opacity="0.8"
                            />
                          </g>
                        )}
                        <rect x="170" y="164" width="60" height="4" rx="2" fill={ledColor} />

                        {/* Lector de salida */}
                        <g transform="translate(252,118)">
                          {anim.reader === 'exit' && anim.scanning && (
                            <circle
                              className="airlock-scan-ring"
                              cx="11"
                              cy="11"
                              r="7"
                              fill="none"
                              stroke="#38bdf8"
                              strokeWidth="2"
                            />
                          )}
                          <rect
                            width="22"
                            height="22"
                            rx="4"
                            className="fill-white stroke-[#94a9b1] dark:fill-[#1e293b] dark:stroke-[#475569]"
                          />
                          <circle
                            cx="11"
                            cy="11"
                            r="4"
                            fill={anim.reader === 'exit' ? '#38bdf8' : '#64748b'}
                          />
                          <text
                            x="26"
                            y="15"
                            className="fill-[#58727c] dark:fill-[#94a3b8]"
                            fontSize="8.5"
                          >
                            Salida
                          </text>
                        </g>

                        {/* Lector de entrada vinculado a puerta */}
                        <g transform="translate(252,176)">
                          {anim.reader === 'entry' && anim.scanning && (
                            <circle
                              className="airlock-scan-ring"
                              cx="11"
                              cy="11"
                              r="7"
                              fill="none"
                              stroke={isDenied ? '#f43f5e' : accentBright}
                              strokeWidth="2"
                            />
                          )}
                          <rect
                            width="22"
                            height="22"
                            rx="4"
                            className="fill-white stroke-[#94a9b1] dark:fill-[#1e293b] dark:stroke-[#475569]"
                          />
                          <circle
                            cx="11"
                            cy="11"
                            r="4"
                            fill={
                              anim.reader === 'entry'
                                ? isDenied
                                  ? '#f43f5e'
                                  : '#10b981'
                                : '#64748b'
                            }
                          />
                          <text
                            x="26"
                            y="15"
                            className="fill-[#087f7b] font-bold dark:fill-[#2dd4bf]"
                            fontSize="8.5"
                          >
                            {doorIdCode}
                          </text>
                        </g>

                        {/* Persona animada en tránsito */}
                        <g
                          className="airlock-walker"
                          style={{
                            transform: `translate(${anim.walkerX}px, ${anim.walkerY}px)`,
                            opacity: anim.walkerVisible ? 1 : 0,
                          }}
                        >
                          <g className={anim.walkerShake ? 'airlock-shake' : ''}>
                            <use href={`#person-icon-${room.id}`} fill={anim.walkerColor} />
                          </g>
                        </g>
                      </svg>
                    </div>

                    {/* Estado del lector y métricas ambientales */}
                    <div className="flex flex-col gap-3 p-4">
                      <div className={`flex min-h-[120px] flex-col justify-center rounded-2xl border p-3.5 transition ${statusBorder}`}>
                        <div className="flex items-center gap-2">
                          {anim.phase === 'grant' ? (
                            <CheckCircle2 className="size-4 shrink-0 text-emerald-600 dark:text-emerald-300" />
                          ) : anim.phase === 'exit' ? (
                            <LogOut className="size-4 shrink-0 text-sky-600 dark:text-sky-300" />
                          ) : anim.phase === 'lockout' ? (
                            <Lock className="size-4 shrink-0 text-rose-600 dark:text-rose-300" />
                          ) : anim.phase === 'deny' ? (
                            <ShieldX className="size-4 shrink-0 text-rose-600 dark:text-rose-300" />
                          ) : anim.phase === 'anomaly' ? (
                            <AlertTriangle className="size-4 shrink-0 text-amber-600 dark:text-amber-300" />
                          ) : (
                            <DoorOpen className="size-4 shrink-0 text-[#087f7b] dark:text-[#2dd4bf]" />
                          )}
                          <p className="text-sm font-bold text-[#163542] dark:text-[#e6f0f2]">
                            {anim.statusTitle}
                          </p>
                        </div>
                        <p className="mt-1 text-xs text-[#58727c] dark:text-[#94adb8]">
                          {anim.statusDetail}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-center text-xs sm:grid-cols-4 md:grid-cols-2">
                        <MetricPill label="Temp" metric={tempMetric} />
                        <MetricPill label="Humedad" metric={humMetric} />
                        <MetricPill label="PM2.5" metric={pmMetric} />
                        <MetricPill label="Presión" metric={pressMetric} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Historial reciente de la zona con identificación de persona y puerta */}
                <div className="border-t border-[#edf2f3] bg-[#f8fbfb] p-4 dark:border-[#1e3340] dark:bg-[#0d1820]">
                  <div className="mb-2.5 flex items-center justify-between">
                    <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#718995] dark:text-[#94adb8]">
                      Historial reciente · {doorDisplayName} ({room.code})
                    </h3>
                    <span className="font-mono text-[11px] text-[#087f7b] dark:text-[#2dd4bf]">
                      {roomLogs.length} eventos
                    </span>
                  </div>

                  {roomLogs.length === 0 ? (
                    <p className="text-xs text-[#82969d] dark:text-[#94adb8]">
                      Aún no hay eventos registrados para esta puerta.
                    </p>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {roomLogs.map((evt) => {
                        const who = resolvePersonName(evt)
                        const allowed = evt.result === 'ALLOWED'
                        const isFacial = evt.event_type === 'FACIAL'
                        const friendlyReason = evt.denial_reason ? (DENIAL_LABELS[evt.denial_reason] ?? evt.denial_reason) : ''

                        return (
                          <div
                            key={evt.id}
                            className={`flex items-center justify-between gap-2 rounded-xl border p-2.5 text-xs transition ${
                              allowed
                                ? 'border-[#e5edf0] bg-white dark:border-[#1e3340] dark:bg-[#101e26]'
                                : 'border-rose-200 bg-rose-50/50 dark:border-rose-900/40 dark:bg-rose-950/30'
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span
                                  className={`rounded px-1.5 py-0.2 font-mono text-[9px] font-bold ${
                                    isFacial
                                      ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300'
                                      : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                  }`}
                                >
                                  {isFacial ? 'FACIAL' : 'RFID'}
                                </span>
                                <p className="truncate font-semibold text-[#163542] dark:text-[#e6f0f2]">
                                  {who}
                                </p>
                              </div>
                              <p className="truncate text-[11px] text-[#718995] dark:text-[#94adb8] mt-0.5">
                                {evt.direction === 'EXIT' ? 'Salida' : 'Entrada'}
                                {evt.rfid_uid ? ` · ${evt.rfid_uid}` : ''}
                                {friendlyReason ? ` · ${friendlyReason}` : ''}
                              </p>
                            </div>
                            <div className="shrink-0 text-right">
                              <span
                                className={`inline-block rounded-md px-2 py-0.5 text-[10px] font-bold ${
                                  allowed
                                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                                    : 'bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300'
                                }`}
                              >
                                {evt.result}
                              </span>
                              <p className="mt-0.5 font-mono text-[10px] text-[#82969d]">
                                {formatTime(evt.occurred_at)}
                              </p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </article>
            )
          })}
        </section>
      )}

      {/* Bitácora unificada de accesos con Puerta y Persona */}
      <section className="overflow-hidden rounded-2xl border border-[#e5edf0] bg-white shadow-[0_8px_24px_rgba(18,49,66,0.04)] dark:border-[#1e3340] dark:bg-[#101e26]">
        <div className="flex flex-col gap-3 border-b border-[#edf2f3] p-5 dark:border-[#1e3340] lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-base font-semibold text-[#163542] dark:text-[#e6f0f2]">
              Bitácora unificada de accesos
            </h2>
            <p className="mt-0.5 text-xs text-[#82969d] dark:text-[#94adb8]">
              Registros en tiempo real sincronizados desde lectores IoT, terminales RFID y reconocimiento facial
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="relative flex items-center">
              <Search className="pointer-events-none absolute left-3 size-3.5 text-[#82969d]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Buscar persona, UID o puerta…"
                className="rounded-xl border border-[#dce8eb] bg-[#f9fcfc] py-2 pr-3 pl-8 text-xs text-[#163542] outline-none focus:border-[#087f7b] dark:border-[#233a47] dark:bg-[#0d1820] dark:text-[#e6f0f2]"
              />
            </label>

            <div className="flex items-center gap-1.5 text-xs text-[#718995]">
              <Filter className="size-3.5" />
            </div>

            <select
              aria-label="Filtrar por cuarto limpio"
              value={roomFilter}
              onChange={(event) => setRoomFilter(event.target.value)}
              className="rounded-xl border border-[#dce8eb] bg-[#f9fcfc] px-2.5 py-2 text-xs text-[#29434e] outline-none focus:border-[#087f7b] dark:border-[#233a47] dark:bg-[#0d1820] dark:text-[#e6f0f2]"
            >
              <option value="ALL">Todas las salas</option>
              {rooms.map((room) => (
                <option key={room.id} value={String(room.id)}>
                  {room.code} ({room.id === 1 ? 'Entrada Principal' : room.name})
                </option>
              ))}
            </select>

            <select
              aria-label="Filtrar por resultado"
              value={resultFilter}
              onChange={(event) => setResultFilter(event.target.value)}
              className="rounded-xl border border-[#dce8eb] bg-[#f9fcfc] px-2.5 py-2 text-xs text-[#29434e] outline-none focus:border-[#087f7b] dark:border-[#233a47] dark:bg-[#0d1820] dark:text-[#e6f0f2]"
            >
              <option value="ALL">Todos los resultados</option>
              <option value="ALLOWED">Permitidos (ALLOWED)</option>
              <option value="DENIED">Denegados (DENIED)</option>
            </select>

            <select
              aria-label="Filtrar por dirección"
              value={directionFilter}
              onChange={(event) => setDirectionFilter(event.target.value)}
              className="rounded-xl border border-[#dce8eb] bg-[#f9fcfc] px-2.5 py-2 text-xs text-[#29434e] outline-none focus:border-[#087f7b] dark:border-[#233a47] dark:bg-[#0d1820] dark:text-[#e6f0f2]"
            >
              <option value="ALL">Entrada y salida</option>
              <option value="ENTRY">Entrada (ENTRY)</option>
              <option value="EXIT">Salida (EXIT)</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          {accessesLoading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-xs text-[#718995] dark:text-[#94adb8]">
              <LoaderCircle className="size-4 animate-spin" />
              Cargando eventos de acceso…
            </div>
          ) : filteredAccesses.length === 0 ? (
            <p className="py-10 text-center text-xs text-[#82969d] dark:text-[#94adb8]">
              No hay eventos que coincidan con los filtros aplicados.
            </p>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#edf2f3] bg-[#f8fbfb] text-[11px] font-semibold uppercase tracking-wider text-[#718995] dark:border-[#1e3340] dark:bg-[#0d1820] dark:text-[#94adb8]">
                <tr>
                  <th className="px-4 py-3">Fecha y hora</th>
                  <th className="px-4 py-3">Método</th>
                  <th className="px-4 py-3">Puerta / Esclusa</th>
                  <th className="px-4 py-3">Persona / Tarjeta</th>
                  <th className="px-4 py-3">Sentido</th>
                  <th className="px-4 py-3">Resultado</th>
                  <th className="px-4 py-3">Motivo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#edf2f3] dark:divide-[#1e3340]">
                {filteredAccesses.slice(0, 50).map((evt) => {
                  const room = roomById.get(evt.cleanroom_id)
                  const personName = resolvePersonName(evt)
                  const isAllowed = evt.result === 'ALLOWED'
                  const isFacial = evt.event_type === 'FACIAL'
                  const doorCode = String(evt.door_id ?? (evt.cleanroom_id === 1 ? 'entrada-principal' : 'puerta'))
                  const friendlyReason = evt.denial_reason ? (DENIAL_LABELS[evt.denial_reason] ?? evt.denial_reason) : ''

                  return (
                    <tr
                      key={evt.id}
                      className="transition hover:bg-[#f7fbfa] dark:hover:bg-[#15242e]"
                    >
                      <td className="px-4 py-3 font-mono text-[#58727c] dark:text-[#94adb8]">
                        {formatDateTime(evt.occurred_at)}
                      </td>
                      <td className="px-4 py-3">
                        {isFacial ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-purple-50 px-2 py-0.5 text-[10px] font-bold text-purple-700 dark:bg-purple-950/40 dark:text-purple-300">
                            <ScanFace className="size-3" />
                            FACIAL
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-md bg-[#eff8f7] px-2 py-0.5 text-[10px] font-bold text-[#087f7b] dark:bg-[#13313b] dark:text-[#5eead4]">
                            <CreditCard className="size-3" />
                            RFID
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <span className="font-semibold text-[#163542] dark:text-[#e6f0f2]">
                            {doorCode === 'entrada-principal' ? 'Entrada Principal' : doorCode}
                          </span>
                          <span className="font-mono text-[10px] text-[#82969d] dark:text-[#94adb8]">
                            {room ? room.code : `Sala #${evt.cleanroom_id}`} · {doorCode}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <span className="font-medium text-[#29434e] dark:text-[#d7e6ea]">
                            {personName}
                          </span>
                          {evt.rfid_uid && (
                            <span className="font-mono text-[10px] text-[#82969d] dark:text-[#94adb8]">
                              UID: {evt.rfid_uid}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                            evt.direction === 'EXIT'
                              ? 'bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300'
                              : 'bg-[#eff8f7] text-[#087f7b] dark:bg-[#13313b] dark:text-[#5eead4]'
                          }`}
                        >
                          {evt.direction === 'EXIT' ? 'SALIDA' : 'ENTRADA'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-bold ${
                            isAllowed
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                              : 'bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300'
                          }`}
                        >
                          {evt.result}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[#58727c] dark:text-[#94adb8]">
                        {friendlyReason ? (
                          <span>{friendlyReason}</span>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  )
}

function MiniStat({
  label,
  value,
  accent = 'default',
}: {
  label: string
  value: string
  accent?: 'default' | 'emerald' | 'sky' | 'rose' | 'teal'
}) {
  const color =
    accent === 'emerald'
      ? 'text-emerald-700 dark:text-emerald-300'
      : accent === 'sky'
        ? 'text-sky-700 dark:text-sky-300'
        : accent === 'rose'
          ? 'text-rose-700 dark:text-rose-300'
          : accent === 'teal'
            ? 'text-[#087f7b] dark:text-[#2dd4bf]'
            : 'text-[#163542] dark:text-[#e6f0f2]'

  return (
    <div className="rounded-2xl border border-[#e5edf0] bg-white p-4 shadow-[0_8px_24px_rgba(18,49,66,0.04)] dark:border-[#1e3340] dark:bg-[#101e26]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#82969d] dark:text-[#94adb8]">
        {label}
      </p>
      <p className={`mt-1.5 text-2xl font-bold ${color}`}>{value}</p>
    </div>
  )
}

function MetricPill({
  label,
  metric,
}: {
  label: string
  metric?: { value: number | null; unit: string; in_range: boolean }
}) {
  return (
    <div
      className={`rounded-xl border p-2 ${
        metric && !metric.in_range
          ? 'border-rose-200 bg-rose-50/70 dark:border-rose-500/30 dark:bg-rose-950/30'
          : 'border-[#e5edf0] bg-[#f8fbfb] dark:border-[#1e3340] dark:bg-[#13222b]'
      }`}
    >
      <p className="text-[10px] font-medium text-[#82969d] dark:text-[#94adb8]">{label}</p>
      <p
        className={`mt-0.5 font-bold ${
          metric && !metric.in_range
            ? 'text-rose-700 dark:text-rose-300'
            : 'text-[#163542] dark:text-[#e6f0f2]'
        }`}
      >
        {metric && metric.value !== null ? `${metric.value} ${metric.unit}` : '—'}
      </p>
    </div>
  )
}
