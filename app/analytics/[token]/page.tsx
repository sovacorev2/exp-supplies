import { Metadata } from 'next'
import SharedAnalyticsClient from './SharedAnalyticsClient'

export const metadata: Metadata = {
  title: 'Shared Analytics',
  description: 'View shared form analytics',
}

export default async function SharedAnalyticsPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  return <SharedAnalyticsClient token={token} />
}
