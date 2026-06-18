import { getForms, getSubmissions } from '@/lib/supabase'
import Link from 'next/link'
import { ExternalLink, Copy, Pencil, PlusCircle } from 'lucide-react'
import FormActions from './forms/FormActions'

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
      <header className="bg-white border-b border-gray-100 px-6 h-14 flex items-center justify-between flex-shrink-0">
        <h1 className="font-semibold">Forms</h1>
        <Link href="/admin/forms/new" className="btn btn-primary text-xs py-1.5 px-3">
          <PlusCircle size={14} /> New form
        </Link>
      </header>

      <main className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-2 gap-4">
          {forms.map(form => {
            const formUrl = `/f/${form.slug}`
            const count = countMap[form.id] || 0

            return (
              <div key={form.id} className="card p-5">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <h2 className="font-medium text-sm">{form.name}</h2>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {form.category} · {form.fields.length} fields · {count} responses
                    </p>
                  </div>
                  <span className={`badge flex-shrink-0 ${form.is_active ? 'badge-approved' : 'badge-rejected'}`}>
                    {form.is_active ? 'Live' : 'Paused'}
                  </span>
                </div>

                {form.description && (
                  <p className="text-xs text-gray-500 mb-3 line-clamp-2">{form.description}</p>
                )}

                <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 mb-3">
                  <code className="text-xs text-blue-600 flex-1 truncate">{formUrl}</code>
                  <FormActions formId={form.id} formUrl={formUrl} isActive={form.is_active} />
                </div>

                <div className="flex gap-2">
                  <a href={formUrl} target="_blank" className="btn text-xs py-1.5 px-3">
                    <ExternalLink size={13} /> Preview
                  </a>
                  <Link href={`/admin/suppliers?form=${form.id}`} className="btn text-xs py-1.5 px-3">
                    <Copy size={13} /> {count} responses
                  </Link>
                  <Link href={`/admin/forms/${form.id}/edit`} className="btn text-xs py-1.5 px-3 ml-auto">
                    <Pencil size={13} /> Edit
                  </Link>
                </div>
              </div>
            )
          })}

          <Link
            href="/admin/forms/new"
            className="card p-5 border-dashed flex flex-col items-center justify-center gap-2 text-gray-400 hover:border-brand-300 hover:text-brand-600 transition-colors min-h-[160px]"
          >
            <PlusCircle size={28} />
            <span className="text-sm">Create new form</span>
          </Link>
        </div>
      </main>
    </>
  )
}
