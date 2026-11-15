'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { LiveApiList, PendingIntegration, liveLoaders } from '@/components/live-api-list'
import { RoomManagement } from '@/components/room-management'
import { AccessPermissionManagement } from '@/components/access-management'
import { AlertsManagement } from '@/components/alerts-management'
import { DeviceManagement } from '@/components/device-management'
import { PeopleManagement } from '@/components/people-management'
import { SupervisorDashboard } from '@/components/supervisor-dashboard'
import { AccessZoneMonitor } from '@/components/access-zone-monitor'
import { EcbdAnalytics } from '@/components/ecbd-analytics'
import { AgentDrawer } from '@/components/agent-drawer'
import { api, clearSession, getCurrentUserFromToken } from '@/lib/api'
import { LiveDeviceForm, LivePersonForm } from '@/components/live-admin-forms'
import {
  Activity,
  Bell,
  Bot,
  Building2,
  ClipboardList,
  DoorOpen,
  Gauge,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  TabletSmartphone,
  Users,
  X,
} from 'lucide-react'

const adminItems = [
  { href: '/admin/dashboard', label: 'Resumen', icon: LayoutDashboard },
  { href: '/admin/cuartos', label: 'Cuartos limpios', icon: Building2 },
  { href: '/admin/dispositivos', label: 'Dispositivos', icon: TabletSmartphone },
  { href: '/admin/personas', label: 'Personas autorizadas', icon: Users },
  { href: '/admin/permisos', label: 'Permisos', icon: ShieldCheck },
  { href: '/admin/monitoreo/parametros', label: 'Parámetros', icon: SlidersHorizontal },
]
const supervisorItems = [
  { href: '/supervisor/dashboard', label: 'Resumen', icon: LayoutDashboard },
  { href: '/supervisor/accesos', label: 'Accesos', icon: DoorOpen },
  { href: '/supervisor/monitoreo', label: 'Monitoreo', icon: Activity },
  { href: '/supervisor/monitoreo/historico', label: 'Histórico', icon: ClipboardList },
  { href: '/supervisor/avisos', label: 'Avisos', icon: Bell },
  { href: '/supervisor/analisis', label: 'Análisis', icon: Gauge },
]

const THEME_STORAGE_KEY = 'cleanspace_theme'

type UserSummary = { name: string; role: string; initials: string }

function normalizeRole(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (Array.isArray(value)) {
    const resolved = value.map((entry) => normalizeRole(entry)).find(Boolean)
    return resolved ?? null
  }
  if (value && typeof value === 'object') {
    const nested = value as Record<string, unknown>
    return normalizeRole(nested.name ?? nested.label ?? nested.title ?? nested.role ?? nested.value) ?? null
  }
  return null
}

function readUserName(rawUser: Record<string, unknown> | null | undefined) {
  const candidate = rawUser && typeof rawUser === 'object' ? rawUser : null
  const nestedUser =
    candidate && 'user' in candidate && candidate.user && typeof candidate.user === 'object'
      ? (candidate.user as Record<string, unknown>)
      : null
  const nestedData =
    candidate && 'data' in candidate && candidate.data && typeof candidate.data === 'object'
      ? (candidate.data as Record<string, unknown>)
      : null
  const userRecord = nestedUser ?? nestedData ?? candidate

  const directName =
    typeof userRecord?.name === 'string'
      ? userRecord.name
      : typeof userRecord?.full_name === 'string'
        ? userRecord.full_name
        : typeof userRecord?.fullName === 'string'
          ? userRecord.fullName
          : typeof userRecord?.nombre === 'string'
            ? userRecord.nombre
            : null

  if (directName && directName.trim()) return directName.trim()

  const firstName = typeof userRecord?.first_name === 'string' ? userRecord.first_name : null
  const lastName = typeof userRecord?.last_name === 'string' ? userRecord.last_name : null
  if (firstName || lastName) return [firstName, lastName].filter(Boolean).join(' ').trim()

  const email = typeof userRecord?.email === 'string' ? userRecord.email : null
  if (email) {
    const localPart = email.split('@')[0]?.replace(/[._-]+/g, ' ').trim()
    if (localPart) return localPart
  }

  return 'Usuario'
}

