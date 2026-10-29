'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bell,
  Check,
  ChevronDown,
  CircleHelp,
  CreditCard,
  DoorOpen,
  Gauge,
  LayoutDashboard,
  Leaf,
  LockKeyhole,
  LogIn,
  Menu,
  Moon,
  MoreHorizontal,
  Sun,
  Search,
  Settings2,
  Thermometer,
  UserRound,
  Users,
  Wind,
  X,
} from 'lucide-react'

const navItems = [
  { id: 'dashboard', label: 'Resumen', icon: LayoutDashboard },
  { id: 'monitoring', label: 'Monitoreo', icon: Activity },
  { id: 'access', label: 'Control de acceso', icon: LockKeyhole },
  { id: 'people', label: 'Personas autorizadas', icon: Users },
  { id: 'alerts', label: 'Avisos', icon: Bell, count: 2 },
]

const accessRows = [
  { name: 'Dra. Valeria Ruiz', role: 'Supervisora', time: '09:42:18', method: 'Tarjeta RFID', result: 'Permitido', initials: 'VR' },
  { name: 'Ing. Mateo Cruz', role: 'Administrador', time: '09:36:04', method: 'Tarjeta RFID', result: 'Permitido', initials: 'MC' },
  { name: 'ID no reconocido', role: 'Visitante', time: '08:51:27', method: 'Credencial', result: 'Denegado', initials: 'ID' },
  { name: 'Ana Sofía López', role: 'Técnica', time: '08:24:55', method: 'Tarjeta RFID', result: 'Permitido', initials: 'AL' },
]

const sensors = [
  { label: 'Temperatura', value: '21.8', unit: '°C', status: 'En rango', icon: Thermometer, color: 'cyan', range: '18 — 24 °C' },
  { label: 'Humedad relativa', value: '46.2', unit: '%', status: 'En rango', icon: Wind, color: 'blue', range: '35 — 55 %' },
  { label: 'Presión diferencial', value: '+12', unit: 'Pa', status: 'En rango', icon: Gauge, color: 'green', range: '+8 — +15 Pa' },
  { label: 'Partículas 0.5 μm', value: '182', unit: 'p/m³', status: 'Revisar', icon: Activity, color: 'amber', range: '≤ 200 p/m³' },
]

