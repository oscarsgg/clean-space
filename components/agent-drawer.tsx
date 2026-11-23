'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import useSWR, { useSWRConfig } from 'swr'
import {
  Bot,
  Check,
  History,
  LoaderCircle,
  MessageSquarePlus,
  Send,
  ShieldAlert,
  Sparkles,
  X,
} from 'lucide-react'
import {
  api,
  type AgentConversation,
  type AgentMessage,
  type SupervisorRoomSummary,
} from '@/lib/api'
import { userFacingClientError } from '@/lib/user-facing-errors.mjs'

const QUICK_CHIPS = [
  { label: '¿Aforo actual en las salas?', prompt: '¿Cuál es el aforo actual de las salas limpias?' },
  { label: '¿Últimos rechazos de acceso?', prompt: '¿Cuáles fueron los últimos rechazos de acceso y por qué?' },
  { label: '¿Hay anomalías ambientales?', prompt: '¿Hay anomalías ambientales o lecturas fuera de rango?' },
  { label: 'Resumen de alertas activas', prompt: 'Dame un resumen de las alertas activas actuales' },
  { label: 'Bloquear esclusa CL-01', prompt: 'Bloquear esclusa de SALA-A por seguridad', critical: true },
]

function formatTime(value?: string) {
  if (!value) return ''
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''
  return parsed.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
}

