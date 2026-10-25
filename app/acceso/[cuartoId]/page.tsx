import { RfidAccessPage } from '@/components/access-flows'

type Props = { params: Promise<{ cuartoId: string }> }

export default async function RfidRoute({ params }: Props) {
  const { cuartoId } = await params
  return <RfidAccessPage cuartoId={cuartoId} />
}
