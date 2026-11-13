'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { Activity, ArrowDown, ArrowRight, ArrowUpRight, Menu, ShieldCheck, X } from 'lucide-react'

const navigation = [
  { href: '#plataforma', label: 'Plataforma' },
  { href: '#operacion', label: 'Operación' },
  { href: '#trazabilidad', label: 'Trazabilidad' },
]

const capabilities = [
  {
    number: '01',
    title: 'Control de acceso',
    description: 'Administra personas, permisos y registros de entrada a los cuartos limpios.',
    icon: ShieldCheck,
  },
  {
    number: '02',
    title: 'Monitoreo ambiental',
    description: 'Consulta las condiciones y los parámetros ambientales configurados para cada espacio.',
    icon: Activity,
  },
  {
    number: '03',
    title: 'Avisos e historial',
    description: 'Revisa avisos y registros de operación desde las áreas de supervisión.',
    icon: ArrowRight,
  },
]

export function CleanSpaceLanding() {
  const [menuOpen, setMenuOpen] = useState(false)

  function closeMenu() {
    setMenuOpen(false)
  }

  return (
    <div className="min-h-screen bg-[#f4f7f6] text-[#17313b] selection:bg-[#b9e1db] selection:text-[#102a34]">
      <a
        href="#contenido"
        className="sr-only z-[60] rounded-lg bg-white px-4 py-3 font-semibold text-[#17313b] focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:outline-2 focus:outline-offset-2 focus:outline-[#087f7b]"
      >
        Saltar al contenido
      </a>

      <header className="sticky top-0 z-50 border-b border-[#dbe5e3] bg-[#f9fbfa]">
        <div className="mx-auto flex h-[72px] max-w-[1440px] items-center justify-between px-5 sm:px-8 lg:px-14">
          <Link
            href="/"
            onClick={closeMenu}
            className="group flex min-h-11 items-center gap-3 rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#087f7b]"
            aria-label="CleanSpace, inicio"
          >
            <span className="flex size-10 items-center justify-center overflow-hidden rounded-xl bg-[#dff1ef]">
              <Image src="/custodia-logo.png" alt="" width={40} height={40} className="size-full object-cover" />
            </span>
            <span className="text-[15px] font-bold tracking-[-0.035em]">CleanSpace</span>
          </Link>

          <nav aria-label="Navegación principal" className="hidden items-center gap-8 md:flex">
            {navigation.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="group relative flex min-h-11 items-center text-sm font-medium text-[#526b72] transition-colors hover:text-[#17313b] focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#087f7b]"
              >
                {item.label}
                <span aria-hidden="true" className="absolute inset-x-0 bottom-1 h-px origin-left scale-x-0 bg-[#087f7b] transition-transform duration-200 group-hover:scale-x-100 group-focus-visible:scale-x-100" />
              </a>
            ))}
          </nav>

          <div className="hidden items-center md:flex">
            <Link
              href="/login"
              className="group inline-flex min-h-11 items-center justify-center gap-3 rounded-full bg-[#17313b] px-5 text-sm font-semibold text-white transition-[background-color,transform] duration-150 hover:-translate-y-0.5 hover:bg-[#244b56] active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[#087f7b]"
            >
              Ingresar al sistema
              <ArrowUpRight aria-hidden="true" className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>
          </div>

          <button
            type="button"
            aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
            aria-expanded={menuOpen}
            aria-controls="mobile-navigation"
            onClick={() => setMenuOpen((open) => !open)}
            className="inline-flex size-11 items-center justify-center rounded-xl border border-[#d2dfdc] bg-white text-[#17313b] transition-colors hover:bg-[#edf5f3] active:bg-[#e4efec] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#087f7b] md:hidden"
          >
            {menuOpen ? <X aria-hidden="true" className="size-5" /> : <Menu aria-hidden="true" className="size-5" />}
          </button>
        </div>

        <div
          id="mobile-navigation"
          hidden={!menuOpen}
          className="border-t border-[#dbe5e3] bg-[#f9fbfa] px-5 pb-5 pt-2 md:hidden"
        >
          <nav aria-label="Navegación móvil" className="mx-auto flex max-w-[640px] flex-col">
            {navigation.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={closeMenu}
                className="flex min-h-12 items-center border-b border-[#e5ecea] text-[15px] font-medium text-[#36545d] transition-colors hover:text-[#087f7b] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#087f7b]"
              >
                {item.label}
              </a>
            ))}
            <Link
              href="/login"
              onClick={closeMenu}
              className="mt-4 inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#17313b] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#244b56] active:bg-[#102a34] focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[#087f7b]"
            >
              Ingresar al sistema <ArrowUpRight aria-hidden="true" className="size-4" />
            </Link>
          </nav>
        </div>
      </header>

      <main id="contenido" className="outline-none">
        <section
          aria-labelledby="hero-title"
          className="mx-auto grid min-h-[min(780px,calc(100svh_-_72px))] max-w-[1440px] items-center gap-10 px-5 py-12 sm:px-8 sm:py-16 lg:grid-cols-[0.88fr_1.12fr] lg:gap-14 lg:px-14 lg:py-14"
        >
          <div className="flex flex-col items-start lg:py-12" data-enter>
            <p className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-[#087f7b]">
              <span aria-hidden="true" className="size-2 rounded-full bg-[#087f7b]" />
              Gestión de espacios limpios
            </p>
            <h1
              id="hero-title"
              className="max-w-[660px] text-[clamp(2.75rem,5vw,5.25rem)] font-semibold leading-[0.99] tracking-[-0.065em] text-[#17313b]"
            >
              Gestión de cuartos limpios para equipos de operación.
            </h1>
            <p className="mt-7 max-w-[510px] text-base leading-7 text-[#526b72] sm:text-lg sm:leading-8">
              CleanSpace reúne control de acceso, monitoreo ambiental y registros operativos en una plataforma web.
            </p>

            <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center sm:gap-5">
              <Link
                href="/login"
                className="group inline-flex min-h-12 items-center justify-center gap-3 rounded-full bg-[#17313b] px-6 text-sm font-semibold text-white transition-[background-color,transform] duration-150 hover:-translate-y-0.5 hover:bg-[#244b56] active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[#087f7b]"
              >
                Ingresar al sistema
                <ArrowUpRight aria-hidden="true" className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Link>
              <a
                href="#plataforma"
                className="group inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-3 text-sm font-semibold text-[#087f7b] transition-colors hover:text-[#075e5b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#087f7b]"
              >
                Ver la plataforma
                <ArrowDown aria-hidden="true" className="size-4 transition-transform group-hover:translate-y-0.5" />
              </a>
            </div>

            <div className="mt-10 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-[#d5e2df] pt-5 text-[13px] font-medium text-[#526b72] sm:gap-x-7">
              <span>Acceso</span>
              <span aria-hidden="true" className="size-1 rounded-full bg-[#8da7a5]" />
              <span>Ambiente</span>
              <span aria-hidden="true" className="size-1 rounded-full bg-[#8da7a5]" />
              <span>Trazabilidad</span>
            </div>
          </div>

          <div className="relative min-h-[340px] overflow-hidden rounded-[24px] bg-[#dce9e6] sm:min-h-[440px] lg:min-h-[600px]" data-enter-media>
            <Image
              src="/images/cleanroom-team.png"
              alt="Personal con indumentaria de protección revisa información en un cuarto limpio."
              fill
              priority
              sizes="(max-width: 1023px) 100vw, 58vw"
              className="object-cover object-center transition-transform duration-700 ease-out motion-safe:hover:scale-[1.02]"
            />
          </div>
        </section>

        <section
          id="plataforma"
          aria-labelledby="platform-title"
          className="scroll-mt-20 border-y border-[#dce6e3] bg-white px-5 py-20 sm:px-8 sm:py-24 lg:px-14 lg:py-28"
        >
          <div className="mx-auto max-w-[1280px]">
            <div className="grid gap-7 lg:grid-cols-[0.9fr_1.1fr] lg:items-end lg:gap-16">
              <div>
                <p className="text-sm font-semibold text-[#087f7b]">La plataforma</p>
                <h2 id="platform-title" className="mt-4 max-w-[650px] text-4xl font-semibold leading-[1.04] tracking-[-0.055em] text-[#17313b] sm:text-5xl">
                  La operación de cada espacio, en un mismo lugar.
                </h2>
              </div>
              <p className="max-w-[520px] text-base leading-7 text-[#526b72] lg:justify-self-end">
                Consulta las áreas de acceso, monitoreo y supervisión desde una misma aplicación web.
              </p>
            </div>

            <div className="mt-14 grid border-t border-[#dce6e3] md:grid-cols-3">
              {capabilities.map(({ number, title, description, icon: Icon }) => (
                <article
                  key={number}
                  className="group border-b border-[#dce6e3] py-7 md:border-b-0 md:border-r md:px-6 md:first:pl-0 md:last:border-r-0 md:last:pr-0 lg:py-9 lg:first:pr-8 lg:last:pl-8"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[13px] font-medium tabular-nums text-[#087f7b]">{number}</span>
                    <span className="flex size-10 items-center justify-center rounded-xl bg-[#e9f4f2] text-[#087f7b] transition-colors group-hover:bg-[#d9eeea]">
                      <Icon aria-hidden="true" className="size-[18px]" strokeWidth={1.8} />
                    </span>
                  </div>
                  <h3 className="mt-8 text-xl font-semibold tracking-[-0.025em] text-[#17313b]">{title}</h3>
                  <p className="mt-3 max-w-[340px] text-base leading-7 text-[#526b72]">{description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section
          id="operacion"
          aria-labelledby="operation-title"
          className="scroll-mt-20 bg-[#f4f7f6] px-5 py-20 sm:px-8 sm:py-24 lg:px-14 lg:py-28"
        >
          <div className="mx-auto grid max-w-[1280px] gap-12 lg:grid-cols-[0.82fr_1.18fr] lg:items-center lg:gap-20">
            <div>
              <p className="text-sm font-semibold text-[#087f7b]">Administración y supervisión</p>
              <h2 id="operation-title" className="mt-4 max-w-[500px] text-4xl font-semibold leading-[1.04] tracking-[-0.055em] text-[#17313b] sm:text-5xl">
                Información útil para el trabajo diario.
              </h2>
              <p className="mt-6 max-w-[480px] text-base leading-7 text-[#526b72]">
                Las áreas de administración y supervisión organizan los espacios, las personas, los dispositivos y los avisos del sistema.
              </p>
              <a
                href="#trazabilidad"
                className="group mt-7 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[#087f7b] focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#087f7b]"
              >
                Ver registros e historial
                <ArrowRight aria-hidden="true" className="size-4 transition-transform group-hover:translate-x-1" />
              </a>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:gap-5">
              <div className="relative col-span-2 aspect-[1.72] overflow-hidden rounded-[20px] bg-[#dce9e6]">
                <Image
                  src="/images/cleanspace-hero-professional.png"
                  alt="Operadora consulta un equipo dentro de un espacio de producción limpio."
                  fill
                  sizes="(max-width: 1023px) 100vw, 56vw"
                  className="object-cover transition-transform duration-700 ease-out motion-safe:hover:scale-[1.02]"
                />
              </div>
              <div className="relative aspect-[1.15] overflow-hidden rounded-[20px] bg-[#dce9e6]">
                <Image
                  src="/images/cleanroom-detail.png"
                  alt="Lector de acceso junto a una puerta de un cuarto limpio."
                  fill
                  sizes="(max-width: 639px) 46vw, 28vw"
                  className="object-cover transition-transform duration-700 ease-out motion-safe:hover:scale-[1.02]"
                />
              </div>
              <div className="flex min-h-full flex-col justify-between rounded-[20px] bg-[#17313b] p-5 text-white sm:p-7 lg:p-8">
                <ShieldCheck aria-hidden="true" className="size-6 text-[#9bd3c7]" strokeWidth={1.7} />
                <p className="max-w-[250px] text-xl font-medium leading-snug tracking-[-0.025em] sm:text-2xl">
                  Personas, espacios y dispositivos conectados a la operación.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section
          id="trazabilidad"
          aria-labelledby="trace-title"
          className="scroll-mt-20 bg-[#17313b] px-5 py-20 text-white sm:px-8 sm:py-24 lg:px-14 lg:py-28"
        >
          <div className="mx-auto flex max-w-[1280px] flex-col gap-9 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-semibold text-[#9bd3c7]">Avisos y registros</p>
              <h2 id="trace-title" className="mt-4 max-w-[760px] text-4xl font-semibold leading-[1.04] tracking-[-0.055em] sm:text-5xl lg:text-6xl">
                Revisa lo que ocurre en tus espacios limpios.
              </h2>
              <p className="mt-6 max-w-[580px] text-base leading-7 text-[#d0dddf]">
                CleanSpace incluye monitoreo, gestión de avisos y consulta de registros de acceso e historial.
              </p>
            </div>
            <Link
              href="/login"
              className="group inline-flex min-h-12 w-full shrink-0 items-center justify-center gap-3 rounded-full bg-[#e5f1ee] px-6 text-sm font-semibold text-[#17313b] transition-[background-color,transform] duration-150 hover:-translate-y-0.5 hover:bg-white active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[#9bd3c7] sm:w-fit"
            >
              Ingresar al sistema
              <ArrowUpRight aria-hidden="true" className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>
          </div>
        </section>
      </main>

      <footer className="bg-[#17313b] px-5 pb-7 text-sm text-[#c0d0d2] sm:px-8 lg:px-14">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-4 border-t border-white/15 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/" className="w-fit font-semibold text-white focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#9bd3c7]">
            CleanSpace
          </Link>
          <p>Gestión de espacios limpios</p>
          <span>© {new Date().getFullYear()} CleanSpace</span>
        </div>
      </footer>
    </div>
  )
}
