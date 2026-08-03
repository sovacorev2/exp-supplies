'use client'

import { useEffect, useState, useRef } from 'react'
import { AlertCircle, Download, FileDown } from 'lucide-react'
import { analyzeField, computeRatingRadar, exportCSV } from '@/lib/analytics'
import { exportAnalyticsPDF } from '@/lib/pdf'
import { StatTile, ChartCard, FieldCard, RadarChart } from '@/components/analytics/AnalyticsCharts'

export default function SharedAnalyticsClient({ token }: { token: string }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [form, setForm] = useState<any>(null)
  const [submissions, setSubmissions] = useState<any[]>([])
  const [exportingPdf, setExportingPdf] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`/api/analytics/${token}/fetch`)
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

  async function handleExportPDF() {
    if (!contentRef.current || !form) return
    setExportingPdf(true)
    try {
      await exportAnalyticsPDF(contentRef.current, form.name)
    } catch (err) {
      console.error('[v0] Error exporting PDF:', err)
      alert('Failed to export PDF')
    } finally {
      setExportingPdf(false)
    }
  }

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

  const radarAxes = computeRatingRadar(form.fields, submissions)

  return (
    <div className="min-h-screen bg-gray-900 dark:bg-gray-950">
      <header className="bg-gradient-to-r from-blue-600 to-blue-700 border-b border-blue-800 px-4 md:px-6 py-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">{form?.name}</h1>
          <p className="text-blue-100 text-sm">Shared Analytics · Read-only view</p>
        </div>
        {submissions.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => exportCSV(submissions, form)}
              className="flex items-center gap-1.5 text-[13px] font-semibold border border-white/30 text-white hover:bg-white/10 px-3 py-1.5 rounded-lg transition-colors"
            >
              <Download size={14} /> Export CSV
            </button>
            <button
              onClick={handleExportPDF}
              disabled={exportingPdf}
              className="flex items-center gap-1.5 text-[13px] font-semibold border border-white/30 text-white hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed px-3 py-1.5 rounded-lg transition-colors"
            >
              <FileDown size={14} /> {exportingPdf ? 'Exporting…' : 'Export PDF'}
            </button>
          </div>
        )}
      </header>

      <main className="p-4 md:p-6">
        {!form.fields || form.fields.length === 0 ? (
          <div className="text-center text-gray-400 py-20">No analytics available</div>
        ) : submissions.length === 0 ? (
          <div className="py-20 text-center">
            <p className="font-bold text-lg text-white">No responses yet</p>
            <p className="text-sm text-gray-400 mt-1">Analytics will appear once this form receives responses.</p>
          </div>
        ) : (
          <div ref={contentRef} className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatTile label="Total responses" value={submissions.length} />
              <StatTile label="Questions" value={form.fields.filter((f: any) => f.section !== 'SECTION_HEADER').length} />
              <StatTile label="Category" value={form.category} />
              <StatTile label="Status" value={form.is_active ? 'Live' : 'Paused'} />
            </div>

            {radarAxes && (
              <ChartCard
                title="Ratings at a glance"
                meta="Average score per rating question"
                tableRows={radarAxes.map(a => ({ label: a.label, value: `${a.avg.toFixed(1)} / ${a.max}` }))}
                tableValueHeader="Average"
              >
                <RadarChart axes={radarAxes} />
              </ChartCard>
            )}

            <div className="space-y-4">
              {form.fields.map((field: any) => {
                if (field.section === 'SECTION_HEADER') {
                  return (
                    <div key={field.id} className="mt-6 mb-4 pt-4 border-t-2 border-blue-800">
                      <h3 className="text-lg font-bold text-white">{field.label}</h3>
                    </div>
                  )
                }
                return <FieldCard key={field.id} field={field} result={analyzeField(field, submissions)} />
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
