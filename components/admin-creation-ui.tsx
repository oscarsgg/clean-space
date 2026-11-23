'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { AlertCircle, ArrowLeft, CheckCircle2, LoaderCircle, Plus, X } from 'lucide-react'
import Link from 'next/link'

export const creationInputClass = 'min-h-12 w-full min-w-0 rounded-xl border border-[#cfdcde] bg-white px-3.5 text-sm text-[#163542] outline-none transition placeholder:text-[#91a3a8] hover:border-[#a9c2c2] focus:border-[#087f7b] focus:ring-4 focus:ring-[#087f7b]/10 disabled:cursor-not-allowed disabled:bg-[#f4f7f7] disabled:text-[#82969d]'
export const creationLabelClass = 'flex min-w-0 flex-col gap-2 text-sm font-semibold text-[#29434e]'

export function CreationLayout({ eyebrow = 'Administración · nuevo registro', title, description, backHref, backLabel = 'Volver al listado', children }: { eyebrow?: string; title: string; description: string; backHref: string; backLabel?: string; children: ReactNode }) {
  return <div className="mx-auto flex w-full min-w-0 flex-col gap-6 pb-8">
    <header className="relative overflow-hidden rounded-3xl border border-[#d8e7e5] bg-[linear-gradient(120deg,#eaf6f3_0%,#f7fbfa_58%,#f0f6f8_100%)] px-5 py-6 sm:px-8 sm:py-8">
      <div className="relative z-10 max-w-4xl"><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#087f7b]">{eyebrow}</p><h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-[#102d3b] sm:text-4xl">{title}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[#5f7880] sm:text-base">{description}</p>
        <Link href={backHref} className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#d1e0df] bg-white/80 px-3.5 text-sm font-semibold text-[#36515b] transition hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#087f7b]"><ArrowLeft className="size-4" />{backLabel}</Link>
      </div><div aria-hidden="true" className="absolute -right-10 -top-24 size-72 rounded-full border-[36px] border-white/35" />
    </header>
    <div className="grid min-w-0 gap-5 2xl:grid-cols-[minmax(0,1fr)_minmax(18rem,0.34fr)] 2xl:items-start">{children}</div>
  </div>
}

export function CreationCard({ title, description, icon, children, className = '' }: { title: string; description: string; icon: ReactNode; children: ReactNode; className?: string }) {
  return <section className={`min-w-0 overflow-hidden rounded-2xl border border-[#dce7e8] bg-white shadow-[0_12px_34px_rgba(16,44,58,0.045)] ${className}`}>
    <div className="flex items-start gap-3 border-b border-[#e9efef] px-5 py-5 sm:px-7"><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#e8f4f1] text-[#087f7b]">{icon}</span><div className="min-w-0"><h2 className="text-base font-semibold tracking-tight text-[#163542]">{title}</h2><p className="mt-1 text-sm leading-5 text-[#718995]">{description}</p></div></div>
    <div className="p-5 sm:p-7">{children}</div>
  </section>
}

export function CreationAside({ title, children }: { title: string; children: ReactNode }) {
  return <aside className="min-w-0 rounded-2xl border border-[#dce7e8] bg-[#f8fbfa] p-5 sm:p-6 2xl:sticky 2xl:top-6"><p className="text-xs font-bold uppercase tracking-[0.13em] text-[#087f7b]">{title}</p><div className="mt-4 space-y-4 text-sm leading-6 text-[#617a82]">{children}</div></aside>
}

export function CreationNotice({ tone = 'error', title, children }: { tone?: 'error' | 'success' | 'info'; title: string; children: ReactNode }) {
  const style = tone === 'error' ? 'border-rose-200 bg-rose-50 text-rose-900' : tone === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-sky-200 bg-sky-50 text-sky-900'
  return <div role={tone === 'error' ? 'alert' : 'status'} className={`flex items-start gap-3 rounded-xl border px-4 py-3.5 text-sm leading-5 ${style}`}><span className="mt-0.5 shrink-0">{tone === 'success' ? <CheckCircle2 className="size-4" /> : <AlertCircle className="size-4" />}</span><div className="min-w-0"><p className="font-semibold">{title}</p><div className="mt-0.5">{children}</div></div></div>
}

export function CreationActions({ cancelHref, submitLabel, saving, disabled = false }: { cancelHref: string; submitLabel: string; saving: boolean; disabled?: boolean }) {
  return <div className="flex flex-col-reverse gap-2 border-t border-[#edf2f3] pt-5 sm:flex-row sm:justify-end"><Link href={cancelHref} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#d6e2e3] bg-white px-4 text-sm font-semibold text-[#526c75] transition hover:bg-[#f5f9f8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#087f7b]">Cancelar</Link><button type="submit" disabled={saving || disabled} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#087f7b] px-5 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-px hover:bg-[#066c69] active:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#087f7b] disabled:pointer-events-none disabled:opacity-55">{saving ? <LoaderCircle className="size-4 animate-spin" /> : <Plus className="size-4" />}{saving ? 'Guardando…' : submitLabel}</button></div>
}

export function CreateConfirmDialog({ open, title, description, loading, onCancel, onConfirm }: { open: boolean; title: string; description: string; loading: boolean; onCancel: () => void; onConfirm: () => void }) {
  const cancelButtonRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!open) return
    cancelButtonRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape' && !loading) onCancel() }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, loading, onCancel])
  if (!open) return null
  return <div className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-[#0b2430]/55 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget && !loading) onCancel() }}>
    <section role="dialog" aria-modal="true" aria-labelledby="create-confirm-title" aria-describedby="create-confirm-description" className="w-full max-w-md rounded-2xl border border-[#dce7e8] bg-white p-5 shadow-[0_24px_80px_rgba(10,34,46,0.24)] sm:p-6">
      <div className="flex items-start justify-between gap-4"><span className="grid size-11 place-items-center rounded-xl bg-[#e8f4f1] text-[#087f7b]"><CheckCircle2 className="size-5" /></span><button type="button" aria-label="Cerrar confirmación" disabled={loading} onClick={onCancel} className="grid size-9 place-items-center rounded-lg text-[#82969d] transition hover:bg-[#f2f6f5] disabled:opacity-50"><X className="size-4" /></button></div>
      <h2 id="create-confirm-title" className="mt-4 text-lg font-semibold tracking-tight text-[#163542]">{title}</h2><p id="create-confirm-description" className="mt-2 text-sm leading-6 text-[#718995]">{description}</p>
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button ref={cancelButtonRef} type="button" disabled={loading} onClick={onCancel} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#d6e2e3] px-4 text-sm font-semibold text-[#526c75] hover:bg-[#f5f9f8]">Revisar datos</button><button type="button" disabled={loading} onClick={onConfirm} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#087f7b] px-4 text-sm font-semibold text-white hover:bg-[#066c69] disabled:opacity-55">{loading && <LoaderCircle className="size-4 animate-spin" />}{loading ? 'Creando…' : 'Confirmar creación'}</button></div>
    </section>
  </div>
}
