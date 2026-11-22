import { RequestErrorPage } from '@/components/request-error-page'

export default function ForbiddenPage() {
  return <RequestErrorPage status={403} />
}
