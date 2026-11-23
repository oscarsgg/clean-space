'use client'

import { useEffect, useRef, useState } from 'react'
import { useSWRConfig } from 'swr'
import { API_BASE_URL, getAccessToken, hasValidAccessToken } from '@/lib/api'

export type RealtimeEventType =
  | 'access_event'
  | 'telemetry_reading'
  | 'alert_created'
  | 'agent_decision'
  | 'command_created'

export type RealtimeEventEnvelope = {
  type: string
  payload: Record<string, unknown>
  receivedAt: number
}

export type RealtimeStatus = 'connecting' | 'connected' | 'reconnecting' | 'offline'

type UseRealtimeOptions = {
  enabled?: boolean
  mutateKeys?: string[]
  onEvent?: (eventType: string, payload: Record<string, unknown>) => void
}

const DEFAULT_KEYS_BY_EVENT: Record<string, string[]> = {
  access_event: ['supervisor-summary', 'access-events', 'agent-decisions', 'ecbd-patterns', 'ecbd-correlation', 'ecbd-indicators'],
  telemetry_reading: ['supervisor-summary', 'ecbd-correlation', 'ecbd-anomalies', 'ecbd-indicators'],
  alert_created: ['supervisor-summary', 'operational-alerts', 'ecbd-anomalies', 'agent-decisions'],
  agent_decision: ['agent-decisions', 'supervisor-summary'],
  command_created: ['supervisor-summary', 'agent-decisions'],
}

const REALTIME_EVENTS: RealtimeEventType[] = [
  'access_event',
  'telemetry_reading',
  'alert_created',
  'agent_decision',
  'command_created',
]

export function useRealtimeEvents(options: UseRealtimeOptions = {}) {
  const { enabled = true, mutateKeys, onEvent } = options
  const { mutate } = useSWRConfig()
  const [status, setStatus] = useState<RealtimeStatus>(enabled ? 'connecting' : 'offline')
  const [lastEvent, setLastEvent] = useState<RealtimeEventEnvelope | null>(null)
  const onEventRef = useRef(onEvent)
  const extraKeysRef = useRef(mutateKeys)

  useEffect(() => {
    onEventRef.current = onEvent
  }, [onEvent])

  useEffect(() => {
    extraKeysRef.current = mutateKeys
  }, [mutateKeys])

  useEffect(() => {
    if (!enabled || typeof window === 'undefined' || typeof EventSource === 'undefined') {
      setStatus('offline')
      return
    }

    let disposed = false
    let source: EventSource | null = null
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    let attempt = 0

    const triggerMutate = (eventType: string) => {
      const targetKeys = new Set<string>([
        ...(DEFAULT_KEYS_BY_EVENT[eventType] ?? ['supervisor-summary']),
        ...(extraKeysRef.current ?? []),
      ])
      void mutate((key) => {
        if (typeof key === 'string') return targetKeys.has(key)
        if (Array.isArray(key) && typeof key[0] === 'string') return targetKeys.has(key[0])
        return false
      })
    }

    const handleIncoming = (eventType: string, rawData: string) => {
      let parsed: Record<string, unknown> = {}
      if (rawData) {
        try {
          const decoded = JSON.parse(rawData) as Record<string, unknown>
          parsed = decoded && typeof decoded === 'object' ? decoded : { value: decoded }
        } catch {
          parsed = { raw: rawData }
        }
      }
      const resolvedType =
        eventType === 'message' && typeof parsed.event === 'string'
          ? parsed.event
          : eventType === 'message' && typeof parsed.type === 'string'
            ? parsed.type
            : eventType
      const payload =
        (parsed.data && typeof parsed.data === 'object' ? (parsed.data as Record<string, unknown>) : null) ??
        (parsed.payload && typeof parsed.payload === 'object' ? (parsed.payload as Record<string, unknown>) : null) ??
        parsed

      setLastEvent({ type: resolvedType, payload, receivedAt: Date.now() })
      triggerMutate(resolvedType)
      onEventRef.current?.(resolvedType, payload)
    }

    const connect = () => {
      if (disposed) return
      const token = getAccessToken()
      if (!token || !hasValidAccessToken(token)) {
        setStatus('offline')
        reconnectTimer = setTimeout(connect, 4000)
        return
      }

      setStatus(attempt === 0 ? 'connecting' : 'reconnecting')
      const url = `${API_BASE_URL}/eventos/stream?token=${encodeURIComponent(token)}`
      source = new EventSource(url)

      source.onopen = () => {
        if (disposed) return
        attempt = 0
        setStatus('connected')
      }

      source.onmessage = (event) => {
        if (disposed) return
        handleIncoming('message', event.data)
      }

      for (const evtName of REALTIME_EVENTS) {
        source.addEventListener(evtName, (event) => {
          if (disposed) return
          handleIncoming(evtName, (event as MessageEvent<string>).data)
        })
      }

      source.onerror = () => {
        if (disposed) return
        source?.close()
        source = null
        attempt += 1
        setStatus('reconnecting')
        const delayMs = Math.min(15000, 1000 * Math.pow(2, Math.min(attempt - 1, 4)))
        reconnectTimer = setTimeout(connect, delayMs)
      }
    }

    connect()

    return () => {
      disposed = true
      if (reconnectTimer) clearTimeout(reconnectTimer)
      if (source) source.close()
    }
  }, [enabled, mutate])

  return { status, lastEvent }
}
