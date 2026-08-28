'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { type Submission, type Form } from '@/app/actions/forms'
import { Search, Download, RefreshCw, Trash2, ExternalLink } from 'lucide-react'
import { format } from 'date-fns'
import { exportCSV, formatAnswerPreview } from '@/lib/analytics'

export default function SuppliersClient({
  submissions,
  forms,
  defaultFormId,
  currentUser,
}: {
  submissions: Submission[]
  forms: Form[]
  defaultFormId?: string
  currentUser: { id: string; role: string }
}) {
  const router = useRouter()
  const [search, setSearch]     = useState('')
  const [formId, setFormId]     = useState(defaultFormId ?? '')
  const [refreshing, setRefreshing] = useState(false)
  const [selected, setSelected] = useState<Submission | null>(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [excludedDates, setExcludedDates] = useState<Set<string>>(new Set())

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

  // Calculate summary statistics
  const summary = useMemo(() => {
    const stats = {
      totalAdults: 0,
      totalChildren: 0,
      // Whether this form actually has adult/children headcount fields at
      // all (not just whether any response summed to >0) — the RSVP-style
      // dashboard below only makes sense for forms shaped like an event
      // headcount planner. A generic form that merely has *a* field with
      // "date" in its label (a delivery date, an activation date, etc.)
      // isn't one, even though it'd otherwise populate dateBreakdown too.
      hasHeadcountFields: false,
      dateBreakdown: {} as Record<string, { count: number, adults: number, children: number, firstChoiceVotes: number }>,
      preferredDate: '',
      preferredDateHeadcount: 0,
      selectedAllDatesCount: 0,
      noneOfTheDates: { count: 0, adults: 0, children: 0, respondents: [] as Array<{ name: string, reason: string, adults: number, children: number }> },
    }

    filtered.forEach(sub => {
      const data = sub.data

      // Find count fields - strict matching to avoid false positives
      const adultField = Object.entries(data).find(([key, val]) =>
        (key.toLowerCase().includes('adult') && (key.toLowerCase().includes('count') || key.toLowerCase().includes('number')))
      )
      const adultCountParsed = adultField ? parseInt(adultField[1]) : 0
      const adultCount = !isNaN(adultCountParsed) && adultCountParsed >= 0 ? Math.max(0, adultCountParsed) : 0
      if (adultCount > 0) stats.totalAdults += adultCount

      const childField = Object.entries(data).find(([key, val]) =>
        (key.toLowerCase().includes('child') && (key.toLowerCase().includes('count') || key.toLowerCase().includes('number')))
      )
      const childCountParsed = childField ? parseInt(childField[1]) : 0
      const childCount = !isNaN(childCountParsed) && childCountParsed >= 0 ? Math.max(0, childCountParsed) : 0
      if (childCount > 0) stats.totalChildren += childCount

      if (adultField || childField) stats.hasHeadcountFields = true
      
      // Track date availability - works for single OR multiple dates
      const dateField = Object.entries(data).find(([key, val]) =>
        key.toLowerCase().includes('date') && typeof val === 'string' && val.trim() !== ''
      )
      
      if (dateField && dateField[1].trim()) {
        // Split on || for multiselect, or treat as single date
        const dates = dateField[1].includes('||')
          ? dateField[1].split('||').map(d => d.trim()).filter(Boolean)
          : [dateField[1].trim()].filter(Boolean)
        
        if (dates.length > 0) {
          // Filter out excluded dates to see what's actually available
          const availableDates = dates.filter(d => !excludedDates.has(d))
          
          if (availableDates.length > 0) {
            // Has available dates - add to breakdown
            availableDates.forEach(date => {
              if (!stats.dateBreakdown[date]) {
                stats.dateBreakdown[date] = { count: 0, adults: 0, children: 0, firstChoiceVotes: 0 }
              }
              stats.dateBreakdown[date].count += 1
              // Add full headcount to every date this person is available for
              stats.dateBreakdown[date].adults += adultCount
              stats.dateBreakdown[date].children += childCount
            })
          } else {
            // All selected dates are excluded - treat as cannot attend
            stats.noneOfTheDates.count += 1
            stats.noneOfTheDates.adults += adultCount
            stats.noneOfTheDates.children += childCount
            
            // Get respondent name and reason
            const nameField = Object.entries(data).find(([key]) => 
              key.toLowerCase().includes('name') || key.toLowerCase().includes('respondent') || key.toLowerCase().includes('person')
            )
            const reasonField = Object.entries(data).find(([key]) => 
              key.toLowerCase().includes('reason') || key.toLowerCase().includes('note') || key.toLowerCase().includes('why')
            )
            
            stats.noneOfTheDates.respondents.push({
              name: nameField ? String(nameField[1]) : 'Unknown',
              reason: reasonField ? String(reasonField[1]) : `Selected dates have scheduling conflicts (${dates.join(', ')})`,
              adults: adultCount,
              children: childCount
            })
          }
        } else {
          // No dates selected - add to "none of the dates"
          stats.noneOfTheDates.count += 1
          stats.noneOfTheDates.adults += adultCount
          stats.noneOfTheDates.children += childCount
          
          // Get respondent name and reason
          const nameField = Object.entries(data).find(([key]) => 
            key.toLowerCase().includes('name') || key.toLowerCase().includes('respondent') || key.toLowerCase().includes('person')
          )
          const reasonField = Object.entries(data).find(([key]) => 
            key.toLowerCase().includes('reason') || key.toLowerCase().includes('note') || key.toLowerCase().includes('why')
          )
          
          stats.noneOfTheDates.respondents.push({
            name: nameField ? String(nameField[1]) : 'Unknown',
            reason: reasonField ? String(reasonField[1]) : 'No reason provided',
            adults: adultCount,
            children: childCount
          })
        }
      } else {
        // No date field or empty date field - add to "none of the dates"
        stats.noneOfTheDates.count += 1
        stats.noneOfTheDates.adults += adultCount
        stats.noneOfTheDates.children += childCount
        
        // Get respondent name and reason
        const nameField = Object.entries(data).find(([key]) => 
          key.toLowerCase().includes('name') || key.toLowerCase().includes('respondent') || key.toLowerCase().includes('person')
        )
        const reasonField = Object.entries(data).find(([key]) => 
          key.toLowerCase().includes('reason') || key.toLowerCase().includes('note') || key.toLowerCase().includes('why')
        )
        
        stats.noneOfTheDates.respondents.push({
          name: nameField ? String(nameField[1]) : 'Unknown',
          reason: reasonField ? String(reasonField[1]) : 'No reason provided',
          adults: adultCount,
          children: childCount
        })
      }
      
      // Track first choice votes
      const firstChoiceField = Object.entries(data).find(([key]) =>
        (key.toLowerCase().includes('choice') || key.toLowerCase().includes('preference')) && 
        key.toLowerCase().includes('date')
      )
      if (firstChoiceField && stats.dateBreakdown[firstChoiceField[1]]) {
        stats.dateBreakdown[firstChoiceField[1]].firstChoiceVotes += 1
      }
    })
    
    // Find winning date: most availability count, tiebreak by first-choice votes (exclude conflict dates)
    let maxCount = 0
    Object.entries(stats.dateBreakdown).forEach(([date, data]) => {
      if (!excludedDates.has(date)) {
        if (data.count > maxCount || (data.count === maxCount && data.firstChoiceVotes > (stats.dateBreakdown[stats.preferredDate]?.firstChoiceVotes || 0))) {
          maxCount = data.count
          stats.preferredDate = date
          stats.preferredDateHeadcount = data.adults + data.children
        }
      }
    })
    
    return stats
  }, [filtered, excludedDates])




  function handleExportCSV() {
    // Only pass the form definition (for question-order headers) when a
    // single form is selected — mixed forms have no single field order.
    const selectedForm = formId ? forms.find((f: Form) => f.id === formId) : undefined
    exportCSV(filtered, selectedForm)
  }

  async function handleDeleteResponse() {
    if (!selected) return

    setDeleting(true)
    setDeleteError('')

    try {
      const response = await fetch(`/api/submissions/${selected.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        setDeleteError(error.error || 'Failed to delete response')
        return
      }

      setShowDeleteModal(false)
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
    <div className="h-full flex flex-col overflow-y-auto">
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
          <button onClick={handleExportCSV} className="flex-1 md:flex-none btn text-xs md:text-sm py-2 px-3 md:px-4 inline-flex justify-center" title="Export to CSV">
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

      {/* Summary Dashboard - Only show if the form actually has Adult/Children
          count fields. Dates alone used to be enough to trigger this (any
          field with "date" in its label), which showed this RSVP-style
          headcount dashboard on completely unrelated forms that just happen
          to ask for *a* date (an activation date, a delivery date, etc.). */}
      {filtered.length > 0 && summary.hasHeadcountFields && (
        <>
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-700 dark:to-gray-600 border-b border-blue-200 dark:border-gray-600 px-4 md:px-6 py-4 grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-3 md:p-4 border border-blue-100 dark:border-gray-600">
              <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-1">Total Adults</p>
              <p className="text-2xl md:text-3xl font-bold text-blue-600 dark:text-blue-400">{summary.totalAdults}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-3 md:p-4 border border-indigo-100 dark:border-gray-600">
              <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-1">Total Children</p>
              <p className="text-2xl md:text-3xl font-bold text-indigo-600 dark:text-indigo-400">{summary.totalChildren}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-3 md:p-4 border border-green-100 dark:border-gray-600">
              <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-1">Total Responses</p>
              <p className="text-2xl md:text-3xl font-bold text-green-600 dark:text-green-400">{filtered.length}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-3 md:p-4 border border-purple-100 dark:border-gray-600">
              <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-1">Dates</p>
              <p className="text-2xl md:text-3xl font-bold text-purple-600 dark:text-purple-400">{Object.keys(summary.dateBreakdown).length}</p>
            </div>
          </div>

          {/* Winning Date Alert - Always show if dates exist */}
          {summary.preferredDate && (() => {
            const winningDateData = summary.dateBreakdown[summary.preferredDate]
            const hasExcludedDates = excludedDates.size > 0
            return (
              <div className="bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 px-4 md:px-6 py-3">
                <p className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-2">Winning Date (Most Selections){hasExcludedDates && ' - Excluding Conflicts'}</p>
                <p className="text-lg font-bold text-amber-900 dark:text-amber-100">{summary.preferredDate}</p>
                <div className="flex gap-4 mt-2 text-sm text-amber-700 dark:text-amber-300">
                  {winningDateData?.firstChoiceVotes > 0 && (
                    <span><strong>{winningDateData.firstChoiceVotes}</strong> first-choice votes</span>
                  )}
                  {summary.preferredDateHeadcount > 0 && (
                    <span><strong>{summary.preferredDateHeadcount}</strong> headcount</span>
                  )}
                </div>
                {hasExcludedDates && (
                  <p className="text-xs mt-2 text-amber-600 dark:text-amber-500">({excludedDates.size} date{excludedDates.size !== 1 ? 's' : ''} excluded from calculation)</p>
                )}
              </div>
            )
          })()}

          {/* None of the dates section */}
          {summary.noneOfTheDates.count > 0 && (
            <div className="bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800 px-4 md:px-6 py-4">
              <p className="text-xs font-bold text-red-700 dark:text-red-400 uppercase tracking-wider mb-3">Cannot Attend Any Date</p>
              <div className="flex gap-4 text-sm text-red-700 dark:text-red-300 mb-3">
                <span><strong>{summary.noneOfTheDates.count}</strong> respondent{summary.noneOfTheDates.count !== 1 ? 's' : ''}</span>
                {summary.noneOfTheDates.adults > 0 && <span><strong>{summary.noneOfTheDates.adults}</strong> adults</span>}
                {summary.noneOfTheDates.children > 0 && <span><strong>{summary.noneOfTheDates.children}</strong> children</span>}
              </div>
              <div className="space-y-2 text-sm">
                {summary.noneOfTheDates.respondents.map((resp, idx) => (
                  <div key={idx} className="bg-white/50 dark:bg-gray-800/50 rounded p-2 border-l-2 border-red-300 dark:border-red-700">
                    <p className="font-semibold text-red-900 dark:text-red-100">{resp.name} {resp.adults > 0 || resp.children > 0 ? `(${resp.adults + resp.children} people)` : ''}</p>
                    <p className="text-xs text-red-700 dark:text-red-400 mt-1">{resp.reason}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Date Breakdown - Show for any dates found */}
          {Object.keys(summary.dateBreakdown).length > 0 && (
            <div className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 px-4 md:px-6 py-4">
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Date Breakdown</p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {Object.entries(summary.dateBreakdown)
                  .filter(([, stats]) => stats.count > 0)
                  .sort((a, b) => b[1].firstChoiceVotes - a[1].firstChoiceVotes)
                  .map(([date, stats]) => (
                    <div key={date} className={`bg-white dark:bg-gray-800 rounded p-3 border ${excludedDates.has(date) ? 'border-red-300 dark:border-red-700 opacity-50' : 'border-gray-200 dark:border-gray-600'}`}>
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{date}</p>
                          <div className="space-y-1 mt-2 text-xs text-gray-600 dark:text-gray-400">
                            <div><strong className="text-gray-900 dark:text-gray-100">{stats.count}</strong> available {stats.firstChoiceVotes > 0 && <span>| <strong className="text-blue-600 dark:text-blue-400">{stats.firstChoiceVotes}</strong> 1st choice</span>}</div>
                            <div><strong className="text-gray-900 dark:text-gray-100">{stats.adults}</strong> adults, <strong className="text-gray-900 dark:text-gray-100">{stats.children}</strong> children</div>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            const newExcluded = new Set(excludedDates)
                            if (newExcluded.has(date)) {
                              newExcluded.delete(date)
                            } else {
                              newExcluded.add(date)
                            }
                            setExcludedDates(newExcluded)
                          }}
                          className={`px-2 py-1 rounded text-xs font-semibold transition-colors whitespace-nowrap flex-shrink-0 ${
                            excludedDates.has(date)
                              ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/50'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                          }`}
                        >
                          {excludedDates.has(date) ? 'Undo' : 'Exclude'}
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Main content area - Table takes full width */}
      <div className="flex-1 relative">
        {/* Table section */}
        <div className="w-full overflow-x-auto">
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
                const subForm = forms.find(f => f.id === sub.form_id)
                const previewText = Object.entries(sub.data)
                  .filter(([, v]) => v !== '' && v != null)
                  .slice(0, 2)
                  .map(([key, value]) => formatAnswerPreview(value, subForm?.fields.find(f => f.label === key)))
                  .join(' • ')
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
        {selected && (() => {
          const selectedForm = forms.find(f => f.id === selected.form_id)
          // A collaborator gets full review access to a shared form, but
          // deleting a response is destructive and permanent — reserved
          // for the actual owner (or a super-admin), not extended to
          // "everything" a collaborator can do.
          const canDelete = currentUser.role === 'admin' || selectedForm?.user_id === currentUser.id
          return (
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
                const formDef = forms.find(f => f.id === selected.form_id)
                const fieldDef = formDef?.fields.find(fld => fld.label === key)

                const isImageField = key.toLowerCase().includes('image') || key.toLowerCase().includes('photo') || key.toLowerCase().includes('product') || key.toLowerCase().includes('supply')
                const isImageUrl = isImageField && typeof value === 'string' && value.startsWith('https://')

                // Detect and format multiselect/checkbox fields (|| separated values)
                const isMultiselect = typeof value === 'string' && value.includes('||')
                const items = isMultiselect ? value.split('||').map(v => v.trim()).filter(Boolean) : []

                const matrixRows = fieldDef?.type === 'matrix'
                  ? (value || '').split('||').filter(Boolean).map(pair => {
                      const [row, score] = pair.split(':')
                      return { row, score }
                    })
                  : []

                return (
                  <div key={key} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 border border-gray-100 dark:border-gray-600">
                    <p className="text-xs uppercase tracking-wider text-gray-600 dark:text-gray-400 font-bold mb-3">{key}</p>
                    {fieldDef?.type === 'rating' ? (
                      <p className="text-sm md:text-base text-gray-900 dark:text-gray-100 font-medium">
                        {value || '—'} / {fieldDef.maxValue ?? 5}
                      </p>
                    ) : fieldDef?.type === 'matrix' ? (
                      <table className="w-full text-sm">
                        <tbody>
                          {matrixRows.map(({ row, score }, idx) => (
                            <tr key={idx} className="border-t border-gray-200 dark:border-gray-600 first:border-t-0">
                              <td className="py-1.5 pr-3 text-gray-700 dark:text-gray-300">{row}</td>
                              <td className="py-1.5 text-right font-medium text-gray-900 dark:text-gray-100">{score} / {fieldDef.maxValue ?? 5}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : isImageUrl ? (
                      <a
                        href={`/api/image-proxy?url=${encodeURIComponent(value)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-brand-50 dark:bg-brand-900/20 hover:bg-brand-100 dark:hover:bg-brand-900/40 text-brand-700 dark:text-brand-300 rounded-lg border border-brand-200 dark:border-brand-800 font-medium text-sm transition-colors"
                      >
                        <ExternalLink size={16} />
                        View Image
                      </a>
                    ) : isMultiselect && items.length > 1 ? (
                      <ul className="space-y-2">
                        {items.map((item, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="text-brand-600 dark:text-brand-400 font-bold mt-0.5">•</span>
                            <span className="text-sm md:text-base text-gray-900 dark:text-gray-100">{item}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm md:text-base text-gray-900 dark:text-gray-100 leading-relaxed break-words font-medium">{value || '—'}</p>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="p-4 md:p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex-shrink-0 space-y-3">
              {canDelete && (
                <button
                  onClick={() => {
                    setShowDeleteModal(true)
                    setDeleteError('')
                  }}
                  className="w-full btn bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 text-red-700 dark:text-red-400 font-semibold py-2 px-4 rounded-lg inline-flex items-center justify-center gap-2 transition-colors"
                >
                  <Trash2 size={16} />
                  Delete Response
                </button>
              )}
              <p className="text-xs text-gray-400 dark:text-gray-500 text-center truncate">
                Response ID: {selected.id.slice(0, 16)}
              </p>
            </div>
          </div>
        )})()}

        {/* Delete Confirmation Modal */}
        {showDeleteModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-sm w-full p-6 space-y-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Delete Response</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                  This action cannot be undone. Are you sure you want to delete this response?
                </p>
                {deleteError && (
                  <p className="text-xs text-red-500 dark:text-red-400 mt-2">{deleteError}</p>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowDeleteModal(false)
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
    </div>
  )
}
