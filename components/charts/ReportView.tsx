'use client'

import type { Form, Submission, ReportNarrative } from '@/app/actions/forms'
import { analyzeField, isPrivateField, ratingGradient, splitBySegment } from '@/lib/analytics'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RechartsPieChart, Pie, Cell } from 'recharts'

// Built from the Exp brand red/silver scale (tailwind.config.js) rather
// than an arbitrary rainbow — alternates dark/light so adjacent chart
// segments stay distinguishable while the report stays strictly on-brand.
const PRIMARY = '#ED1C24' // brand-500, Pantone 485 C
const SILVER  = '#6D6E71' // silver-500, Pantone 424 C
const COLORS  = ['#ED1C24', '#6D6E71', '#b01319', '#d0d0d2', '#f7aaaa', '#575859', '#920e15', '#e7e7e8']

// Heuristic, label-pattern based — same approach isPrivateField already
// uses in lib/analytics.ts. Only pulls a field into the Participant
// Profile section when its label actually matches; forms without any of
// these questions render exactly as before, no empty section.
const DEMOGRAPHIC_PATTERNS: { key: 'gender' | 'occupation' | 'location'; test: RegExp }[] = [
  { key: 'gender',     test: /gender/i },
  { key: 'occupation', test: /occupation|job title|profession/i },
  { key: 'location',   test: /residence|location|estate|neighbou?rhood|which area|county|town|city/i },
]
function classifyDemographic(label: string) {
  return DEMOGRAPHIC_PATTERNS.find(p => p.test.test(label))?.key ?? null
}

