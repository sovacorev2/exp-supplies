'use client'

import type { Form, Submission } from '@/app/actions/forms'
import { analyzeField, isPrivateField } from '@/lib/analytics'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart as RechartsPieChart, Pie, Cell } from 'recharts'

export default function ReportView({ form, submissions }: { form: Form; submissions: Submission[] }) {
  const filteredFields = form.fields?.filter((f: any) => !isPrivateField(f.label)) ?? []
  const filteredSubs = submissions.map(s => ({
    ...s,
    data: Object.fromEntries(
      Object.entries(s.data as any).filter(([k]) => !isPrivateField(k))
    ) as Record<string, string>,
  })) as Submission[]

  return (
    <div className="w-full max-w-4xl mx-auto p-8 bg-white">
      {/* Header */}
      <div className="mb-12 pb-8 border-b-2 border-gray-200">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-red-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-xl">EXP</span>
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{form.name}</h1>
            <p className="text-sm text-gray-500">{form.description}</p>
          </div>
        </div>
        <div className="flex gap-8 text-sm text-gray-600 mt-4">
          <div>
            <p className="font-semibold text-gray-900">{submissions.length}</p>
            <p className="text-gray-500">Total Responses</p>
          </div>
          <div>
            <p className="font-semibold text-gray-900">{filteredFields.length}</p>
            <p className="text-gray-500">Questions</p>
          </div>
        </div>
      </div>

      {/* Analytics Charts */}
      <div className="space-y-12">
        {filteredFields.map((field: any) => {
          if (field.section === 'SECTION_HEADER') {
            return (
              <div key={field.id} className="mt-8 pt-4 border-t-2 border-gray-300">
                <h2 className="text-2xl font-bold text-gray-900">{field.label}</h2>
              </div>
            )
          }

          const result = analyzeField(field, filteredSubs, true)
          const isRequired = field.required ? '*' : ''

          return (
            <div key={field.id} className="page-break-avoid">
              <h3 className="text-lg font-bold text-gray-900 mb-4">
                {field.label} {isRequired}
              </h3>

              {result.kind === 'categorical' && (
                <div className="grid grid-cols-2 gap-8">
                  <div>
                    <ResponsiveContainer width="100%" height={300}>
                      <RechartsPieChart>
                        <Pie
                          data={result.buckets}
                          dataKey="value"
                          nameKey="label"
                          cx="50%"
                          cy="50%"
                          outerRadius={100}
                          label
                        >
                          {['#dc2626', '#2563eb', '#16a34a', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'].map((color, i) => (
                            <Cell key={`cell-${i}`} fill={color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  </div>
                  <div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 font-semibold">Option</th>
                          <th className="text-right py-2 font-semibold">Count</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.buckets.map(b => (
                          <tr key={b.label} className="border-b">
                            <td className="py-2">{b.label}</td>
                            <td className="text-right py-2">{b.value}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {result.kind === 'text' && (
                <div>
                  <div className="mb-4 p-3 bg-gray-100 rounded">
                    <p className="text-sm text-gray-600">{result.answered} responses</p>
                  </div>
                  <div className="space-y-2">
                    {result.allAnswers?.map((answer, i) => (
                      <div key={i} className="p-3 bg-gray-50 border border-gray-200 rounded text-sm">
                        {answer}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {result.kind === 'numeric' && (
                <div className="grid grid-cols-2 gap-8">
                  <div>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={result.histogram}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="label" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="value" fill="#dc2626" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div>
                    <table className="w-full text-sm">
                      <tbody>
                        <tr className="border-b">
                          <td className="py-2 font-semibold">Answered</td>
                          <td className="text-right">{result.answered}</td>
                        </tr>
                        <tr className="border-b">
                          <td className="py-2 font-semibold">Min</td>
                          <td className="text-right">{result.min.toFixed(2)}</td>
                        </tr>
                        <tr className="border-b">
                          <td className="py-2 font-semibold">Max</td>
                          <td className="text-right">{result.max.toFixed(2)}</td>
                        </tr>
                        <tr className="border-b">
                          <td className="py-2 font-semibold">Average</td>
                          <td className="text-right">{result.avg.toFixed(2)}</td>
                        </tr>
                        <tr>
                          <td className="py-2 font-semibold">Median</td>
                          <td className="text-right">{result.median.toFixed(2)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {result.kind === 'boolean' && (
                <div className="grid grid-cols-2 gap-8">
                  <div>
                    <ResponsiveContainer width="100%" height={300}>
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
                          outerRadius={100}
                          label
                        >
                          <Cell fill="#16a34a" />
                          <Cell fill="#dc2626" />
                        </Pie>
                        <Tooltip />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  </div>
                  <div>
                    <table className="w-full text-sm">
                      <tbody>
                        <tr className="border-b">
                          <td className="py-2 font-semibold">Yes</td>
                          <td className="text-right">{result.yes}</td>
                        </tr>
                        <tr>
                          <td className="py-2 font-semibold">No</td>
                          <td className="text-right">{result.no}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {result.kind === 'multi' && (
                <div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 font-semibold">Option</th>
                        <th className="text-right py-2 font-semibold">Selected</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.buckets.map(b => (
                        <tr key={b.label} className="border-b">
                          <td className="py-2">{b.label}</td>
                          <td className="text-right py-2">{b.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {result.kind === 'date' && (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 font-semibold">Date</th>
                      <th className="text-right py-2 font-semibold">Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.buckets.map(b => (
                      <tr key={b.label} className="border-b">
                        <td className="py-2">{b.label}</td>
                        <td className="text-right py-2">{b.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
