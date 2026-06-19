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
    <div className="flex flex-col h-full bg-white dark:bg-gray-900">
      {/* Header */}
      <header className="flex-shrink-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-4 md:px-6 md:py-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">Forms</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Create and manage your forms</p>
          </div>
          <Link 
            href="/admin/forms/new" 
            className="btn btn-primary flex items-center justify-center gap-2 py-2.5 px-4 md:py-3 md:px-6 font-semibold text-sm md:text-base whitespace-nowrap"
          >
            <PlusCircle size={18} />
            New Form
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4 md:p-6">
        {forms.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <h2 className="text-lg md:text-xl font-bold text-gray-900 dark:text-white mb-2">No forms yet</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Create your first form to get started</p>
              <Link 
                href="/admin/forms/new" 
                className="btn btn-primary inline-flex items-center gap-2 py-2.5 px-4 font-semibold"
              >
                <PlusCircle size={16} />
                Create Form
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            {forms.map(form => {
              const formUrl = `/f/${form.slug}`
              const count = countMap[form.id] || 0

              return (
                <div 
                  key={form.id} 
                  className="flex flex-col rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 md:p-5 hover:shadow-md transition-shadow duration-200"
                >
                  {/* Form Header */}
                  <div className="mb-3 pb-3 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="text-base md:text-lg font-semibold text-gray-900 dark:text-white truncate flex-1">
                        {form.name}
                      </h3>
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold flex-shrink-0 ${
                        form.is_active 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' 
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
                      }`}>
                        {form.is_active ? 'Live' : 'Paused'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 flex flex-wrap gap-3">
                      <span><strong className="text-gray-900 dark:text-gray-200">{form.category}</strong></span>
                      <span>{form.fields.length} fields</span>
                      <span className="text-brand-600 dark:text-brand-400 font-semibold">{count} responses</span>
                    </p>
                  </div>

                  {/* Description */}
                  {form.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
                      {form.description}
                    </p>
                  )}

                  {/* Form URL */}
                  <div className="flex items-center gap-2 bg-brand-50 dark:bg-brand-900/20 rounded px-3 py-2 mb-4 border border-brand-200 dark:border-brand-800">
                    <code className="text-xs text-brand-700 dark:text-brand-300 flex-1 truncate font-mono">
                      {formUrl}
                    </code>
                    <div className="flex-shrink-0">
                      <FormActions formId={form.id} formUrl={formUrl} isActive={form.is_active} />
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 mt-auto">
                    <a 
                      href={formUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium text-xs md:text-sm"
                    >
                      <ExternalLink size={16} />
                      <span className="hidden sm:inline">Preview</span>
                    </a>
                    <Link 
                      href={`/admin/suppliers?form=${form.id}`}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium text-xs md:text-sm"
                    >
                      <Copy size={16} />
                      <span className="hidden sm:inline">{count}</span>
                    </Link>
                    <Link 
                      href={`/admin/forms/${form.id}/edit`}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium text-xs md:text-sm"
                    >
                      <Pencil size={16} />
                      <span className="hidden sm:inline">Edit</span>
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
