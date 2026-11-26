import { headers } from 'next/headers'
import { RequestErrorPage } from '@/components/request-error-page'

export const dynamic = 'force-dynamic'

export default async function ServiceUnavailablePage() {
  const requestHeaders = await headers()
  const message = requestHeaders.get('x-cleanspace-error-message') ?? undefined
  return <RequestErrorPage status={503} message={message} />
}
