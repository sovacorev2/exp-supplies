'use client'

import type { Form, Submission } from '@/app/actions/forms'
import { analyzeField, isPrivateField } from '@/lib/analytics'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RechartsPieChart, Pie, Cell } from 'recharts'

const COLORS = ['#dc2626', '#2563eb', '#16a34a', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316']

export default function ReportView({ form, submissions }: { form: Form; submissions: Submission[] }) {
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
      <div className="space-y-0">
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
                        <Bar dataKey="value" fill="#dc2626" />
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
                          <Cell fill="#16a34a" />
                          <Cell fill="#dc2626" />
                        </Pie>
                        <Tooltip formatter={(value) => `${value} responses`} />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="col-span-1 space-y-2">
                    <div className="bg-green-50 p-3 rounded border border-green-200">
                      <p className="text-xs text-green-700">Yes</p>
                      <p className="text-2xl font-bold text-green-900">{result.yes}</p>
                    </div>
                    <div className="bg-red-50 p-3 rounded border border-red-200">
                      <p className="text-xs text-red-700">No</p>
                      <p className="text-2xl font-bold text-red-900">{result.no}</p>
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
      </div>

      {/* Footer */}
      <div className="w-full p-12 bg-gray-900 text-white text-center text-sm mt-12 page-break-avoid">
        <p>© EXP {new Date().getFullYear()} • Confidential</p>
      </div>
    </div>
  )
}
