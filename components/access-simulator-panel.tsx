'use client'

import { useEffect, useState } from 'react'
import { useSWRConfig } from 'swr'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Cpu,
  LoaderCircle,
  Lock,
  LogOut,
  ShieldX,
} from 'lucide-react'
import { api, type SupervisorRoomSummary } from '@/lib/api'
import { userFacingClientError } from '@/lib/user-facing-errors.mjs'

export type SimulatedZoneFeedback = {
  cleanroomId: number
  kind: 'entry-grant' | 'entry-deny' | 'lockout' | 'anomaly' | 'exit'
  uid: string
  detail: string
  stayMinutes?: number | null
}

const UID_PRESETS = [
  { uid: '04-A1-B2-C3', label: 'UID con permiso · 04-A1-B2-C3' },
  { uid: '04-D4-E5-F6', label: 'UID con permiso · 04-D4-E5-F6' },
  { uid: '04-11-22-33', label: 'UID de supervisión · 04-11-22-33' },
  { uid: 'FF-00-DE-AD', label: 'UID sin registro · FF-00-DE-AD' },
]

export function AccessSimulatorPanel({
  rooms,
  onSimulationEvent,
  onRoomSelectionChange,
}: {
  rooms: SupervisorRoomSummary[]
  onSimulationEvent?: (event: SimulatedZoneFeedback) => void
  onRoomSelectionChange?: (roomId: number | null) => void
}) {
  if (process.env.NEXT_PUBLIC_ENABLE_ACCESS_SIMULATOR === 'false') {
    return null
  }

  return <AccessSimulatorCard rooms={rooms} onSimulationEvent={onSimulationEvent} onRoomSelectionChange={onRoomSelectionChange} />
}

