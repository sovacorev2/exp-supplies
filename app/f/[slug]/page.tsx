import { getFormBySlug } from '@/app/actions/forms'
import { notFound } from 'next/navigation'
import SupplierForm from './SupplierForm'

export default async function PublicFormPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  let form
  try {
    form = await getFormBySlug(slug)
  } catch {
    notFound()
  }

  if (!form) notFound()

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-2xl mx-auto px-4 md:px-6 py-6 md:py-8">
        <SupplierForm form={form} />
      </div>
    </div>
  )
}
