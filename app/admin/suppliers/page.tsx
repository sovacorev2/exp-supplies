import { getSubmissions, getForms } from '@/app/actions/forms'
import SuppliersClient from './SuppliersClient'

export const revalidate = 0

export default async function SuppliersPage({
  searchParams,
}: {
  searchParams: Promise<{ form?: string }>
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
      defaultFormId={params.form}
    />
  )
}
