'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
<<<<<<< HEAD
import { useEffect, useState } from 'react'
import { api, clearSession, getCurrentUserFromToken, saveSession } from '@/lib/api'
import { ArrowRight, CreditCard, LockKeyhole, Mail, ShieldCheck } from 'lucide-react'
=======
import { useEffect, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import useSWR from 'swr'
import { api, getCurrentUserFromToken, saveSession } from '@/lib/api'
import {
  ArrowRight,
  Camera,
  CameraOff,
  Check,
  CreditCard,
  LoaderCircle,
  LockKeyhole,
  Mail,
  RefreshCw,
  ScanFace,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  UserRound,
} from 'lucide-react'
>>>>>>> 5d87d37 (Conexion con backend, nuevos endpoints y eliminacion de datos estaticos)

function Brand({ light = false }: { light?: boolean }) {
  return <Link href="/" className="flex items-center gap-3"><div className="flex size-10 items-center justify-center overflow-hidden rounded-xl bg-[#dff8f5]"><img src="/custodia-logo.png" alt="Símbolo de CleanSpace" className="size-full object-cover" /></div><div><div className={`font-serif text-[19px] font-semibold tracking-[-0.03em] ${light ? 'text-white' : 'text-[#102d3b]'}`}>CleanSpace</div><div className={`text-[9px] font-semibold uppercase tracking-[0.24em] ${light ? 'text-slate-300' : 'text-[#77909b]'}`}>CleanSpace</div></div></Link>
}

function Shell({ children, eyebrow }: { children: React.ReactNode; eyebrow: string }) {
  return <main className="min-h-screen bg-[#f4faf9] text-[#102d3b]"><div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 py-6 sm:px-10 lg:grid lg:grid-cols-[0.85fr_1.15fr] lg:gap-10 lg:px-14"><section className="hidden flex-col justify-between rounded-[2rem] bg-[#102c3a] p-10 lg:flex xl:p-14"><div><Brand light /><div className="mt-28 max-w-md"><p className="text-xs font-bold uppercase tracking-[0.24em] text-[#83d5cc]">{eyebrow}</p><h1 className="mt-5 font-serif text-5xl leading-[1.05] tracking-[-0.04em] text-white xl:text-6xl">El control empieza con una identidad.</h1><p className="mt-6 text-base leading-relaxed text-slate-300">Accesos claros, trazables y pensados para proteger cada operación dentro del cuarto limpio.</p></div></div><p className="text-xs text-slate-400">CleanSpace protege la operación crítica · v1.0</p></section><section className="flex flex-1 flex-col"><div className="flex items-center justify-between"><Brand /><span className="hidden text-xs font-medium text-[#91a5ab] sm:block">¿Necesitas ayuda? Contacta a soporte</span></div><div className="mx-auto flex w-full max-w-[480px] flex-1 flex-col justify-center py-12">{children}</div></section></div></main>
}

export function LoginPage() {
  const router = useRouter()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionMessage, setSessionMessage] = useState('')

  useEffect(() => {
    if (typeof window === 'undefined') return
    const message = window.sessionStorage.getItem('auth_session_message')
    if (message) {
      setSessionMessage(message)
      window.sessionStorage.removeItem('auth_session_message')
    }
    if (window.history.replaceState && window.location.pathname === '/login') {
      const nextUrl = new URL(window.location.href)
      nextUrl.search = ''
      window.history.replaceState({}, '', nextUrl)
    }
  }, [])

  const resolveDefaultRoute = (rolesInput: unknown) => {
    const roles = Array.isArray(rolesInput) ? rolesInput.map((item) => String(item).toUpperCase()) : []
    if (roles.includes('ADMINISTRADOR')) return '/admin/dashboard'
    if (roles.includes('SUPERVISOR')) return '/supervisor/dashboard'
    return null
  }

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setLoading(true)
    if (typeof window !== 'undefined') window.sessionStorage.removeItem('auth_session_message')
    const form = new FormData(event.currentTarget)
    try {
      const session = await api.login(String(form.get('email')), String(form.get('password')))
      const roles = session.user?.roles ?? getCurrentUserFromToken()?.roles
      const destination = resolveDefaultRoute(roles)
      if (!destination) {
        clearSession()
        setError('Tu cuenta no tiene acceso al portal web. Usa tu credencial en el lector RFID.')
        return
      }
      saveSession(session)
      router.push(destination)
    } catch (cause) {
      setError(cause instanceof Error ? 'Correo o contraseña inválidos, o API no disponible.' : 'No fue posible iniciar sesión.')
    } finally {
      setLoading(false)
    }
  }

  return <Shell eyebrow="Acceso institucional"><div><p className="text-sm font-semibold text-[#0d9691]">Bienvenido a CleanSpace</p><h2 className="mt-2 text-3xl font-semibold tracking-tight">Ingresa con tus credenciales</h2><p className="mt-2 text-sm leading-relaxed text-[#718995]">Usa tu correo institucional y contraseña para entrar al sistema.</p></div>{sessionMessage && <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-sm">{sessionMessage}</div>}<div className="mt-8 rounded-3xl border border-[#dcebea] bg-white p-5 shadow-[0_14px_36px_rgba(18,49,66,0.06)] sm:p-6"><div className="mb-5 flex items-center gap-3"><div className="flex size-9 items-center justify-center rounded-xl bg-[#e4f6f3] text-[#087f7b]"><LockKeyhole className="size-4" /></div><div><p className="text-sm font-semibold text-[#29434e]">Acceso seguro</p><p className="text-xs text-[#8a9da5]">Sesión protegida con JWT</p></div></div><form onSubmit={submit} className="flex flex-col gap-5"><label className="flex flex-col gap-2 text-sm font-semibold text-[#36515b]">Correo institucional<div className="relative"><Mail className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[#91a5ab]" /><input required type="email" name="email" placeholder="nombre@organizacion.com" className="w-full rounded-xl border border-[#d8e6e6] bg-white py-3.5 pl-11 pr-4 font-normal outline-none focus:border-[#087f7b] focus:ring-4 focus:ring-[#087f7b]/10" /></div></label><label className="flex flex-col gap-2 text-sm font-semibold text-[#36515b]">Contraseña<div className="relative"><LockKeyhole className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[#91a5ab]" /><input required name="password" type="password" placeholder="••••••••" className="w-full rounded-xl border border-[#d8e6e6] bg-white py-3.5 pl-11 pr-4 font-normal outline-none focus:border-[#087f7b] focus:ring-4 focus:ring-[#087f7b]/10" /></div></label>{error && <p className="text-sm text-red-600">{error}</p>}<button type="submit" className="flex items-center justify-center gap-2 rounded-xl bg-[#087f7b] px-4 py-3.5 text-sm font-semibold text-white shadow-[0_6px_16px_rgba(8,127,123,0.22)] transition hover:bg-[#066c69]">{loading ? 'Conectando...' : 'Ingresar al sistema'} <ArrowRight className="size-4" /></button></form></div><div className="mt-8 flex items-start gap-3 rounded-xl border border-[#dcebea] bg-white/70 p-4"><ShieldCheck className="mt-0.5 size-5 shrink-0 text-[#087f7b]" /><p className="text-xs leading-relaxed text-[#718995]">Tu sesión queda protegida y cada acción se registra para mantener la trazabilidad.</p></div><Link href="/acceso/cuarto-01" className="mt-6 text-center text-sm font-semibold text-[#087f7b] hover:underline">¿Acceso físico? Usa el lector RFID</Link></Shell>
}

export function RfidAccessPage({ cuartoId }: { cuartoId: string }) {
<<<<<<< HEAD
  return <Shell eyebrow="Acceso físico"><div><p className="text-sm font-semibold text-[#0d9691]">Lector RFID · {cuartoId}</p><h2 className="mt-2 text-3xl font-semibold tracking-tight">Validación de acceso</h2><p className="mt-2 text-sm leading-relaxed text-[#718995]">La autorización se realiza cuando el lector físico envía el UID a CleanSpace. Esta página no puede leer ni simular una tarjeta.</p></div><div className="mt-8 flex flex-col items-center rounded-3xl border border-[#dcebea] bg-white p-8 text-center shadow-[0_12px_30px_rgba(18,49,66,0.05)]"><div className="flex size-28 items-center justify-center rounded-full border-8 border-[#dff1ef] bg-[#f4faf9]"><CreditCard className="size-12 text-[#087f7b]" /></div><p className="mt-6 font-semibold text-[#163542]">Se requiere un lector registrado</p><p className="mt-2 max-w-sm text-sm text-[#718995]">El dispositivo debe autenticarse en la API y validar la tarjeta contra los permisos vigentes del cuarto. Si el lector no está conectado, no se concede acceso.</p><div role="note" className="mt-5 rounded-xl bg-[#f7fbfb] px-4 py-3 text-left text-xs leading-relaxed text-[#58727c]">Endpoint para el firmware del dispositivo: <code>POST /api/v1/iot/acceso/validar</code></div></div><Link href="/login" className="mt-6 text-center text-sm font-semibold text-[#087f7b] hover:underline">Ingresar con correo y contraseña</Link></Shell>
=======
  const router = useRouter()
  const [mode, setMode] = useState<'rfid' | 'facial'>('rfid')
  const [reading, setReading] = useState(false)
  const [manualUid, setManualUid] = useState('')
  const [feedback, setFeedback] = useState<{ tone: 'ok' | 'err'; message: string } | null>(null)

  // Camera stream state for Facial Recognition
  const videoRef = useRef<HTMLVideoElement>(null)
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraError, setCameraError] = useState('')

  // Watch for recent card swipe
  const { data: lastScanned } = useSWR('rfid-last-scanned', api.lastScannedCard, {
    refreshInterval: 1800,
  })

  // Start webcam
  const startCamera = async () => {
    setCameraError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
      })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        setCameraActive(true)
      }
    } catch (err) {
      setCameraError('No se pudo acceder a la cámara. Puedes usar las opciones de verificación directa.')
    }
  }

  // Stop webcam
  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream
      stream.getTracks().forEach((track) => track.stop())
      videoRef.current.srcObject = null
    }
    setCameraActive(false)
  }

  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [])

  // Auto-redirect if hardware ESP32 scanned an authorized card
  useEffect(() => {
    if (lastScanned?.authorized && lastScanned.door_id === 'entrada-principal') {
      router.push(`/acceso/${cuartoId}/confirmado`)
    }
  }, [lastScanned, cuartoId, router])

  // Process RFID access
  const handleValidateRfid = async (targetUid: string) => {
    const cleanUid = targetUid.trim()
    if (!cleanUid) return
    setReading(true)
    setFeedback(null)
    try {
      const res = await api.simulateAccess({
        cleanroom_id: 1,
        uid: cleanUid,
        direction: 'ENTRY',
      })
      if (res.allowed) {
        setFeedback({ tone: 'ok', message: `Acceso concedido para tarjeta ${cleanUid}` })
        window.setTimeout(() => router.push(`/acceso/${cuartoId}/confirmado`), 900)
      } else {
        setFeedback({
          tone: 'err',
          message: `Acceso denegado: Tarjeta ${cleanUid} no autorizada (${res.reason || 'Sin permiso'})`,
        })
      }
    } catch {
      setFeedback({ tone: 'err', message: 'No se pudo conectar con el servicio de acceso.' })
    } finally {
      setReading(false)
    }
  }

  // Process Facial Verification via Camera Capture or Simulation
  const handleCaptureAndVerify = async () => {
    if (!videoRef.current) return
    setReading(true)
    setFeedback(null)
    try {
      const canvas = document.createElement('canvas')
      canvas.width = videoRef.current.videoWidth || 640
      canvas.height = videoRef.current.videoHeight || 480
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height)
        const base64 = canvas.toDataURL('image/jpeg', 0.85).split(',')[1]
        const result = await api.facialVerify({ image_base64: base64, door_id: cuartoId })
        if (result.authorized) {
          setFeedback({ tone: 'ok', message: `Identidad confirmada: ${result.employee_name || 'Personal autorizado'}` })
          window.setTimeout(() => router.push(`/acceso/${cuartoId}/confirmado`), 900)
        } else {
          setFeedback({
            tone: 'err',
            message: `Alerta: Acceso facial denegado (${result.reason === 'unknown_face' ? 'Rostro no reconocido' : 'Sin permiso para este cuarto'}).`,
          })
        }
      }
    } catch {
      setFeedback({ tone: 'err', message: 'Error al procesar la captura facial.' })
    } finally {
      setReading(false)
    }
  }

  // Fast Simulation of Facial Access (Granted or Denied/Alert)
  const handleFacialSimulation = async (simMode: 'grant' | 'deny') => {
    setReading(true)
    setFeedback(null)
    try {
      const res = await api.simulateFacialAccess({ mode: simMode, door_id: cuartoId })
      if (res.authorized) {
        setFeedback({ tone: 'ok', message: `Identidad confirmada: ${res.employee_name || 'Carlos Mendez'}` })
        window.setTimeout(() => router.push(`/acceso/${cuartoId}/confirmado`), 900)
      } else {
        setFeedback({
          tone: 'err',
          message: 'Alerta de seguridad: Rostro no reconocido en el cuarto limpio. Evento reportado a supervisión.',
        })
      }
    } catch {
      setFeedback({ tone: 'err', message: 'Error de conexión con el servicio biométrico.' })
    } finally {
      setReading(false)
    }
  }

  return (
    <Shell eyebrow="Terminal de acceso físico">
      <div>
        <p className="text-sm font-semibold text-[#0d9691]">Esclusa de acceso · {cuartoId}</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight">Validación de identidad</h2>
        <p className="mt-2 text-sm leading-relaxed text-[#718995]">
          Selecciona tu método de autenticación para ingresar a la sala limpia.
        </p>
      </div>

      {/* Selector de método: Tarjeta vs Rostro */}
      <div className="mt-6 grid grid-cols-2 gap-2 rounded-2xl border border-[#dcebea] bg-white p-1.5 shadow-sm">
        <button
          type="button"
          onClick={() => {
            setMode('rfid')
            stopCamera()
            setFeedback(null)
          }}
          className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-semibold transition ${
            mode === 'rfid'
              ? 'bg-[#087f7b] text-white shadow'
              : 'text-[#58727c] hover:bg-[#f3f8f8]'
          }`}
        >
          <CreditCard className="size-4" />
          Tarjeta RFID
        </button>
        <button
          type="button"
          onClick={() => {
            setMode('facial')
            setFeedback(null)
          }}
          className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-semibold transition ${
            mode === 'facial'
              ? 'bg-[#087f7b] text-white shadow'
              : 'text-[#58727c] hover:bg-[#f3f8f8]'
          }`}
        >
          <ScanFace className="size-4" />
          Reconocimiento Facial
        </button>
      </div>

      {/* Alerta de acceso o error */}
      {feedback && (
        <div
          role="alert"
          className={`mt-4 flex items-center gap-2.5 rounded-2xl border p-4 text-xs font-semibold shadow-md ${
            feedback.tone === 'ok'
              ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
              : 'border-rose-400 bg-rose-50 text-rose-900 animate-bounce'
          }`}
        >
          {feedback.tone === 'ok' ? (
            <Check className="size-5 shrink-0 text-emerald-600" />
          ) : (
            <ShieldAlert className="size-5 shrink-0 text-rose-600" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* MODO 1: TARJETA RFID */}
      {mode === 'rfid' && (
        <div className="mt-6 flex flex-col items-center rounded-3xl border border-[#dcebea] bg-white p-6 text-center shadow-[0_12px_30px_rgba(18,49,66,0.05)]">
          <div
            className={`flex size-24 items-center justify-center rounded-full border-8 ${
              reading ? 'animate-pulse border-[#83d5cc] bg-[#e7f7f5]' : 'border-[#dff1ef] bg-[#f4faf9]'
            }`}
          >
            <CreditCard className="size-10 text-[#087f7b]" />
          </div>

          <p className="mt-4 font-semibold text-[#163542]">Lector de proximidad listo</p>
          <p className="mt-1 text-xs text-[#718995]">
            Acerca tu tarjeta física al lector o ingresa tu código para validar.
          </p>

          <div className="mt-5 flex w-full max-w-xs flex-col gap-2">
            <div className="flex gap-2">
              <input
                value={manualUid}
                onChange={(e) => setManualUid(e.target.value)}
                placeholder="Código de tarjeta (ej: CARD-EMP-001)"
                className="w-full rounded-xl border border-[#dce8eb] bg-[#fbfefe] px-3 py-2 text-xs outline-none focus:border-[#087f7b]"
              />
              <button
                type="button"
                disabled={reading || !manualUid.trim()}
                onClick={() => handleValidateRfid(manualUid)}
                className="rounded-xl bg-[#087f7b] px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-[#066c69] disabled:opacity-50"
              >
                Validar
              </button>
            </div>

            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                disabled={reading}
                onClick={() => handleValidateRfid('CARD-EMP-001')}
                className="rounded-lg border border-[#dce8eb] px-3 py-1.5 text-[11px] font-semibold text-[#58727c] hover:bg-[#f7fbfa]"
              >
                Probar tarjeta autorizada
              </button>
              <button
                type="button"
                disabled={reading}
                onClick={() => handleValidateRfid('TAG-DESCONOCIDA')}
                className="rounded-lg border border-red-200 px-3 py-1.5 text-[11px] font-semibold text-red-700 hover:bg-red-50"
              >
                Probar denegada
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODO 2: RECONOCIMIENTO FACIAL */}
      {mode === 'facial' && (
        <div className="mt-6 flex flex-col items-center rounded-3xl border border-[#dcebea] bg-white p-6 text-center shadow-[0_12px_30px_rgba(18,49,66,0.05)]">
          <div className="relative flex size-44 items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-[#087f7b]/40 bg-[#f4faf9]">
            {cameraActive ? (
              <video ref={videoRef} autoPlay playsInline muted className="size-full object-cover" />
            ) : (
              <div className="flex flex-col items-center gap-2 text-[#718995]">
                <ScanFace className="size-12 text-[#087f7b]" />
                <span className="text-xs">Cámara en espera</span>
              </div>
            )}
          </div>

          {cameraError && <p className="mt-2 text-xs text-amber-700">{cameraError}</p>}

          <div className="mt-4 flex flex-col items-center gap-2">
            {!cameraActive ? (
              <button
                type="button"
                onClick={startCamera}
                className="inline-flex items-center gap-2 rounded-xl bg-[#087f7b] px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-[#066c69]"
              >
                <Camera className="size-4" />
                Activar cámara web
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={reading}
                  onClick={handleCaptureAndVerify}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                >
                  {reading ? <LoaderCircle className="size-4 animate-spin" /> : <ScanFace className="size-4" />}
                  Verificar rostro
                </button>
                <button
                  type="button"
                  onClick={stopCamera}
                  className="rounded-xl border border-[#dce8eb] px-3 py-2 text-xs font-semibold text-[#58727c]"
                >
                  <CameraOff className="size-4" />
                </button>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              <button
                type="button"
                disabled={reading}
                onClick={() => handleFacialSimulation('grant')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-100"
              >
                <UserCheck className="size-3.5" />
                Validar rostro autorizado
              </button>
              <button
                type="button"
                disabled={reading}
                onClick={() => handleFacialSimulation('deny')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-[11px] font-semibold text-red-800 hover:bg-red-100"
              >
                <ShieldAlert className="size-3.5" />
                Validar rostro no reconocido (Alerta)
              </button>
            </div>
          </div>
        </div>
      )}

      <Link href="/login" className="mt-6 text-center text-sm font-semibold text-[#087f7b] hover:underline">
        Ingresar con correo y contraseña
      </Link>
    </Shell>
  )
>>>>>>> 5d87d37 (Conexion con backend, nuevos endpoints y eliminacion de datos estaticos)
}

export function RfidConfirmedPage({ cuartoId }: { cuartoId: string }) {
  return <Shell eyebrow="Acceso físico"><div className="text-center"><div className="mx-auto flex size-16 items-center justify-center rounded-full bg-amber-100 text-amber-700"><CreditCard className="size-7" /></div><p className="mt-6 text-sm font-semibold text-amber-700">Sin lectura asociada</p><h2 className="mt-2 text-3xl font-semibold tracking-tight">No se confirmó el acceso</h2><p className="mt-2 text-sm leading-relaxed text-[#718995]">Esta ruta no representa una autorización. El resultado válido se genera y registra únicamente al validar el UID mediante el dispositivo autenticado del cuarto {cuartoId}.</p></div><Link href={`/acceso/${encodeURIComponent(cuartoId)}`} className="mt-6 flex items-center justify-center gap-2 rounded-xl bg-[#087f7b] px-4 py-3.5 text-sm font-semibold text-white hover:bg-[#066c69]">Volver al estado del lector <ArrowRight className="size-4" /></Link></Shell>
}