export function AgentConsole({
  rooms,
  compact = false,
}: {
  rooms?: SupervisorRoomSummary[]
  compact?: boolean
}) {
  const { mutate } = useSWRConfig()
  const { data: summaryData } = useSWR(
    rooms ? null : 'supervisor-summary',
    api.supervisorSummary,
  )
  const {
    data: conversationsData,
    mutate: mutateConversations,
  } = useSWR('agent-conversations', api.agent.conversations)

  const resolvedRooms = rooms ?? summaryData?.rooms ?? []
  const conversations = useMemo(
    () => (Array.isArray(conversationsData) ? conversationsData : []),
    [conversationsData],
  )

  const [conversationId, setConversationId] = useState<number | undefined>(undefined)
  const [selectedRoomId, setSelectedRoomId] = useState<string>('')
  const [messages, setMessages] = useState<AgentMessage[]>([])
  const [loadingConv, setLoadingConv] = useState(false)
  const [sending, setSending] = useState(false)
  const [confirmingId, setConfirmingId] = useState<number | null>(null)
  const [input, setInput] = useState('')
  const [error, setError] = useState('')
  const [showHistory, setShowHistory] = useState(false)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (conversationId !== undefined || conversations.length === 0) return
    const latest = conversations[0]
    if (latest?.id) {
      void loadConversation(latest.id)
    }
  }, [conversations, conversationId])

  useEffect(() => {
    if (!scrollRef.current) return
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages, sending])

  const loadConversation = async (id: number) => {
    setLoadingConv(true)
    setError('')
    try {
      const detail = (await api.agent.conversation(id)) as AgentConversation
      setConversationId(detail.id)
      setMessages(Array.isArray(detail.messages) ? detail.messages : [])
      setShowHistory(false)
    } catch (cause) {
      setError(userFacingClientError(cause))
    } finally {
      setLoadingConv(false)
    }
  }

  const startNewConversation = () => {
    setConversationId(undefined)
    setMessages([])
    setError('')
    setShowHistory(false)
  }

  const sendMessage = async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || sending) return
    setSending(true)
    setError('')
    setInput('')
    try {
      const response = await api.agent.chat({
        message: trimmed,
        conversation_id: conversationId,
        cleanroom_id: selectedRoomId ? Number(selectedRoomId) : undefined,
      })
      setConversationId(response.conversation_id)
      setMessages((current) => [
        ...current,
        response.user_message,
        response.agent_message,
      ])
      void mutateConversations()
      void mutate('agent-decisions')
    } catch (cause) {
      setError(userFacingClientError(cause))
      setInput(trimmed)
    } finally {
      setSending(false)
    }
  }

  const handleConfirm = async (messageId: number, action: 'CONFIRM' | 'CANCEL') => {
    setConfirmingId(messageId)
    setError('')
    try {
      const result = await api.agent.confirmMessage(messageId, action)
      setMessages((current) =>
        current.map((msg) =>
          msg.id === messageId
            ? { ...msg, confirmation_status: result.confirmation_status }
            : msg,
        ),
      )
      void mutate('supervisor-summary')
      void mutate('agent-decisions')
    } catch (cause) {
      setError(userFacingClientError(cause))
    } finally {
      setConfirmingId(null)
    }
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <select
            aria-label="Filtrar contexto por cuarto limpio"
            value={selectedRoomId}
            onChange={(event) => setSelectedRoomId(event.target.value)}
            className="rounded-lg border border-[#dce8eb] bg-[#f7fbfa] px-2.5 py-1.5 text-xs font-medium text-[#29434e] outline-none focus:border-[#087f7b] dark:border-[#233a47] dark:bg-[#13222b] dark:text-[#e6f0f2]"
          >
            <option value="">Todas las salas</option>
            {resolvedRooms.map((room) => (
              <option key={room.id} value={String(room.id)}>
                {room.code} · {room.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowHistory((v) => !v)}
            className="inline-flex items-center gap-1 rounded-lg border border-[#dce8eb] px-2.5 py-1.5 text-xs font-medium text-[#58727c] transition hover:bg-[#f4f9f8] dark:border-[#233a47] dark:text-[#94adb8] dark:hover:bg-[#182b36]"
          >
            <History className="size-3.5" />
            Historial ({conversations.length})
          </button>
          <button
            type="button"
            onClick={startNewConversation}
            className="inline-flex items-center gap-1 rounded-lg border border-[#dce8eb] px-2.5 py-1.5 text-xs font-medium text-[#087f7b] transition hover:bg-[#eff8f7] dark:border-[#233a47] dark:text-[#2dd4bf] dark:hover:bg-[#13313b]"
          >
            <MessageSquarePlus className="size-3.5" />
            Nueva
          </button>
        </div>
      </div>

      {showHistory && (
        <div className="max-h-40 overflow-y-auto rounded-xl border border-[#dce8eb] bg-[#f7fbfa] p-2 dark:border-[#233a47] dark:bg-[#0d1820]">
          {conversations.length === 0 ? (
            <p className="p-2 text-xs text-[#718995] dark:text-[#94adb8]">
              Aún no hay conversaciones guardadas.
            </p>
          ) : (
            <div className="flex flex-col gap-1">
              {conversations.slice(0, 12).map((conv) => (
                <button
                  key={conv.id}
                  type="button"
                  onClick={() => void loadConversation(conv.id)}
                  className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs transition ${
                    conv.id === conversationId
                      ? 'bg-[#dff8f5] font-semibold text-[#087f7b] dark:bg-[#13313b] dark:text-[#5eead4]'
                      : 'text-[#29434e] hover:bg-white dark:text-[#d7e6ea] dark:hover:bg-[#15242e]'
                  }`}
                >
                  <span className="truncate">{conv.title || `Conversación #${conv.id}`}</span>
                  <span className="ml-2 shrink-0 text-[10px] text-[#82969d]">#{conv.id}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div
        ref={scrollRef}
        className={`flex flex-col gap-3 overflow-y-auto rounded-2xl border border-[#e5edf0] bg-[#f8fbfb] p-3.5 dark:border-[#1e3340] dark:bg-[#0b141a] ${
          compact ? 'h-64' : 'min-h-[300px] flex-1'
        }`}
      >
        {loadingConv ? (
          <div className="flex flex-1 items-center justify-center gap-2 text-xs text-[#718995] dark:text-[#94adb8]">
            <LoaderCircle className="size-4 animate-spin" />
            Cargando conversación…
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-start gap-2.5">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#087f7b] text-[10px] font-bold text-white">
              IA
            </div>
            <div className="rounded-2xl border border-[#dce8eb] bg-white px-3.5 py-2.5 text-xs leading-relaxed text-[#29434e] shadow-xs dark:border-[#1e3340] dark:bg-[#101e26] dark:text-[#e6f0f2]">
              Soy el asistente operativo de CleanSpace. Consulta aforos, rechazos, anomalías ambientales o solicita comandos de esclusa con confirmación previa.
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            const isUser = msg.sender === 'USER'
            return (
              <div
                key={msg.id}
                className={`flex items-start gap-2.5 ${isUser ? 'flex-row-reverse' : ''}`}
              >
                <div
                  className={`flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                    isUser
                      ? 'bg-[#102c3a] text-white dark:bg-[#0ea5e9] dark:text-[#042f2e]'
                      : 'bg-[#087f7b] text-white dark:bg-[#14b8a6] dark:text-[#042f2e]'
                  }`}
                >
                  {isUser ? 'TÚ' : 'IA'}
                </div>
                <div
                  className={`max-w-[86%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                    isUser
                      ? 'bg-[#102c3a] text-white dark:bg-[#143642] dark:text-[#e6f0f2]'
                      : 'border border-[#dce8eb] bg-white text-[#29434e] shadow-xs dark:border-[#1e3340] dark:bg-[#101e26] dark:text-[#e6f0f2]'
                  }`}
                >
                  <div className="whitespace-pre-wrap">{msg.content}</div>

                  {!isUser && Array.isArray(msg.references) && msg.references.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {msg.references.map((ref, idx) => (
                        <span
                          key={`${ref.type}-${ref.id}-${idx}`}
                          className="rounded-md bg-[#eff8f7] px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[#087f7b] dark:bg-[#13313b] dark:text-[#5eead4]"
                        >
                          {ref.label}
                        </span>
                      ))}
                    </div>
                  )}

                  {!isUser && msg.pending_command && (
                    <div className="mt-2.5 rounded-xl border border-amber-200 bg-amber-50/90 p-2.5 text-[#163542] dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-100">
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-800 dark:text-amber-300">
                        <ShieldAlert className="size-3.5 shrink-0" />
                        Confirmación humana requerida
                      </div>
                      <p className="mt-1 text-[11px] text-amber-900/90 dark:text-amber-200/90">
                        Comando <span className="font-mono font-semibold">{msg.pending_command.command}</span> para dispositivo #{msg.pending_command.device_id}
                      </p>
                      {msg.confirmation_status === 'PENDING' ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={confirmingId === msg.id}
                            onClick={() => void handleConfirm(msg.id, 'CONFIRM')}
                            className="inline-flex items-center gap-1 rounded-lg bg-[#087f7b] px-2.5 py-1.5 text-[11px] font-semibold text-white transition hover:bg-[#066c69] disabled:opacity-60"
                          >
                            {confirmingId === msg.id ? (
                              <LoaderCircle className="size-3 animate-spin" />
                            ) : (
                              <Check className="size-3" />
                            )}
                            Confirmar comando
                          </button>
                          <button
                            type="button"
                            disabled={confirmingId === msg.id}
                            onClick={() => void handleConfirm(msg.id, 'CANCEL')}
                            className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-amber-900 transition hover:bg-amber-100 disabled:opacity-60 dark:border-amber-500/40 dark:bg-transparent dark:text-amber-200 dark:hover:bg-amber-900/40"
                          >
                            <X className="size-3" />
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <p className="mt-1.5 text-[11px] font-semibold text-[#087f7b] dark:text-[#5eead4]">
                          Estado: {msg.confirmation_status === 'CONFIRMED' ? 'Confirmado y enviado' : 'Cancelado por supervisor'}
                        </p>
                      )}
                    </div>
                  )}

                  {msg.created_at && (
                    <p className={`mt-1 text-[10px] ${isUser ? 'text-slate-300' : 'text-[#82969d] dark:text-[#78909a]'}`}>
                      {formatTime(msg.created_at)}
                    </p>
                  )}
                </div>
              </div>
            )
          })
        )}

        {sending && (
          <div className="flex items-center gap-2 text-xs text-[#718995] dark:text-[#94adb8]">
            <LoaderCircle className="size-3.5 animate-spin text-[#087f7b]" />
            Consultando base operativa…
          </div>
        )}
      </div>

      {error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-500/30 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {QUICK_CHIPS.map((chip) => (
          <button
            key={chip.label}
            type="button"
            disabled={sending}
            onClick={() => void sendMessage(chip.prompt)}
            className={`rounded-lg border px-2.5 py-1 text-[11px] font-medium transition disabled:opacity-60 ${
              chip.critical
                ? 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-300 dark:hover:bg-amber-950/50'
                : 'border-[#dce8eb] bg-[#f7fbfa] text-[#29434e] hover:border-[#087f7b]/40 hover:bg-[#eff8f7] dark:border-[#233a47] dark:bg-[#13222b] dark:text-[#d7e6ea] dark:hover:bg-[#182b36]'
            }`}
          >
            {chip.label}
          </button>
        ))}
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault()
          void sendMessage(input)
        }}
        className="flex gap-2"
      >
        <input
          type="text"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Pregunta al agente sobre aforo, accesos o comandos…"
          className="min-w-0 flex-1 rounded-xl border border-[#dce8eb] bg-white px-3.5 py-2.5 text-xs text-[#163542] outline-none transition focus:border-[#087f7b] focus:ring-4 focus:ring-[#087f7b]/10 dark:border-[#233a47] dark:bg-[#101e26] dark:text-[#e6f0f2]"
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-[#087f7b] px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-[#066c69] disabled:opacity-50"
        >
          <Send className="size-3.5" />
          Consultar
        </button>
      </form>
    </div>
  )
}

export function AgentDrawer({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const [agentTab, setAgentTab] = useState<'local' | 'esp_claw'>('local')

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Cerrar panel del agente"
        onClick={onClose}
        className="fixed inset-0 bg-[#102c3a]/40 backdrop-blur-[1px] transition-opacity"
      />
      <aside
        aria-label="Consola del Agente IA"
        className="relative z-10 flex h-full w-full max-w-xl flex-col border-l border-[#e5edf0] bg-white p-5 shadow-2xl dark:border-[#1e3340] dark:bg-[#101e26]"
      >
        <div className="flex items-center justify-between border-b border-[#edf2f3] pb-4 dark:border-[#1e3340]">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-[#dff8f5] text-[#087f7b] dark:bg-[#13313b] dark:text-[#5eead4]">
              <Bot className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="text-sm font-semibold text-[#163542] dark:text-[#e6f0f2]">
                  {agentTab === 'local' ? 'Agente IA CleanSpace' : 'Agente ESP-Claw (Hardware)'}
                </h2>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                  <Sparkles className="size-2.5" />
                  Activo
                </span>
              </div>
              <p className="text-xs text-[#718995] dark:text-[#94adb8]">
                {agentTab === 'local'
                  ? 'Consultas operativas y comandos con confirmación'
                  : 'Edge Agent en tiempo real en ESP32 (192.168.0.19)'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar asistente"
            className="rounded-xl p-2 text-[#58727c] transition hover:bg-[#f4f9f8] dark:text-[#94adb8] dark:hover:bg-[#182b36]"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Selector de agente: Local vs ESP-Claw */}
        <div className="mt-3 flex rounded-xl border border-[#dce8eb] bg-[#f4f7f6] p-1 dark:border-[#233a47] dark:bg-[#13222b]">
          <button
            type="button"
            onClick={() => setAgentTab('local')}
            className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition ${
              agentTab === 'local'
                ? 'bg-white text-[#087f7b] shadow-sm dark:bg-[#101e26] dark:text-[#2dd4bf]'
                : 'text-[#718995] hover:text-[#163542] dark:text-[#94adb8]'
            }`}
          >
            Agente CleanSpace (Local)
          </button>
          <button
            type="button"
            onClick={() => setAgentTab('esp_claw')}
            className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition ${
              agentTab === 'esp_claw'
                ? 'bg-white text-[#087f7b] shadow-sm dark:bg-[#101e26] dark:text-[#2dd4bf]'
                : 'text-[#718995] hover:text-[#163542] dark:text-[#94adb8]'
            }`}
          >
            Agente ESP-Claw (192.168.0.19)
          </button>
        </div>

        <div className="mt-3 flex min-h-0 flex-1 flex-col">
          {agentTab === 'local' ? (
            <AgentConsole />
          ) : (
            <div className="flex h-full flex-col gap-2">
              <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
                <span className="flex items-center gap-1.5 font-medium">
                  <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                  Conectado a ESP-Claw WebIM: <code>http://192.168.0.19/#webim</code>
                </span>
                <a
                  href="http://192.168.0.19/#webim"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg bg-emerald-600 px-2 py-1 text-[11px] font-semibold text-white transition hover:bg-emerald-700"
                >
                  Abrir directo ↗
                </a>
              </div>
              <iframe
                src="http://192.168.0.19/#webim"
                title="ESP-Claw WebIM"
                className="w-full flex-1 rounded-xl border border-[#dce8eb] bg-white shadow-inner dark:border-[#233a47] dark:bg-[#0d1820]"
              />
            </div>
          )}
        </div>
      </aside>
    </div>
  )
}
