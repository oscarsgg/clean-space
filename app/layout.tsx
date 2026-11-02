import { Analytics } from '@vercel/analytics/next'
import { Manrope } from 'next/font/google'
import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
title: { default: 'CleanSpace · Operación bajo control', template: '%s · CleanSpace' },
description: 'CleanSpace conecta acceso, ambiente y trazabilidad para que los equipos de cuartos limpios operen con claridad y confianza.',
  generator: 'CleanSpace',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

const manrope = Manrope({ subsets: ['latin'], variable: '--font-manrope' })

export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: 'white' },
    { media: '(prefers-color-scheme: dark)', color: 'black' },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es">
      <body className={`${manrope.variable} antialiased [font-family:var(--font-manrope)]`}>
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
