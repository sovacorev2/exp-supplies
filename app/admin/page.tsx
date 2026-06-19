import { getForms, getSubmissions } from '@/app/actions/forms'
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
      <header className="bg-brand-600 dark:bg-brand-700 border-b border-brand-700 dark:border-brand-800 px-4 md:px-6 py-4 md:py-5 flex items-center justify-between flex-shrink-0">
        <h1 className="font-bold text-xl md:text-2xl text-white">Forms</h1>
        <Link href="/admin/forms/new" className="flex items-center gap-2 bg-white hover:bg-gray-100 text-brand-600 font-semibold py-2 px-4 rounded-lg transition-colors text-sm md:text-base">
          <PlusCircle size={18} /> New form
        </Link>
      </header>

      <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-white dark:bg-gray-900">
        {forms.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-12">
            <h2 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white mb-2">No forms yet</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">Create your first form to get started</p>
          </div>
        ) : (
          <div className="flex flex-col md:grid md:grid-cols-2 gap-4 md:gap-6">
            {forms.map(form => {
              const formUrl = `/f/${form.slug}`
              const count = countMap[form.id] || 0

              return (
                <div key={form.id} className="card p-5 md:p-6">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1">
                      <h2 className="font-bold text-base md:text-lg text-gray-900 dark:text-white">{form.name}</h2>
                      <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {form.category} · {form.fields.length} fields · {count} responses
                      </p>
                    </div>
                    <span className={`badge text-xs font-bold flex-shrink-0 px-3 py-1 ${form.is_active ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300' : 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'}`}>
                      {form.is_active ? 'Live' : 'Paused'}
                    </span>
                  </div>

                  {form.description && (
                    <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400 mb-4 pb-4 border-b border-gray-200 dark:border-gray-700 line-clamp-2">{form.description}</p>
                  )}

                  <div className="flex items-center gap-2 bg-brand-50 dark:bg-brand-900/20 rounded-lg px-3 py-2 mb-4 border border-brand-200 dark:border-brand-800">
                    <code className="text-xs text-brand-700 dark:text-brand-300 flex-1 truncate font-mono">{formUrl}</code>
                    <FormActions formId={form.id} formUrl={formUrl} isActive={form.is_active} />
                  </div>

                  <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <a href={formUrl} target="_blank" className="btn btn-primary text-xs md:text-sm py-2.5 px-2 text-center font-semibold truncate">
                      <ExternalLink size={16} />
                    </a>
                    <Link href={`/admin/suppliers?form=${form.id}`} className="btn text-xs md:text-sm py-2.5 px-2 text-center font-semibold truncate">
                      <Copy size={16} /> <span className="hidden sm:inline">{count}</span>
                    </Link>
                    <Link href={`/admin/forms/${form.id}/edit`} className="btn text-xs md:text-sm py-2.5 px-2 text-center font-semibold truncate">
                      <Pencil size={16} />
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </>
  )
}
