'use client'

import { type Submission } from '@/app/actions/forms'
import { BarChart3, Users, TrendingUp, AlertCircle } from 'lucide-react'

interface EventAnalysisProps {
  submissions: Submission[]
}

interface DateVote {
  date: string
  firstChoiceVotes: number
  availableCount: number
  percentage: number
}

interface AnalysisData {
  dateVotes: DateVote[]
  totalAttendees: number
  totalAdults: number
  totalChildren: number
  conflictReasons: Record<string, number>
  winningDate: string | null
  projectedHeadcount: number
}

function analyzeSubmissions(submissions: Submission[]): AnalysisData {
  const dateVotes: Record<string, { firstChoice: number; available: number }> = {
    'Friday, 14 August 2026': { firstChoice: 0, available: 0 },
    'Friday, 21 August 2026': { firstChoice: 0, available: 0 },
    'Saturday, 15 August 2026': { firstChoice: 0, available: 0 },
    'Saturday, 22 August 2026': { firstChoice: 0, available: 0 },
  }

  const conflictReasons: Record<string, number> = {}
  let totalAdults = 0
  let totalChildren = 0
  let projectedHeadcount = 0

  submissions.forEach(submission => {
    const data = submission.data
    
    // Count first choice votes
    if (data['Of those, which is your first choice?']) {
      const choice = data['Of those, which is your first choice?']
      if (choice in dateVotes) {
        dateVotes[choice].firstChoice++
      }
    }

    // Count availability per date
    const datesStr = data['Which dates could you attend?']
    if (datesStr) {
      const dates = Array.isArray(datesStr) ? datesStr : String(datesStr).split(',').map(d => d.trim())
      dates.forEach(date => {
        if (date in dateVotes && date !== 'None of these work') {
          dateVotes[date].available++
        }
      })
    }

    // Count conflicts
    if (data['If none of the dates work, why not?']) {
      const reason = String(data['If none of the dates work, why not?']).toLowerCase()
      conflictReasons[reason] = (conflictReasons[reason] || 0) + 1
    }

    // Sum headcount
    const adults = parseInt(String(data['Number of adults attending (including you)'] || '0'), 10)
    const children = parseInt(String(data['Number of children attending'] || '0'), 10)
    totalAdults += adults
    totalChildren += children
  })

  // Find winning date
  let winningDate: string | null = null
  let maxVotes = 0
  Object.entries(dateVotes).forEach(([date, votes]) => {
    if (votes.firstChoice > maxVotes) {
      maxVotes = votes.firstChoice
      winningDate = date
    }
  })

  // Project headcount for winning date
  projectedHeadcount = totalAdults + totalChildren

  const dateVotesList: DateVote[] = Object.entries(dateVotes).map(([date, votes]) => ({
    date,
    firstChoiceVotes: votes.firstChoice,
    availableCount: votes.available,
    percentage: submissions.length > 0 ? Math.round((votes.available / submissions.length) * 100) : 0,
  }))

  return {
    dateVotes: dateVotesList.sort((a, b) => b.firstChoiceVotes - a.firstChoiceVotes),
    totalAttendees: submissions.length,
    totalAdults,
    totalChildren,
    conflictReasons,
    winningDate,
    projectedHeadcount,
  }
}

