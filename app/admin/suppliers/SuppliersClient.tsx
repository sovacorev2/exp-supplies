'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { type Submission, type Form } from '@/app/actions/forms'
import { Search, X, Download, Check, Ban, Trash2, RefreshCw } from 'lucide-react'
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
  const [search, setSearch]     = useState(defaultCategory ? '' : '')
  const [category, setCategory] = useState(defaultCategory ?? '')
  const [status, setStatus]     = useState(defaultStatus ?? '')
  const [formId, setFormId]     = useState(defaultFormId ?? '')
  const [selected, setSelected] = useState<Submission | null>(null)
  const [acting, setActing]     = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  // Auto-refresh every 10 seconds for real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      router.refresh()
    }, 10000)
    return () => clearInterval(interval)
  }, [router])

  const categories = useMemo<string[]>(() => {
    const cats = new Set(
      submissions
        .map((s: Submission) => s.forms?.category)
        .filter((c): c is string => Boolean(c))
    )
    return Array.from(cats)
  }, [submissions])

  const filtered = useMemo<Submission[]>(() => {
    return submissions.filter((s: Submission) => {
      const text        = Object.values(s.data).join(' ').toLowerCase()
      const matchSearch = !search   || text.includes(search.toLowerCase())
      const matchCat    = !category || s.forms?.category === category
      const matchStatus = !status   || s.status === status
      const matchForm   = !formId   || s.form_id === formId
      return matchSearch && matchCat && matchStatus && matchForm
    })
  }, [submissions, search, category, status, formId])

  async function handleStatus(sub: Submission, newStatus: 'approved' | 'rejected' | 'pending') {
    setActing(true)
    await fetch(`/api/submissions/${sub.id}/status`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: newStatus }) })
    setActing(false)
    router.refresh()
    setSelected(null)
  }

  async function handleDelete(sub: Submission) {
    if (!confirm('Remove this supplier permanently?')) return
    setActing(true)
    await fetch(`/api/submissions/${sub.id}/status`, { method: "DELETE" })
    setActing(false)
    router.refresh()
    setSelected(null)
  }

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
          <div className="bg-white border-b border-gray-100 px-5 py-3 flex items-center gap-3">
            <div className="relative flex-1 max-w-xs">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                className="input pl-8 h-8 text-xs"
                placeholder="Search suppliers…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <select className="input h-8 text-xs w-36" value={category} onChange={e => setCategory(e.target.value)}>
              <option value="">All categories</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select className="input h-8 text-xs w-32" value={status} onChange={e => setStatus(e.target.value)}>
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
            <select className="input h-8 text-xs w-44" value={formId} onChange={e => setFormId(e.target.value)}>
              <option value="">All forms</option>
              {forms.map((f: Form) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
            <span className="text-xs text-gray-400 ml-auto">
              {filtered.length} result{filtered.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Company</th>
                  <th className="text-left px-3 py-3 text-xs font-medium text-gray-500">Category</th>
                  <th className="text-left px-3 py-3 text-xs font-medium text-gray-500">Contact</th>
                  <th className="text-left px-3 py-3 text-xs font-medium text-gray-500">Location</th>
                  <th className="text-left px-3 py-3 text-xs font-medium text-gray-500">Status</th>
                  <th className="text-left px-3 py-3 text-xs font-medium text-gray-500">Date</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-50">
                {filtered.map((sub: Submission) => (
                  <tr
                    key={sub.id}
                    onClick={() => setSelected(sub)}
                    className={clsx(
                      'hover:bg-gray-50 cursor-pointer transition-colors',
                      selected?.id === sub.id && 'bg-brand-50'
                    )}
                  >
                    <td className="px-5 py-3 font-medium">{sub.data['Company name'] ?? '—'}</td>
                    <td className="px-3 py-3 text-xs text-gray-500">{sub.forms?.category}</td>
                    <td className="px-3 py-3 text-xs text-gray-500">{sub.data['Contact person'] ?? '—'}</td>
                    <td className="px-3 py-3 text-xs text-gray-500">
                      {sub.data['County / location'] ?? sub.data['Counties you operate in'] ?? '—'}
                    </td>
                    <td className="px-3 py-3">
                      <span className={`badge badge-${sub.status}`}>{sub.status}</span>
                    </td>
                    <td className="px-3 py-3 text-xs text-gray-400">
                      {format(new Date(sub.created_at), 'MMM d, yyyy')}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-16 text-center text-gray-400 text-sm">
                      No suppliers match your filters
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="w-80 flex-shrink-0 border-l border-gray-100 bg-white overflow-y-auto flex flex-col">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-sm">{selected.data['Company name']}</h2>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600">
                <X size={16} />
              </button>
            </div>

            <div className="p-5 flex-1 space-y-4">
              <div>
                <span className={`badge badge-${selected.status} text-xs`}>{selected.status}</span>
                <span className="ml-2 text-xs text-gray-400">{selected.forms?.name}</span>
              </div>
              <div className="space-y-3">
                {Object.entries(selected.data).map(([key, value]: [string, string]) => (
                  <div key={key}>
                    <p className="text-[10px] uppercase tracking-wider text-gray-400 font-medium mb-0.5">{key}</p>
                    <p className="text-sm text-gray-800 leading-relaxed">{value || '—'}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-400">
                Submitted {format(new Date(selected.created_at), 'PPp')}
              </p>
            </div>

            <div className="p-4 border-t border-gray-100 space-y-2">
              {selected.status !== 'approved' && (
                <button
                  onClick={() => handleStatus(selected, 'approved')}
                  disabled={acting}
                  className="btn btn-primary w-full justify-center text-xs py-2"
                >
                  <Check size={14} /> Approve supplier
                </button>
              )}
              {selected.status !== 'rejected' && (
                <button
                  onClick={() => handleStatus(selected, 'rejected')}
                  disabled={acting}
                  className="btn w-full justify-center text-xs py-2 text-amber-700 border-amber-200 hover:bg-amber-50"
                >
                  <Ban size={14} /> Reject
                </button>
              )}
              {selected.status !== 'pending' && (
                <button
                  onClick={() => handleStatus(selected, 'pending')}
                  disabled={acting}
                  className="btn w-full justify-center text-xs py-2"
                >
                  Mark as pending
                </button>
              )}
              <button
                onClick={() => handleDelete(selected)}
                disabled={acting}
                className="btn btn-danger w-full justify-center text-xs py-2"
              >
                <Trash2 size={14} /> Delete
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
