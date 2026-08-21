import { getForms, getSubmissions } from '@/app/actions/forms'
import { aiConfigured } from '@/lib/ai'
import AnalyticsClient from './AnalyticsClient'

export const revalidate = 0

export default async function AnalyticsPage() {
  let forms       = await getForms().catch(() => [])
  let submissions = await getSubmissions().catch(() => [])

  return <AnalyticsClient allForms={forms} allSubmissions={submissions} aiInsightsAvailable={aiConfigured()} />
}
