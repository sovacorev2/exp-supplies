'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { type Submission, type Form } from '@/app/actions/forms'
import { Search, Download, RefreshCw, Trash2 } from 'lucide-react'
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
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deletePassword, setDeletePassword] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

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

  async function handleDeleteResponse() {
    if (!selected || !deletePassword.trim()) {
      setDeleteError('Please enter the admin password')
      return
    }

    setDeleting(true)
    setDeleteError('')
    
    try {
      const response = await fetch(`/api/submissions/${selected.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: deletePassword }),
      })

      if (!response.ok) {
        const error = await response.json()
        setDeleteError(error.error || 'Failed to delete response')
        return
      }

      setShowDeleteModal(false)
      setDeletePassword('')
      setSelected(null)
      router.refresh()
    } catch (error) {
      setDeleteError('Error deleting response')
      console.error('[v0] Delete error:', error)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <header className="bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 px-4 md:px-6 py-3 md:py-4 flex flex-col md:flex-row md:items-center md:justify-between flex-shrink-0 shadow-sm gap-3">
        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          <h1 className="font-semibold text-gray-900 dark:text-gray-100 text-base md:text-lg">Responses</h1>
          <span className="text-xs px-3 py-1.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full font-semibold flex-shrink-0">{filtered.length} total</span>
        </div>
        <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
          <button 
            onClick={() => {
              setRefreshing(true)
              router.refresh()
              setTimeout(() => setRefreshing(false), 500)
            }} 
            className="flex-1 md:flex-none btn text-xs md:text-sm py-2 px-3 md:px-4 inline-flex justify-center"
            disabled={refreshing}
            title="Refresh responses"
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            <span className="ml-2">{refreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
          <button onClick={exportCSV} className="flex-1 md:flex-none btn text-xs md:text-sm py-2 px-3 md:px-4 inline-flex justify-center" title="Export to CSV">
            <Download size={16} />
            <span className="ml-2">Export</span>
          </button>
        </div>
      </header>

      {/* Filters - Full width header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 md:px-6 py-4 md:py-5 grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 shadow-sm">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
          <input
            className="input w-full pl-10 h-11 text-sm font-medium border-2 border-gray-200 dark:border-gray-600 focus:border-brand-500 dark:focus:border-brand-400 rounded-lg"
            placeholder="Search by company, email, phone…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-3">
          <select className="input flex-1 h-11 text-sm font-medium border-2 border-gray-200 dark:border-gray-600 focus:border-brand-500 dark:focus:border-brand-400 rounded-lg" value={formId} onChange={e => setFormId(e.target.value)}>
            <option value="">All forms</option>
            {forms.map((f: Form) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
          <span className="text-sm text-gray-600 dark:text-gray-300 font-semibold bg-brand-50 dark:bg-brand-900/30 px-4 py-2.5 rounded-lg border border-brand-100 dark:border-brand-800 whitespace-nowrap flex-shrink-0 min-w-max">
            {filtered.length}
          </span>
        </div>
      </div>

      {/* Main content area - Table takes full width */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Table section */}
        <div className="flex-1 overflow-y-auto overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0 border-b-2 border-gray-200 dark:border-gray-600">
              <tr className="hidden md:table-row">
                <th className="text-left px-4 md:px-6 py-4 text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Response</th>
                <th className="text-left px-4 md:px-6 py-4 text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Preview</th>
                <th className="text-left px-4 md:px-6 py-4 text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Date</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
              {filtered.map((sub: Submission) => {
                const previewText = Object.values(sub.data).slice(0, 2).join(' • ')
                return (
                  <tr
                    key={sub.id}
                    onClick={() => setSelected(sub)}
                    className={`hover:bg-blue-50 dark:hover:bg-gray-700 cursor-pointer transition-colors md:hover:bg-gray-50 md:dark:hover:bg-gray-700 ${selected?.id === sub.id ? 'bg-brand-50 dark:bg-brand-900/20 md:border-l-4 md:border-brand-600' : ''}`}
                  >
                    {/* Mobile Card View */}
                    <td colSpan={3} className="px-4 py-4 md:hidden">
                      <div className="space-y-3">
                        <div className="flex justify-between items-start gap-2">
                          <div className="flex-1">
                            <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">From</p>
                            <p className="font-semibold text-gray-900 dark:text-white text-sm">{sub.forms?.name ?? 'Unknown'}</p>
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap pt-6">
                            {format(new Date(sub.created_at), 'MMM d')}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Response</p>
                          <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2 leading-relaxed">
                            {previewText || '—'}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Desktop Table View */}
                    <td className="hidden md:table-cell px-4 md:px-6 py-4 font-semibold text-gray-900 dark:text-gray-100 text-sm">{sub.forms?.name ?? 'Unknown'}</td>
                    <td className="hidden md:table-cell px-4 md:px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                      <div className="line-clamp-2">
                        {previewText || '—'}
                      </div>
                    </td>
                    <td className="hidden md:table-cell px-4 md:px-6 py-4 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {format(new Date(sub.created_at), 'MMM d, yyyy')}
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 md:px-6 py-16 md:py-24 text-center">
                    <p className="text-gray-500 dark:text-gray-400 font-semibold text-lg">Not available</p>
                    <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
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
          <div className="fixed right-0 top-0 bottom-0 w-full md:w-96 border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-y-auto flex flex-col shadow-2xl z-50">
            <div className="px-4 md:px-6 py-4 md:py-5 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-white dark:bg-gray-800 flex-shrink-0">
              <div className="flex-1 min-w-0">
                <h2 className="font-bold text-gray-900 dark:text-gray-100 text-base md:text-lg truncate">{selected.forms?.name}</h2>
                <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400 mt-1">{format(new Date(selected.created_at), 'PPp')}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg flex-shrink-0 ml-3 text-2xl leading-none">
                ✕
              </button>
            </div>

            <div className="p-4 md:p-6 flex-1 space-y-4 overflow-y-auto">
              {Object.entries(selected.data).map(([key, value]: [string, string]) => {
                const isImageField = key.toLowerCase().includes('image') || key.toLowerCase().includes('photo') || key.toLowerCase().includes('product')
                const isImage = isImageField && typeof value === 'string' && (value.endsWith('.jpg') || value.endsWith('.jpeg') || value.endsWith('.png') || value.endsWith('.gif') || value.endsWith('.webp'))
                
                return (
                  <div key={key} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 border border-gray-100 dark:border-gray-600">
                    <p className="text-xs uppercase tracking-wider text-gray-600 dark:text-gray-400 font-bold mb-3">{key}</p>
                    {isImage ? (
                      <div className="space-y-2">
                        <img 
                          src={`/api/submissions/${selected.id}/image?filename=${encodeURIComponent(value)}`}
                          alt={key}
                          className="max-w-full h-auto rounded-lg border border-gray-200 dark:border-gray-600 max-h-64 object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none'
                          }}
                        />
                        <p className="text-xs text-gray-600 dark:text-gray-400 break-words">{value}</p>
                      </div>
                    ) : (
                      <p className="text-sm md:text-base text-gray-900 dark:text-gray-100 leading-relaxed break-words font-medium">{value || '—'}</p>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="p-4 md:p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex-shrink-0 space-y-3">
              <button 
                onClick={() => {
                  setShowDeleteModal(true)
                  setDeletePassword('')
                  setDeleteError('')
                }}
                className="w-full btn bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 text-red-700 dark:text-red-400 font-semibold py-2 px-4 rounded-lg inline-flex items-center justify-center gap-2 transition-colors"
              >
                <Trash2 size={16} />
                Delete Response
              </button>
              <p className="text-xs text-gray-400 dark:text-gray-500 text-center truncate">
                Response ID: {selected.id.slice(0, 16)}
              </p>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-sm w-full p-6 space-y-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Delete Response</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                  This action cannot be undone. Enter the admin password to confirm deletion.
                </p>
              </div>

              <div className="space-y-2">
                <label className="label text-sm">Admin Password</label>
                <input
                  type="password"
                  className="input w-full"
                  placeholder="Enter admin password"
                  value={deletePassword}
                  onChange={e => setDeletePassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleDeleteResponse()}
                  autoFocus
                />
                {deleteError && (
                  <p className="text-xs text-red-500 dark:text-red-400 mt-2">{deleteError}</p>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowDeleteModal(false)
                    setDeletePassword('')
                    setDeleteError('')
                  }}
                  className="flex-1 btn bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-900 dark:text-white font-semibold py-2 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteResponse}
                  disabled={deleting}
                  className="flex-1 btn bg-red-500 hover:bg-red-600 disabled:bg-red-400 text-white font-semibold py-2 rounded-lg transition-colors"
                >
                  {deleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
