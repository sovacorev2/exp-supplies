'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { BarChart2, List, Download, FileDown, Search, RefreshCw, Share2, Check, Copy, FileText, ChevronDown } from 'lucide-react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import type { Form, Submission } from '@/app/actions/forms'
import { analyzeField, computeOverview, computeRatingRadar, exportCSV } from '@/lib/analytics'
import { exportAnalyticsPDF } from '@/lib/pdf'
import {
  StatTile, BarList, DonutChart, ChartCard, FieldCard, RadarChart,
} from '@/components/analytics/AnalyticsCharts'

const ReportView = dynamic(() => import('@/components/charts/ReportView'), { ssr: false })


export default function AnalyticsClient({
  allForms,
  allSubmissions,
}: {
  allForms: Form[]
  allSubmissions: Submission[]
}) {
  const router    = useRouter()
  const [view,    setView]    = useState<'list' | 'analytics'>('analytics')
  const [search,  setSearch]  = useState('')
  const [formId,  setFormId]  = useState('')
  const [shareModal, setShareModal] = useState(false)
  const [shareLink, setShareLink] = useState('')
  const [sharing, setSharing] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showReport, setShowReport] = useState(false)
  const [preparingReport, setPreparingReport] = useState(false)
  const [exportingPdf, setExportingPdf] = useState(false)
  const [exportMenu, setExportMenu] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)

  const filtered = useMemo(() => {
    return allSubmissions.filter(s => {
      const text       = Object.values(s.data as any).join(' ').toLowerCase()
      const matchSearch = !search || text.includes(search.toLowerCase())
      const matchForm   = !formId || s.form_id === formId
      return matchSearch && matchForm
    })
  }, [allSubmissions, search, formId])

  const selectedForm = formId ? allForms.find(f => f.id === formId) : null
  const overview     = useMemo(() => computeOverview(filtered), [filtered])

  async function generateAnalyticsLink() {
    if (!selectedForm) return
    setSharing(true)
    try {
      const res = await fetch(`/api/analytics/${selectedForm.id}/share`, { method: 'POST' })
      const data = await res.json()
      setShareLink(data.shareLink)
    } catch (err) {
      console.error('[v0] Error generating share link:', err)
      alert('Failed to generate share link')
    } finally {
      setSharing(false)
    }
  }

  function copyToClipboard() {
    navigator.clipboard.writeText(shareLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleExportPDF() {
    if (!contentRef.current) return
    setExportMenu(false)
    setExportingPdf(true)
    try {
      const title = selectedForm ? selectedForm.name : 'All Forms Overview'
      await exportAnalyticsPDF(contentRef.current, title)
    } catch (err) {
      console.error('[v0] Error exporting PDF:', err)
      alert('Failed to export PDF')
    } finally {
      setExportingPdf(false)
    }
  }

  function handlePrintReport() {
    setExportMenu(false)
    setPreparingReport(true)
    setShowReport(true)
  }

  // The report is mounted off-canvas (not display:none) as soon as
  // showReport flips on, so recharts gets a real width to measure and
  // paint charts against. Two animation frames later the paint has
  // landed, so window.print() actually captures rendered charts instead
  // of a blank first pass.
  useEffect(() => {
    if (!showReport) return
    let cancelled = false
    const raf1 = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (cancelled) return
        setPreparingReport(false)
        window.print()
      })
    })
    function afterPrint() { setShowReport(false) }
    window.addEventListener('afterprint', afterPrint)
    return () => {
      cancelled = true
      cancelAnimationFrame(raf1)
      window.removeEventListener('afterprint', afterPrint)
    }
  }, [showReport])

  // ── List view ────────────────────────────────────────────────────────────
  function ListView() {
    return (
      <div className="overflow-x-auto">
        {filtered.length === 0 ? (
          <div className="py-16 text-center text-gray-400">No responses match your filters</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-gray-200 dark:border-gray-700">
                <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">#</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Form</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">First answer</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Fields answered</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Submitted</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s, idx) => {
                const answers      = Object.values(s.data as Record<string, unknown>).filter(Boolean)
                const firstAnswer  = String(answers[0] ?? '—').slice(0, 80)
                const fieldsCount  = answers.length
                const date         = new Date(s.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                return (
                  <tr key={s.id} className="border-b border-gray-100 dark:border-gray-700/60 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="px-4 py-3 text-gray-400 dark:text-gray-500 tabular-nums">{filtered.length - idx}</td>
                    <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white whitespace-nowrap">{s.forms?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 max-w-xs truncate">{firstAnswer}</td>
                    <td className="px-4 py-3">
                      <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                        {fieldsCount} field{fieldsCount !== 1 ? 's' : ''}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">{date}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    )
  }

  // ── Overview ─────────────────────────────────────────────────────────────
  function OverviewView() {
    return (
      <div className="p-5 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatTile label="Total responses" value={overview.totalResponses} />
          <StatTile label="Active forms"    value={overview.activeForms} />
          <StatTile label="Forms"           value={allForms.length} />
          <StatTile label="Avg per form"    value={allForms.length ? Math.round(overview.totalResponses / allForms.length) : 0} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <ChartCard title="Responses by form" meta={`${allForms.length} forms`} tableRows={overview.byForm}>
            <BarList data={overview.byForm} highlightMax />
          </ChartCard>
          <ChartCard title="Responses in the last 14 days" meta="By submission date" tableRows={overview.byDay}>
            <BarList data={overview.byDay} />
          </ChartCard>
        </div>
        <div className="rounded-xl border border-brand-200 dark:border-brand-800 bg-brand-50/60 dark:bg-brand-900/20 px-5 py-3 text-[13px] text-brand-700 dark:text-brand-300">
          Pick a single form above to see a question-by-question breakdown with charts tailored to each field type.
        </div>
      </div>
    )
  }

  // ── Per-form analytics ───────────────────────────────────────────────────
  function FormAnalyticsView({ form }: { form: Form }) {
    const formSubs  = filtered.filter(s => s.form_id === form.id)
    const radarAxes = computeRatingRadar(form.fields, formSubs)

    if (!formSubs.length) {
      return (
        <div className="p-5">
          <div className="py-20 text-center">
            <p className="font-bold text-lg text-gray-900 dark:text-white">No responses yet</p>
            <p className="text-sm text-gray-400 mt-1">Analytics will appear once this form receives responses.</p>
          </div>
        </div>
      )
    }

    return (
      <div className="p-5 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatTile label="Total responses" value={formSubs.length} />
          <StatTile label="Questions"       value={form.fields.filter(f => f.section !== 'SECTION_HEADER').length} />
          <StatTile label="Category"        value={form.category} />
          <StatTile label="Status"          value={form.is_active ? 'Live' : 'Paused'} />
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
          {form.fields.map(field => {
            if (field.section === 'SECTION_HEADER') {
              return (
                <div key={field.id} className="mt-6 mb-4 pt-4 border-t-2 border-brand-200 dark:border-brand-800">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">{field.label}</h3>
                </div>
              )
            }
            return (
              <FieldCard
                key={field.id}
                field={field}
                result={analyzeField(field, formSubs, true)}
              />
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-brand-600 dark:bg-brand-700 border-b border-brand-700 px-3 sm:px-4 md:px-6 py-3 flex flex-wrap items-center justify-between gap-3 flex-shrink-0">
        <div className="flex items-center gap-2 sm:gap-3">
          <h1 className="font-bold text-lg sm:text-xl text-white">Analytics</h1>
          <span className="bg-white/20 text-white text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap">
            {filtered.length} responses
          </span>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-end">
          {/* Tab switcher */}
          <div className="flex bg-black/20 rounded-lg p-1 gap-1">
            <button
              onClick={() => setView('analytics')}
              className={`flex items-center gap-1.5 text-[13px] font-semibold px-2.5 sm:px-3 py-1.5 rounded-md transition-colors ${view === 'analytics' ? 'bg-white text-brand-700 shadow-sm' : 'text-white/80 hover:text-white'}`}
            >
              <BarChart2 size={14} /> <span className="hidden sm:inline">Analytics</span>
            </button>
            <button
              onClick={() => setView('list')}
              className={`flex items-center gap-1.5 text-[13px] font-semibold px-2.5 sm:px-3 py-1.5 rounded-md transition-colors ${view === 'list' ? 'bg-white text-brand-700 shadow-sm' : 'text-white/80 hover:text-white'}`}
            >
              <List size={14} /> <span className="hidden sm:inline">List</span>
            </button>
          </div>

          {selectedForm && (
            <button
              onClick={() => { setShareModal(true); setShareLink(''); generateAnalyticsLink() }}
              className="flex items-center gap-1.5 text-[13px] font-semibold p-2 sm:px-3 sm:py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-md transition-colors"
              title="Share analytics with a public link"
            >
              <Share2 size={14} /> <span className="hidden sm:inline">Share</span>
            </button>
          )}

          {/* Export / report menu — one entry point instead of three
              separate buttons, so the header stays usable at phone widths. */}
          <div className="relative">
            <button
              onClick={() => setExportMenu(v => !v)}
              className="flex items-center gap-1.5 text-[13px] font-semibold border border-white/30 text-white hover:bg-white/10 p-2 sm:px-3 sm:py-1.5 rounded-lg transition-colors"
              title="Export"
            >
              <Download size={14} /> <span className="hidden sm:inline">Export</span> <ChevronDown size={12} className="hidden sm:inline" />
            </button>
            {exportMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setExportMenu(false)} />
                <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-1.5 z-50">
                  {selectedForm && (
                    <button
                      onClick={handlePrintReport}
                      className="w-full flex items-start gap-2.5 px-3.5 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <FileText size={16} className="text-gray-400 mt-0.5 flex-shrink-0" />
                      <span>
                        <span className="block text-sm font-semibold text-gray-900 dark:text-white">Print report</span>
                        <span className="block text-xs text-gray-400">Branded, paginated report via your browser&apos;s print dialog</span>
                      </span>
                    </button>
                  )}
                  <button
                    onClick={() => { exportCSV(filtered, selectedForm); setExportMenu(false) }}
                    className="w-full flex items-start gap-2.5 px-3.5 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <Download size={16} className="text-gray-400 mt-0.5 flex-shrink-0" />
                    <span>
                      <span className="block text-sm font-semibold text-gray-900 dark:text-white">Export CSV</span>
                      <span className="block text-xs text-gray-400">Raw responses, one row per submission</span>
                    </span>
                  </button>
                  <button
                    onClick={handleExportPDF}
                    disabled={view !== 'analytics' || exportingPdf}
                    title={view !== 'analytics' ? 'Switch to Analytics view to download a PDF' : undefined}
                    className="w-full flex items-start gap-2.5 px-3.5 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <FileDown size={16} className="text-gray-400 mt-0.5 flex-shrink-0" />
                    <span>
                      <span className="block text-sm font-semibold text-gray-900 dark:text-white">{exportingPdf ? 'Exporting…' : 'Download PDF'}</span>
                      <span className="block text-xs text-gray-400">Snapshot of the charts on screen right now</span>
                    </span>
                  </button>
                </div>
              </>
            )}
          </div>

          <button
            onClick={() => router.refresh()}
            className="flex items-center gap-1.5 text-[13px] font-semibold border border-white/30 text-white hover:bg-white/10 p-2 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </header>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 md:px-6 py-3 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search responses…"
            className="w-full pl-8 pr-3 py-2 text-sm border-2 border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:border-brand-500 focus:outline-none transition-colors"
          />
        </div>
        <select
          value={formId}
          onChange={e => setFormId(e.target.value)}
          className="flex-1 sm:max-w-xs py-2 px-3 text-sm border-2 border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:border-brand-500 focus:outline-none transition-colors"
        >
          <option value="">All forms</option>
          {allForms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
        <div className="flex-shrink-0 text-[13px] font-bold px-4 py-2 rounded-lg bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 self-center whitespace-nowrap">
          {filtered.length} shown
        </div>
      </div>

      {/* Body */}
      <main className="flex-1 overflow-y-auto">
        {view === 'list' ? (
          <ListView />
        ) : (
          <div ref={contentRef} className="bg-gray-50 dark:bg-gray-900">
            {selectedForm ? <FormAnalyticsView form={selectedForm} /> : <OverviewView />}
          </div>
        )}
      </main>

      {/* Share Modal */}
      {shareModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Share Analytics</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Share a read-only link to this form&apos;s analytics. Anyone with the link can view the charts and data (no admin access required).
            </p>
            
            {shareLink ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-700 p-3 rounded-lg">
                  <input
                    type="text"
                    value={shareLink}
                    readOnly
                    className="flex-1 bg-transparent text-sm text-gray-900 dark:text-white outline-none font-mono"
                  />
                  <button
                    onClick={copyToClipboard}
                    className="flex-shrink-0 p-2 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                    title="Copy to clipboard"
                  >
                    {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} className="text-gray-600 dark:text-gray-400" />}
                  </button>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShareModal(false)}
                    className="flex-1 btn bg-gray-200 text-gray-900 hover:bg-gray-300 text-sm py-2"
                  >
                    Close
                  </button>
                  <button
                    onClick={() => window.open(shareLink, '_blank')}
                    className="flex-1 btn bg-brand-500 text-white hover:bg-brand-600 text-sm py-2"
                  >
                    Open
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center py-4">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-gray-300 border-t-brand-500"></div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Report for printing — kept off-canvas (not display:none) so recharts
          can measure a real width and paint before window.print() fires;
          print.css pulls it into the page and hides everything else. */}
      {showReport && selectedForm && (
        <div id="report-view" style={{ position: 'fixed', top: 0, left: '-10000px', width: 794 }}>
          <ReportView form={selectedForm} submissions={filtered} />
        </div>
      )}

      {preparingReport && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60]">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl px-6 py-4 flex items-center gap-3">
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-gray-300 border-t-brand-500" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Preparing report…</span>
          </div>
        </div>
      )}
    </div>
  )
}
