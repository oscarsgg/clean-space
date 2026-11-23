import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
title: { default: 'CleanSpace · Operación bajo control', template: '%s · CleanSpace' },
description: 'CleanSpace conecta acceso, ambiente y trazabilidad para que los equipos de cuartos limpios operen con claridad y confianza.',
  generator: 'CleanSpace',
  icons: {
    icon: '/custodia-logo-web.png',
    apple: '/custodia-logo-web.png',
  },
}


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
    <html lang="es" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: "(function(){try{if(localStorage.getItem('cleanspace_theme')==='dark'){document.documentElement.classList.add('dark')}}catch(e){}})()",
          }}
        />
      </head>
      <body className="antialiased">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
