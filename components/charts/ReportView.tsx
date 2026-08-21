'use client'

import type { Form, Submission, ReportNarrative } from '@/app/actions/forms'
import { analyzeField, isPrivateField } from '@/lib/analytics'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RechartsPieChart, Pie, Cell } from 'recharts'

// Built from the Exp brand red/silver scale (tailwind.config.js) rather
// than an arbitrary rainbow — alternates dark/light so adjacent chart
// segments stay distinguishable while the report stays strictly on-brand.
const PRIMARY = '#ED1C24' // brand-500, Pantone 485 C
const SILVER  = '#6D6E71' // silver-500, Pantone 424 C
const COLORS  = ['#ED1C24', '#6D6E71', '#b01319', '#d0d0d2', '#f7aaaa', '#575859', '#920e15', '#e7e7e8']

export default function ReportView({ form, submissions, narrative }: { form: Form; submissions: Submission[]; narrative?: ReportNarrative }) {
  const filteredFields = form.fields?.filter((f: any) => !isPrivateField(f.label)) ?? []
  const filteredSubs = submissions.map(s => ({
    ...s,
    data: Object.fromEntries(
      Object.entries(s.data as any).filter(([k]) => !isPrivateField(k))
    ) as Record<string, string>,
  })) as Submission[]

  return (
    <div className="min-h-screen bg-white text-black print:bg-white print:text-black">
      {/* Page 1: Cover Page */}
      <div className="w-full h-screen flex flex-col items-center justify-center p-12 page-break-avoid print:page-break-after-always">
        <div className="text-center">
          {/* EXP Logo */}
          <div className="inline-flex items-center justify-center w-20 h-20 bg-red-600 rounded-lg mb-8">
            <span className="text-white font-bold text-4xl">EXP</span>
          </div>
          
          {/* Title */}
          <h1 className="text-5xl font-bold text-gray-900 mb-4">{form.name}</h1>
          
          {/* Description */}
          {form.description && (
            <p className="text-lg text-gray-600 mb-12 max-w-2xl">{form.description}</p>
          )}
          
          {/* Key Metrics */}
          <div className="grid grid-cols-2 gap-8 mt-16 max-w-md mx-auto">
            <div className="bg-gray-50 p-6 rounded-lg">
              <p className="text-4xl font-bold text-red-600">{filteredSubs.length}</p>
              <p className="text-gray-600 text-sm mt-2">Total Responses</p>
            </div>
            <div className="bg-gray-50 p-6 rounded-lg">
              <p className="text-4xl font-bold text-red-600">100%</p>
              <p className="text-gray-600 text-sm mt-2">Response Rate</p>
            </div>
          </div>

          {/* Date */}
          <p className="text-gray-500 mt-16 text-sm">Report generated on {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
      </div>

      {/* Page 2+: Content Pages */}
      <div className="space-y-0" data-pdf-flatten>
        {narrative && (
          <div className="w-full p-12 border-b border-gray-200 page-break-avoid report-section">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Executive Summary</h2>
            <p className="text-gray-700 leading-relaxed">{narrative.summary}</p>
          </div>
        )}

        {filteredFields.map((field: any, fieldIdx) => {
          if (field.section === 'SECTION_HEADER') {
            return (
              <div key={field.id} className="w-full p-12 bg-red-50 print:bg-red-50 page-break-avoid print:page-break-before-always">
                <h2 className="text-3xl font-bold text-red-600">{field.label}</h2>
              </div>
            )
          }

          const result = analyzeField(field, filteredSubs, true)
          const answered = 'answered' in result ? result.answered : ('yes' in result ? result.yes + result.no : result.respondents ?? 0)
          const responseRate = Math.round((answered / filteredSubs.length) * 100)

          return (
            <div key={field.id} className="w-full p-12 border-b border-gray-200 page-break-avoid report-section">
              {/* Question Title */}
              <h3 className="text-xl font-bold text-gray-900 mb-2">{field.label}</h3>
              
              {/* Response Rate */}
              <div className="flex items-center gap-4 mb-6">
                <div className="text-sm">
                  <p className="text-gray-600">Response Rate: <span className="font-semibold text-gray-900">{responseRate}%</span></p>
                  <p className="text-gray-600">{answered} of {filteredSubs.length} answered</p>
                </div>
              </div>

              {/* Chart/Data by Type */}
              {result.kind === 'categorical' && (
                <div className="grid grid-cols-3 gap-8 mt-6">
                  <div className="col-span-2">
                    <ResponsiveContainer width="100%" height={300}>
                      <RechartsPieChart>
                        <Pie
                          data={result.buckets}
                          dataKey="value"
                          nameKey="label"
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          label={{ fontSize: 12 }}
                        >
                          {result.buckets.map((_, i) => (
                            <Cell key={`cell-${i}`} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => `${value} responses`} />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="col-span-1">
                    <div className="space-y-2">
                      {result.buckets.map(b => (
                        <div key={b.label} className="flex justify-between text-sm">
                          <span className="text-gray-700">{b.label}</span>
                          <span className="font-semibold">{b.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {result.kind === 'text' && (
                <div className="mt-6">
                  <p className="text-sm text-gray-600 mb-4 font-semibold">All {answered} Responses:</p>
                  <div className="space-y-4">
                    {result.allAnswers?.map((answer, i) => (
                      <div key={i} className="response-item p-3 bg-gray-50 border-l-4 border-red-600 text-sm rounded">
                        <p className="text-gray-900 m-0">{answer}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {result.kind === 'numeric' && (
                <div className="grid grid-cols-3 gap-8 mt-6">
                  <div className="col-span-2">
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={result.histogram} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="label" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="value" fill={PRIMARY} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="col-span-1 space-y-2">
                    <div className="bg-gray-50 p-3 rounded">
                      <p className="text-xs text-gray-600">Average</p>
                      <p className="text-2xl font-bold text-gray-900">{result.avg.toFixed(1)}</p>
                    </div>
                    <div className="bg-gray-50 p-3 rounded">
                      <p className="text-xs text-gray-600">Median</p>
                      <p className="text-2xl font-bold text-gray-900">{result.median.toFixed(1)}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-gray-50 p-3 rounded">
                        <p className="text-xs text-gray-600">Min</p>
                        <p className="text-lg font-bold text-gray-900">{result.min.toFixed(1)}</p>
                      </div>
                      <div className="bg-gray-50 p-3 rounded">
                        <p className="text-xs text-gray-600">Max</p>
                        <p className="text-lg font-bold text-gray-900">{result.max.toFixed(1)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {result.kind === 'boolean' && (
                <div className="grid grid-cols-3 gap-8 mt-6">
                  <div className="col-span-2">
                    <ResponsiveContainer width="100%" height={250}>
                      <RechartsPieChart>
                        <Pie
                          data={[
                            { label: 'Yes', value: result.yes },
                            { label: 'No', value: result.no },
                          ]}
                          dataKey="value"
                          nameKey="label"
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          label={{ fontSize: 12 }}
                        >
                          <Cell fill={PRIMARY} />
                          <Cell fill={SILVER} />
                        </Pie>
                        <Tooltip formatter={(value) => `${value} responses`} />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="col-span-1 space-y-2">
                    <div className="bg-brand-50 p-3 rounded border border-brand-200">
                      <p className="text-xs text-brand-700">Yes</p>
                      <p className="text-2xl font-bold text-brand-900">{result.yes}</p>
                    </div>
                    <div className="bg-silver-50 p-3 rounded border border-silver-200">
                      <p className="text-xs text-silver-700">No</p>
                      <p className="text-2xl font-bold text-silver-900">{result.no}</p>
                    </div>
                  </div>
                </div>
              )}

              {result.kind === 'multi' && (
                <div className="mt-6 space-y-2">
                  {result.buckets.map(b => (
                    <div key={b.label} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                      <span className="text-sm text-gray-700">{b.label}</span>
                      <span className="text-sm font-semibold text-gray-900">{b.value} selected</span>
                    </div>
                  ))}
                </div>
              )}

              {result.kind === 'date' && (
                <div className="mt-6 space-y-2">
                  {result.buckets.map(b => (
                    <div key={b.label} className="flex justify-between p-2 text-sm border-b border-gray-200">
                      <span className="text-gray-700">{b.label}</span>
                      <span className="font-semibold">{b.value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}

        {narrative && (
          <div className="w-full p-12 border-b border-gray-200 page-break-avoid report-section">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Key Insights</h2>
            <ul className="space-y-2 mb-8">
              {narrative.keyInsights.map((point, i) => (
                <li key={i} className="flex gap-3 text-gray-700">
                  <span className="text-red-600 font-bold flex-shrink-0">•</span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>

            {narrative.notableQuotes.length > 0 && (
              <>
                <h3 className="text-lg font-bold text-gray-900 mb-3">What Respondents Said</h3>
                <div className="space-y-3 mb-8">
                  {narrative.notableQuotes.map((quote, i) => (
                    <div key={i} className="p-3 bg-gray-50 border-l-4 border-red-600 text-sm rounded">
                      <p className="text-gray-900 m-0 italic">&ldquo;{quote}&rdquo;</p>
                    </div>
                  ))}
                </div>
              </>
            )}

            <h3 className="text-lg font-bold text-gray-900 mb-3">Recommendations</h3>
            <ol className="space-y-2 mb-8 list-decimal list-inside">
              {narrative.recommendations.map((rec, i) => (
                <li key={i} className="text-gray-700">{rec}</li>
              ))}
            </ol>

            <h3 className="text-lg font-bold text-gray-900 mb-3">Conclusion</h3>
            <p className="text-gray-700 leading-relaxed">{narrative.conclusion}</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="w-full p-12 bg-gray-900 text-white text-center text-sm mt-12 page-break-avoid">
        <p>© EXP {new Date().getFullYear()} • Confidential</p>
      </div>
    </div>
  )
}
