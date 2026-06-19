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

      {/* Filters - Full width header */}
      <div className="bg-white border-b border-gray-200 px-6 py-5 grid grid-cols-2 gap-4 shadow-sm items-center">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="input w-full pl-10 h-11 text-sm font-medium border-2 border-gray-200 focus:border-brand-500"
            placeholder="Search by company name, email, phone…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-3">
          <select className="input flex-1 h-11 text-sm font-medium border-2 border-gray-200 focus:border-brand-500" value={formId} onChange={e => setFormId(e.target.value)}>
            <option value="">All forms</option>
            {forms.map((f: Form) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
          <span className="text-sm text-gray-600 font-semibold bg-brand-50 px-3 py-2 rounded-lg border border-brand-100 whitespace-nowrap">
            {filtered.length}
          </span>
        </div>
      </div>

      {/* Main content area - Table takes full width */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Table section */}
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
                  className={`hover:bg-blue-50 cursor-pointer transition-colors ${selected?.id === sub.id ? 'bg-brand-50 border-l-4 border-brand-600' : ''}`}
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
                  <td colSpan={3} className="px-5 py-16 text-center">
                    <p className="text-gray-500 font-medium">Not available</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {search || formId ? 'No responses match your search or filters' : 'No responses yet'}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Detail panel - Fixed position overlay on right */}
        {selected && (
          <div className="fixed right-0 top-0 bottom-0 w-96 border-l border-gray-200 bg-gradient-to-b from-white to-gray-50 overflow-y-auto flex flex-col shadow-xl">
            <div className="px-6 py-5 border-b border-gray-200 flex items-center justify-between bg-white flex-shrink-0">
              <div>
                <h2 className="font-bold text-gray-900">{selected.forms?.name}</h2>
                <p className="text-xs text-gray-500 mt-1">{format(new Date(selected.created_at), 'PPp')}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-100 rounded-lg flex-shrink-0">
                ✕
              </button>
            </div>

            <div className="p-6 flex-1 space-y-5 overflow-y-auto">
              {Object.entries(selected.data).map(([key, value]: [string, string]) => (
                <div key={key} className="bg-white rounded-lg p-4 border border-gray-100">
                  <p className="text-[11px] uppercase tracking-wider text-gray-500 font-bold mb-2">{key}</p>
                  <p className="text-sm text-gray-800 leading-relaxed break-words">{value || '—'}</p>
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-gray-200 bg-white flex-shrink-0">
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
