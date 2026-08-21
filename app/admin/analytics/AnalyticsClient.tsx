'use client'

import { useState, useMemo, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { BarChart2, List, Download, FileDown, Search, RefreshCw, Share2, Check, Copy, FileText, ChevronDown, Sparkles } from 'lucide-react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import type { Form, Submission, ReportNarrative, FieldValueMerge } from '@/app/actions/forms'
import { generateReportNarrative, getFieldValueMerges } from '@/app/actions/forms'
import { analyzeField, computeOverview, computeRatingRadar, exportCSV, formatAnswerPreview, applyFieldMerges } from '@/lib/analytics'
import { exportAnalyticsPDF } from '@/lib/pdf'
import {
  StatTile, BarList, DonutChart, ChartCard, FieldCard, RadarChart,
} from '@/components/analytics/AnalyticsCharts'

const ReportView = dynamic(() => import('@/components/charts/ReportView'), { ssr: false })


export default function AnalyticsClient({
  allForms,
  allSubmissions,
  aiInsightsAvailable,
}: {
  allForms: Form[]
  allSubmissions: Submission[]
  aiInsightsAvailable: boolean
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
  const [preparingMessage, setPreparingMessage] = useState('Preparing report…')
  const [exportingPdf, setExportingPdf] = useState(false)
  const [pdfProgress, setPdfProgress] = useState<{ done: number; total: number } | null>(null)
  const [exportMenu, setExportMenu] = useState(false)
  const [includeAiInsights, setIncludeAiInsights] = useState(false)
  const [narrative, setNarrative] = useState<ReportNarrative | null>(null)
  const [narrativeNotice, setNarrativeNotice] = useState<string | null>(null)
  const [merges, setMerges] = useState<Record<string, FieldValueMerge[]>>({})

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

  // Admin-created "these are the same answer" mappings (e.g. "Sunton" /
  // "Sunton Kasarani") — fetched per selected form and applied once here
  // so the dashboard, the printed report, and CSV export all stay
  // consistent from a single source of truth.
  async function refetchMerges() {
    if (!selectedForm) { setMerges({}); return }
    setMerges(await getFieldValueMerges(selectedForm.id))
  }
  useEffect(() => { refetchMerges() }, [selectedForm?.id])
  const mergedSubs = useMemo(() => applyFieldMerges(filtered, merges), [filtered, merges])

  // Independent of the search box — the AI eligibility threshold should
  // reflect the form's real response count, not whatever the admin
  // happens to be filtering the list by right now.
  const selectedFormSubCount = selectedForm ? allSubmissions.filter(s => s.form_id === selectedForm.id).length : 0
  const aiInsightsDisabledReason = !aiInsightsAvailable
    ? 'Smart Insights are not configured'
    : !selectedForm
      ? 'Pick a form above to enable Smart Insights'
      : selectedFormSubCount < 3
        ? 'Needs at least 3 responses for Smart Insights'
        : null

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

  // Both "Print report" and "Download PDF" render the same clean
  // ReportView (no dashboard chrome, no buttons) into #report-view and
  // wait for it to actually paint before acting on it. The report sits
  // off-canvas rather than display:none so recharts' ResizeObserver sees
  // a real width and draws real charts instead of nothing — then this
  // just polls for a few settled frames after the node shows up.
  function ensureReportRendered(): Promise<HTMLElement> {
    setShowReport(true)
    return new Promise((resolve, reject) => {
      let settledFrames = 0
      let totalFrames = 0
      function tick() {
        totalFrames++
        const node = document.getElementById('report-view')
        // #report-view (the portal mount) exists the instant showReport
        // flips true, but ReportView is a dynamic(ssr:false) import — on
        // its first use the chunk is still loading and the mount is an
        // empty wrapper. [data-pdf-flatten] only appears once ReportView
        // itself has actually rendered, so wait on that instead.
        const ready = node?.querySelector('[data-pdf-flatten]')
        if (ready) settledFrames++
        if (ready && settledFrames > 6) { resolve(node!); return }
        if (totalFrames > 300) { reject(new Error('Report took too long to render')); return }
        requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    })
  }

  // Fetches (or reuses the cached) AI narrative when the admin opted in.
  // Failures here never block the report — they fall back to the plain
  // chart report with a brief notice, since Print/Download must keep
  // working exactly as before for anyone who didn't ask for AI insights.
  async function prepareNarrative() {
    if (!includeAiInsights || !selectedForm) { setNarrative(null); return }
    setPreparingMessage('Generating insights…')
    const result = await generateReportNarrative(selectedForm.id)
    if (result.ok) {
      setNarrative(result.data)
    } else {
      console.error('[analytics] Smart Insights failed:', result.error)
      setNarrative(null)
      setNarrativeNotice('Smart Insights unavailable — showing the standard report.')
      setTimeout(() => setNarrativeNotice(null), 5000)
    }
    setPreparingMessage('Preparing report…')
  }

  async function handlePrintReport() {
    if (!selectedForm) return
    setExportMenu(false)
    setPreparingReport(true)
    try {
      await prepareNarrative()
      await ensureReportRendered()
    } catch (err) {
      console.error('[analytics] Error preparing report:', err)
      alert('Failed to prepare the report')
      setShowReport(false)
      return
    } finally {
      setPreparingReport(false)
    }
    const cleanup = () => { setShowReport(false); window.removeEventListener('afterprint', cleanup) }
    window.addEventListener('afterprint', cleanup)
    window.print()
  }

  async function handleDownloadPDF() {
    if (!selectedForm) return
    setExportMenu(false)
    setExportingPdf(true)
    setPdfProgress(null)
    try {
      await prepareNarrative()
      const node = await ensureReportRendered()
      // #report-view is the portal mount; its one child is ReportView's
      // own root — that root's direct children are the actual
      // cover/question/footer blocks getBlocks() paginates on.
      const reportRoot = (node.firstElementChild as HTMLElement) ?? node
      await exportAnalyticsPDF(reportRoot, selectedForm.name, (done, total) => setPdfProgress({ done, total }))
    } catch (err) {
      console.error('[analytics] Error exporting PDF:', err)
      alert('Failed to export PDF')
    } finally {
      setExportingPdf(false)
      setPdfProgress(null)
      setShowReport(false)
    }
  }

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
                const dataEntries  = Object.entries(s.data as Record<string, unknown>).filter(([, v]) => v !== '' && v != null)
                const form         = allForms.find(f => f.id === s.form_id)
                // Prefer form field order over object key order, so "first
                // answer" means the first *question*, not whatever key
                // happened to be inserted first — and look up its type so
                // matrix/rating/multiselect values format cleanly instead
                // of leaking their raw "Row:Score||Row:Score" encoding.
                const firstEntry   = (form?.fields ?? [])
                  .map(f => dataEntries.find(([k]) => k === f.label))
                  .find((e): e is [string, unknown] => !!e) ?? dataEntries[0]
                const firstFieldDef = firstEntry ? form?.fields.find(f => f.label === firstEntry[0]) : undefined
                const firstAnswer  = firstEntry ? formatAnswerPreview(firstEntry[1], firstFieldDef).slice(0, 80) : '—'
                const fieldsCount  = dataEntries.length
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
    const formSubs  = mergedSubs.filter(s => s.form_id === form.id)
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
                formId={form.id}
                merges={merges[field.label] ?? []}
                onMergesChanged={refetchMerges}
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
                  {!selectedForm && (
                    <p className="px-3.5 pb-2 pt-1 text-xs text-gray-400 border-b border-gray-100 dark:border-gray-700 mb-1">
                      Pick a form above to generate its report
                    </p>
                  )}
                  <button
                    onClick={handlePrintReport}
                    disabled={!selectedForm}
                    className="w-full flex items-start gap-2.5 px-3.5 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <FileText size={16} className="text-gray-400 mt-0.5 flex-shrink-0" />
                    <span>
                      <span className="block text-sm font-semibold text-gray-900 dark:text-white">Print report</span>
                      <span className="block text-xs text-gray-400">Full data-analysis report — cover page, per-question charts, via your browser&apos;s print dialog</span>
                    </span>
                  </button>
                  <button
                    onClick={handleDownloadPDF}
                    disabled={!selectedForm || exportingPdf}
                    className="w-full flex items-start gap-2.5 px-3.5 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <FileDown size={16} className="text-gray-400 mt-0.5 flex-shrink-0" />
                    <span>
                      <span className="block text-sm font-semibold text-gray-900 dark:text-white">Download PDF</span>
                      <span className="block text-xs text-gray-400">Same report as a one-click PDF download</span>
                    </span>
                  </button>
                  <label
                    className={`w-full flex items-start gap-2.5 px-3.5 py-2.5 text-left border-t border-gray-100 dark:border-gray-700 mt-1 pt-2.5 ${
                      aiInsightsDisabledReason ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700'
                    } transition-colors`}
                  >
                    <input
                      type="checkbox"
                      checked={includeAiInsights}
                      disabled={!!aiInsightsDisabledReason}
                      onChange={e => setIncludeAiInsights(e.target.checked)}
                      className="mt-1 flex-shrink-0"
                    />
                    <span>
                      <span className="flex items-center gap-1 text-sm font-semibold text-gray-900 dark:text-white">
                        <Sparkles size={14} className="text-brand-500 flex-shrink-0" /> Include Smart Insights
                      </span>
                      <span className="block text-xs text-gray-400">
                        {aiInsightsDisabledReason || 'Adds an executive summary, key insights and recommendations'}
                      </span>
                    </span>
                  </label>
                  <button
                    onClick={() => { exportCSV(mergedSubs, selectedForm); setExportMenu(false) }}
                    className="w-full flex items-start gap-2.5 px-3.5 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <Download size={16} className="text-gray-400 mt-0.5 flex-shrink-0" />
                    <span>
                      <span className="block text-sm font-semibold text-gray-900 dark:text-white">Export CSV</span>
                      <span className="block text-xs text-gray-400">Raw responses, one row per submission</span>
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
          <div className="bg-gray-50 dark:bg-gray-900">
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

      {/* Report for printing/export — portaled to a direct child of <body>
          so print CSS can hide the entire app (including its nested
          overflow-hidden/flex layout) by just hiding body's other direct
          children, instead of chasing every wrapper by tag or class. Kept
          off-canvas (not display:none) so recharts can measure a real
          width and paint before window.print()/html2canvas run. */}
      {showReport && selectedForm && typeof document !== 'undefined' && createPortal(
        <div id="report-view" style={{ position: 'fixed', top: 0, left: '-10000px', width: 794 }}>
          <ReportView form={selectedForm} submissions={mergedSubs} narrative={narrative ?? undefined} />
        </div>,
        document.body
      )}

      {preparingReport && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60]">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl px-6 py-4 flex items-center gap-3">
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-gray-300 border-t-brand-500" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{preparingMessage}</span>
          </div>
        </div>
      )}

      {/* The export menu closes the instant Download PDF is clicked, so
          the "Preparing PDF…" label inside it is invisible for the whole
          export — this overlay is the only feedback the admin actually
          sees while html2canvas works through each chart. */}
      {exportingPdf && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60]">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl px-6 py-4 w-72">
            <div className="flex items-center gap-3 mb-2">
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-gray-300 border-t-brand-500 flex-shrink-0" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                {pdfProgress ? `Rendering charts… ${pdfProgress.done}/${pdfProgress.total}` : 'Preparing PDF…'}
              </span>
            </div>
            {pdfProgress && (
              <div className="h-1.5 w-full bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand-500 transition-all duration-200"
                  style={{ width: `${Math.round((pdfProgress.done / pdfProgress.total) * 100)}%` }}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {narrativeNotice && (
        <div className="fixed bottom-4 right-4 z-[70] bg-white dark:bg-gray-800 border border-amber-200 dark:border-amber-800 rounded-lg shadow-lg px-4 py-3 max-w-sm text-sm text-gray-700 dark:text-gray-200">
          {narrativeNotice}
        </div>
      )}
    </div>
  )
}
