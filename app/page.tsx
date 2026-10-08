'use client'

import { useState } from 'react'
import CustodiaApp, { LandingPage } from '@/components/custodia-app'

export default function Page() {
  const [showApp, setShowApp] = useState(false)
  return showApp ? <CustodiaApp /> : <LandingPage onEnter={() => setShowApp(true)} />
}
