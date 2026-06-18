import { getSubmissions, getForms } from '@/app/actions/forms'
import SuppliersClient from './SuppliersClient'

export const revalidate = 0

export default async function SuppliersPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; status?: string; form?: string }>
}) {
  const params = await searchParams
  const [submissions, forms] = await Promise.all([
    getSubmissions(),
    getForms(),
  ])

  return (
    <SuppliersClient
      submissions={submissions}
      forms={forms}
      defaultCategory={params.category}
      defaultStatus={params.status}
      defaultFormId={params.form}
    />
  )
}
