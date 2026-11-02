'use client'

import Link from 'next/link'
import { ArrowUpRight, Check, Menu, ShieldCheck, X } from 'lucide-react'
import { useState } from 'react'

const capabilities = [
  { number: '01', title: 'Control de acceso', text: 'Permisos claros y registros confiables para cada entrada.' },
  { number: '02', title: 'Condiciones visibles', text: 'El estado del espacio, disponible antes de tomar decisiones.' },
  { number: '03', title: 'Trazabilidad continua', text: 'Una historia completa de lo que ocurrió y cuándo.' },
]

export function CleanSpaceLanding() {
  const [menuOpen, setMenuOpen] = useState(false)
  return (
    <div className="min-h-screen bg-[#f4f6f5] text-[#17313b]">
      <header className="sticky top-0 z-50 mx-auto flex max-w-[1440px] items-center justify-between border-b border-[#dce7e4]/80 bg-[#f4f6f5]/90 px-6 py-4 backdrop-blur-xl lg:px-14 lg:py-5">
        <Link href="/" className="flex items-center gap-3" aria-label="CleanSpace, inicio">
          <span className="flex size-11 items-center justify-center overflow-hidden rounded-2xl border border-[#c7d4d3] bg-[#dff1ef] shadow-sm"><img src="/custodia-logo.png" alt="CleanSpace" className="size-full object-cover" /></span>
          <span className="text-sm font-semibold tracking-[-0.02em] text-[#17313b]">CleanSpace</span>
        </Link>
        <nav className="hidden items-center gap-9 text-sm font-medium text-[#587078] lg:flex"><a href="#plataforma" className="text-[#17313b]">Plataforma</a><a href="#metodo" className="hover:text-[#3f8580]">Cómo funciona</a><a href="#confianza" className="hover:text-[#3f8580]">Confianza</a></nav>
        <div className="hidden items-center gap-3 sm:flex"><Link href="/login" className="rounded-full px-4 py-2.5 text-sm font-semibold text-[#3f8580] hover:bg-white">Ingresar</Link><Link href="/login" className="rounded-full bg-[#17313b] px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#17313b]/15">Comenzar</Link></div>
        <button onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'} className="rounded-xl border border-[#c7d4d3] bg-white p-2 lg:hidden">{menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}</button>
      </header>
      {menuOpen && <div className="relative z-20 mx-6 rounded-2xl border border-[#d9e3e1] bg-white p-4 shadow-xl lg:hidden"><a href="#plataforma" className="block rounded-xl p-3">Plataforma</a><a href="#metodo" className="block rounded-xl p-3">Cómo funciona</a><Link href="/login" className="mt-2 block rounded-xl bg-[#17313b] p-3 font-semibold text-white">Ingresar</Link></div>}

      <main>
        <section className="mx-auto max-w-[1440px] px-6 pb-20 pt-12 lg:px-14 lg:pb-28 lg:pt-20">
          <div className="grid overflow-hidden rounded-[28px] bg-[#e5eeed] lg:grid-cols-[0.88fr_1.12fr]">
            <div className="flex flex-col justify-center px-7 py-14 sm:px-12 lg:px-16 lg:py-20">
              <p className="text-sm font-semibold text-[#3f8580]">Sistemas para espacios de alta exigencia</p>
              <h1 className="mt-6 max-w-xl text-[clamp(2.8rem,5.2vw,5.6rem)] font-semibold leading-[0.98] tracking-[-0.065em] text-[#17313b]">La operación bajo control, sin perder claridad.</h1>
              <p className="mt-7 max-w-lg text-base leading-relaxed text-[#5e747a] sm:text-lg">CleanSpace conecta acceso, ambiente y trazabilidad para que tu equipo trabaje con más certeza en cada turno.</p>
              <div className="mt-9 flex flex-wrap items-center gap-4"><Link href="/login" className="flex items-center gap-3 rounded-full bg-[#17313b] px-6 py-3.5 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5">Entrar a CleanSpace <ArrowUpRight className="size-4" /></Link><a href="#plataforma" className="text-sm font-semibold text-[#3f8580]">Conocer la plataforma</a></div>
              <div className="mt-10 flex items-center gap-2 text-xs font-medium text-[#70858a]"><Check className="size-4 text-[#3f8580]" /> Diseñado para equipos que no pueden improvisar</div>
            </div>
            <div className="relative min-h-[410px] overflow-hidden lg:min-h-[620px]"><img src="/images/cleanspace-hero-wide.png" alt="Supervisora en un entorno de cuarto limpio" className="absolute inset-0 size-full object-cover" /><div className="absolute inset-0 bg-gradient-to-r from-[#17313b]/20 via-transparent to-[#17313b]/10" /><div className="absolute bottom-6 left-6 right-6 flex items-end justify-between gap-4 sm:bottom-10 sm:left-10 sm:right-10"><div className="rounded-2xl border border-white/30 bg-[#17313b]/75 px-4 py-3 text-white backdrop-blur-md"><div className="flex items-center gap-2 text-xs font-semibold"><span className="size-2 rounded-full bg-[#9bd3c7]" /> Operación conectada</div><p className="mt-1 text-[11px] text-white/70">Claridad para cada turno</p></div><div className="hidden size-16 items-center justify-center rounded-full border border-white/50 bg-white/15 text-white backdrop-blur-md sm:flex"><ArrowUpRight className="size-5" /></div></div></div>
          </div>
        </section>

        <section id="plataforma" className="border-y border-[#dce5e3] bg-white px-6 py-20 lg:px-14 lg:py-28"><div className="mx-auto max-w-[1280px]"><div className="flex flex-col justify-between gap-7 lg:flex-row lg:items-end"><div><p className="text-sm font-semibold text-[#3f8580]">Una plataforma para el trabajo real</p><h2 className="mt-4 max-w-2xl text-4xl font-semibold leading-tight tracking-[-0.05em] text-[#17313b] sm:text-5xl">Todo lo que importa, en una sola lectura.</h2></div><p className="max-w-sm text-sm leading-relaxed text-[#71858a]">La información aparece cuando hace falta: clara, contextual y lista para convertirse en una decisión.</p></div><div className="mt-14 grid gap-4 md:grid-cols-3">{capabilities.map((capability) => <article key={capability.number} className="border-t border-[#b8cfcc] pt-5"><span className="text-xs font-semibold text-[#3f8580]">{capability.number}</span><h3 className="mt-14 text-xl font-semibold text-[#17313b]">{capability.title}</h3><p className="mt-3 max-w-xs text-sm leading-relaxed text-[#71858a]">{capability.text}</p></article>)}</div></div></section>

        <section id="metodo" className="bg-[#f4f6f5] px-6 py-20 lg:px-14 lg:py-28"><div className="mx-auto grid max-w-[1280px] gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-center"><div><p className="text-sm font-semibold text-[#3f8580]">Cómo funciona</p><h2 className="mt-4 max-w-md text-4xl font-semibold leading-tight tracking-[-0.05em] text-[#17313b] sm:text-5xl">Menos ruido. Más contexto para actuar.</h2><p className="mt-6 max-w-md leading-relaxed text-[#71858a]">CleanSpace acompaña el trabajo diario sin interrumpirlo: une las señales que tu equipo necesita para operar con confianza.</p></div><div className="grid gap-4 sm:grid-cols-2"><div className="rounded-[24px] bg-[#17313b] p-7 text-white sm:row-span-2"><ShieldCheck className="size-6 text-[#9bd3c7]" /><p className="mt-24 text-2xl font-semibold leading-tight">Una lectura completa de la operación.</p><p className="mt-4 text-sm leading-relaxed text-slate-300">Permisos, condiciones y eventos trazables para decidir con contexto.</p></div><div className="rounded-[24px] border border-[#d5e2df] bg-white p-7"><p className="text-sm font-semibold text-[#3f8580]">Para quien opera</p><p className="mt-9 text-lg font-semibold text-[#17313b]">Señales que se entienden rápido.</p></div><div className="rounded-[24px] border border-[#d5e2df] bg-white p-7"><p className="text-sm font-semibold text-[#3f8580]">Para quien audita</p><p className="mt-9 text-lg font-semibold text-[#17313b]">Un registro que cuenta la historia.</p></div></div></div></section>

        <section id="confianza" className="bg-[#17313b] px-6 py-20 text-white lg:px-14 lg:py-24"><div className="mx-auto flex max-w-[1280px] flex-col justify-between gap-8 md:flex-row md:items-end"><div><p className="text-sm font-semibold text-[#9bd3c7]">CleanSpace</p><h2 className="mt-4 max-w-2xl text-4xl font-semibold leading-tight tracking-[-0.05em] sm:text-5xl">La tranquilidad de saber qué está pasando.</h2></div><Link href="/login" className="flex w-fit items-center gap-3 rounded-full bg-[#e5eeed] px-6 py-3.5 text-sm font-semibold text-[#17313b]">Ingresar a CleanSpace <ArrowUpRight className="size-4" /></Link></div></section>
      </main>
      <footer className="bg-[#17313b] px-6 pb-8 text-xs text-white/50 lg:px-14"><div className="mx-auto flex max-w-[1280px] justify-between border-t border-white/10 pt-6"><span>© 2026 CleanSpace</span><span>CleanSpace · claridad operativa.</span></div></footer>
    </div>
  )
}
