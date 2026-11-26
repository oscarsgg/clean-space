'use client'

import { useEffect, useRef, useState } from 'react'
import useSWR from 'swr'
import { Camera, CameraOff, LoaderCircle, Trash2 } from 'lucide-react'
import { api } from '@/lib/api'

export function FacialEnrollment() {
  const { data: employeesData } = useSWR('facial-employees', api.employees)
  const [employeeId, setEmployeeId] = useState('')
  const { data: profiles, mutate } = useSWR(
    employeeId ? ['facial-biometrics', employeeId] : null,
    () => api.facialBiometrics(Number(employeeId)),
  )
  const [cameraActive, setCameraActive] = useState(false)
  const [working, setWorking] = useState(false)
  const [message, setMessage] = useState('')
  const videoRef = useRef<HTMLVideoElement>(null)
  const employees = Array.isArray(employeesData) ? employeesData.filter((employee) => employee.isActive) : []

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
      setMessage('No se pudo abrir la cámara. Verifica el permiso del navegador y usa HTTPS fuera de localhost.')
    }
  }

  const enroll = async () => {
    if (!employeeId || !videoRef.current) return
    setWorking(true)
    setMessage('')
    try {
      const video = videoRef.current
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth || 640
      canvas.height = video.videoHeight || 480
      const context = canvas.getContext('2d')
      if (!context) throw new Error('No se pudo preparar la imagen de cámara.')
      context.drawImage(video, 0, 0, canvas.width, canvas.height)
      const image_base64 = canvas.toDataURL('image/jpeg', 0.85).split(',')[1]
      const result = await api.facialEnroll({ employee_id: Number(employeeId), image_base64, sample_type: 'full_face' })
      await mutate()
      setMessage(result.message)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo registrar el perfil biométrico.')
    } finally {
      setWorking(false)
    }
  }

  const remove = async (id: number) => {
    setWorking(true)
    setMessage('')
    try {
      await api.deleteFacialBiometric(id)
      await mutate()
      setMessage('Perfil biométrico eliminado.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo eliminar el perfil.')
    } finally {
      setWorking(false)
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--admin-panel-shadow)]">
      <div className="border-b border-border bg-muted/40 px-5 py-4 sm:px-6"><h2 className="font-semibold text-foreground">Registro biométrico facial</h2><p className="mt-1 text-sm text-muted-foreground">Solo administradores pueden registrar o eliminar plantillas faciales.</p></div>
      <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(14rem,0.8fr)]">
        <div className="space-y-3">
          <label className="flex flex-col gap-2 text-xs font-semibold text-foreground">Personal activo
            <select value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} className="min-h-11 rounded-xl border border-border bg-background px-3 text-sm"><option value="">Selecciona personal</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.firstName} {employee.lastName} · {employee.department}</option>)}</select>
          </label>
          <div className="flex min-h-48 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted/20">{cameraActive ? <video ref={videoRef} autoPlay playsInline muted className="h-56 w-full object-cover" /> : <p className="px-4 text-center text-sm text-muted-foreground">Activa la cámara y coloca un solo rostro dentro del encuadre.</p>}</div>
          <div className="flex flex-wrap gap-2">{cameraActive ? <><button type="button" onClick={() => void enroll()} disabled={working || !employeeId} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60">{working ? <LoaderCircle className="size-4 animate-spin" /> : <Camera className="size-4" />}Registrar rostro</button><button type="button" onClick={stopCamera} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border px-3 text-sm"><CameraOff className="size-4" />Detener</button></> : <button type="button" onClick={() => void startCamera()} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"><Camera className="size-4" />Activar cámara</button>}</div>
          {message && <p role="status" className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">{message}</p>}
        </div>
        <div><h3 className="text-sm font-semibold text-foreground">Plantillas registradas</h3>{!employeeId ? <p className="mt-3 text-sm text-muted-foreground">Selecciona una persona para ver sus plantillas.</p> : (profiles ?? []).length === 0 ? <p className="mt-3 text-sm text-muted-foreground">No hay plantillas faciales para este perfil.</p> : <ul className="mt-2 divide-y divide-border">{profiles?.map((profile) => <li key={profile.id} className="flex items-center justify-between gap-3 py-3 text-sm"><span className="text-foreground">{profile.sample_type} · {profile.is_masked ? 'con mascarilla' : 'rostro completo'}</span><button type="button" aria-label="Eliminar plantilla biométrica" disabled={working} onClick={() => void remove(profile.id)} className="rounded-lg p-2 text-muted-foreground hover:bg-muted disabled:opacity-50"><Trash2 className="size-4" /></button></li>)}</ul>}</div>
      </div>
    </section>
  )
}
