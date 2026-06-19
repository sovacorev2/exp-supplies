'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { type Submission, type Form } from '@/app/actions/forms'
import { Search, Download, RefreshCw } from 'lucide-react'
import { format } from 'date-fns'

export default function SuppliersClient({
  submissions,
  forms,
  defaultFormId,
}: {
  submissions: Submission[]
  forms: Form[]
  defaultFormId?: string
}) {
  const router = useRouter()
  const [search, setSearch]     = useState('')
  const [formId, setFormId]     = useState(defaultFormId ?? '')
  const [refreshing, setRefreshing] = useState(false)
  const [selected, setSelected] = useState<Submission | null>(null)

  // Auto-refresh every 10 seconds for real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      router.refresh()
    }, 10000)
    return () => clearInterval(interval)
  }, [router])

  const filtered = useMemo<Submission[]>(() => {
    return submissions.filter((s: Submission) => {
      const text        = Object.values(s.data).join(' ').toLowerCase()
      const matchSearch = !search || text.includes(search.toLowerCase())
      const matchForm   = !formId || s.form_id === formId
      return matchSearch && matchForm
    })
  }, [submissions, search, formId])




  function exportCSV() {
    if (!filtered.length) return
    const keys = Array.from(new Set(filtered.flatMap((s: Submission) => Object.keys(s.data))))
    const rows: string[][] = [
      ['Form', ...keys, 'Submitted'],
      ...filtered.map((s: Submission) => [
        s.forms?.name ?? '',
        ...keys.map(k => s.data[k] ?? ''),
        format(new Date(s.created_at), 'yyyy-MM-dd HH:mm'),
      ]),
    ]
    const csv = rows
      .map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `responses-${format(new Date(), 'yyyyMMdd-HHmm')}.csv`
    a.click()
  }

  return (
    <>
      <header className="bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 px-3 md:px-6 h-12 md:h-14 flex items-center justify-between flex-shrink-0 shadow-sm">
        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          <h1 className="font-semibold text-gray-900 dark:text-gray-100 text-sm md:text-base">Responses</h1>
          <span className="text-xs px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full font-semibold flex-shrink-0">{filtered.length}</span>
        </div>
        <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
          <button 
            onClick={() => {
              setRefreshing(true)
              router.refresh()
              setTimeout(() => setRefreshing(false), 500)
            }} 
            className="btn text-xs py-1.5 px-2 md:px-3"
            disabled={refreshing}
            title="Refresh responses"
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            <span className="hidden md:inline">{refreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
          <button onClick={exportCSV} className="btn text-xs py-1.5 px-2 md:px-3" title="Export to CSV">
            <Download size={13} />
            <span className="hidden md:inline">CSV</span>
          </button>
        </div>
      </header>

      {/* Filters - Full width header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-3 md:px-6 py-3 md:py-5 grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 shadow-sm items-center">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
          <input
            className="input w-full pl-10 h-10 md:h-11 text-xs md:text-sm font-medium border-2 border-gray-200 dark:border-gray-600 focus:border-brand-500 dark:focus:border-brand-400"
            placeholder="Search..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 md:gap-3">
          <select className="input flex-1 h-10 md:h-11 text-xs md:text-sm font-medium border-2 border-gray-200 dark:border-gray-600 focus:border-brand-500 dark:focus:border-brand-400" value={formId} onChange={e => setFormId(e.target.value)}>
            <option value="">All forms</option>
            {forms.map((f: Form) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
          <span className="text-xs md:text-sm text-gray-600 dark:text-gray-300 font-semibold bg-brand-50 dark:bg-brand-900/30 px-2 md:px-3 py-2 rounded-lg border border-brand-100 dark:border-brand-800 whitespace-nowrap flex-shrink-0">
            {filtered.length}
          </span>
        </div>
      </div>

      {/* Main content area - Table takes full width */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Table section */}
        <div className="flex-1 overflow-y-auto overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0 border-b border-gray-200 dark:border-gray-600">
              <tr>
                <th className="text-left px-3 md:px-5 py-3 text-xs font-semibold text-gray-700 dark:text-gray-300">Form</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-gray-700 dark:text-gray-300 hidden md:table-cell">Preview</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-gray-700 dark:text-gray-300">Submitted</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
              {filtered.map((sub: Submission) => (
                <tr
                  key={sub.id}
                  onClick={() => setSelected(sub)}
                  className={`hover:bg-blue-50 dark:hover:bg-gray-700 cursor-pointer transition-colors ${selected?.id === sub.id ? 'bg-brand-50 dark:bg-brand-900/20 border-l-4 border-brand-600' : ''}`}
                >
                  <td className="px-3 md:px-5 py-3 md:py-4 font-medium text-gray-900 dark:text-gray-100 text-xs md:text-sm">{sub.forms?.name ?? 'Unknown'}</td>
                  <td className="px-3 py-3 md:py-4 text-xs text-gray-600 dark:text-gray-400 hidden md:table-cell">
                    <div className="line-clamp-1">
                      {Object.values(sub.data).slice(0, 3).join(' • ')}
                    </div>
                  </td>
                  <td className="px-3 py-3 md:py-4 text-xs text-gray-500 dark:text-gray-400">
                    {format(new Date(sub.created_at), 'MMM d')}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-3 md:px-5 py-12 md:py-16 text-center">
                    <p className="text-gray-500 dark:text-gray-400 font-medium">Not available</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      {search || formId ? 'No responses match' : 'No responses yet'}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Detail panel - Fixed position overlay on right */}
        {selected && (
          <div className="fixed right-0 top-0 bottom-0 w-full md:w-96 border-l border-gray-200 dark:border-gray-700 bg-gradient-to-b from-white dark:from-gray-800 to-gray-50 dark:to-gray-900 overflow-y-auto flex flex-col shadow-xl z-50">
            <div className="px-4 md:px-6 py-4 md:py-5 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-white dark:bg-gray-800 flex-shrink-0">
              <div className="flex-1 min-w-0">
                <h2 className="font-bold text-gray-900 dark:text-gray-100 text-sm md:text-base truncate">{selected.forms?.name}</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{format(new Date(selected.created_at), 'MMM d, yyyy')}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg flex-shrink-0 ml-2">
                ✕
              </button>
            </div>

            <div className="p-4 md:p-6 flex-1 space-y-3 md:space-y-5 overflow-y-auto">
              {Object.entries(selected.data).map(([key, value]: [string, string]) => (
                <div key={key} className="bg-white dark:bg-gray-700 rounded-lg p-3 md:p-4 border border-gray-100 dark:border-gray-600">
                  <p className="text-[10px] md:text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-400 font-bold mb-2">{key}</p>
                  <p className="text-xs md:text-sm text-gray-800 dark:text-gray-200 leading-relaxed break-words">{value || '—'}</p>
                </div>
              ))}
            </div>

            <div className="p-3 md:p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex-shrink-0">
              <p className="text-xs text-gray-400 dark:text-gray-500 text-center truncate">
                ID: {selected.id.slice(0, 12)}...
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