function buildUserSummary(rawUser: Record<string, unknown> | null | undefined, fallbackRole: 'admin' | 'supervisor'): UserSummary {
  const name = readUserName(rawUser)
  const normalizedRole = normalizeRole(rawUser?.role) ?? (fallbackRole === 'admin' ? 'Administrador' : 'Supervisor')
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .map((segment) => segment[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'U'

  return { name, role: normalizedRole, initials }
}

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-3">
      <div className="flex size-10 items-center justify-center overflow-hidden rounded-xl bg-[#dff8f5]">
        <img src="/custodia-logo.png" alt="CleanSpace" className="size-full object-cover" />
      </div>
      <div>
        <div className="font-serif text-[19px] font-semibold tracking-[-0.03em] text-white">CleanSpace</div>
        <div className="text-[9px] font-semibold uppercase tracking-[0.24em] text-slate-400">operación crítica</div>
      </div>
    </Link>
  )
}

function Content({ path }: { path: string }) {
  const normalizedPath = path.replace('/supervisor', '').replace('/admin', '')
  if (path === '/admin/dashboard') {
    return (
      <LiveApiList
        title="Resumen operativo"
        eyebrow="Administración"
        description="Resumen oficial entregado por el endpoint del dashboard administrativo."
        loader={liveLoaders.adminSummary}
      />
    )
  }
  if (path === '/supervisor/dashboard') return <SupervisorDashboard />
  if (normalizedPath === '/dashboard') {
    return (
      <PendingIntegration
        title="Ruta no disponible"
        description="Usa /admin/dashboard o /supervisor/dashboard."
      />
    )
  }
  if (path.startsWith('/admin/cuartos')) return <RoomManagement />
  if (path === '/admin/dispositivos/nuevo') return <LiveDeviceForm />
  if (path === '/admin/dispositivos') return <DeviceManagement />
  if (path === '/admin/personas/nueva') return <LivePersonForm />
  if (path.startsWith('/admin/personas/') && path.endsWith('/permisos')) {
    return <AccessPermissionManagement personId={Number(path.split('/')[3])} />
  }
  if (path === '/admin/permisos') return <AccessPermissionManagement />
  if (path === '/admin/personas') return <PeopleManagement />
  if (path === '/monitoreo/parametros' || path === '/admin/monitoreo/parametros') return <RoomManagement />
  if (path === '/accesos' || path === '/supervisor/accesos') return <AccessZoneMonitor />
  if (path === '/monitoreo' || path === '/supervisor/monitoreo') {
    return (
      <LiveApiList
        title="Monitoreo ambiental"
        eyebrow="Supervisión"
        description="Lecturas e histórico disponibles en FastAPI."
        loader={liveLoaders.monitoring}
      />
    )
  }
  if (path === '/monitoreo/historico' || path === '/supervisor/monitoreo/historico') {
    return (
      <LiveApiList
        title="Histórico"
        eyebrow="Supervisión"
        description="Tendencias ambientales consultadas desde FastAPI."
        loader={liveLoaders.monitoring}
      />
    )
  }
  if (path === '/avisos' || path === '/supervisor/avisos') return <AlertsManagement />
  if (path === '/analisis' || path === '/supervisor/analisis') return <EcbdAnalytics />
  return <EcbdAnalytics />
}