export function EventAnalysis({ submissions }: EventAnalysisProps) {
  if (submissions.length === 0) {
    return (
      <div className="flex items-center justify-center p-8 text-center text-gray-600 dark:text-gray-400">
        <AlertCircle className="mr-3" size={20} />
        <span>No responses yet. Analysis will appear here once staff submit their availability.</span>
      </div>
    )
  }

  const analysis = analyzeSubmissions(submissions)

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Total Responses</p>
              <p className="text-3xl font-bold text-blue-900 dark:text-blue-100 mt-1">{analysis.totalAttendees}</p>
            </div>
            <Users size={32} className="text-blue-300 dark:text-blue-700" />
          </div>
        </div>

        <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-green-600 dark:text-green-400 uppercase tracking-wider">Projected Headcount</p>
              <p className="text-3xl font-bold text-green-900 dark:text-green-100 mt-1">{analysis.projectedHeadcount}</p>
            </div>
            <TrendingUp size={32} className="text-green-300 dark:text-green-700" />
          </div>
          <p className="text-xs text-green-700 dark:text-green-300 mt-2">
            {analysis.totalAdults} adults + {analysis.totalChildren} children
          </p>
        </div>

        <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg border border-purple-200 dark:border-purple-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wider">Winning Date</p>
              <p className="text-lg font-bold text-purple-900 dark:text-purple-100 mt-1 line-clamp-2">
                {analysis.winningDate ? analysis.winningDate.split(',')[0] : 'N/A'}
              </p>
            </div>
            <BarChart3 size={32} className="text-purple-300 dark:text-purple-700" />
          </div>
        </div>

        <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg border border-orange-200 dark:border-orange-800">
          <div>
            <p className="text-xs font-semibold text-orange-600 dark:text-orange-400 uppercase tracking-wider">Conflict Issues</p>
            <p className="text-3xl font-bold text-orange-900 dark:text-orange-100 mt-1">
              {Object.keys(analysis.conflictReasons).length}
            </p>
            <p className="text-xs text-orange-700 dark:text-orange-300 mt-2">
              {Object.values(analysis.conflictReasons).reduce((a, b) => a + b, 0)} total responses
            </p>
          </div>
        </div>
      </div>

      {/* Date Breakdown */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <BarChart3 size={20} />
          First Choice Votes & Availability by Date
        </h3>
        <div className="space-y-3">
          {analysis.dateVotes.map(vote => (
            <div key={vote.date}>
              <div className="flex items-center justify-between mb-1">
                <p className="font-medium text-gray-900 dark:text-white text-sm">{vote.date}</p>
                <div className="flex gap-3 text-sm">
                  <span className="text-blue-600 dark:text-blue-400 font-semibold">
                    {vote.firstChoiceVotes} 1st choice
                  </span>
                  <span className="text-gray-600 dark:text-gray-400">
                    {vote.availableCount} available ({vote.percentage}%)
                  </span>
                </div>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-blue-500 h-full rounded-full transition-all duration-300"
                  style={{ width: `${vote.percentage}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Conflict Reasons */}
      {Object.keys(analysis.conflictReasons).length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <AlertCircle size={20} />
            Reasons for Unavailability
          </h3>
          <div className="space-y-2">
            {Object.entries(analysis.conflictReasons)
              .sort(([, a], [, b]) => b - a)
              .map(([reason, count]) => (
                <div
                  key={reason}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded border border-gray-200 dark:border-gray-600"
                >
                  <p className="text-gray-700 dark:text-gray-300 text-sm line-clamp-2">{reason}</p>
                  <span className="ml-4 font-semibold text-gray-900 dark:text-white whitespace-nowrap">
                    {count} {count === 1 ? 'person' : 'people'}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="bg-gradient-to-r from-brand-50 to-brand-100 dark:from-brand-900/20 dark:to-brand-800/20 rounded-lg border border-brand-200 dark:border-brand-800 p-6">
        <h3 className="font-bold text-gray-900 dark:text-white mb-3">Analysis Summary</h3>
        <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
          <li>
            ✓ <strong>Recommended Date:</strong> {analysis.winningDate} ({analysis.dateVotes[0]?.firstChoiceVotes} first choice votes)
          </li>
          <li>
            ✓ <strong>Availability on winning date:</strong> {analysis.dateVotes[0]?.availableCount} people ({analysis.dateVotes[0]?.percentage}%)
          </li>
          <li>
            ✓ <strong>Plan catering for:</strong> {analysis.projectedHeadcount} people ({analysis.totalAdults} adults, {analysis.totalChildren} children)
          </li>
          {Object.keys(analysis.conflictReasons).length > 0 && (
            <li>
              ⚠ <strong>Key conflict:</strong> {Object.entries(analysis.conflictReasons).sort(([, a], [, b]) => b - a)[0][0]}
            </li>
          )}
        </ul>
      </div>
    </div>
  )
}
