'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { type Submission, type Form } from '@/app/actions/forms'
import { Search, X, Download, RefreshCw } from 'lucide-react'
import { format } from 'date-fns'
import clsx from 'clsx'

export default function SuppliersClient({
  submissions,
  forms,
  defaultCategory,
  defaultStatus,
  defaultFormId,
}: {
  submissions: Submission[]
  forms: Form[]
  defaultCategory?: string
  defaultStatus?: string
  defaultFormId?: string
}) {
  const router = useRouter()
  const [search, setSearch]     = useState('')
  const [formId, setFormId]     = useState(defaultFormId ?? '')
  const [selected, setSelected] = useState<Submission | null>(null)
  const [refreshing, setRefreshing] = useState(false)

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
      ['Status', 'Form', ...keys, 'Submitted'],
      ...filtered.map((s: Submission) => [
        s.status,
        s.forms?.name ?? '',
        ...keys.map(k => s.data[k] ?? ''),
        format(new Date(s.created_at), 'yyyy-MM-dd'),
      ]),
    ]
    const csv = rows
      .map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `suppliers-${format(new Date(), 'yyyyMMdd')}.csv`
    a.click()
  }

  return (
    <>
      <header className="bg-white border-b border-gray-100 px-6 h-14 flex items-center justify-between flex-shrink-0 shadow-sm">
        <div className="flex items-center gap-3">
          <h1 className="font-semibold text-gray-900">Responses</h1>
          <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full font-semibold">{filtered.length} total</span>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => {
              setRefreshing(true)
              router.refresh()
              setTimeout(() => setRefreshing(false), 500)
            }} 
            className="btn text-xs py-1.5 px-3"
            disabled={refreshing}
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} /> {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
          <button onClick={exportCSV} className="btn text-xs py-1.5 px-3">
            <Download size={13} /> Export CSV
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Filters */}
          <div className="bg-white border-b border-gray-100 px-5 py-4 flex items-center gap-3">
            <div className="relative flex-1 max-w-xs">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                className="input pl-8 h-8 text-xs"
                placeholder="Search responses…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <select className="input h-8 text-xs" value={formId} onChange={e => setFormId(e.target.value)}>
              <option value="">All forms</option>
              {forms.map((f: Form) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
            <span className="text-xs text-gray-500 ml-auto font-medium">
              {filtered.length} response{filtered.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0 border-b border-gray-200">
                <tr>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-700">Form</th>
                  <th className="text-left px-3 py-3 text-xs font-semibold text-gray-700">Preview</th>
                  <th className="text-left px-3 py-3 text-xs font-semibold text-gray-700">Submitted</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {filtered.map((sub: Submission) => (
                  <tr
                    key={sub.id}
                    onClick={() => setSelected(sub)}
                    className={clsx(
                      'hover:bg-blue-50 cursor-pointer transition-colors',
                      selected?.id === sub.id && 'bg-brand-50 border-l-4 border-brand-600'
                    )}
                  >
                    <td className="px-5 py-4 font-medium text-gray-900">{sub.forms?.name ?? 'Unknown'}</td>
                    <td className="px-3 py-4 text-xs text-gray-600">
                      <div className="line-clamp-1">
                        {Object.values(sub.data).slice(0, 3).join(' • ')}
                      </div>
                    </td>
                    <td className="px-3 py-4 text-xs text-gray-500">
                      {format(new Date(sub.created_at), 'MMM d, yyyy h:mm a')}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-5 py-16 text-center text-gray-400 text-sm">
                      No responses yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="w-96 flex-shrink-0 border-l border-gray-200 bg-gradient-to-b from-white to-gray-50 overflow-y-auto flex flex-col shadow-lg">
            <div className="px-6 py-5 border-b border-gray-200 flex items-center justify-between bg-white">
              <div>
                <h2 className="font-bold text-gray-900">{selected.forms?.name}</h2>
                <p className="text-xs text-gray-500 mt-1">{format(new Date(selected.created_at), 'PPp')}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-100 rounded-lg">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 flex-1 space-y-5">
              {Object.entries(selected.data).map(([key, value]: [string, string]) => (
                <div key={key} className="bg-white rounded-lg p-4 border border-gray-100">
                  <p className="text-[11px] uppercase tracking-wider text-gray-500 font-bold mb-2">{key}</p>
                  <p className="text-sm text-gray-800 leading-relaxed break-words">{value || '—'}</p>
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-gray-200 bg-white">
              <p className="text-xs text-gray-400 text-center">
                Response ID: {selected.id.slice(0, 8)}...
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
