'use client'

import { useState } from 'react'
import CustodiaApp, { AccessPage, LandingPage } from '@/components/custodia-app'

export default function Page() {
  const [view, setView] = useState<'landing' | 'access' | 'app'>('landing')

  if (view === 'app') return <CustodiaApp />
  if (view === 'access') return <AccessPage onBack={() => setView('landing')} onAuthenticated={() => setView('app')} />

  return <LandingPage onEnter={() => setView('access')} />
}
