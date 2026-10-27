import { RfidConfirmedPage } from '@/components/access-flows'

type Props = { params: Promise<{ cuartoId: string }> }

export default async function ConfirmedRfidRoute({ params }: Props) {
  const { cuartoId } = await params
  return <RfidConfirmedPage cuartoId={cuartoId} />
}
