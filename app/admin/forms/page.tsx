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
      <header className="bg-gray-50 dark:bg-gray-800 border-b-2 border-gray-300 dark:border-gray-700 px-4 md:px-6 py-4 md:py-5 flex flex-col md:flex-row md:items-center md:justify-between flex-shrink-0 shadow-sm gap-4">
        <div className="min-w-0">
          <h1 className="font-bold text-2xl md:text-3xl text-gray-900 dark:text-white">Exp Forms</h1>
          <p className="text-sm md:text-base text-gray-700 dark:text-gray-300 mt-2 font-medium">Create flexible forms to collect supplier data</p>
        </div>
        <Link href="/admin/forms/new" className="btn btn-primary text-sm md:text-base py-3 px-4 md:px-6 font-semibold shadow-md hover:shadow-lg flex-shrink-0 w-full md:w-auto justify-center">
          <PlusCircle size={18} /> New Form
        </Link>
      </header>

      <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-white dark:bg-gray-900">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          {forms.map(form => {
            const formUrl = `/f/${form.slug}`
            const count = countMap[form.id] || 0

            return (
              <div key={form.id} className="card p-5 md:p-6 hover:shadow-lg transition-all duration-200 border-gray-200 dark:border-gray-700 dark:bg-gray-800 flex flex-col h-full">
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <h2 className="font-bold text-base md:text-lg text-gray-900 dark:text-white truncate">{form.name}</h2>
                        <span className={`badge text-xs font-bold flex-shrink-0 px-3 py-1 ${form.is_active ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300' : 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'}`}>
                          {form.is_active ? 'Live' : 'Paused'}
                        </span>
                      </div>
                      <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400 font-medium">
                        <span className="text-gray-900 dark:text-gray-200 font-semibold">{form.category}</span> • <span>{form.fields.length} fields</span> • <span className="text-brand-600 dark:text-brand-400 font-bold">{count} responses</span>
                      </p>
                    </div>
                  </div>

                  {form.description && (
                    <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400 mb-4 pb-4 border-b border-gray-200 dark:border-gray-700 line-clamp-2">{form.description}</p>
                  )}

                  <div className="flex items-center gap-2 bg-brand-50 dark:bg-brand-900/20 rounded-lg px-3 py-2 mb-4 border border-brand-200 dark:border-brand-800">
                    <code className="text-xs text-brand-700 dark:text-brand-300 flex-1 truncate font-mono">{formUrl}</code>
                    <div className="flex-shrink-0 relative z-10">
                      <FormActions formId={form.id} formUrl={formUrl} isActive={form.is_active} />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <a href={formUrl} target="_blank" className="btn btn-primary text-xs md:text-sm py-2.5 px-2 text-center font-semibold truncate z-0">
                    <ExternalLink size={16} />
                  </a>
                  <Link href={`/admin/suppliers?form=${form.id}`} className="btn text-xs md:text-sm py-2.5 px-2 text-center font-semibold truncate z-0">
                    <Copy size={16} /> <span className="hidden sm:inline">{count}</span>
                  </Link>
                  <Link href={`/admin/forms/${form.id}/edit`} className="btn text-xs md:text-sm py-2.5 px-2 text-center font-semibold truncate z-0">
                    <Pencil size={16} />
                  </Link>
                </div>
              </div>
            )
          })}
        </div>

        {/* Create New Form Card - Separate container below forms grid */}
        <div className="mt-4 md:mt-6">
          <Link
            href="/admin/forms/new"
            className="card p-6 md:p-8 border-2 border-dashed border-brand-400 dark:border-brand-600 bg-brand-50 dark:bg-brand-900/20 flex flex-col items-center justify-center gap-4 text-brand-700 dark:text-brand-300 hover:border-brand-500 dark:hover:border-brand-500 hover:bg-brand-100 dark:hover:bg-brand-900/30 transition-all duration-200 min-h-[180px] md:min-h-[240px] group cursor-pointer"
          >
            <div className="p-4 bg-brand-100 dark:bg-brand-900/40 rounded-full group-hover:bg-brand-200 dark:group-hover:bg-brand-900/60 transition-colors">
              <PlusCircle size={36} className="text-brand-600 dark:text-brand-400 md:w-10 md:h-10" />
            </div>
            <span className="text-lg md:text-xl font-bold text-brand-900 dark:text-brand-200">Create New Form</span>
            <span className="text-sm md:text-base text-brand-700 dark:text-brand-400 font-medium">Add a supplier form</span>
          </Link>
        </div>
      </main>
    </>
  )
}