function ThemeToggle({ floating = false }: { floating?: boolean }) {
  const [dark, setDark] = useState(false)

  const toggleTheme = () => {
    const next = !dark
    setDark(next)
    document.documentElement.classList.toggle('dark', next)
  }

  return <button type="button" onClick={toggleTheme} aria-label={dark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'} className={`flex items-center justify-center rounded-full border border-[#d9e6e8] bg-white text-[#36515b] shadow-[0_8px_24px_rgba(18,49,66,0.12)] transition hover:border-[#087f7b] hover:text-[#087f7b] ${floating ? 'fixed bottom-6 right-6 z-40 size-12' : 'size-9'}`}>
    {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
  </button>
}

function Logo({ light = false }: { light?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className={`flex size-10 items-center justify-center overflow-hidden rounded-xl ${light ? 'bg-white' : 'bg-[#dff8f5]'}`}>
        <img src="/custodia-logo.png" alt="Símbolo de CleanSpace" className="size-full object-cover" />
      </div>
      <div>
        <div className={`font-serif text-[19px] font-semibold tracking-[-0.03em] ${light ? 'text-white' : 'text-[#0e2634]'}`}>CleanSpace</div>
        <div className={`text-[9px] font-semibold uppercase tracking-[0.24em] ${light ? 'text-slate-400' : 'text-[#77909b]'}`}>operación crítica</div>
      </div>
    </div>
  )
}

function MetricCard({ sensor }: { sensor: typeof sensors[number] }) {
  const Icon = sensor.icon
  const palette = sensor.color === 'amber' ? 'bg-amber-50 text-amber-700' : sensor.color === 'green' ? 'bg-emerald-50 text-emerald-700' : sensor.color === 'blue' ? 'bg-blue-50 text-blue-700' : 'bg-cyan-50 text-cyan-700'
  return (
    <div className="rounded-2xl border border-[#e5edf0] bg-white p-5 shadow-[0_8px_24px_rgba(18,49,66,0.04)]">
      <div className="flex items-start justify-between">
        <div className={`flex size-10 items-center justify-center rounded-xl ${palette}`}><Icon className="size-5" /></div>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${sensor.status === 'Revisar' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>{sensor.status}</span>
      </div>
      <p className="mt-5 text-sm font-medium text-[#718995]">{sensor.label}</p>
      <div className="mt-1 flex items-baseline gap-1"><span className="text-[30px] font-semibold tracking-tight text-[#112d3b]">{sensor.value}</span><span className="text-sm font-medium text-[#718995]">{sensor.unit}</span></div>
      <p className="mt-2 text-xs text-[#9aabb2]">Rango objetivo: {sensor.range}</p>
    </div>
  )
}

function Dashboard({ onNavigate }: { onNavigate: (id: string) => void }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-sm font-medium text-[#0d9691]">Miércoles, 06 de octubre de 2026</p><h1 className="mt-1 text-3xl font-semibold tracking-tight text-[#102d3b]">Buenos días, Mateo</h1><p className="mt-1 text-sm text-[#718995]">Este es el estado operativo de tu cuarto limpio.</p></div><button onClick={() => onNavigate('monitoring')} className="flex w-fit items-center gap-2 rounded-xl bg-[#087f7b] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_6px_16px_rgba(8,127,123,0.22)] transition hover:bg-[#066c69]">Ver monitoreo <ArrowRight className="size-4" /></button></div>
      <div className="flex items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/70 px-4 py-3.5"><div className="flex size-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"><Check className="size-4" /></div><div className="flex-1"><p className="text-sm font-semibold text-emerald-900">Sistema operando con normalidad</p><p className="text-xs text-emerald-700/80">3 de 4 parámetros ambientales están en rango.</p></div><span className="hidden text-xs font-medium text-emerald-700 sm:block">Actualizado hace 28 s</span></div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{sensors.map((sensor) => <MetricCard key={sensor.label} sensor={sensor} />)}</div>
      <div className="grid gap-6 xl:grid-cols-[1.35fr_1fr]">
        <section className="rounded-2xl border border-[#e5edf0] bg-white shadow-[0_8px_24px_rgba(18,49,66,0.04)]"><div className="flex items-center justify-between border-b border-[#edf2f3] px-5 py-4"><div><h2 className="font-semibold text-[#163542]">Accesos recientes</h2><p className="mt-0.5 text-xs text-[#8a9da5]">Actividad registrada hoy</p></div><button onClick={() => onNavigate('access')} className="text-xs font-semibold text-[#087f7b] hover:underline">Ver todos</button></div><div className="divide-y divide-[#edf2f3]">{accessRows.slice(0, 3).map((row) => <AccessRow key={row.time} row={row} />)}</div></section>
        <section className="rounded-2xl border border-[#e5edf0] bg-white shadow-[0_8px_24px_rgba(18,49,66,0.04)]"><div className="flex items-center justify-between border-b border-[#edf2f3] px-5 py-4"><div><h2 className="font-semibold text-[#163542]">Avisos activos</h2><p className="mt-0.5 text-xs text-[#8a9da5]">Requieren atención</p></div><button onClick={() => onNavigate('alerts')} className="text-xs font-semibold text-[#087f7b] hover:underline">Ver avisos</button></div><div className="flex flex-col gap-3 p-5"><div className="flex gap-3 rounded-xl border border-amber-100 bg-amber-50/70 p-3.5"><div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700"><AlertTriangle className="size-4" /></div><div><p className="text-sm font-semibold text-amber-900">Partículas cerca del límite</p><p className="mt-0.5 text-xs leading-relaxed text-amber-800/75">Lectura de 182 p/m³ en sensor S-04.</p><p className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-amber-700">Hace 4 min</p></div></div><div className="flex gap-3 rounded-xl border border-blue-100 bg-blue-50/60 p-3.5"><div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-700"><Activity className="size-4" /></div><div><p className="text-sm font-semibold text-blue-900">Mantenimiento programado</p><p className="mt-0.5 text-xs leading-relaxed text-blue-800/75">Revisión del sensor S-02 mañana.</p><p className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-blue-700">Programado</p></div></div></div></section>
      </div>
    </div>
  )
}

function AccessRow({ row }: { row: typeof accessRows[number] }) {
  return <div className="flex items-center gap-3 px-5 py-3.5"><div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#e9f4f3] text-[11px] font-bold text-[#087f7b]">{row.initials}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-[#29434e]">{row.name}</p><p className="text-xs text-[#93a4aa]">{row.role} · {row.method}</p></div><div className="text-right"><p className="text-xs font-medium text-[#6f858e]">{row.time}</p><span className={`text-[10px] font-semibold ${row.result === 'Permitido' ? 'text-emerald-600' : 'text-red-500'}`}>{row.result}</span></div></div>
}

function Monitoring() {
  return <div className="flex flex-col gap-6"><div><p className="text-sm font-medium text-[#0d9691]">Sensores y dispositivos</p><h1 className="mt-1 text-3xl font-semibold tracking-tight text-[#102d3b]">Monitoreo ambiental</h1><p className="mt-1 text-sm text-[#718995]">Lecturas en tiempo real del Cuarto Limpio 01.</p></div><div className="grid gap-4 sm:grid-cols-2">{sensors.map((sensor) => <MetricCard key={sensor.label} sensor={sensor} />)}</div><section className="rounded-2xl border border-[#e5edf0] bg-white p-5 shadow-[0_8px_24px_rgba(18,49,66,0.04)]"><div className="flex items-center justify-between"><div><h2 className="font-semibold text-[#163542]">Tendencia de lecturas</h2><p className="mt-0.5 text-xs text-[#8a9da5]">Últimas 12 horas · actualización automática</p></div><button className="flex items-center gap-2 rounded-lg border border-[#e5edf0] px-3 py-2 text-xs font-medium text-[#5b737d]">Últimas 12 horas <ChevronDown className="size-3.5" /></button></div><div className="mt-6 flex h-48 items-end gap-2 rounded-xl bg-[#f7fbfb] px-4 pb-4 pt-6 sm:gap-4">{[42,50,45,58,53,66,61,72,68,75,70,78,74,82,77,80,76,84,79,86,81,88].map((height, i) => <div key={i} className="group flex h-full flex-1 flex-col justify-end"><div className="relative rounded-t-md bg-[#9ddbd7] transition group-hover:bg-[#087f7b]" style={{ height: `${height}%` }} /></div>)}</div><div className="mt-3 flex justify-between text-[10px] text-[#9aabb2]"><span>08:00</span><span>12:00</span><span>16:00</span><span>20:00</span></div></section></div>
}

function Access() {
  return <div className="flex flex-col gap-6"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-sm font-medium text-[#0d9691]">Trazabilidad y seguridad</p><h1 className="mt-1 text-3xl font-semibold tracking-tight text-[#102d3b]">Control de acceso</h1><p className="mt-1 text-sm text-[#718995]">Registro de entradas y salidas del área controlada.</p></div><button className="flex w-fit items-center gap-2 rounded-xl border border-[#d9e6e8] bg-white px-4 py-2.5 text-sm font-semibold text-[#36515b]"><Search className="size-4" /> Filtrar registros</button></div><div className="grid gap-4 sm:grid-cols-3"><div className="rounded-2xl border border-[#e5edf0] bg-white p-5"><p className="text-xs font-medium text-[#82969d]">Accesos de hoy</p><p className="mt-2 text-3xl font-semibold text-[#163542]">128</p><p className="mt-1 text-xs text-emerald-600">+12% vs. ayer</p></div><div className="rounded-2xl border border-[#e5edf0] bg-white p-5"><p className="text-xs font-medium text-[#82969d]">Permitidos</p><p className="mt-2 text-3xl font-semibold text-[#163542]">124</p><p className="mt-1 text-xs text-[#82969d]">96.8% del total</p></div><div className="rounded-2xl border border-[#e5edf0] bg-white p-5"><p className="text-xs font-medium text-[#82969d]">Denegados</p><p className="mt-2 text-3xl font-semibold text-[#163542]">04</p><p className="mt-1 text-xs text-amber-600">Requiere revisión</p></div></div><section className="overflow-hidden rounded-2xl border border-[#e5edf0] bg-white shadow-[0_8px_24px_rgba(18,49,66,0.04)]"><div className="flex items-center justify-between border-b border-[#edf2f3] px-5 py-4"><div><h2 className="font-semibold text-[#163542]">Registro de actividad</h2><p className="mt-0.5 text-xs text-[#8a9da5]">06 de octubre de 2026</p></div><button className="rounded-lg p-2 text-[#82969d] hover:bg-[#f3f8f8]"><MoreHorizontal className="size-5" /></button></div><div className="divide-y divide-[#edf2f3]">{accessRows.map((row) => <AccessRow key={row.time} row={row} />)}</div></section></div>
}

function SimplePage({ type }: { type: 'people' | 'alerts' }) {
  const people = type === 'people'
  return <div className="flex flex-col gap-6"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-sm font-medium text-[#0d9691]">{people ? 'Gestión de usuarios' : 'Centro de atención'}</p><h1 className="mt-1 text-3xl font-semibold tracking-tight text-[#102d3b]">{people ? 'Personas autorizadas' : 'Avisos'}</h1><p className="mt-1 text-sm text-[#718995]">{people ? 'Administra permisos y accesos del personal.' : 'Condiciones que requieren seguimiento operativo.'}</p></div><button className="flex w-fit items-center gap-2 rounded-xl bg-[#087f7b] px-4 py-2.5 text-sm font-semibold text-white">{people ? <><Users className="size-4" /> Agregar persona</> : <><Check className="size-4" /> Marcar todo revisado</>}</button></div><section className="rounded-2xl border border-[#e5edf0] bg-white shadow-[0_8px_24px_rgba(18,49,66,0.04)]"><div className="flex items-center justify-between border-b border-[#edf2f3] px-5 py-4"><h2 className="font-semibold text-[#163542]">{people ? 'Directorio activo' : 'Avisos activos'}</h2><button className="text-[#82969d]"><Search className="size-4" /></button></div>{people ? <div className="divide-y divide-[#edf2f3]">{[{name:'Mateo Cruz',role:'Administrador',status:'Activo',initials:'MC'},{name:'Valeria Ruiz',role:'Supervisora',status:'Activo',initials:'VR'},{name:'Ana Sofía López',role:'Técnica',status:'Activo',initials:'AL'},{name:'Carlos Méndez',role:'Técnico',status:'Desactivado',initials:'CM'}].map(p => <div key={p.name} className="flex items-center gap-3 px-5 py-4"><div className="flex size-10 items-center justify-center rounded-full bg-[#e9f4f3] text-xs font-bold text-[#087f7b]">{p.initials}</div><div className="flex-1"><p className="text-sm font-semibold text-[#29434e]">{p.name}</p><p className="text-xs text-[#93a4aa]">{p.role}</p></div><span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${p.status === 'Activo' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{p.status}</span><button className="p-2 text-[#82969d]"><MoreHorizontal className="size-4" /></button></div>)}</div> : <div className="flex flex-col gap-3 p-5"><div className="rounded-xl border border-amber-100 bg-amber-50/70 p-4"><div className="flex gap-3"><AlertTriangle className="mt-0.5 size-5 text-amber-600" /><div><p className="text-sm font-semibold text-amber-900">Partículas cerca del límite permitido</p><p className="mt-1 text-xs text-amber-800/80">El sensor S-04 reportó 182 p/m³ hace 4 minutos. Verifica la ventilación del área.</p><button className="mt-3 text-xs font-bold text-amber-700">Revisar evento →</button></div></div></div><div className="rounded-xl border border-blue-100 bg-blue-50/70 p-4"><div className="flex gap-3"><Activity className="mt-0.5 size-5 text-blue-600" /><div><p className="text-sm font-semibold text-blue-900">Mantenimiento programado</p><p className="mt-1 text-xs text-blue-800/80">El sensor S-02 requiere revisión mañana a las 09:00.</p><button className="mt-3 text-xs font-bold text-blue-700">Ver programación →</button></div></div></div></div>}</section></div>
}

export function AccessPage({ onBack }: { onBack?: () => void }) {
  const router = useRouter()
  const [mode, setMode] = useState<'credentials' | 'rfid'>('rfid')
  const [role, setRole] = useState<'Administrador' | 'Supervisor' | 'Personal autorizado'>('Administrador')
  const [isReading, setIsReading] = useState(false)
  const [message, setMessage] = useState('')

  const handleRfid = () => {
    setIsReading(true)
    setMessage('')
    window.setTimeout(() => {
      setIsReading(false)
      setRole('Personal autorizado')
      setMessage('Tarjeta reconocida. Perfil de acceso listo.')
    }, 900)
  }

  const handleCredentials = () => {
    setRole('Personal autorizado')
    setMessage('Credenciales verificadas. Perfil de acceso listo.')
  }

  return <div className="min-h-screen bg-[#f4faf9] text-[#102d3b] lg:grid lg:grid-cols-[0.9fr_1.1fr]">
    <section className="relative hidden overflow-hidden bg-[#102c3a] p-10 lg:flex lg:flex-col lg:justify-between xl:p-14">
      <div className="pointer-events-none absolute -right-32 top-20 size-[420px] rounded-full bg-[#087f7b]/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -left-32 size-[420px] rounded-full bg-[#4e9eb1]/20 blur-3xl" />
      <div className="relative"><Logo light /><div className="mt-28 max-w-md"><p className="text-xs font-bold uppercase tracking-[0.24em] text-[#83d5cc]">Acceso seguro</p><h1 className="mt-5 font-serif text-5xl leading-[1.05] tracking-[-0.04em] text-white xl:text-6xl">Cada acceso bajo control.</h1><p className="mt-6 text-base leading-relaxed text-slate-300">Una entrada unificada para quienes administran, supervisan y operan tus cuartos limpios.</p></div></div>
      <div className="relative flex items-center gap-3 text-xs text-slate-400"><span className="size-2 rounded-full bg-emerald-400" /> CleanSpace protege la operación crítica <span className="text-slate-600">·</span> v1.0</div>
    </section>
    <section className="flex min-h-screen flex-col px-5 py-6 sm:px-10 lg:px-16 xl:px-24"><div className="flex items-center justify-between"><button onClick={() => onBack ? onBack() : router.push('/')} className="flex items-center gap-2 text-sm font-semibold text-[#58717b] transition hover:text-[#087f7b]"><ArrowRight className="size-4 rotate-180" /> Volver al inicio</button><div className="lg:hidden"><Logo /></div><span className="hidden text-xs font-medium text-[#91a5ab] sm:block">¿Necesitas ayuda? Contacta a soporte</span></div><div className="mx-auto flex w-full max-w-[480px] flex-1 flex-col justify-center py-10"><div className="mb-8"><p className="text-sm font-semibold text-[#0d9691]">Bienvenido a CleanSpace</p><h2 className="mt-2 text-3xl font-semibold tracking-tight text-[#102d3b]">Ingresa a tu espacio</h2><p className="mt-2 text-sm leading-relaxed text-[#718995]">Elige cómo quieres identificarte para continuar.</p></div><div className="grid grid-cols-2 gap-2 rounded-2xl bg-[#e7f1f0] p-1.5"><button onClick={() => { setMode('rfid'); setMessage('') }} className={`rounded-xl px-3 py-3 text-sm font-semibold transition ${mode === 'rfid' ? 'bg-white text-[#087f7b] shadow-sm' : 'text-[#6b848d]'}`}>Tarjeta RFID</button><button onClick={() => { setMode('credentials'); setMessage('') }} className={`rounded-xl px-3 py-3 text-sm font-semibold transition ${mode === 'credentials' ? 'bg-white text-[#087f7b] shadow-sm' : 'text-[#6b848d]'}`}>Usuario y contraseña</button></div>{mode === 'credentials' ? <div className="mt-7 flex flex-col gap-5"><label className="flex flex-col gap-2 text-sm font-semibold text-[#36515b]">Correo institucional<input className="rounded-xl border border-[#d8e6e6] bg-white px-4 py-3.5 font-normal outline-none transition placeholder:text-[#aab9bd] focus:border-[#087f7b] focus:ring-4 focus:ring-[#087f7b]/10" placeholder="nombre@organizacion.com" type="email" /></label><label className="flex flex-col gap-2 text-sm font-semibold text-[#36515b]">Contraseña<input className="rounded-xl border border-[#d8e6e6] bg-white px-4 py-3.5 font-normal outline-none transition placeholder:text-[#aab9bd] focus:border-[#087f7b] focus:ring-4 focus:ring-[#087f7b]/10" placeholder="••••••••" type="password" /></label><div className="flex items-center justify-between text-xs"><label className="flex items-center gap-2 text-[#718995]"><input type="checkbox" className="size-4 accent-[#087f7b]" /> Mantener sesión iniciada</label><button className="font-semibold text-[#087f7b]">¿Olvidaste tu contraseña?</button></div><button onClick={handleCredentials} className="mt-2 rounded-xl bg-[#087f7b] px-4 py-3.5 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(8,127,123,0.2)] transition hover:bg-[#066c69]">Continuar al sistema</button></div> : <div className="mt-7"><div className={`relative flex min-h-[218px] flex-col items-center justify-center overflow-hidden rounded-2xl border ${isReading ? 'border-[#71c9c0] bg-[#e9f9f6]' : 'border-[#bfe5e0] bg-[#effaf8]'} p-6 text-center transition`}><div className={`flex size-16 items-center justify-center rounded-2xl ${isReading ? 'bg-[#087f7b] text-white' : 'bg-white text-[#087f7b] shadow-sm'}`}><CreditCard className="size-8" /></div><p className="mt-5 font-semibold text-[#174451]">{isReading ? 'Leyendo tarjeta…' : 'Acerca tu tarjeta al lector'}</p><p className="mt-1 text-xs text-[#6a878e]">{isReading ? 'Validando identidad y permisos' : 'Usaremos el RFID para identificar tu perfil automáticamente'}</p>{isReading && <div className="absolute inset-x-12 bottom-0 h-1 overflow-hidden rounded-full bg-[#c8ebe6]"><div className="h-full w-1/2 animate-pulse rounded-full bg-[#087f7b]" /></div>}</div><button onClick={handleRfid} disabled={isReading} className="mt-4 w-full rounded-xl bg-[#087f7b] px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-[#066c69] disabled:cursor-wait disabled:opacity-70">{isReading ? 'Detectando…' : 'Simular lectura RFID'}</button></div>}{message && <div className="mt-5 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">{message}</div>}<div className="mt-8 border-t border-[#dfeaea] pt-6"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#91a5ab]">Nivel de acceso</p><div className="mt-3 grid grid-cols-3 gap-2">{(['Administrador', 'Supervisor', 'Personal autorizado'] as const).map((item) => <button key={item} onClick={() => setRole(item)} className={`rounded-xl border px-2 py-3 text-center text-[11px] font-semibold transition ${role === item ? 'border-[#8bd1ca] bg-[#e7f7f4] text-[#087f7b]' : 'border-[#dce8e8] bg-white text-[#718995]'}`}>{item}</button>)}</div><p className="mt-3 text-xs leading-relaxed text-[#8aa0a7]">{role === 'Personal autorizado' ? 'El RFID valida tu permiso y registra cada intento de entrada o salida.' : role === 'Supervisor' ? 'Consulta lecturas, avisos y registros de los cuartos asignados.' : 'Administra cuartos, personas, permisos y parámetros del sistema.'}</p></div></div><p className="pb-2 text-center text-xs text-[#9aabb2]">Acceso protegido por CleanSpace · Tus datos se manejan de forma segura</p></section>
  </div>
}

export default function CleanSpaceApp() {
  const [section, setSection] = useState('dashboard')
  const [mobileOpen, setMobileOpen] = useState(false)
  const activeLabel = navItems.find((item) => item.id === section)?.label ?? 'Resumen'
  const render = section === 'dashboard' ? <Dashboard onNavigate={setSection} /> : section === 'monitoring' ? <Monitoring /> : section === 'access' ? <Access /> : <SimplePage type={section as 'people' | 'alerts'} />
  return <div className="min-h-screen bg-[#f6f9f9] text-[#163542]"><aside className={`fixed inset-y-0 left-0 z-30 flex w-[252px] flex-col bg-[#102c3a] px-4 py-5 transition-transform lg:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}><div className="px-3"><Logo light /></div><div className="mt-10 flex flex-1 flex-col"><p className="px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Operación</p><nav className="mt-3 flex flex-col gap-1">{navItems.map((item) => { const Icon = item.icon; return <button key={item.id} onClick={() => { setSection(item.id); setMobileOpen(false) }} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium transition ${section === item.id ? 'bg-[#1c4b56] text-white shadow-inner' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}><Icon className="size-[18px]" /><span className="flex-1">{item.label}</span>{item.count && <span className="flex size-5 items-center justify-center rounded-full bg-amber-400 text-[10px] font-bold text-[#21343c]">{item.count}</span>}</button> })}</nav><p className="mt-9 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Sistema</p><nav className="mt-3 flex flex-col gap-1"><button className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-slate-400 hover:bg-white/5 hover:text-white"><Settings2 className="size-[18px]" /> Configuración</button><button className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-slate-400 hover:bg-white/5 hover:text-white"><CircleHelp className="size-[18px]" /> Ayuda</button></nav></div><div className="rounded-2xl border border-white/10 bg-white/5 p-3"><div className="flex items-center gap-3"><div className="flex size-9 items-center justify-center rounded-full bg-[#d8efed] text-xs font-bold text-[#087f7b]">MC</div><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-white">Mateo Cruz</p><p className="text-[10px] text-slate-400">Administrador</p></div><ChevronDown className="size-4 text-slate-500" /></div></div></aside>{mobileOpen && <button aria-label="Cerrar menú" onClick={() => setMobileOpen(false)} className="fixed inset-0 z-20 bg-[#102c3a]/40 lg:hidden" />}
  <div className="lg:pl-[252px]"><header className="sticky top-0 z-10 flex h-[72px] items-center justify-between border-b border-[#e5edf0] bg-white/90 px-5 backdrop-blur-md sm:px-8"><div className="flex items-center gap-3"><button aria-label="Abrir menú" onClick={() => setMobileOpen(true)} className="rounded-lg p-2 text-[#526f7b] hover:bg-[#f2f7f7] lg:hidden"><Menu className="size-5" /></button><div className="lg:hidden"><Logo /></div><div className="hidden items-center gap-2 text-sm text-[#78909a] lg:flex"><span>CleanSpace</span><span className="text-[#c2d0d4]">/</span><span className="font-medium text-[#29434e]">{activeLabel}</span></div></div><div className="flex items-center gap-4"><div className="hidden items-center gap-2 text-xs text-emerald-700 sm:flex"><span className="size-2 rounded-full bg-emerald-500" /> Sistema conectado</div><button aria-label="Notificaciones" className="relative rounded-lg p-2 text-[#607b85] hover:bg-[#f2f7f7]"><Bell className="size-5" /><span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-amber-500" /></button><div className="hidden h-6 w-px bg-[#e5edf0] sm:block" /><div className="flex size-8 items-center justify-center rounded-full bg-[#d8efed] text-[10px] font-bold text-[#087f7b]">MC</div></div></header><main className="mx-auto max-w-[1440px] p-5 sm:p-8">{render}</main></div></div>
}

export function LandingPage() {
  return <div className="min-h-screen bg-[#f8fbfb] text-[#102d3b]"><ThemeToggle floating /><header className="absolute left-0 right-0 top-0 z-10 mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-10"><Logo /><nav className="hidden items-center gap-8 text-sm font-medium text-[#6c858e] md:flex"><a href="#plataforma" className="hover:text-[#087f7b]">Plataforma</a><a href="#como-funciona" className="hover:text-[#087f7b]">Cómo funciona</a><a href="#seguridad" className="hover:text-[#087f7b]">Seguridad</a></nav><Link href="/login" className="flex items-center gap-2 rounded-xl border border-[#c9ddde] bg-white/70 px-4 py-2.5 text-sm font-semibold text-[#087f7b] shadow-sm backdrop-blur-sm">Ingresar <LogIn className="size-4" /></Link></header><main><section className="relative overflow-hidden px-6 pb-24 pt-40 lg:px-10 lg:pb-36 lg:pt-48"><div className="pointer-events-none absolute -right-20 top-20 size-[500px] rounded-full bg-[#dff7f3] opacity-70 blur-3xl" /><div className="pointer-events-none absolute -left-40 bottom-0 size-[360px] rounded-full bg-[#e8f0fa] opacity-70 blur-3xl" /><div className="relative mx-auto grid max-w-7xl items-center gap-16 lg:grid-cols-[1.05fr_0.95fr]"><div><div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[#cbe9e5] bg-white px-3 py-1.5 text-xs font-semibold text-[#087f7b]"><span className="size-1.5 rounded-full bg-emerald-500" /> Plataforma de operación para cuartos limpios</div><h1 className="max-w-2xl text-5xl font-semibold leading-[1.06] tracking-[-0.04em] text-[#102d3b] sm:text-6xl lg:text-[72px]">La calma detrás de cada <span className="text-[#087f7b]">espacio crítico.</span></h1><p className="mt-7 max-w-xl text-lg leading-relaxed text-[#6e858e]">CleanSpace conecta el control de acceso y el monitoreo ambiental para que tu equipo opere con confianza, precisión y trazabilidad.</p><div className="mt-9 flex flex-wrap items-center gap-3"><Link href="/login" className="flex items-center gap-2 rounded-xl bg-[#087f7b] px-5 py-3.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(8,127,123,0.22)] transition hover:bg-[#066c69]">Explorar plataforma <ArrowRight className="size-4" /></Link><a href="#plataforma" className="rounded-xl px-5 py-3.5 text-sm font-semibold text-[#50707a] hover:bg-white">Conocer más</a></div><div className="mt-12 flex flex-wrap items-center gap-x-8 gap-y-3 text-xs font-medium text-[#8aa0a7]"><span className="flex items-center gap-2"><LockKeyhole className="size-4 text-[#087f7b]" /> Trazabilidad completa</span><span className="flex items-center gap-2"><Activity className="size-4 text-[#087f7b]" /> Lecturas en tiempo real</span></div></div><div className="relative"><div className="absolute -inset-5 rounded-[36px] bg-white/70 shadow-[0_24px_80px_rgba(18,49,66,0.1)] backdrop-blur-sm" /><div className="relative rounded-3xl border border-white bg-[#102c3a] p-4 shadow-[0_24px_80px_rgba(18,49,66,0.18)] sm:p-5"><div className="flex items-center justify-between border-b border-white/10 pb-4"><div className="flex items-center gap-2"><div className="flex size-7 items-center justify-center rounded-lg bg-[#d8efed] text-[#087f7b]"><img src="/custodia-logo.png" alt="Símbolo de CleanSpace" className="size-full rounded-lg object-cover" /></div><span className="text-xs font-semibold text-white">CleanSpace</span></div><span className="flex items-center gap-1.5 text-[10px] text-emerald-300"><span className="size-1.5 rounded-full bg-emerald-400" /> En vivo</span></div><div className="grid grid-cols-2 gap-3 py-4"><div className="col-span-2 rounded-2xl bg-[#1a4350] p-4"><div className="flex items-center justify-between"><div><p className="text-[10px] text-slate-400">Estado del cuarto limpio</p><p className="mt-1 text-lg font-semibold text-white">Operando normalmente</p></div><div className="flex size-10 items-center justify-center rounded-full bg-emerald-400/15 text-emerald-300"><Check className="size-5" /></div></div><div className="mt-4 h-1.5 rounded-full bg-white/10"><div className="h-full w-[92%] rounded-full bg-emerald-400" /></div><p className="mt-2 text-[10px] text-slate-400">92% de parámetros en rango</p></div>{sensors.slice(0, 2).map((s) => <div key={s.label} className="rounded-2xl bg-white/5 p-4"><p className="text-[10px] text-slate-400">{s.label}</p><p className="mt-2 text-xl font-semibold text-white">{s.value}<span className="ml-1 text-xs font-normal text-slate-400">{s.unit}</span></p><p className="mt-2 text-[10px] text-emerald-300">● En rango</p></div>)}</div><div className="flex items-center justify-between border-t border-white/10 pt-4"><div className="flex -space-x-2">{['VR','MC','AL'].map((x) => <div key={x} className="flex size-6 items-center justify-center rounded-full border-2 border-[#102c3a] bg-[#b9e1dd] text-[8px] font-bold text-[#087f7b]">{x}</div>)}</div><span className="text-[10px] text-slate-400">3 personas dentro</span></div></div></div></div></section><section id="plataforma" className="border-y border-[#e6eff0] bg-white px-6 py-20 lg:px-10"><div className="mx-auto max-w-7xl"><div className="max-w-xl"><p className="text-sm font-semibold text-[#087f7b]">Una sola vista, todo bajo control</p><h2 className="mt-3 text-3xl font-semibold tracking-tight text-[#163542] sm:text-4xl">La operación crítica, hecha simple.</h2></div><div className="mt-12 grid gap-5 md:grid-cols-3"><div className="rounded-2xl bg-[#f2f9f8] p-6"><div className="flex size-11 items-center justify-center rounded-xl bg-[#d8efed] text-[#087f7b]"><LockKeyhole className="size-5" /></div><h3 className="mt-6 font-semibold text-[#163542]">Acceso con trazabilidad</h3><p className="mt-2 text-sm leading-relaxed text-[#718995]">Administra personas autorizadas y conserva cada intento de entrada en un registro claro y consultable.</p></div><div className="rounded-2xl bg-[#f3f7fc] p-6"><div className="flex size-11 items-center justify-center rounded-xl bg-[#e1ebfa] text-[#3e72ad]"><Wind className="size-5" /></div><h3 className="mt-6 font-semibold text-[#163542]">Monitoreo ambiental</h3><p className="mt-2 text-sm leading-relaxed text-[#718995]">Visualiza temperatura, humedad, presión y partículas con lecturas actualizadas desde tus sensores.</p></div><div className="rounded-2xl bg-[#fff8ec] p-6"><div className="flex size-11 items-center justify-center rounded-xl bg-[#ffedc8] text-[#b27816]"><Bell className="size-5" /></div><h3 className="mt-6 font-semibold text-[#163542]">Avisos accionables</h3><p className="mt-2 text-sm leading-relaxed text-[#718995]">Recibe señales claras cuando una condición se sale de los parámetros establecidos.</p></div></div></div></section><section id="seguridad" className="bg-[#102c3a] px-6 py-20 text-white lg:px-10"><div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-8 md:flex-row md:items-center"><div><div className="flex items-center gap-3"><Leaf className="size-5 text-cyan-300" /><p className="text-sm font-semibold text-cyan-300">Diseñado para operar con confianza</p></div><h2 className="mt-4 max-w-xl text-3xl font-semibold tracking-tight sm:text-4xl">Tu equipo ve lo importante. CleanSpace cuida el resto.</h2></div><Link href="/login" className="flex items-center gap-2 rounded-xl bg-white px-5 py-3.5 text-sm font-semibold text-[#102c3a]">Entrar al demo <ArrowRight className="size-4" /></Link></div></section></main><footer className="bg-[#102c3a] px-6 pb-8 text-slate-500 lg:px-10"><div className="mx-auto flex max-w-7xl flex-col justify-between gap-3 border-t border-white/10 pt-6 text-xs sm:flex-row"><span>© 2026 CleanSpace · Prototipo académico</span><span>Control de acceso y monitoreo ambiental</span></div></footer></div>
}

export { X, DoorOpen, UserRound }
