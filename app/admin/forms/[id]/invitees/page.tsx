import { getInvitees } from '@/app/actions/forms'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import InviteesTable from './InviteesTable'

export const revalidate = 0

export default async function InviteesPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { form, invitees } = await getInvitees(id)

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900">
      <header className="flex-shrink-0 bg-brand-600 dark:bg-brand-700 border-b border-brand-700 dark:border-brand-800 px-4 py-4 md:px-6 md:py-5">
        <Link
          href="/admin/forms"
          className="inline-flex items-center gap-1.5 text-sm text-brand-100 hover:text-white mb-2 transition-colors"
        >
          <ArrowLeft size={14} /> Back to Forms
        </Link>
        <h1 className="text-2xl md:text-3xl font-bold text-white">Invitees</h1>
        <p className="text-sm text-brand-100 mt-1">{form.name}</p>
      </header>

      <main className="flex-1 overflow-y-auto p-4 md:p-6">
        <InviteesTable formId={form.id} formSlug={form.slug} invitees={invitees} />
      </main>
    </div>
  )
}