export default function CleanSpacePortal({ role = 'admin' }: { role?: 'admin' | 'supervisor' }) {
  const pathname = usePathname()
  const router = useRouter()
  const [userRoles, setUserRoles] = useState<string[]>([])
  const hasAdminRole = userRoles.includes('ADMINISTRADOR')
  const items = role === 'admin' ? adminItems : supervisorItems
  const [user, setUser] = useState<UserSummary>(() => buildUserSummary(null, role))
  const [isDark, setIsDark] = useState(false)
  const [agentOpen, setAgentOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(THEME_STORAGE_KEY)
      const darkPreferred = saved === 'dark'
      setIsDark(darkPreferred)
      document.documentElement.classList.toggle('dark', darkPreferred)
    } catch {
      setIsDark(false)
    }
  }, [])

  const toggleTheme = () => {
    setIsDark((prev) => {
      const next = !prev
      document.documentElement.classList.toggle('dark', next)
      try {
        window.localStorage.setItem(THEME_STORAGE_KEY, next ? 'dark' : 'light')
      } catch {
        // ignore storage errors
      }
      return next
    })
  }

  useEffect(() => {
    let active = true

    const applyResolvedUser = (rawUser: Record<string, unknown> | null | undefined) => {
      const rolesRaw = rawUser?.roles
      const resolvedRoles = Array.isArray(rolesRaw) ? rolesRaw.map((item) => String(item).toUpperCase()) : []
      if (resolvedRoles.length > 0) {
        setUserRoles(resolvedRoles)
        if (role === 'admin' && !resolvedRoles.includes('ADMINISTRADOR') && resolvedRoles.includes('SUPERVISOR')) {
          router.replace('/supervisor/dashboard')
        }
      }
      setUser(buildUserSummary(rawUser, role))
    }

    const loadUser = async () => {
      try {
        const response = await api.me()
        if (!active) return
        applyResolvedUser(response as Record<string, unknown>)
      } catch {
        const fallback = getCurrentUserFromToken()
        if (!active) return
        applyResolvedUser(fallback)
      }
    }

    void loadUser()
    return () => {
      active = false
    }
  }, [role, router])

  useEffect(() => {
    setMobileMenuOpen(false)
  }, [pathname])

  const handleLogout = async () => {
    try {
      await api.logout()
    } catch {
      // limpiamos sesión local aunque la API falle
    }
    clearSession()
    router.push('/login')
  }

  return (
    <div className="min-h-screen bg-[#f6f9f9] text-[#163542] transition-colors dark:bg-[#0b141a] dark:text-[#e6f0f2]">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-[252px] flex-col overflow-y-auto bg-[#102c3a] px-4 py-5 dark:bg-[#09151c] lg:flex">
        <div className="px-3">
          <Logo />
        </div>
        <p className="mt-8 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
          {role === 'admin' ? 'Administración' : 'Supervisión'}
        </p>
        <nav className="mt-3 flex flex-col gap-1">
          {items.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                pathname === href
                  ? 'bg-[#1c4b56] text-white'
                  : 'text-slate-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <Icon className="size-[18px]" />
              <span className="flex-1">{label}</span>
            </Link>
          ))}
        </nav>
        {hasAdminRole && (
          <>
            <p className="mt-6 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
              {role === 'admin' ? 'Supervisión y Agente' : 'Administración'}
            </p>
            <nav className="mt-2 flex flex-col gap-1">
              {(role === 'admin' ? supervisorItems : adminItems).map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2 text-xs font-medium transition ${
                    pathname === href
                      ? 'bg-[#1c4b56] text-white'
                      : 'text-slate-400 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <Icon className="size-4" />
                  <span className="flex-1">{label}</span>
                </Link>
              ))}
            </nav>
          </>
        )}
        <div className="mt-auto pt-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-full bg-[#d8efed] text-xs font-bold text-[#087f7b]">
                {user.initials}
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-white">{user.name}</p>
                <p className="truncate text-[10px] text-slate-400">{user.role}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="mt-4 flex items-center gap-2 text-xs text-slate-400 hover:text-white"
            >
              <LogOut className="size-3.5" /> Cerrar sesión
            </button>
          </div>
        </div>
      </aside>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <button
            type="button"
            aria-label="Cerrar menú"
            onClick={() => setMobileMenuOpen(false)}
            className="fixed inset-0 bg-[#102c3a]/50"
          />
          <aside className="relative z-10 flex w-64 flex-col bg-[#102c3a] px-4 py-5 dark:bg-[#09151c]">
            <div className="flex items-center justify-between px-2">
              <Logo />
              <button
                type="button"
                aria-label="Cerrar navegación"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:text-white"
              >
                <X className="size-4" />
              </button>
            </div>
            <nav className="mt-6 flex flex-col gap-1">
              {items.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                    pathname === href
                      ? 'bg-[#1c4b56] text-white'
                      : 'text-slate-400 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <Icon className="size-[18px]" />
                  <span>{label}</span>
                </Link>
              ))}
            </nav>
            <button
              type="button"
              onClick={handleLogout}
              className="mt-auto flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs text-slate-400 hover:text-white"
            >
              <LogOut className="size-3.5" /> Cerrar sesión
            </button>
          </aside>
        </div>
      )}

      <div className="lg:pl-[252px]">
        <header className="sticky top-0 z-10 flex h-[72px] items-center justify-between border-b border-[#e5edf0] bg-white/95 px-5 shadow-[0_4px_18px_rgba(18,49,66,0.04)] backdrop-blur sm:px-8 dark:border-[#1e3340] dark:bg-[#101e26]/95">
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Abrir menú"
              onClick={() => setMobileMenuOpen(true)}
              className="rounded-xl border border-[#dce8eb] p-2 text-[#29434e] lg:hidden dark:border-[#233a47] dark:text-[#e6f0f2]"
            >
              <Menu className="size-4" />
            </button>
            <div>
              <p className="text-xs text-[#78909a] dark:text-[#94adb8]">
                CleanSpace / {role === 'admin' ? 'Administrador' : 'Supervisor'}
              </p>
              <h2 className="text-sm font-semibold text-[#29434e] dark:text-[#e6f0f2]">
                {items.find((item) => item.href === pathname)?.label ?? 'Resumen'}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2.5 sm:gap-3">
            <span className="hidden items-center gap-2 text-xs text-emerald-700 sm:flex dark:text-emerald-300">
              <span className="size-2 rounded-full bg-emerald-500" /> Sistema conectado
            </span>

            <button
              type="button"
              onClick={toggleTheme}
              aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
              title={isDark ? 'Modo claro' : 'Modo oscuro'}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#dce8eb] bg-[#f7fbfa] px-3 py-2 text-xs font-semibold text-[#29434e] transition hover:bg-[#eff8f7] dark:border-[#233a47] dark:bg-[#13222b] dark:text-[#e6f0f2] dark:hover:bg-[#182b36]"
            >
              {isDark ? <Sun className="size-3.5 text-amber-400" /> : <Moon className="size-3.5 text-[#087f7b]" />}
              <span className="hidden sm:inline">{isDark ? 'Modo Claro' : 'Modo Oscuro'}</span>
            </button>

            <button
              type="button"
              onClick={() => setAgentOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#087f7b] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#066c69]"
            >
              <Bot className="size-3.5" />
              <span>Agente IA</span>
            </button>

            <Link
              href={role === 'admin' ? '/avisos' : '/supervisor/avisos'}
              aria-label="Ver avisos"
              className="rounded-xl p-1.5 text-[#607b85] transition hover:bg-[#f4f9f8] dark:text-[#94adb8] dark:hover:bg-[#182b36]"
            >
              <Bell className="size-5" />
            </Link>

            <div className="flex size-8 items-center justify-center rounded-full bg-[#d8efed] text-[10px] font-bold text-[#087f7b] dark:bg-[#13313b] dark:text-[#5eead4]">
              {user.initials}
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-[1440px] p-5 sm:p-8">
          <Content path={pathname} />
        </main>
      </div>

      <AgentDrawer open={agentOpen} onClose={() => setAgentOpen(false)} />
    </div>
  )
}
