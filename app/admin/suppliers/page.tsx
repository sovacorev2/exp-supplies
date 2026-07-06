import { getSubmissions, getForms } from '@/app/actions/forms'
import SuppliersClient from './SuppliersClient'

export const revalidate = 0

export default async function SuppliersPage({
  searchParams,
}: {
  searchParams: Promise<{ form?: string }>
}) {
  const params = await searchParams
  let submissions: Awaited<ReturnType<typeof getSubmissions>> = []
  let forms: Awaited<ReturnType<typeof getForms>> = []

  try {
    ;[submissions, forms] = await Promise.all([getSubmissions(), getForms()])
  } catch (err) {
    console.error('[v0] SuppliersPage DB error:', err)
  }

  return (
    <SuppliersClient
      submissions={submissions}
      forms={forms}
      defaultFormId={params.form}
    />
  )
}
