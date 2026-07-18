'use client'

import { useMemo } from 'react'
import { Lock } from 'lucide-react'

interface Submission {
  id: string
  form_id: string
  data: any
  status: string
  created_at: string
}

interface Form {
  id: string
  name: string
  description?: string
  fields: any[]
  created_at: string
}

export default function SharedResponsesClient({
  form,
  submissions,
  expiresAt,
}: {
  form: Form
  submissions: Submission[]
  expiresAt: any
}) {
  const summary = useMemo(() => {
    const stats = {
      totalAdults: 0,
      totalChildren: 0,
      totalResponses: submissions.length,
      hasAdultField: false,
      hasChildField: false,
    }

    submissions.forEach(submission => {
      const data = submission.data || {}

      // Count adults
      const adultField = Object.entries(data).find(([key]) => 
        key.toLowerCase().includes('adult') && (key.toLowerCase().includes('count') || key.toLowerCase().includes('number'))
      )
      if (adultField) {
        stats.hasAdultField = true
        const adultCount = parseInt(String(adultField[1])) || 0
        stats.totalAdults += Math.max(0, adultCount)
      }

      // Count children
      const childField = Object.entries(data).find(([key]) => 
        key.toLowerCase().includes('child') && (key.toLowerCase().includes('count') || key.toLowerCase().includes('number'))
      )
      if (childField) {
        stats.hasChildField = true
        const childCount = parseInt(String(childField[1])) || 0
        stats.totalChildren += Math.max(0, childCount)
      }
    })

    return stats
  }, [submissions])

  const expiresDate = new Date(expiresAt)
  const isExpiringSoon = new Date(Date.now() + 24 * 60 * 60 * 1000) > expiresDate

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                {form.name}
              </h1>
              {form.description && (
                <p className="text-gray-600 dark:text-gray-400">{form.description}</p>
              )}
            </div>
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 rounded-lg">
              <Lock size={16} />
              <span className="text-sm font-medium">Read-only view</span>
            </div>
          </div>

          {/* Stats */}
          <div className={`grid gap-4 mt-6 pt-6 border-t border-gray-200 dark:border-gray-700 grid-cols-1 ${summary.hasAdultField || summary.hasChildField ? 'md:grid-cols-3' : 'md:grid-cols-1'}`}>
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded p-4">
              <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Total Responses</p>
              <p className="text-2xl font-bold text-blue-900 dark:text-blue-100 mt-1">{summary.totalResponses}</p>
            </div>
            {summary.hasAdultField && (
              <div className="bg-green-50 dark:bg-green-900/20 rounded p-4">
                <p className="text-xs font-semibold text-green-600 dark:text-green-400 uppercase tracking-wider">Total Adults</p>
                <p className="text-2xl font-bold text-green-900 dark:text-green-100 mt-1">{summary.totalAdults}</p>
              </div>
            )}
            {summary.hasChildField && (
              <div className="bg-purple-50 dark:bg-purple-900/20 rounded p-4">
                <p className="text-xs font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wider">Total Children</p>
                <p className="text-2xl font-bold text-purple-900 dark:text-purple-100 mt-1">{summary.totalChildren}</p>
              </div>
            )}
          </div>

          {/* Expiry warning */}
          {isExpiringSoon && (
            <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                This share link expires on {expiresDate.toLocaleString()}
              </p>
            </div>
          )}
        </div>

        {/* Responses List */}
        <div className="space-y-6">
          {submissions.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm px-6 py-12 text-center">
              <p className="text-gray-500 dark:text-gray-400">No responses yet</p>
            </div>
          ) : (
            submissions.map((submission, idx) => (
              <div key={submission.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
                <div className="px-6 py-4 bg-gray-100 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 flex justify-between items-center">
                  <h3 className="font-semibold text-gray-900 dark:text-white">Response #{idx + 1}</h3>
                  <span className="text-xs text-gray-600 dark:text-gray-400">
                    {new Date(submission.created_at).toLocaleString()}
                  </span>
                </div>
                <div className="px-6 py-4 space-y-6">
                  {form.fields && form.fields.length > 0 ? (
                    form.fields.map((field: any, fieldIdx: number) => {
                      const answer = submission.data?.[field.label] || submission.data?.[field.id] || ''
                      return (
                        <div key={fieldIdx} className="border-l-4 border-blue-500 dark:border-blue-400 pl-4">
                          <p className="text-sm font-semibold text-blue-700 dark:text-blue-300 mb-2">
                            {field.label}
                            {field.required && <span className="text-red-500 ml-1">*</span>}
                          </p>
                          <p className="text-gray-900 dark:text-gray-200 whitespace-pre-wrap break-words">
                            {typeof answer === 'object' ? JSON.stringify(answer, null, 2) : String(answer || '—')}
                          </p>
                        </div>
                      )
                    })
                  ) : (
                    <div className="bg-gray-50 dark:bg-gray-900/50 rounded p-4">
                      <pre className="font-mono text-gray-700 dark:text-gray-300 text-sm overflow-x-auto whitespace-pre-wrap break-words">
                        {JSON.stringify(submission.data, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
