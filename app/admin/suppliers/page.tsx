import { getSubmissions, getForms } from '@/app/actions/forms'
import { requireUser } from '@/lib/auth-helpers'
import SuppliersClient from './SuppliersClient'

export const revalidate = 0

export default async function SuppliersPage({
  searchParams,
}: {
  searchParams: Promise<{ form?: string }>
}) {
  const params = await searchParams
  const currentUser = await requireUser()
  let submissions: Awaited<ReturnType<typeof getSubmissions>> = []
  let forms: Awaited<ReturnType<typeof getForms>> = []
  try {
    ;[submissions, forms] = await Promise.all([getSubmissions(), getForms()])
  } catch (e) {
    console.error('[v0] suppliers/page DB error:', e)
  }

  return (
    <SuppliersClient
      submissions={submissions}
      forms={forms}
      defaultFormId={params.form}
      currentUser={{ id: currentUser.id, role: currentUser.role }}
    />
  )
}
