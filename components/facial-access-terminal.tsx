'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import { Camera, CameraOff, LoaderCircle, ScanFace } from 'lucide-react'
import { api, getCurrentUserFromToken } from '@/lib/api'

function doorIdForRoom(room: { id: number; code: string }) {
  return room.id === 1 ? 'entrada-principal' : `puerta-${room.code.toLowerCase()}`
}

export function FacialAccessTerminal({ initialDoor = '' }: { initialDoor?: string }) {
  const { data: roomsData } = useSWR('facial-door-rooms', api.rooms)
  const [doorId, setDoorId] = useState(initialDoor)
  const [cameraActive, setCameraActive] = useState(false)
  const [working, setWorking] = useState(false)
  const [message, setMessage] = useState('')
  const [authorized, setAuthorized] = useState<boolean | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const rooms = Array.isArray(roomsData) ? roomsData : []
  const identity = getCurrentUserFromToken()
  const roles = Array.isArray(identity?.roles) ? identity.roles.map((role) => String(role).toUpperCase()) : []
  const canVerify = roles.includes('ADMINISTRADOR') || roles.includes('SUPERVISOR')

  useEffect(() => {
    if (doorId || !rooms[0]) return
    setDoorId(doorIdForRoom(rooms[0]))
  }, [doorId, rooms])

  const stopCamera = () => {
    const stream = videoRef.current?.srcObject
    if (stream instanceof MediaStream) stream.getTracks().forEach((track) => track.stop())
    if (videoRef.current) videoRef.current.srcObject = null
    setCameraActive(false)
  }

  useEffect(() => () => {
    const stream = videoRef.current?.srcObject
    if (stream instanceof MediaStream) stream.getTracks().forEach((track) => track.stop())
  }, [])

  const startCamera = async () => {
    setMessage('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' } })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        setCameraActive(true)
      }
    } catch {
      setMessage('No se pudo abrir la cámara. Revisa el permiso del navegador y que la página use HTTPS o localhost.')
    }
  }

  const verify = async () => {
    if (!videoRef.current || !doorId) return
    setWorking(true)
    setMessage('')
    setAuthorized(null)
    try {
      const video = videoRef.current
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth || 640
      canvas.height = video.videoHeight || 480
      const context = canvas.getContext('2d')
      if (!context) throw new Error('No se pudo capturar la imagen.')
      context.drawImage(video, 0, 0, canvas.width, canvas.height)
      const result = await api.facialVerify({ image_base64: canvas.toDataURL('image/jpeg', 0.85).split(',')[1], door_id: doorId })
      setAuthorized(result.authorized)
      if (!result.authorized) setMessage(`Acceso denegado: ${result.reason}.`)
      else if (result.command_queued) setMessage(`${result.employee_name ?? 'Personal identificado'} está autorizado. La orden ${result.command_id ? `#${result.command_id} ` : ''}quedó en cola; falta confirmación de apertura del lector.`)
      else setMessage(`${result.employee_name ?? 'Personal identificado'} tiene permiso, pero no hay dispositivo activo asociado a esta sala.`)
    } catch (error) {
      setAuthorized(false)
      setMessage(error instanceof Error ? error.message : 'No se pudo verificar el rostro.')
    } finally {
      setWorking(false)
    }
  }

  if (!canVerify) {
    return <section className="mt-6 rounded-2xl border border-[#dcebea] bg-white p-5 text-sm text-[#58727c]"><h3 className="font-semibold text-[#163542]">Verificación facial supervisada</h3><p className="mt-2">Inicia sesión como administrador o supervisor para usar esta cámara. La lectura RFID del dispositivo físico sigue disponible.</p><Link href="/login" className="mt-3 inline-block font-semibold text-[#087f7b] hover:underline">Ir al inicio de sesión</Link></section>
  }

  return (
    <section className="mt-6 rounded-2xl border border-[#dcebea] bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2"><ScanFace className="size-5 text-[#087f7b]" /><h3 className="font-semibold text-[#163542]">Verificación facial supervisada</h3></div>
      <p className="mt-1 text-xs text-[#718995]">Requiere sesión de administrador o supervisor y permiso RFID activo para esa puerta.</p>
      <label className="mt-4 flex flex-col gap-2 text-xs font-semibold text-[#36515b]">Sala / puerta
        <select value={doorId} onChange={(event) => setDoorId(event.target.value)} className="min-h-10 rounded-xl border border-[#d8e6e6] bg-white px-3 text-sm">{rooms.map((room) => <option key={room.id} value={doorIdForRoom(room)}>{room.name} · {room.code}</option>)}</select>
      </label>
      <div className="mt-4 flex min-h-48 items-center justify-center overflow-hidden rounded-xl border border-[#dcebea] bg-[#f7fbfb]">{cameraActive ? <video ref={videoRef} autoPlay playsInline muted className="h-56 w-full object-cover" /> : <p className="px-4 text-center text-sm text-[#718995]">Activa la cámara para capturar un solo rostro.</p>}</div>
      <div className="mt-3 flex flex-wrap gap-2">{cameraActive ? <><button type="button" disabled={working || !doorId} onClick={() => void verify()} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#087f7b] px-4 text-sm font-semibold text-white disabled:opacity-60">{working ? <LoaderCircle className="size-4 animate-spin" /> : <ScanFace className="size-4" />}Verificar rostro</button><button type="button" onClick={stopCamera} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#dce8eb] px-3 text-sm"><CameraOff className="size-4" />Detener</button></> : <button type="button" onClick={() => void startCamera()} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#087f7b] px-4 text-sm font-semibold text-white"><Camera className="size-4" />Activar cámara</button>}</div>
      {message && <p role="status" aria-live="polite" className={`mt-3 rounded-lg border px-3 py-2 text-sm ${authorized ? 'border-amber-300 bg-amber-50 text-amber-900' : 'border-border bg-muted/40 text-foreground'}`}>{message}</p>}
    </section>
  )
}
