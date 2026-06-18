import { getForms, getSubmissions } from '@/app/actions/forms'
import Link from 'next/link'
import { ExternalLink, Copy, Pencil, PlusCircle } from 'lucide-react'
import FormActions from './FormActions'

export const revalidate = 0

export default async function FormsPage() {
  const [forms, submissions] = await Promise.all([
    getForms(),
    getSubmissions(),
  ])

  const countMap: Record<string, number> = {}
  submissions.forEach(s => { countMap[s.form_id] = (countMap[s.form_id] || 0) + 1 })

  return (
    <>
      <header className="bg-gradient-to-r from-brand-50 to-brand-100 border-b border-brand-200 px-6 h-16 flex items-center justify-between flex-shrink-0 shadow-sm">
        <div>
          <h1 className="font-bold text-lg text-gray-900">Supplier Forms</h1>
          <p className="text-xs text-gray-600 mt-0.5">Manage and publish forms for suppliers</p>
        </div>
        <Link href="/admin/forms/new" className="btn btn-primary text-xs py-2 px-4 font-semibold shadow-md hover:shadow-lg">
          <PlusCircle size={15} /> Create New Form
        </Link>
      </header>

      <main className="flex-1 overflow-y-auto p-6 bg-gradient-to-br from-gray-50 to-white">
        <div className="grid grid-cols-2 gap-6">
          {forms.map(form => {
            const formUrl = `/f/${form.slug}`
            const count = countMap[form.id] || 0

            return (
              <div key={form.id} className="card p-6 hover:shadow-lg transition-all duration-200 border-brand-100">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h2 className="font-bold text-gray-900">{form.name}</h2>
                      <span className={`badge text-xs font-semibold flex-shrink-0 ${form.is_active ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                        {form.is_active ? '● Live' : '● Paused'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">{form.category}</span> • <span className="text-gray-500">{form.fields.length} fields</span> • <span className="text-brand-600 font-semibold">{count} responses</span>
                    </p>
                  </div>
                </div>

                {form.description && (
                  <p className="text-sm text-gray-600 mb-4 pb-3 border-b border-gray-100 line-clamp-2">{form.description}</p>
                )}

                <div className="flex items-center gap-2 bg-brand-50 rounded-lg px-3 py-2 mb-4 border border-brand-100">
                  <code className="text-xs text-brand-700 flex-1 truncate font-mono">{formUrl}</code>
                  <FormActions formId={form.id} formUrl={formUrl} isActive={form.is_active} />
                </div>

                <div className="flex gap-2">
                  <a href={formUrl} target="_blank" className="btn text-xs py-2 px-3 flex-1 text-center hover:bg-brand-50">
                    <ExternalLink size={13} /> Preview
                  </a>
                  <Link href={`/admin/suppliers?form=${form.id}`} className="btn text-xs py-2 px-3 flex-1 text-center hover:bg-brand-50">
                    <Copy size={13} /> {count}
                  </Link>
                  <Link href={`/admin/forms/${form.id}/edit`} className="btn btn-primary text-xs py-2 px-3 flex-1 text-center font-semibold">
                    <Pencil size={13} /> Edit
                  </Link>
                </div>
              </div>
            )
          })}

          <Link
            href="/admin/forms/new"
            className="card p-6 border-2 border-dashed border-brand-200 bg-gradient-to-br from-brand-50 to-brand-100 flex flex-col items-center justify-center gap-2 text-brand-600 hover:border-brand-400 hover:bg-brand-100 transition-all duration-200 min-h-[220px] group cursor-pointer"
          >
            <div className="p-3 bg-brand-100 rounded-full group-hover:bg-brand-200 transition-colors">
              <PlusCircle size={32} className="text-brand-600" />
            </div>
            <span className="text-base font-semibold">Create New Form</span>
            <span className="text-xs text-brand-500">Add a supplier form</span>
          </Link>
        </div>
      </main>
    </>
  )
}
