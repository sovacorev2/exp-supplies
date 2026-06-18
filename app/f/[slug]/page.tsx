import { getFormBySlug } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import SupplierForm from './SupplierForm'

export default async function PublicFormPage({ params }: { params: { slug: string } }) {
  let form
  try {
    form = await getFormBySlug(params.slug)
  } catch {
    notFound()
  }

  if (!form) notFound()

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-brand-600 text-white px-6 py-5">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-xl font-semibold">{form.name}</h1>
          {form.description && (
            <p className="text-brand-100 text-sm mt-1">{form.description}</p>
          )}
        </div>
      </div>
      <div className="max-w-2xl mx-auto px-4 py-8">
        <SupplierForm form={form} />
      </div>
    </div>
  )
}
