import Link from 'next/link'
import { ArrowLeft, CircleAlert, ShieldX } from 'lucide-react'

type RequestErrorPageProps = {
  status: 403 | 503
  message?: string
}

export function RequestErrorPage({ status, message }: RequestErrorPageProps) {
  const forbidden = status === 403
  const title = forbidden ? 'No tienes acceso a esta sección' : 'No pudimos validar tu sesión'
  const description = forbidden
    ? 'Tu cuenta está autenticada, pero su rol no tiene permiso para consultar esta página.'
    : message ?? 'El servicio de autenticación no está disponible en este momento. Intenta de nuevo en unos minutos.'
  const Icon = forbidden ? ShieldX : CircleAlert

  return (
    <main className="grid min-h-screen place-items-center bg-[#f3f7f7] px-5 py-10 text-[#143443] dark:bg-[#0b141a] dark:text-[#e6f0f2]">
      <section className="w-full max-w-xl rounded-[28px] border border-[#dce7e8] bg-white p-7 shadow-[0_24px_70px_rgba(24,58,70,0.08)] dark:border-[#1e3340] dark:bg-[#101e26] sm:p-10">
        <div className="mb-9 flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-2xl bg-[#dff5f0] text-[#087f7b] dark:bg-[#13313b] dark:text-[#5eead4]">✳</div>
          <span className="font-semibold tracking-wide">CleanSpace</span>
        </div>
        <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-[#087f7b] dark:text-[#5eead4]">
          <Icon className="size-4" />
          Error {status}
        </div>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
        <p className="mt-4 max-w-lg text-sm leading-7 text-[#627985] dark:text-[#a5bac2]">{description}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href={forbidden ? '/' : '/login'} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#087f7b] px-4 text-sm font-semibold text-white transition hover:bg-[#066c69]">
            {forbidden ? <ArrowLeft className="size-4" /> : null}
            {forbidden ? 'Volver al inicio' : 'Volver a iniciar sesión'}
          </Link>
          {!forbidden && <Link href="/" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#d4e1e3] px-4 text-sm font-semibold text-[#244651] transition hover:bg-[#f4f9f8] dark:border-[#2b4350] dark:text-[#d7e6ea] dark:hover:bg-[#182b36]">Ir al inicio</Link>}
        </div>
        {!forbidden && <p className="mt-7 text-xs text-[#82939a] dark:text-[#829ba5]">Si el problema continúa, verifica que el servicio esté disponible o contacta al administrador.</p>}
      </section>
    </main>
  )
}