function AccessSimulatorCard({
  rooms,
  onSimulationEvent,
  onRoomSelectionChange,
}: {
  rooms: SupervisorRoomSummary[]
  onSimulationEvent?: (event: SimulatedZoneFeedback) => void
  onRoomSelectionChange?: (roomId: number | null) => void
}) {
  const { mutate } = useSWRConfig()
  const [expanded, setExpanded] = useState(true)
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null)
  const [uid, setUid] = useState<string>(UID_PRESETS[0].uid)
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{ tone: 'ok' | 'warn' | 'err'; text: string } | null>(null)

  useEffect(() => {
    if (selectedRoomId !== null && !rooms.some((r) => r.id === selectedRoomId)) {
      setSelectedRoomId(null)
    }
  }, [rooms, selectedRoomId])

  const activeRoom = selectedRoomId === null ? undefined : rooms.find((room) => room.id === selectedRoomId)

  useEffect(() => {
    onRoomSelectionChange?.(activeRoom?.id ?? null)
  }, [activeRoom?.id, onRoomSelectionChange])

  const refreshQueries = () => {
    void mutate('supervisor-summary')
    void mutate('access-events')
    void mutate('agent-decisions')
    void mutate('operational-alerts')
  }

  const runAccess = async (mode: 'grant' | 'deny' | 'exit') => {
    if (!activeRoom) return
    setBusyAction(mode)
    setFeedback(null)
    const targetUid =
      mode === 'deny' && uid.trim().toUpperCase() === '04-A1-B2-C3'
        ? 'FF-00-DE-AD'
        : uid.trim() || '04-A1-B2-C3'
    const direction = mode === 'exit' ? 'EXIT' : 'ENTRY'

    try {
      const response = await api.simulateAccess({
        cleanroom_id: activeRoom.id,
        device_id: activeRoom.device_id ?? undefined,
        uid: targetUid,
        direction,
      })
      refreshQueries()

      if (direction === 'EXIT') {
        onSimulationEvent?.({
          cleanroomId: activeRoom.id,
          kind: 'exit',
          uid: targetUid,
          detail: response.stay_minutes != null
            ? `Salida registrada · Permanencia ${response.stay_minutes} min`
            : 'Salida registrada',
          stayMinutes: response.stay_minutes,
        })
        setFeedback({
          tone: 'ok',
          text: `Salida registrada en ${activeRoom.code} (${targetUid})${
            response.stay_minutes != null ? ` · Permanencia ${response.stay_minutes} min` : ''
          }.`,
        })
      } else if (response.allowed) {
        onSimulationEvent?.({
          cleanroomId: activeRoom.id,
          kind: 'entry-grant',
          uid: targetUid,
          detail: `Acceso concedido en ${activeRoom.code}`,
        })
        setFeedback({
          tone: 'ok',
          text: `Acceso concedido en ${activeRoom.code} para UID ${targetUid} (evento #${response.event_id}).`,
        })
      } else {
        const isLock = Boolean(response.auto_locked)
        onSimulationEvent?.({
          cleanroomId: activeRoom.id,
          kind: isLock ? 'lockout' : 'entry-deny',
          uid: targetUid,
          detail: response.reason ?? 'Acceso denegado',
        })
        setFeedback({
          tone: 'warn',
          text: `Acceso denegado en ${activeRoom.code} (${targetUid}) · Motivo: ${response.reason ?? 'DENIED'}.`,
        })
      }
    } catch (cause) {
      setFeedback({
        tone: 'err',
        text: userFacingClientError(cause),
      })
    } finally {
      setBusyAction(null)
    }
  }

  const runThreeStrikesLock = async () => {
    if (!activeRoom) return
    setBusyAction('lock')
    setFeedback(null)
    const denyUid = uid.trim().toUpperCase() === '04-A1-B2-C3' ? 'FF-00-DE-AD' : (uid.trim() || 'FF-00-DE-AD')
    try {
      let lastResponse = null
      for (let step = 0; step < 3; step += 1) {
        lastResponse = await api.simulateAccess({
          cleanroom_id: activeRoom.id,
          device_id: activeRoom.device_id ?? undefined,
          uid: denyUid,
          direction: 'ENTRY',
        })
      }
      refreshQueries()
      onSimulationEvent?.({
        cleanroomId: activeRoom.id,
        kind: 'lockout',
        uid: denyUid,
        detail: '3 rechazos consecutivos · Bloqueo automático RN-10',
      })
      setFeedback({
        tone: 'warn',
        text: `Secuencia de 3 rechazos completada en ${activeRoom.code} (${denyUid}). ${
          lastResponse?.auto_locked ? 'Bloqueo RN-10 y alerta crítica emitidos.' : 'Eventos de rechazo registrados.'
        }`,
      })
    } catch (cause) {
      setFeedback({
        tone: 'err',
        text: userFacingClientError(cause),
      })
    } finally {
      setBusyAction(null)
    }
  }

  const runPm25Anomaly = async () => {
    if (!activeRoom) return
    if (!activeRoom.device_id) {
      setFeedback({
        tone: 'err',
        text: `El cuarto ${activeRoom.code} no tiene un dispositivo vinculado para recibir telemetría.`,
      })
      return
    }
    setBusyAction('anomaly')
    setFeedback(null)
    try {
      await api.addReading({
        device_id: activeRoom.device_id,
        cleanroom_id: activeRoom.id,
        metric: 'pm25',
        value: 214,
        unit: 'p/m³',
      })
      refreshQueries()
      onSimulationEvent?.({
        cleanroomId: activeRoom.id,
        kind: 'anomaly',
        uid: activeRoom.device_code ?? `DEV-${activeRoom.device_id}`,
        detail: 'PM2.5 = 214 p/m³ fuera de rango · Alerta RN-11',
      })
      setFeedback({
        tone: 'warn',
        text: `Lectura anómala PM2.5 (214 p/m³) enviada a ${activeRoom.code}. Alerta y decisión RN-11 registradas.`,
      })
    } catch (cause) {
      setFeedback({
        tone: 'err',
        text: userFacingClientError(cause),
      })
    } finally {
      setBusyAction(null)
    }
  }

  return (
    <section className="rounded-2xl border border-[#d5e7e3] bg-white p-4 shadow-[0_8px_22px_rgba(16,44,58,0.035)] dark:border-[#1e4145] dark:bg-[#101e26]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-xl bg-[#087f7b] text-white dark:bg-[#14b8a6] dark:text-[#042f2e]">
            <Cpu className="size-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-[#163542] dark:text-[#e6f0f2]">
                Validación manual de accesos
              </h3>
              <span className="rounded-full bg-[#eaf5f2] px-2.5 py-1 text-[10px] font-semibold text-[#087f7b] dark:bg-[#13313b] dark:text-[#5eead4]">
                Control asistido
              </span>
            </div>
            <p className="text-xs text-[#58727c] dark:text-[#94adb8]">
              Registra acciones de acceso y evalúa las reglas vigentes del cuarto seleccionado.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="inline-flex items-center gap-1.5 rounded-xl border border-[#dce8eb] bg-white px-3 py-1.5 text-xs font-semibold text-[#29434e] transition hover:bg-[#f4f9f8] dark:border-[#233a47] dark:bg-[#101e26] dark:text-[#e6f0f2]"
        >
          {expanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
          {expanded ? 'Ocultar controles' : 'Mostrar controles'}
        </button>
      </div>

      {expanded && (
        <div className="mt-4 flex flex-col gap-3 border-t border-[#087f7b]/15 pt-4 dark:border-[#2dd4bf]/15">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="flex flex-col gap-1 text-xs font-medium text-[#29434e] dark:text-[#d7e6ea]">
              <span>Cuarto limpio objetivo</span>
              <select
                value={selectedRoomId ?? ''}
                onChange={(event) => {
                  const roomId = event.target.value ? Number(event.target.value) : null
                  setSelectedRoomId(roomId)
                  onRoomSelectionChange?.(roomId)
                }}
                className="rounded-xl border border-[#dce8eb] bg-white px-3 py-2 text-xs text-[#163542] outline-none focus:border-[#087f7b] dark:border-[#233a47] dark:bg-[#101e26] dark:text-[#e6f0f2]"
              >
                <option value="">Seleccione un cuarto</option>
                {rooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.code} · {room.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-xs font-medium text-[#29434e] dark:text-[#d7e6ea]">
              <span>Tarjeta RFID predefinida</span>
              <select
                value={UID_PRESETS.some((item) => item.uid === uid) ? uid : ''}
                onChange={(event) => {
                  if (event.target.value) setUid(event.target.value)
                }}
                className="rounded-xl border border-[#dce8eb] bg-white px-3 py-2 text-xs text-[#163542] outline-none focus:border-[#087f7b] dark:border-[#233a47] dark:bg-[#101e26] dark:text-[#e6f0f2]"
              >
                {UID_PRESETS.map((preset) => (
                  <option key={preset.uid} value={preset.uid}>
                    {preset.label}
                  </option>
                ))}
                {!UID_PRESETS.some((item) => item.uid === uid) && (
                  <option value="">UID personalizado</option>
                )}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-xs font-medium text-[#29434e] dark:text-[#d7e6ea]">
              <span>UID manual</span>
              <input
                type="text"
                value={uid}
                onChange={(event) => setUid(event.target.value)}
                placeholder="04-A1-B2-C3"
                className="rounded-xl border border-[#dce8eb] bg-white px-3 py-2 font-mono text-xs text-[#163542] outline-none focus:border-[#087f7b] dark:border-[#233a47] dark:bg-[#101e26] dark:text-[#e6f0f2]"
              />
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!activeRoom || busyAction !== null}
              onClick={() => void runAccess('grant')}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
            >
              {busyAction === 'grant' ? <LoaderCircle className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
              Validar acceso
            </button>

            <button
              type="button"
              disabled={!activeRoom || busyAction !== null}
              onClick={() => void runAccess('deny')}
              className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-rose-700 disabled:opacity-50"
            >
              {busyAction === 'deny' ? <LoaderCircle className="size-3.5 animate-spin" /> : <ShieldX className="size-3.5" />}
              Validar rechazo
            </button>

            <button
              type="button"
              disabled={!activeRoom || busyAction !== null}
              onClick={() => void runThreeStrikesLock()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-amber-700 disabled:opacity-50"
            >
              {busyAction === 'lock' ? <LoaderCircle className="size-3.5 animate-spin" /> : <Lock className="size-3.5" />}
              Probar bloqueo
            </button>

            <button
              type="button"
              disabled={!activeRoom || busyAction !== null}
              onClick={() => void runPm25Anomaly()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-orange-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-orange-700 disabled:opacity-50"
            >
              {busyAction === 'anomaly' ? <LoaderCircle className="size-3.5 animate-spin" /> : <AlertTriangle className="size-3.5" />}
              Registrar lectura alta
            </button>

            <button
              type="button"
              disabled={!activeRoom || busyAction !== null}
              onClick={() => void runAccess('exit')}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#dce8eb] bg-white px-3 py-2 text-xs font-semibold text-[#163542] transition hover:bg-[#f4f9f8] disabled:opacity-50 dark:border-[#233a47] dark:bg-[#101e26] dark:text-[#e6f0f2] dark:hover:bg-[#182b36]"
            >
              {busyAction === 'exit' ? <LoaderCircle className="size-3.5 animate-spin" /> : <LogOut className="size-3.5" />}
              Registrar salida
            </button>
          </div>

          {feedback && (
            <div
              role={feedback.tone === 'err' ? 'alert' : 'status'}
              className={`rounded-xl border px-3 py-2 text-xs ${
                feedback.tone === 'err'
                  ? 'border-red-200 bg-red-50 text-red-800 dark:border-red-500/30 dark:bg-red-950/40 dark:text-red-200'
                  : feedback.tone === 'warn'
                    ? 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-200'
                    : 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-950/40 dark:text-emerald-200'
              }`}
            >
              {feedback.text}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
