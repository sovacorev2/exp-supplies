import { getSubmissions, getForms } from '@/app/actions/forms'
import { EventAnalysis } from './EventAnalysis'
import Link from 'next/link'
import { ArrowLeft, Calendar } from 'lucide-react'

export const revalidate = 0

export default async function EventsPage() {
  const [submissions, forms] = await Promise.all([
    getSubmissions(),
    getForms(),
  ])

  // Find the event attendance form
  const eventForm = forms.find(f => f.slug === 'event-attendance')
  
  // Filter submissions for the event form
  const eventSubmissions = eventForm 
    ? submissions.filter(s => s.form_id === eventForm.id)
    : []

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900">
      {/* Header */}
      <header className="flex-shrink-0 bg-gradient-to-r from-brand-600 to-brand-700 dark:from-brand-700 dark:to-brand-800 border-b border-brand-700 dark:border-brand-800 px-4 py-4 md:px-6 md:py-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <Calendar className="text-white" size={28} />
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white">Event Attendance Analysis</h1>
              <p className="text-sm text-brand-100 mt-1">
                {eventForm ? 'Track staff availability and preferences for the upcoming event' : 'Event form not found'}
              </p>
            </div>
          </div>
          <Link 
            href="/admin"
            className="flex items-center justify-center gap-2 py-2.5 px-4 md:py-3 md:px-6 font-semibold text-sm md:text-base whitespace-nowrap bg-white hover:bg-gray-100 text-brand-600 rounded-lg transition-colors"
          >
            <ArrowLeft size={18} />
            Back to Admin
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4 md:p-6">
        {!eventForm ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-md">
              <Calendar size={48} className="text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <h2 className="text-lg md:text-xl font-bold text-gray-900 dark:text-white mb-2">
                Event form not set up yet
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Create the event attendance form from the Forms section to start collecting staff availability.
              </p>
              <Link
                href="/admin/forms/new"
                className="btn btn-primary inline-flex items-center gap-2 py-2.5 px-4 font-semibold"
              >
                Create Event Form
              </Link>
            </div>
          </div>
        ) : (
          <div className="max-w-6xl mx-auto">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  {eventForm.name}
                </h2>
                {eventForm.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {eventForm.description}
                  </p>
                )}
              </div>
              <Link
                href={`/admin/suppliers?form=${eventForm.id}`}
                className="text-sm font-semibold text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300"
              >
                View Responses →
              </Link>
            </div>
            
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
              <p className="text-sm text-blue-900 dark:text-blue-100">
                <strong>Total Responses:</strong> {eventSubmissions.length} staff members have submitted their availability
              </p>
            </div>

            <EventAnalysis submissions={eventSubmissions} />
          </div>
        )}
      </main>
    </div>
  )
}
