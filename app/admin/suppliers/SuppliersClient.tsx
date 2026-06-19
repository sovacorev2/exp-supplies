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
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo]     = useState('')

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
      
      const submittedDate = new Date(s.created_at).toDateString()
      const matchDateFrom = !dateFrom || new Date(s.created_at) >= new Date(dateFrom)
      const matchDateTo   = !dateTo || new Date(s.created_at) <= new Date(dateTo + 'T23:59:59')
      
      return matchSearch && matchForm && matchDateFrom && matchDateTo
    })
  }, [submissions, search, formId, dateFrom, dateTo])




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

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Filters */}
          <div className="bg-white border-b border-gray-100 px-5 py-4 space-y-3">
            <div className="flex items-center gap-3">
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
              <span className="text-xs text-gray-500 font-medium">
                {filtered.length} response{filtered.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <label className="text-xs font-medium text-gray-600">From:</label>
              <input
                type="date"
                className="input h-8 text-xs"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
              />
              <label className="text-xs font-medium text-gray-600">To:</label>
              <input
                type="date"
                className="input h-8 text-xs"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
              />
              {(dateFrom || dateTo) && (
                <button
                  onClick={() => {
                    setDateFrom('')
                    setDateTo('')
                  }}
                  className="text-xs text-blue-600 hover:text-blue-700 ml-auto font-medium"
                >
                  Clear dates
                </button>
              )}
            </div>
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
                    onClick={() => router.push(`/admin/suppliers?form=${sub.form_id}`)}
                    className="hover:bg-blue-50 cursor-pointer transition-colors"
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


      </div>
    </>
  )
}
