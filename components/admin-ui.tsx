import type { ReactNode } from 'react'
import Link from 'next/link'
import { ArrowLeft, CircleAlert, LoaderCircle } from 'lucide-react'
import { statusPresentation } from '@/lib/admin-statuses.mjs'
import { userFacingClientError } from '@/lib/user-facing-errors.mjs'

type StatusTone = 'success' | 'warning' | 'info' | 'danger' | 'neutral'

const TONE_STYLES = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300',
  warning: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300',
  info: 'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-300',
  danger: 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300',
  neutral: 'border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-700/40 dark:text-slate-200',
} as const

export function AdminStatusBadge({ value, kind = 'status' }: { value: unknown; kind?: 'status' | 'severity' }) {
  const status = statusPresentation(value, kind)
  const tone = status.tone as StatusTone
  return <span className={`inline-flex min-h-6 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${TONE_STYLES[tone]}`}>
    <span aria-hidden="true" className={`size-1.5 rounded-full ${tone === 'success' ? 'bg-emerald-600' : tone === 'warning' ? 'bg-amber-600' : tone === 'info' ? 'bg-sky-600' : tone === 'danger' ? 'bg-rose-600' : 'bg-slate-500'}`} />
    {status.label}
  </span>
}

export function AdminPageHeader({ eyebrow, title, description, backHref, actions }: {
  eyebrow: string
  title: string
  description?: string
  backHref?: string
  actions?: ReactNode
}) {
  return <header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
    <div className="flex min-w-0 items-start gap-3">
      {backHref && <Link href={backHref} aria-label="Volver" className="mt-1 inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition hover:-translate-y-0.5 hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"><ArrowLeft className="size-4" /></Link>}
      <div className="min-w-0"><p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">{eyebrow}</p><h1 className="mt-1 text-3xl font-semibold tracking-[-0.035em] text-foreground sm:text-[2.15rem]">{title}</h1>{description && <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>}</div>
    </div>
    {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
  </header>
}

export function AdminPanel({ title, description, action, children, className = '' }: {
  title?: string
  description?: string
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return <section className={`min-w-0 rounded-[var(--admin-panel-radius)] border border-border bg-card shadow-[var(--admin-panel-shadow)] ${className}`}>
    {(title || description || action) && <div className="flex flex-col justify-between gap-3 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:px-6">
      <div>{title && <h2 className="text-base font-semibold tracking-tight text-card-foreground">{title}</h2>}{description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}</div>{action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>}
    {children}
  </section>
}

export function AdminFilterBar({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:flex-wrap sm:items-end sm:p-5 ${className}`}>{children}</div>
}

export function AdminField({ label, hint, children, className = '' }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return <label className={`flex min-w-0 flex-col gap-1.5 text-sm font-medium text-foreground ${className}`}>
    <span>{label}</span>{children}{hint && <span className="text-xs font-normal leading-5 text-muted-foreground">{hint}</span>}
  </label>
}

export function AdminKpi({ label, value, detail, icon, tone = 'teal' }: {
  label: string
  value: string
  detail?: string
  icon: ReactNode
  tone?: 'teal' | 'blue' | 'amber' | 'rose' | 'slate'
}) {
  const iconTone = { teal: 'bg-teal-50 text-teal-800 dark:bg-teal-500/10 dark:text-teal-300', blue: 'bg-sky-50 text-sky-800 dark:bg-sky-500/10 dark:text-sky-300', amber: 'bg-amber-50 text-amber-900 dark:bg-amber-500/10 dark:text-amber-300', rose: 'bg-rose-50 text-rose-800 dark:bg-rose-500/10 dark:text-rose-300', slate: 'bg-slate-100 text-slate-700 dark:bg-slate-700/40 dark:text-slate-200' }[tone]
  return <article className="relative min-w-0 overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-[0_12px_34px_rgba(16,44,58,0.035)] sm:p-5">
    <div className="flex items-start justify-between gap-3"><p className="text-[11px] font-bold uppercase leading-4 tracking-[0.11em] text-muted-foreground">{label}</p><span className={`grid size-9 shrink-0 place-items-center rounded-xl ${iconTone}`}>{icon}</span></div>
    <p className="mt-3 text-[1.8rem] font-semibold leading-none tracking-[-0.04em] tabular-nums text-card-foreground sm:text-3xl">{value}</p>
    {detail && <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">{detail}</p>}
  </article>
}

export function AdminLoading({ label = 'Cargando información…' }: { label?: string }) {
  return <div role="status" className="flex min-h-36 items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-card/70 px-5 text-sm text-muted-foreground"><LoaderCircle aria-hidden="true" className="size-4 animate-spin text-primary" />{label}</div>
}

export function AdminEmpty({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <div className="flex min-h-48 flex-col items-center justify-center px-6 py-10 text-center"><span className="grid size-11 place-items-center rounded-2xl bg-accent text-accent-foreground"><CircleAlert aria-hidden="true" className="size-5" /></span><h3 className="mt-4 text-sm font-semibold text-card-foreground">{title}</h3><p className="mt-1 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>{action && <div className="mt-4">{action}</div>}</div>
}

export function AdminError({ error, fallback }: { error: unknown; fallback?: string }) {
  const message = error === undefined || error === null ? fallback ?? 'No pudimos cargar esta información. Inténtalo de nuevo.' : userFacingClientError(error)
  return <div role="alert" className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-900 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200"><CircleAlert aria-hidden="true" className="mt-1 size-4 shrink-0" /><span>{message}</span></div>
}

export function AdminButton({ variant = 'primary', className = '', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' }) {
  const variants = {
    primary: 'border-transparent bg-primary text-primary-foreground hover:brightness-95',
    secondary: 'border-border bg-card text-foreground hover:bg-muted',
    danger: 'border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200',
  }
  return <button {...props} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-semibold shadow-sm transition duration-150 hover:-translate-y-px active:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-55 ${variants[variant]} ${className}`} />
}

export const adminInputClass = 'min-h-11 w-full rounded-xl border border-input bg-background px-3.5 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/75 focus-visible:border-ring focus-visible:ring-4 focus-visible:ring-ring/10 disabled:cursor-not-allowed disabled:opacity-60'
