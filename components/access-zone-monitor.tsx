'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import useSWR from 'swr'
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  DoorOpen,
  Filter,
  LoaderCircle,
  Lock,
  LogOut,
  RefreshCw,
  Search,
  ShieldX,
  Users,
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
  statusTitle: 'Lectores listos · esperando tarjeta',
  statusDetail: 'Validación RFID activa con control de aforo y reglas reactivas',
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
}

const ROOMS_PER_PAGE = 6
const ACCESS_EVENTS_PER_PAGE = 20

export function AccessZoneMonitor() {
  const {
    data: summary,
    error: summaryError,
    isLoading: summaryLoading,
    mutate: mutateSummary,
  } = useSWR<SupervisorSummary>('supervisor-summary', () => api.supervisorSummary())

  const {
    data: accessesRaw,
    isLoading: accessesLoading,
    mutate: mutateAccesses,
  } = useSWR<ApiAccessEvent[]>('access-events', () => api.accesses('?page=1&size=500'))

  const { data: peopleRaw } = useSWR('people-lookup', () => api.people())

  const [zoneStates, setZoneStates] = useState<Record<number, ZoneAnimState>>({})
  const timersRef = useRef<Record<number, ReturnType<typeof setTimeout>[]>>({})

  const [roomFilter, setRoomFilter] = useState<string>('ALL')
  const [resultFilter, setResultFilter] = useState<string>('ALL')
  const [directionFilter, setDirectionFilter] = useState<string>('ALL')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [simulatorRoomId, setSimulatorRoomId] = useState<number | null>(null)
  const [roomPage, setRoomPage] = useState(1)
  const [accessPage, setAccessPage] = useState(1)
  const handleSimulatorRoomChange = useCallback((roomId: number | null) => {
    setSimulatorRoomId(roomId)
    setRoomPage(1)
  }, [])

  const rooms = summary?.rooms ?? []
  const orderedRooms = useMemo(() => {
    if (simulatorRoomId === null) return rooms
    return rooms.filter((room) => room.id === simulatorRoomId)
  }, [rooms, simulatorRoomId])
  const roomPageCount = Math.max(1, Math.ceil(orderedRooms.length / ROOMS_PER_PAGE))
  const activeRoomPage = Math.min(roomPage, roomPageCount)
  const visibleRooms = orderedRooms.slice((activeRoomPage - 1) * ROOMS_PER_PAGE, activeRoomPage * ROOMS_PER_PAGE)
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
          statusTitle: 'Anomalía ambiental detectada',
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
          statusDetail: `Tarjeta ${event.uid}`,
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
            statusTitle: 'Salida registrada',
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
        statusTitle: 'Leyendo tarjeta RFID…',
        statusDetail: `UID ${event.uid}`,
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
            ? 'Acceso concedido'
            : isLock
              ? 'Esclusa bloqueada (RN-10)'
              : 'Acceso denegado',
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
      if (eventType === 'access_event' && typeof payload.cleanroom_id === 'number') {
        const direction = String(payload.direction ?? 'ENTRY').toUpperCase()
        const result = String(payload.result ?? 'ALLOWED').toUpperCase()
        const reason = typeof payload.denial_reason === 'string' ? payload.denial_reason : ''
        triggerZoneAnimation({
          cleanroomId: payload.cleanroom_id,
          kind:
            direction === 'EXIT'
              ? 'exit'
              : result === 'ALLOWED'
                ? 'entry-grant'
                : reason === 'LOCKED'
                  ? 'lockout'
                  : 'entry-deny',
          uid: String(payload.uid ?? `#${payload.event_id ?? ''}`),
          detail: reason ? (DENIAL_LABELS[reason] ?? reason) : 'Evento en vivo desde backend',
        })
      } else if (eventType === 'alert_created' && typeof payload.cleanroom_id === 'number') {
        triggerZoneAnimation({
          cleanroomId: payload.cleanroom_id,
          kind: 'anomaly',
          uid: 'ALERTA',
          detail: String(payload.message ?? 'Alerta ambiental detectada'),
        })
      }
    },
  })

  const filteredAccesses = useMemo(() => {
    const term = searchQuery.trim().toLowerCase()
    return accesses.filter((item) => {
      if (roomFilter !== 'ALL' && String(item.cleanroom_id) !== roomFilter) return false
      if (resultFilter !== 'ALL' && item.result.toUpperCase() !== resultFilter) return false
      if (directionFilter !== 'ALL' && item.direction.toUpperCase() !== directionFilter) return false
      if (!term) return true
      const personName = item.user_id ? (peopleById.get(item.user_id) ?? `Usuario #${item.user_id}`) : 'No identificado'
      const roomCode = roomById.get(item.cleanroom_id)?.code ?? `Cuarto #${item.cleanroom_id}`
      const hay = `${personName} ${roomCode} ${item.denial_reason ?? ''} ${item.direction} ${item.result}`.toLowerCase()
      return hay.includes(term)
    })
  }, [accesses, roomFilter, resultFilter, directionFilter, searchQuery, peopleById, roomById])
  const accessPageCount = Math.max(1, Math.ceil(filteredAccesses.length / ACCESS_EVENTS_PER_PAGE))
  const activeAccessPage = Math.min(accessPage, accessPageCount)
  const visibleAccesses = filteredAccesses.slice((activeAccessPage - 1) * ACCESS_EVENTS_PER_PAGE, activeAccessPage * ACCESS_EVENTS_PER_PAGE)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#087f7b] dark:text-[#2dd4bf]">
            Supervisión · control físico
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-[#102d3b] dark:text-[#e6f0f2]">
            Monitoreo de accesos multizona
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm text-[#718995] dark:text-[#94adb8]">
            Planos 2D en vivo de esclusas RFID, ocupación por sala y bitácora unificada de eventos.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
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

      <section aria-label="Indicadores de acceso" className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <MiniStat label="Eventos" detail="Periodo consultado" value={summaryLoading ? '—' : String(summary?.total_events ?? 0)} icon={<DoorOpen className="size-4" />} />
        <MiniStat label="Entradas" detail="Registros de ingreso" value={summaryLoading ? '—' : String(summary?.entries ?? 0)} accent="emerald" icon={<ArrowDownToLine className="size-4" />} />
        <MiniStat label="Salidas" detail="Registros de salida" value={summaryLoading ? '—' : String(summary?.exits ?? 0)} accent="sky" icon={<ArrowUpFromLine className="size-4" />} />
        <MiniStat label="Denegados" detail="Validaciones rechazadas" value={summaryLoading ? '—' : String(summary?.denied ?? 0)} accent="rose" icon={<ShieldX className="size-4" />} />
        <MiniStat label="Personas dentro" detail="Ocupación actual" value={summaryLoading ? '—' : String(summary?.current_occupancy ?? 0)} accent="teal" icon={<Users className="size-4" />} />
      </section>

      {process.env.NEXT_PUBLIC_ENABLE_ACCESS_SIMULATOR !== 'false' && rooms.length > 0 && (
        <AccessSimulatorPanel rooms={rooms} onSimulationEvent={triggerZoneAnimation} onRoomSelectionChange={handleSimulatorRoomChange} />
      )}

      {summaryError && (
        <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-950/40 dark:text-red-200">
          No se pudieron cargar las zonas de acceso: {userFacingClientError(summaryError)}
        </div>
      )}

      {/* Planos 2D dinámicos por cada Cleanroom */}
      {summaryLoading ? (
        <div className="flex min-h-48 items-center justify-center gap-2 rounded-2xl border border-[#e5edf0] bg-white text-sm text-[#718995] dark:border-[#1e3340] dark:bg-[#101e26] dark:text-[#94adb8]">
          <LoaderCircle className="size-4 animate-spin" />
          Cargando planos de esclusas…
        </div>
      ) : (
        <div className="space-y-3">
        <div className="flex items-end justify-between gap-3"><div><h2 className="text-base font-semibold tracking-tight text-[#163542] dark:text-[#e6f0f2]">Zonas supervisadas</h2><p className="mt-1 text-xs text-[#82969d] dark:text-[#94adb8]">Ocupación, estado de acceso y lecturas ambientales por cuarto.</p></div><span className="rounded-full border border-[#dce7e8] bg-white px-3 py-1.5 text-xs font-semibold text-[#58727c] dark:border-[#1e3340] dark:bg-[#101e26] dark:text-[#d7e6ea]">{orderedRooms.length} {orderedRooms.length === 1 ? 'cuarto' : 'cuartos'}</span></div>
        <section aria-label="Zonas de acceso" className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          {visibleRooms.length === 0 ? <div className="rounded-2xl border border-dashed border-[#d6e3e4] bg-white px-6 py-12 text-center text-sm text-[#718995] dark:border-[#1e3340] dark:bg-[#101e26]">No hay cuartos disponibles para mostrar en esta cuenta.</div> : visibleRooms.map((room, roomIndex) => {
            const anim = zoneStates[room.id] ?? DEFAULT_ANIM
            const accentHex = roomIndex % 2 === 0 ? '#087f7b' : '#4f46e5'
            const accentBright = roomIndex % 2 === 0 ? '#2dd4bf' : '#818cf8'
            const roomLogs = accesses.filter((evt) => evt.cleanroom_id === room.id).slice(0, 4)

            const tempMetric = room.metrics?.temperature
            const humMetric = room.metrics?.humidity
            const pmMetric = room.metrics?.pm25
            const pressMetric = room.metrics?.pressure

            const ledColor =
              anim.phase === 'grant'
                ? '#10b981'
                : anim.phase === 'exit'
                  ? '#38bdf8'
                  : anim.phase === 'deny' || anim.phase === 'lockout'
                    ? '#f43f5e'
                    : anim.phase === 'anomaly'
                      ? '#f59e0b'
                      : '#64748b'

            const statusBorder =
              anim.phase === 'grant'
                ? 'border-emerald-300 bg-emerald-50/70 dark:border-emerald-500/50 dark:bg-emerald-950/40'
                : anim.phase === 'exit'
                  ? 'border-sky-300 bg-sky-50/70 dark:border-sky-500/50 dark:bg-sky-950/40'
                  : anim.phase === 'deny' || anim.phase === 'lockout'
                    ? 'border-rose-300 bg-rose-50/70 dark:border-rose-500/50 dark:bg-rose-950/40'
                    : anim.phase === 'anomaly'
                      ? 'border-amber-300 bg-amber-50/70 dark:border-amber-500/50 dark:bg-amber-950/40'
                      : 'border-[#dce8eb] bg-[#f7fbfa] dark:border-[#1e3340] dark:bg-[#13222b]'

            return (
              <article
                key={room.id}
                className={`flex flex-col justify-between overflow-hidden rounded-2xl border bg-white shadow-[0_8px_24px_rgba(18,49,66,0.04)] transition-[border-color,box-shadow] dark:bg-[#101e26] ${room.id === simulatorRoomId ? 'border-[#75bbb1] ring-2 ring-[#087f7b]/10 dark:border-[#2dd4bf]/50 dark:ring-[#2dd4bf]/10 xl:col-span-2 xl:grid xl:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.85fr)] xl:items-stretch' : 'border-[#e5edf0] dark:border-[#1e3340]'}`}
              >
                <div>
                  <div className="flex items-center justify-between border-b border-[#edf2f3] px-5 py-4 dark:border-[#1e3340]">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="rounded-md bg-[#eff8f7] px-2 py-0.5 font-mono font-bold text-[#087f7b] dark:bg-[#13313b] dark:text-[#5eead4]">
                          {room.code}
                        </span>
                        <span className="rounded-md bg-[#f2f7f7] px-2 py-0.5 font-semibold text-[#29434e] dark:bg-[#15242e] dark:text-[#d7e6ea]">
                          {room.iso_class}
                        </span>
                        <span className="font-mono text-[#82969d] dark:text-[#94adb8]">
                          {room.device_code ?? 'Sin lector'}
                        </span>
                        {room.id === simulatorRoomId && <span className="rounded-full bg-[#eaf5f2] px-2 py-0.5 text-[10px] font-semibold text-[#087f7b] dark:bg-[#13313b] dark:text-[#5eead4]">Cuarto seleccionado</span>}
                      </div>
                      <h2 className="mt-1 text-lg font-semibold text-[#163542] dark:text-[#e6f0f2]">
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
                        aria-label={`Plano 2D de esclusa ${room.code}`}
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
                          y="30"
                          className="fill-[#29434e] dark:fill-[#94a3b8]"
                          fontSize="11"
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
                          fontSize="11"
                        >
                          Pasillo / vestidor (área gris)
                        </text>

                        {/* Muros y puerta corrediza */}
                        <rect x="10" y="150" width="150" height="12" className="fill-[#94a9b1] dark:fill-[#334155]" />
                        <rect x="240" y="150" width="150" height="12" className="fill-[#94a9b1] dark:fill-[#334155]" />
                        <g className={anim.doorOpen ? 'airlock-open' : ''}>
                          <rect
                            className="airlock-door-l"
                            x="160"
                            y="152"
                            width="40"
                            height="8"
                            fill="#38bdf8"
                            opacity="0.75"
                          />
                          <rect
                            className="airlock-door-r"
                            x="200"
                            y="152"
                            width="40"
                            height="8"
                            fill="#38bdf8"
                            opacity="0.75"
                          />
                        </g>
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
                            fontSize="9"
                          >
                            Salida
                          </text>
                        </g>

                        {/* Lector de entrada */}
                        <g transform="translate(252,176)">
                          {anim.reader === 'entry' && anim.scanning && (
                            <circle
                              className="airlock-scan-ring"
                              cx="11"
                              cy="11"
                              r="7"
                              fill="none"
                              stroke={accentBright}
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
                                ? anim.phase === 'deny' || anim.phase === 'lockout'
                                  ? '#f43f5e'
                                  : '#10b981'
                                : '#64748b'
                            }
                          />
                          <text
                            x="26"
                            y="15"
                            className="fill-[#58727c] dark:fill-[#94a3b8]"
                            fontSize="9"
                          >
                            Entrada
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
                          <p className="text-sm font-semibold text-[#163542] dark:text-[#e6f0f2]">
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

                {/* Historial reciente de la zona */}
                <div className={`border-t border-[#edf2f3] bg-[#f8fbfb] p-4 dark:border-[#1e3340] dark:bg-[#0d1820] ${room.id === simulatorRoomId ? 'xl:border-l xl:border-t-0 xl:p-5' : ''}`}>
                  <div className="mb-2.5 flex items-center justify-between">
                    <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#718995] dark:text-[#94adb8]">
                      Historial reciente · {room.code}
                    </h3>
                    <span className="font-mono text-[11px] text-[#087f7b] dark:text-[#2dd4bf]">
                      {roomLogs.length} eventos
                    </span>
                  </div>

                  {roomLogs.length === 0 ? (
                    <p className="text-xs text-[#82969d] dark:text-[#94adb8]">
                      Aún no hay eventos registrados para esta zona.
                    </p>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {roomLogs.map((evt) => {
                        const who = evt.user_id
                          ? (peopleById.get(evt.user_id) ?? `Usuario #${evt.user_id}`)
                          : 'No identificado'
                        const allowed = evt.result === 'ALLOWED'
                        return (
                          <div
                            key={evt.id}
                            className="flex items-center justify-between gap-2 rounded-xl border border-[#e5edf0] bg-white px-3 py-2 text-xs dark:border-[#1e3340] dark:bg-[#101e26]"
                          >
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-[#163542] dark:text-[#e6f0f2]">
                                {who}
                              </p>
                              <p className="truncate text-[11px] text-[#718995] dark:text-[#94adb8]">
                                {evt.direction === 'EXIT' ? 'Salida' : 'Entrada'}
                                {evt.denial_reason ? ` · ${DENIAL_LABELS[evt.denial_reason] ?? evt.denial_reason}` : ''}
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
        </div>
      )}

      {!summaryLoading && !summaryError && orderedRooms.length > ROOMS_PER_PAGE && <nav aria-label="Paginación de cuartos" className="flex flex-col gap-3 rounded-2xl border border-[#e5edf0] bg-white px-4 py-3 text-xs text-[#718995] shadow-[0_4px_16px_rgba(18,49,66,0.03)] sm:flex-row sm:items-center sm:justify-between sm:px-5 dark:border-[#1e3340] dark:bg-[#101e26] dark:text-[#94adb8]"><span>Cuartos <strong className="font-semibold text-[#29434e] dark:text-[#e6f0f2]">{(activeRoomPage - 1) * ROOMS_PER_PAGE + 1}–{Math.min(activeRoomPage * ROOMS_PER_PAGE, orderedRooms.length)}</strong> de <strong className="font-semibold text-[#29434e] dark:text-[#e6f0f2]">{orderedRooms.length}</strong></span><div className="flex items-center gap-2"><button type="button" disabled={activeRoomPage === 1} onClick={() => setRoomPage(Math.max(1, activeRoomPage - 1))} className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-[#dce8eb] px-3 font-semibold text-[#36515b] transition hover:bg-[#f4f9f8] disabled:opacity-40 dark:border-[#233a47] dark:text-[#d7e6ea] dark:hover:bg-[#15242e]"><ChevronLeft className="size-3.5" />Anterior</button><span aria-live="polite" className="min-w-14 text-center font-semibold tabular-nums text-[#36515b] dark:text-[#d7e6ea]">{activeRoomPage} / {roomPageCount}</span><button type="button" disabled={activeRoomPage === roomPageCount} onClick={() => setRoomPage(Math.min(roomPageCount, activeRoomPage + 1))} className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-[#dce8eb] px-3 font-semibold text-[#36515b] transition hover:bg-[#f4f9f8] disabled:opacity-40 dark:border-[#233a47] dark:text-[#d7e6ea] dark:hover:bg-[#15242e]">Siguiente<ChevronRight className="size-3.5" /></button></div></nav>}

      <section aria-label="Bitácora de accesos" className="overflow-hidden rounded-2xl border border-[#dce7e8] bg-white shadow-[0_10px_28px_rgba(16,44,58,0.045)] dark:border-[#1e3340] dark:bg-[#101e26]">
        <div className="flex flex-col gap-4 border-b border-[#e9efef] bg-[#fbfcfc] p-5 dark:border-[#1e3340] dark:bg-[#13222b] lg:flex-row lg:items-center lg:justify-between lg:px-6">
          <div>
            <div className="flex flex-wrap items-center gap-2.5"><h2 className="text-base font-semibold tracking-tight text-[#163542] dark:text-[#e6f0f2]">Bitácora de accesos</h2><span className="rounded-full bg-[#eaf5f2] px-2.5 py-1 text-[11px] font-semibold text-[#087f7b] dark:bg-[#13313b] dark:text-[#5eead4]">{filteredAccesses.length.toLocaleString('es-MX')} resultados</span></div>
            <p className="mt-1 text-xs text-[#82969d] dark:text-[#94adb8]">Eventos recientes, ordenados por fecha y hora.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="relative flex items-center">
              <Search className="pointer-events-none absolute left-3 size-3.5 text-[#82969d]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => { setSearchQuery(event.target.value); setAccessPage(1) }}
                placeholder="Buscar persona o motivo…"
                className="min-h-10 w-full rounded-xl border border-[#dce8eb] bg-white py-2 pr-3 pl-8 text-xs text-[#163542] outline-none transition focus:border-[#087f7b] focus:ring-4 focus:ring-[#087f7b]/10 dark:border-[#233a47] dark:bg-[#0d1820] dark:text-[#e6f0f2] sm:w-56"
              />
            </label>

            <div className="flex items-center gap-1.5 text-xs text-[#718995]">
              <Filter className="size-3.5" />
            </div>

            <select
              aria-label="Filtrar por cuarto limpio"
              value={roomFilter}
              onChange={(event) => { setRoomFilter(event.target.value); setAccessPage(1) }}
              className="min-h-10 rounded-xl border border-[#dce8eb] bg-white px-2.5 py-2 text-xs text-[#29434e] outline-none focus:border-[#087f7b] dark:border-[#233a47] dark:bg-[#0d1820] dark:text-[#e6f0f2]"
            >
              <option value="ALL">Todas las salas</option>
              {rooms.map((room) => (
                <option key={room.id} value={String(room.id)}>
                  {room.code}
                </option>
              ))}
            </select>

            <select
              aria-label="Filtrar por resultado"
              value={resultFilter}
              onChange={(event) => { setResultFilter(event.target.value); setAccessPage(1) }}
              className="min-h-10 rounded-xl border border-[#dce8eb] bg-white px-2.5 py-2 text-xs text-[#29434e] outline-none focus:border-[#087f7b] dark:border-[#233a47] dark:bg-[#0d1820] dark:text-[#e6f0f2]"
            >
              <option value="ALL">Todos los resultados</option>
              <option value="ALLOWED">Permitidos</option>
              <option value="DENIED">Denegados</option>
            </select>

            <select
              aria-label="Filtrar por dirección"
              value={directionFilter}
              onChange={(event) => { setDirectionFilter(event.target.value); setAccessPage(1) }}
              className="min-h-10 rounded-xl border border-[#dce8eb] bg-white px-2.5 py-2 text-xs text-[#29434e] outline-none focus:border-[#087f7b] dark:border-[#233a47] dark:bg-[#0d1820] dark:text-[#e6f0f2]"
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
            <table className="w-full min-w-[48rem] text-left text-xs">
              <thead className="border-b border-[#edf2f3] bg-[#f8fbfb] text-[11px] font-semibold uppercase tracking-wider text-[#718995] dark:border-[#1e3340] dark:bg-[#0d1820] dark:text-[#94adb8]">
                <tr>
                  <th className="px-4 py-3">Fecha y hora</th>
                  <th className="px-4 py-3">Sala</th>
                  <th className="px-4 py-3">Sentido</th>
                  <th className="px-4 py-3">Persona</th>
                  <th className="px-4 py-3">Resultado</th>
                  <th className="px-4 py-3">Motivo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#edf2f3] dark:divide-[#1e3340]">
                {visibleAccesses.map((evt) => {
                  const room = roomById.get(evt.cleanroom_id)
                  const personName = evt.user_id
                    ? (peopleById.get(evt.user_id) ?? `Usuario #${evt.user_id}`)
                    : 'No identificado'
                  const isAllowed = evt.result === 'ALLOWED'

                  return (
                    <tr
                      key={evt.id}
                      className="transition hover:bg-[#f7fbfa] dark:hover:bg-[#15242e]"
                    >
                      <td className="px-4 py-3 font-mono text-[#58727c] dark:text-[#94adb8]">
                        {formatDateTime(evt.occurred_at)}
                      </td>
                      <td className="px-4 py-3 font-semibold text-[#163542] dark:text-[#e6f0f2]">
                        {room ? `${room.code}` : `Cuarto #${evt.cleanroom_id}`}
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
                      <td className="px-4 py-3 font-medium text-[#29434e] dark:text-[#d7e6ea]">
                        {personName}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-bold ${
                            isAllowed
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                              : 'bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300'
                          }`}
                        >
                          {evt.result === 'ALLOWED' ? 'PERMITIDO' : evt.result === 'DENIED' ? 'DENEGADO' : evt.result}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[#58727c] dark:text-[#94adb8]">
                        {evt.denial_reason
                          ? `${DENIAL_LABELS[evt.denial_reason] ?? evt.denial_reason} (${evt.denial_reason})`
                          : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
        {!accessesLoading && filteredAccesses.length > 0 && <div className="flex flex-col gap-3 border-t border-[#e9efef] bg-[#fbfcfc] px-5 py-4 text-xs text-[#82969d] dark:border-[#1e3340] dark:bg-[#13222b] dark:text-[#94adb8] sm:flex-row sm:items-center sm:justify-between sm:px-6"><span>Mostrando <strong className="font-semibold text-[#36515b] dark:text-[#d7e6ea]">{(activeAccessPage - 1) * ACCESS_EVENTS_PER_PAGE + 1}–{Math.min(activeAccessPage * ACCESS_EVENTS_PER_PAGE, filteredAccesses.length)}</strong> de <strong className="font-semibold text-[#36515b] dark:text-[#d7e6ea]">{filteredAccesses.length}</strong> coincidencias entre los últimos {accesses.length.toLocaleString('es-MX')} eventos cargados</span><nav aria-label="Paginación de la bitácora" className="flex items-center gap-2"><button type="button" disabled={activeAccessPage === 1} onClick={() => setAccessPage(Math.max(1, activeAccessPage - 1))} className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-[#dce8eb] bg-white px-3 font-semibold text-[#36515b] transition hover:bg-[#f4f9f8] disabled:cursor-not-allowed disabled:opacity-40 dark:border-[#233a47] dark:bg-[#101e26] dark:text-[#d7e6ea]"><ChevronLeft className="size-3.5" />Anterior</button><span aria-live="polite" className="min-w-14 text-center font-semibold tabular-nums text-[#36515b] dark:text-[#d7e6ea]">{activeAccessPage} / {accessPageCount}</span><button type="button" disabled={activeAccessPage === accessPageCount} onClick={() => setAccessPage(Math.min(accessPageCount, activeAccessPage + 1))} className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-[#dce8eb] bg-white px-3 font-semibold text-[#36515b] transition hover:bg-[#f4f9f8] disabled:cursor-not-allowed disabled:opacity-40 dark:border-[#233a47] dark:bg-[#101e26] dark:text-[#d7e6ea]">Siguiente<ChevronRight className="size-3.5" /></button></nav></div>}
      </section>
    </div>
  )
}

function MiniStat({
  label,
  value,
  detail,
  icon,
  accent = 'default',
}: {
  label: string
  value: string
  detail: string
  icon: React.ReactNode
  accent?: 'default' | 'emerald' | 'sky' | 'rose' | 'teal'
}) {
  const tones = {
    default: 'bg-[#edf4f5] text-[#36515b] dark:bg-[#1b303a] dark:text-[#d7e6ea]',
    emerald: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
    sky: 'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300',
    rose: 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300',
    teal: 'bg-[#e7f5f2] text-[#087f7b] dark:bg-[#13313b] dark:text-[#2dd4bf]',
  }[accent]

  return (
    <article className="rounded-2xl border border-[#e2ebec] bg-white p-4 shadow-[0_5px_18px_rgba(18,49,66,0.035)] dark:border-[#1e3340] dark:bg-[#101e26] sm:p-5">
      <div className="flex items-start justify-between gap-2"><p className="text-[10px] font-bold uppercase leading-4 tracking-[0.13em] text-[#82969d] dark:text-[#94adb8]">{label}</p><span className={`grid size-9 shrink-0 place-items-center rounded-xl ${tones}`}>{icon}</span></div>
      <p className="mt-3 text-[1.7rem] font-semibold leading-none tracking-[-0.04em] tabular-nums text-[#163542] dark:text-[#e6f0f2] sm:text-3xl">{value}</p>
      <p className="mt-2 truncate text-[11px] text-[#82969d] dark:text-[#94adb8]">{detail}</p>
    </article>
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
