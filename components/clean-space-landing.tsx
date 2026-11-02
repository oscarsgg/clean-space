'use client'

import Link from 'next/link'
import { ArrowRight, Check, ChevronDown, Menu, Search, ShieldCheck, X } from 'lucide-react'
import { useState } from 'react'

const areas = [
  { title: 'Acceso controlado', text: 'Permisos claros para las personas correctas.', icon: '01' },
  { title: 'Ambiente estable', text: 'Condiciones visibles antes de que afecten el proceso.', icon: '02' },
  { title: 'Trazabilidad completa', text: 'Cada evento queda listo para revisar y entender.', icon: '03' },
  { title: 'Equipos coordinados', text: 'Una misma lectura para cada turno.', icon: '04' },
]

export function CleanSpaceLanding() {
  const [menuOpen, setMenuOpen] = useState(false)
  return (
    <div className="min-h-screen bg-[#087f7b] px-0 text-[#102d3b] sm:px-5 sm:py-5 lg:px-10 lg:py-8">
      <div className="mx-auto max-w-[1440px] overflow-hidden bg-[#e9f4f5] shadow-[0_30px_100px_rgba(0,38,46,0.22)]">
        <header className="relative z-20 flex items-center justify-between px-6 py-6 sm:px-10 lg:px-20 lg:py-8">
          <Link href="/" className="flex items-center gap-3" aria-label="CleanSpace, inicio">
            <img src="/custodia-logo.png" alt="CleanSpace" className="h-10 w-auto object-contain" />
            <span className="hidden border-l border-[#b5d6d7] pl-3 text-[9px] font-semibold uppercase tracking-[0.2em] text-[#5b7b83] sm:block">operación crítica</span>
          </Link>
          <nav className="hidden items-center gap-8 text-sm font-medium text-[#42636d] lg:flex"><a href="#plataforma" className="border-b-2 border-[#087f7b] pb-1 text-[#087f7b]">Inicio</a><a href="#plataforma">Plataforma</a><a href="#metodo">Cómo funciona</a><a href="#confianza">Confianza</a></nav>
          <div className="hidden items-center gap-3 sm:flex"><Link href="/login" className="rounded-full border border-[#88c2c1] px-5 py-2.5 text-sm font-semibold text-[#087f7b]">Ingresar</Link><Link href="/login" className="rounded-full bg-[#087f7b] px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#087f7b]/20">Comenzar</Link></div>
          <button className="rounded-xl border border-[#b5d6d7] bg-white/60 p-2 lg:hidden" onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}>{menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}</button>
        </header>
        {menuOpen && <div className="relative z-20 mx-6 mb-4 rounded-2xl bg-white p-4 shadow-lg lg:hidden"><a href="#plataforma" className="block rounded-xl p-3">Plataforma</a><a href="#metodo" className="block rounded-xl p-3">Cómo funciona</a><Link href="/login" className="mt-2 block rounded-xl bg-[#087f7b] p-3 font-semibold text-white">Ingresar</Link></div>}

        <main>
          <section className="relative overflow-hidden px-6 pb-12 pt-12 sm:px-10 lg:px-20 lg:pb-16 lg:pt-16">
            <div className="pointer-events-none absolute -right-28 top-[-160px] size-[520px] rounded-full bg-[#c9e5f6] opacity-70" />
            <div className="relative grid items-center gap-12 lg:grid-cols-[0.95fr_1.05fr] lg:gap-6">
              <div className="relative z-10 max-w-xl">
                <p className="mb-6 text-sm font-semibold text-[#087f7b]">La operación de tu cuarto limpio, en una sola lectura.</p>
                <h1 className="font-sans text-[clamp(2.8rem,5.5vw,5.7rem)] font-extrabold leading-[0.94] tracking-[-0.065em] text-[#102d3b]">Más claridad para cuidar lo que <span className="text-[#087f7b]">no puede fallar.</span></h1>
                <p className="mt-7 max-w-md text-base leading-relaxed text-[#5d7881] sm:text-lg">CleanSpace conecta accesos, condiciones ambientales y trazabilidad para que cada equipo trabaje con confianza.</p>
                <div className="mt-8 flex flex-wrap gap-3"><Link href="/login" className="flex items-center gap-3 rounded-full bg-[#087f7b] px-6 py-3.5 text-sm font-semibold text-white shadow-xl shadow-[#087f7b]/20">Entrar a CleanSpace <ArrowRight className="size-4" /></Link><a href="#plataforma" className="flex items-center gap-2 rounded-full px-4 py-3.5 text-sm font-semibold text-[#42636d]">Explorar plataforma <ChevronDown className="size-4" /></a></div>
              </div>
              <div className="relative min-h-[360px] lg:min-h-[500px]">
                <div className="absolute bottom-0 right-[-8%] h-[90%] w-[92%] overflow-hidden rounded-t-[48%] bg-[#a9d1f1] sm:right-0"><img src="/images/cleanroom-hero.png" alt="Técnico trabajando en un cuarto limpio" className="size-full object-cover mix-blend-multiply opacity-90" /></div>
                <div className="absolute left-0 top-10 max-w-[190px] rounded-2xl bg-white p-4 shadow-[0_18px_40px_rgba(25,83,93,0.14)] sm:top-16"><div className="flex items-center gap-2 text-xs font-semibold text-[#087f7b]"><span className="size-2 rounded-full bg-[#42b98e]" /> Señal activa</div><p className="mt-3 text-sm font-semibold leading-snug text-[#29434e]">Todo lo esencial, en contexto.</p><div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[#e1eeee]"><div className="h-full w-3/4 rounded-full bg-[#087f7b]" /></div></div>
                <div className="absolute bottom-8 right-0 rounded-2xl bg-[#102d3b] px-5 py-4 text-white shadow-xl sm:right-8"><ShieldCheck className="size-5 text-[#9ce0d8]" /><p className="mt-2 text-xs text-slate-300">Trazabilidad<br /><strong className="text-white">de extremo a extremo</strong></p></div>
              </div>
            </div>
          </section>

          <section className="grid grid-cols-2 border-y border-[#c9e0e1] bg-[#087f7b] text-white sm:grid-cols-4"><div className="border-white/20 px-5 py-7 sm:border-r lg:px-10"><p className="font-sans text-3xl font-extrabold tracking-[-0.04em]">24/7</p><p className="mt-1 text-xs text-[#c8efec]">Visibilidad operativa</p></div><div className="border-t border-white/20 px-5 py-7 sm:border-r sm:border-t-0 lg:px-10"><p className="font-sans text-3xl font-extrabold tracking-[-0.04em]">1</p><p className="mt-1 text-xs text-[#c8efec]">Lectura compartida</p></div><div className="border-t border-white/20 px-5 py-7 sm:border-r sm:border-t-0 lg:px-10"><p className="font-sans text-3xl font-extrabold tracking-[-0.04em]">100%</p><p className="mt-1 text-xs text-[#c8efec]">Trazabilidad del proceso</p></div><div className="border-t border-white/20 px-5 py-7 sm:border-t-0 lg:px-10"><p className="font-sans text-3xl font-extrabold tracking-[-0.04em]">1</p><p className="mt-1 text-xs text-[#c8efec]">Vista compartida</p></div></section>

          <section id="plataforma" className="bg-white px-6 py-20 sm:px-10 lg:px-20 lg:py-28"><div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end"><div><p className="text-sm font-semibold text-[#087f7b]">Una plataforma para el trabajo real</p><h2 className="mt-4 max-w-2xl text-4xl font-extrabold leading-tight tracking-[-0.05em] text-[#102d3b] sm:text-5xl">Todo lo que tu equipo necesita para operar mejor.</h2></div><p className="max-w-sm text-sm leading-relaxed text-[#6c858d]">Diseñada para quitar fricción, no para añadir otra pantalla que mantener.</p></div><div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{areas.map((area) => <article key={area.icon} className="group rounded-2xl border border-[#d8e8e9] bg-[#f6fbfb] p-5 transition-colors hover:border-[#087f7b] hover:bg-[#eaf7f5]"><span className="text-xs font-bold text-[#087f7b]">{area.icon}</span><h3 className="mt-12 text-lg font-bold text-[#29434e]">{area.title}</h3><p className="mt-3 text-sm leading-relaxed text-[#718995]">{area.text}</p><ArrowRight className="mt-8 size-4 text-[#087f7b] transition-transform group-hover:translate-x-1" /></article>)}</div></section>

          <section id="metodo" className="bg-[#e9f4f5] px-6 py-20 sm:px-10 lg:px-20 lg:py-24"><div className="grid gap-12 lg:grid-cols-[0.75fr_1.25fr] lg:items-center"><div><p className="text-sm font-semibold text-[#087f7b]">Cómo funciona</p><h2 className="mt-4 max-w-md text-4xl font-extrabold leading-tight tracking-[-0.05em] text-[#102d3b]">La información correcta, en el momento correcto.</h2></div><div className="grid gap-3 sm:grid-cols-2"><div className="rounded-3xl bg-[#102d3b] p-7 text-white sm:row-span-2"><p className="text-xs font-semibold text-[#9ce0d8]">Para quien coordina</p><p className="mt-24 text-2xl font-bold leading-tight">Una lectura completa de la operación.</p><p className="mt-4 text-sm leading-relaxed text-slate-300">Permisos, condiciones y eventos trazables para decidir con contexto.</p></div><div className="rounded-3xl bg-white p-6"><Check className="size-5 text-[#087f7b]" /><p className="mt-8 font-bold text-[#29434e]">Señales que se entienden rápido.</p></div><div className="rounded-3xl bg-white p-6"><Check className="size-5 text-[#087f7b]" /><p className="mt-8 font-bold text-[#29434e]">Un registro que cuenta la historia.</p></div></div></div></section>

          <section id="confianza" className="bg-[#102d3b] px-6 py-20 text-white sm:px-10 lg:px-20"><div className="flex flex-col justify-between gap-8 md:flex-row md:items-end"><div><p className="text-sm font-semibold text-[#9ce0d8]">CleanSpace</p><h2 className="mt-4 max-w-2xl text-4xl font-extrabold leading-tight tracking-[-0.05em] sm:text-5xl">Una forma más tranquila de cuidar lo que no puede fallar.</h2></div><Link href="/login" className="flex w-fit items-center gap-3 rounded-full bg-[#d8efed] px-6 py-3.5 text-sm font-semibold text-[#087f7b]">Ingresar a CleanSpace <ArrowRight className="size-4" /></Link></div></section>
        </main>
        <footer className="flex flex-col justify-between gap-3 bg-[#102d3b] px-6 pb-8 text-xs text-slate-400 sm:flex-row sm:px-10 lg:px-20"><span>© 2026 CleanSpace</span><span>Operación crítica, con claridad.</span></footer>
      </div>
    </div>
  )
}
