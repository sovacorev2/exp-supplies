'use client'

import { useEffect, useState } from 'react'
import { AlertCircle } from 'lucide-react'
import * as AnalyticsCharts from '@/components/analytics/AnalyticsCharts'

export default function SharedAnalyticsClient({ token }: { token: string }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [form, setForm] = useState<any>(null)
  const [submissions, setSubmissions] = useState<any[]>([])

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`/api/analytics/token/${token}/fetch`)
        if (res.status === 410) {
          setError('This analytics link has expired')
          return
        }
        if (!res.ok) {
          setError('Analytics link not found or invalid')
          return
        }
        const data = await res.json()
        setForm(data.form)
        setSubmissions(data.submissions)
      } catch (err) {
        console.error('[v0] Error loading shared analytics:', err)
        setError('Failed to load analytics')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [token])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-gray-700 border-t-blue-500 mb-4"></div>
          <p className="text-gray-400">Loading analytics...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-gray-800 border border-red-500/30 rounded-lg p-6 text-center max-w-md w-full">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <p className="text-red-300 font-medium">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 dark:bg-gray-950">
      <header className="bg-gradient-to-r from-blue-600 to-blue-700 border-b border-blue-800 px-4 md:px-6 py-6">
        <h1 className="text-2xl font-bold text-white mb-1">{form?.name}</h1>
        <p className="text-blue-100 text-sm">Shared Analytics · Read-only view</p>
      </header>

      <main className="p-4 md:p-6">
        <div className="space-y-6">
          {form.fields && form.fields.length > 0 ? (
            <>
              <div className="space-y-4">
                <h2 className="text-lg font-bold text-white">Form Overview</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <AnalyticsCharts.StatTile label="Total responses" value={submissions.length} />
                  <AnalyticsCharts.StatTile label="Questions" value={form.fields.filter((f: any) => f.section !== 'SECTION_HEADER').length} />
                  <AnalyticsCharts.StatTile label="Category" value={form.category} />
                  <AnalyticsCharts.StatTile label="Status" value={form.is_active ? 'Live' : 'Paused'} />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {form.fields
                  .filter((f: any) => f.section !== 'SECTION_HEADER')
                  .map((field: any) => (
                    <div key={field.id} className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                      <h3 className="font-bold text-white mb-2">{field.label}</h3>
                      <p className="text-sm text-gray-400">{field.type} field</p>
                    </div>
                  ))}
              </div>
            </>
          ) : (
            <div className="text-center text-gray-400">No analytics available</div>
          )}
        </div>
      </main>
    </div>
  )
}