export default function ReportView({ form, submissions, narrative, dateRangeLabel, compareFieldId }: { form: Form; submissions: Submission[]; narrative?: ReportNarrative; dateRangeLabel?: string; compareFieldId?: string }) {
  const filteredFields = form.fields?.filter((f: any) => !isPrivateField(f.label)) ?? []
  const filteredSubs = submissions.map(s => ({
    ...s,
    data: Object.fromEntries(
      Object.entries(s.data as any).filter(([k]) => !isPrivateField(k))
    ) as Record<string, string>,
  })) as Submission[]

  // Same "Compare by" split shown on the live dashboard, reproduced here so
  // a downloaded/printed report carries the same Rig-vs-Van (or whatever
  // field was picked) comparison the admin was looking at on screen.
  const compareField = compareFieldId ? filteredFields.find((f: any) => f.id === compareFieldId) : null
  const comparison = compareField ? splitBySegment(compareField, filteredSubs) : null
  const comparisonFields = compareField ? filteredFields.filter((f: any) => f.id !== compareField.id && f.section !== 'SECTION_HEADER') : []

  const demographicFields = filteredFields.filter((f: any) => f.section !== 'SECTION_HEADER' && classifyDemographic(f.label))
  const demographicIds    = new Set(demographicFields.map((f: any) => f.id))
  // Everything else renders through the normal per-question loop below —
  // demographic fields are pulled out here so they don't render twice.
  const mainFields = filteredFields.filter((f: any) => f.section === 'SECTION_HEADER' || !demographicIds.has(f.id))

  const genderField     = demographicFields.find((f: any) => classifyDemographic(f.label) === 'gender')
  const occupationField = demographicFields.find((f: any) => classifyDemographic(f.label) === 'occupation')
  const locationField   = demographicFields.find((f: any) => classifyDemographic(f.label) === 'location')

  const genderResult     = genderField ? analyzeField(genderField, filteredSubs, true) : null
  const occupationResult = occupationField ? analyzeField(occupationField, filteredSubs, true) : null
  const locationResult   = locationField ? analyzeField(locationField, filteredSubs, true) : null

  const primaryGender = genderResult?.kind === 'categorical' && genderResult.buckets.length
    ? [...genderResult.buckets].sort((a, b) => b.value - a.value)[0].label
    : null
  const locationFocus = locationResult?.kind === 'categorical' && locationResult.buckets.length
    ? [...locationResult.buckets].sort((a, b) => b.value - a.value).slice(0, 3).map(b => b.label).join(', ')
    : null

  function findInsight(fieldId?: string) {
    return fieldId ? narrative?.fieldInsights?.find(fi => fi.fieldId === fieldId) : undefined
  }
  function findTextSummary(fieldId?: string) {
    return fieldId ? narrative?.textSummaries?.find(ts => ts.fieldId === fieldId) : undefined
  }

  function AnalystTake({ insight }: { insight?: string }) {
    if (!insight) return null
    return (
      <div className="mt-4 flex gap-3 items-start bg-brand-50 border border-brand-100 rounded-lg p-4">
        <span className="text-brand-600 font-bold text-lg leading-none flex-shrink-0">✦</span>
        <p className="text-sm text-gray-800 m-0">
          <span className="font-semibold text-brand-700">Key takeaway: </span>{insight}
        </p>
      </div>
    )
  }

  function ProportionalBars({ buckets }: { buckets: { label: string; value: number }[] }) {
    const max = Math.max(...buckets.map(b => b.value), 1)
    return (
      <div className="space-y-2">
        {buckets.map(b => (
          <div key={b.label}>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-700">{b.label}</span>
              <span className="font-semibold text-gray-900">{b.value}</span>
            </div>
            <div className="h-3 w-full bg-gray-100 rounded-sm">
              <div className="h-full rounded-sm" style={{ width: `${(b.value / max) * 100}%`, background: PRIMARY }} />
            </div>
          </div>
        ))}
      </div>
    )
  }

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

          {dateRangeLabel && (
            <p className="inline-block text-sm font-bold text-red-600 bg-red-50 rounded-full px-4 py-1.5 mb-4">
              {dateRangeLabel}
            </p>
          )}

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

        {demographicFields.length > 0 && (
          <div className="w-full p-12 border-b border-gray-200 page-break-avoid report-section">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Participant Profile</h2>
            <p className="text-gray-600 mb-6">The participant pool represents a diverse range of occupations and backgrounds, ensuring the feedback is representative of the target market.</p>

            <table className="text-sm mb-8">
              <tbody>
                <tr className="border-b border-gray-200">
                  <td className="py-2 pr-10 font-semibold text-gray-900">Total Responses</td>
                  <td className="py-2 text-gray-700">{filteredSubs.length}</td>
                </tr>
                {primaryGender && (
                  <tr className="border-b border-gray-200">
                    <td className="py-2 pr-10 font-semibold text-gray-900">Primary Gender</td>
                    <td className="py-2 text-gray-700">{primaryGender}</td>
                  </tr>
                )}
                {locationFocus && (
                  <tr className="border-b border-gray-200">
                    <td className="py-2 pr-10 font-semibold text-gray-900">Location Focus</td>
                    <td className="py-2 text-gray-700">{locationFocus}</td>
                  </tr>
                )}
              </tbody>
            </table>

            {genderResult?.kind === 'categorical' && genderResult.buckets.length > 0 && (
              <div className="mb-8">
                <h3 className="text-lg font-bold text-gray-900 mb-3">Gender Distribution</h3>
                <div className="grid grid-cols-3 gap-8">
                  <div className="col-span-2">
                    <ResponsiveContainer width="100%" height={250}>
                      <RechartsPieChart>
                        <Pie data={genderResult.buckets} dataKey="value" nameKey="label" cx="50%" cy="50%" outerRadius={80} label={{ fontSize: 12 }} isAnimationActive={false}>
                          {genderResult.buckets.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={(value) => `${value} responses`} />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="col-span-1 space-y-2">
                    {genderResult.buckets.map(b => (
                      <div key={b.label} className="flex justify-between text-sm">
                        <span className="text-gray-700">{b.label}</span>
                        <span className="font-semibold">{b.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <AnalystTake insight={findInsight(genderField?.id)?.insight} />
              </div>
            )}

            {occupationResult?.kind === 'categorical' && occupationResult.buckets.length > 0 && (
              <div className="mb-8">
                <h3 className="text-lg font-bold text-gray-900 mb-3">Occupation Distribution</h3>
                <ProportionalBars buckets={occupationResult.buckets} />
                <AnalystTake insight={findInsight(occupationField?.id)?.insight} />
              </div>
            )}

            {locationResult?.kind === 'categorical' && locationResult.buckets.length > 0 && (
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-3">Residence Distribution</h3>
                <ProportionalBars buckets={locationResult.buckets} />
                <AnalystTake insight={findInsight(locationField?.id)?.insight} />
              </div>
            )}
          </div>
        )}

        {compareField && comparison && (
          <div className="w-full p-12 border-b border-gray-200 page-break-avoid report-section">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Comparing by &ldquo;{compareField.label}&rdquo;</h2>
            <div className="flex flex-wrap gap-3 mb-2">
              {comparison.segments.map(seg => {
                const total = comparison.segments.reduce((s, x) => s + x.subs.length, 0) + comparison.unanswered.length
                return (
                  <span key={seg.label} className="text-sm font-bold text-red-600 bg-red-50 rounded-full px-4 py-1.5">
                    {seg.label} — {seg.subs.length} ({total > 0 ? Math.round((seg.subs.length / total) * 100) : 0}%)
                  </span>
                )
              })}
            </div>
            {comparison.unanswered.length > 0 && (
              <p className="text-xs text-gray-500 mb-6">{comparison.unanswered.length} response{comparison.unanswered.length !== 1 ? 's' : ''} had no {compareField.label.toLowerCase()} selected, excluded from this comparison.</p>
            )}

            <div className="space-y-6 mt-6">
              {comparisonFields.map((f: any) => {
                const results = comparison.segments.map(seg => ({ seg, result: analyzeField(f, seg.subs, true) }))
                const isCategorical = results.every(r => r.result.kind === 'categorical' || r.result.kind === 'boolean')
                const isNumeric = results.every(r => r.result.kind === 'numeric' || r.result.kind === 'rating')
                return (
                  <div key={f.id}>
                    <p className="text-sm font-semibold text-gray-900 mb-3">{f.label}</p>
                    <div className="grid gap-6" style={{ gridTemplateColumns: `repeat(${comparison!.segments.length}, minmax(0, 1fr))` }}>
                      {results.map(({ seg, result }) => {
                        if (isCategorical) {
                          const buckets = result.kind === 'boolean' ? [{ label: 'Yes', value: result.yes }, { label: 'No', value: result.no }] : result.kind === 'categorical' ? result.buckets : []
                          return (
                            <div key={seg.label}>
                              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">{seg.label}</p>
                              <ProportionalBars buckets={buckets} />
                            </div>
                          )
                        }
                        if (isNumeric) {
                          const value = result.kind === 'numeric' ? result.avg.toFixed(1) : result.kind === 'rating' ? `${result.avg.toFixed(1)} / ${result.max}` : '—'
                          const numAnswered = result.kind === 'numeric' || result.kind === 'rating' ? result.answered : 0
                          return (
                            <div key={seg.label} className="bg-gray-50 p-3 rounded">
                              <p className="text-xs text-gray-600">{seg.label}</p>
                              <p className="text-2xl font-bold text-gray-900">{value}</p>
                              <p className="text-xs text-gray-500 mt-1">{numAnswered} answered</p>
                            </div>
                          )
                        }
                        const answered = 'answered' in result ? result.answered : ('yes' in result ? result.yes + result.no : result.respondents ?? 0)
                        return (
                          <div key={seg.label} className="bg-gray-50 p-3 rounded">
                            <p className="text-xs text-gray-600">{seg.label}</p>
                            <p className="text-2xl font-bold text-gray-900">{answered}</p>
                            <p className="text-xs text-gray-500 mt-1">of {seg.subs.length}</p>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {mainFields.map((field: any, fieldIdx) => {
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
          const fieldInsight = findInsight(field.id)
          const textSummary  = findTextSummary(field.id)

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
                          isAnimationActive={false}
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

              {result.kind === 'rating' && (
                <>
                  <div className="grid grid-cols-2 gap-4 mb-6 max-w-sm">
                    <div className="bg-gray-50 p-3 rounded">
                      <p className="text-xs text-gray-600">Average Rating</p>
                      <p className="text-2xl font-bold text-gray-900">{result.avg.toFixed(1)} / {result.max}</p>
                    </div>
                    <div className="bg-gray-50 p-3 rounded">
                      <p className="text-xs text-gray-600">Responses</p>
                      <p className="text-2xl font-bold text-gray-900">{result.answered}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-8">
                    <div className="col-span-2">
                      <ResponsiveContainer width="100%" height={280}>
                        <RechartsPieChart>
                          <Pie data={result.buckets} dataKey="value" nameKey="label" cx="50%" cy="50%" outerRadius={80} label={{ fontSize: 12 }} isAnimationActive={false}>
                            {result.buckets.map((_, i) => (
                              <Cell key={`cell-${i}`} fill={ratingGradient(result.buckets.length)[i]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value) => `${value} responses`} />
                        </RechartsPieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="col-span-1">
                      <div className="space-y-2">
                        {result.buckets.map((b, i) => (
                          <div key={b.label} className="flex items-center gap-2 text-sm">
                            <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: ratingGradient(result.buckets.length)[i] }} />
                            <span className="text-gray-700 flex-1">{b.label}</span>
                            <span className="font-semibold">{b.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              )}

              {result.kind === 'text' && (
                <div className="mt-6">
                  {textSummary ? (
                    <>
                      <p className="text-sm text-gray-600 mb-3 font-semibold">Summary of all {answered} responses</p>
                      <p className="text-gray-800 leading-relaxed bg-gray-50 border-l-4 border-red-600 rounded p-4">{textSummary.summary}</p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-gray-600 mb-4 font-semibold">All {answered} Responses:</p>
                      <div className="space-y-4">
                        {result.allAnswers?.map((answer, i) => (
                          <div key={i} className="response-item p-3 bg-gray-50 border-l-4 border-red-600 text-sm rounded">
                            <p className="text-gray-900 m-0">{answer}</p>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
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
                        <Bar dataKey="value" fill={PRIMARY} isAnimationActive={false} />
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
                          isAnimationActive={false}
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

              {result.kind === 'matrix' && (
                <div className="mt-6">
                  <p className="text-xs text-gray-500 mb-3">Average score per row, out of {result.scaleMax}</p>
                  <ProportionalBars buckets={result.rows.map(r => ({ label: r.row, value: r.avg }))} />
                  <div className="mt-6 grid grid-cols-2 gap-6">
                    {result.rows.map(r => {
                      const rowColors = ratingGradient(r.distribution.length)
                      return (
                        <div key={r.row} className="border border-gray-200 rounded-lg p-4 page-break-avoid">
                          <p className="text-sm font-semibold text-gray-900 mb-1">{r.row}</p>
                          <p className="text-xs text-gray-500 mb-3">Average {r.avg} / {result.scaleMax}</p>
                          <div className="flex items-center gap-3">
                            <ResponsiveContainer width={110} height={110}>
                              <RechartsPieChart>
                                <Pie data={r.distribution} dataKey="value" nameKey="label" cx="50%" cy="50%" outerRadius={50} isAnimationActive={false}>
                                  {r.distribution.map((_, i) => <Cell key={i} fill={rowColors[i]} />)}
                                </Pie>
                              </RechartsPieChart>
                            </ResponsiveContainer>
                            <div className="flex-1 space-y-1">
                              {r.distribution.map((d, i) => (
                                <div key={d.label} className="flex items-center gap-1.5 text-xs">
                                  <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: rowColors[i] }} />
                                  <span className="text-gray-600 flex-1">{d.label}★</span>
                                  <span className="font-semibold text-gray-900">{d.value}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Text fields with a textSummary already got a full LLM
                  synthesis above — a second "Key takeaway" blurb on the
                  same field would just repeat itself. */}
              {!textSummary && <AnalystTake insight={fieldInsight?.insight} />}
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
