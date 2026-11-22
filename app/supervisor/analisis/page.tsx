import { headers } from 'next/headers'
import CleanSpacePortal from '@/components/cleanspace-portal'

export default async function SupervisorAnalisisPage() {
  const requestHeaders = await headers()
  const isAdmin = requestHeaders.get('x-cleanspace-verified-role') === 'ADMINISTRADOR'
  return <CleanSpacePortal role={isAdmin ? 'admin' : 'supervisor'} />
}
