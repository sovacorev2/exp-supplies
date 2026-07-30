import type { FormField, Submission } from '@/app/actions/forms'

export type Bucket = { label: string; value: number }

export type CategoricalResult = { kind: 'categorical'; answered: number; unanswered: number; buckets: Bucket[] }
export type MultiResult      = { kind: 'multi';        respondents: number; totalSelections: number; buckets: Bucket[] }
export type BooleanResult    = { kind: 'boolean';      yes: number; no: number; unanswered: number }
export type NumericResult    = { kind: 'numeric';      answered: number; min: number; max: number; avg: number; median: number; histogram: Bucket[] }
export type DateResult       = { kind: 'date';         answered: number; unanswered: number; buckets: Bucket[] }
export type TextResult       = { kind: 'text';         answered: number; total: number; topAnswers: Bucket[]; samples: string[] }
export type FieldResult      = CategoricalResult | MultiResult | BooleanResult | NumericResult | DateResult | TextResult

export type RadarAxis = { label: string; avg: number; min: number; max: number; answered: number }

export type OverviewData = {
  totalResponses: number
  activeForms: number
  byForm: Bucket[]
  byDay: Bucket[]
}

const CATEGORY_CAP = 7
const MULTI_CAP    = 8
const DATE_CAP     = 10

function answersFor(subs: Submission[], key: string): string[] {
  return subs.map(s => (s.data as any)[key]).filter((v): v is string => typeof v === 'string' && v.trim() !== '')
}

function foldToOther(counts: Map<string, number>, cap: number): Bucket[] {
  const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])
  if (sorted.length <= cap) return sorted.map(([label, value]) => ({ label, value }))
  const head  = sorted.slice(0, cap - 1)
  const other = sorted.slice(cap - 1).reduce((s, [, v]) => s + v, 0)
  return [...head.map(([label, value]) => ({ label, value })), { label: 'Other', value: other }]
}

function analyzeSelect(field: FormField, subs: Submission[]): CategoricalResult {
  const answers = answersFor(subs, field.label)
  const counts  = new Map<string, number>()
  answers.forEach(v => counts.set(v, (counts.get(v) ?? 0) + 1))
  return { kind: 'categorical', answered: answers.length, unanswered: subs.length - answers.length, buckets: foldToOther(counts, CATEGORY_CAP) }
}

function analyzeMulti(field: FormField, subs: Submission[]): MultiResult {
  const answers = answersFor(subs, field.label)
  const counts  = new Map<string, number>()
  let total = 0
  answers.forEach(v => v.split('||').map(s => s.trim()).filter(Boolean).forEach(opt => {
    counts.set(opt, (counts.get(opt) ?? 0) + 1); total++
  }))
  return { kind: 'multi', respondents: answers.length, totalSelections: total, buckets: foldToOther(counts, MULTI_CAP) }
}

function analyzeBoolean(field: FormField, subs: Submission[]): BooleanResult {
  const answers = answersFor(subs, field.label)
  return { kind: 'boolean', yes: answers.filter(v => v === 'true').length, no: answers.filter(v => v === 'false').length, unanswered: subs.length - answers.length }
}

function analyzeNumber(field: FormField, subs: Submission[]): NumericResult {
  const nums = answersFor(subs, field.label).map(parseFloat).filter(v => !isNaN(v))
  if (!nums.length) return { kind: 'numeric', answered: 0, min: 0, max: 0, avg: 0, median: 0, histogram: [] }
  const sorted = [...nums].sort((a, b) => a - b)
  const min    = sorted[0], max = sorted[sorted.length - 1]
  const avg    = nums.reduce((s, v) => s + v, 0) / nums.length
  const mid    = Math.floor(sorted.length / 2)
  const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
  let histogram: Bucket[]
  if (max === min) {
    histogram = [{ label: `${min}`, value: nums.length }]
  } else {
    const bucketCount = Math.min(6, new Set(nums).size)
    const span        = (max - min) / bucketCount
    const buckets     = new Array(bucketCount).fill(0)
    nums.forEach(v => { const idx = Math.min(bucketCount - 1, Math.floor((v - min) / span)); buckets[idx]++ })
    histogram = buckets.map((value, i) => {
      const lo = Math.round(min + i * span)
      const hi = Math.round(i === bucketCount - 1 ? max : min + (i + 1) * span)
      return { label: lo === hi ? `${lo}` : `${lo}–${hi}`, value }
    })
  }
  return { kind: 'numeric', answered: nums.length, min, max, avg, median, histogram }
}

function analyzeDate(field: FormField, subs: Submission[]): DateResult {
  const answers = answersFor(subs, field.label).flatMap(v => v.includes('||') ? v.split('||').map(d => d.trim()).filter(Boolean) : [v.trim()])
  const counts  = new Map<string, number>()
  answers.forEach(v => counts.set(v, (counts.get(v) ?? 0) + 1))
  const entries = Array.from(counts.entries())
  let buckets: Bucket[]
  if (entries.length <= DATE_CAP) {
    buckets = entries.sort((a, b) => a[0].localeCompare(b[0])).map(([label, value]) => ({ label, value }))
  } else {
    const byCount = [...entries].sort((a, b) => b[1] - a[1])
    const head    = byCount.slice(0, DATE_CAP - 1).sort((a, b) => a[0].localeCompare(b[0]))
    const other   = byCount.slice(DATE_CAP - 1).reduce((s, [, v]) => s + v, 0)
    buckets = [...head.map(([label, value]) => ({ label, value })), { label: 'Other', value: other }]
  }
  return { kind: 'date', answered: answers.length, unanswered: subs.length - answers.length, buckets }
}

function analyzeText(field: FormField, subs: Submission[]): TextResult {
  const answers = answersFor(subs, field.label)
  const counts  = new Map<string, number>()
  answers.forEach(v => counts.set(v, (counts.get(v) ?? 0) + 1))
  const repeated   = Array.from(counts.entries()).filter(([, c]) => c > 1)
  const topAnswers = repeated.length >= 2 ? repeated.sort((a, b) => b[1] - a[1]).slice(0, 6).map(([label, value]) => ({ label, value })) : []
  return { kind: 'text', answered: answers.length, total: subs.length, topAnswers, samples: answers.slice(0, 5) }
}

export function analyzeField(field: FormField, subs: Submission[]): FieldResult {
  switch (field.type) {
    case 'select':      return analyzeSelect(field, subs)
    case 'multiselect': return analyzeMulti(field, subs)
    case 'checkbox':    return analyzeBoolean(field, subs)
    case 'number':      return analyzeNumber(field, subs)
    case 'date':        return analyzeDate(field, subs)
    default:            return analyzeText(field, subs)
  }
}

export function computeRatingRadar(fields: FormField[], subs: Submission[]): RadarAxis[] | null {
  const ratingFields = fields.filter(f => f.type === 'number' && f.minValue != null && f.maxValue != null && (f.maxValue ?? 0) > (f.minValue ?? 0))
  if (ratingFields.length < 3) return null
  const axes = ratingFields.map(f => {
    const nums = answersFor(subs, f.label).map(parseFloat).filter(v => !isNaN(v))
    const avg  = nums.length ? nums.reduce((s, v) => s + v, 0) / nums.length : f.minValue!
    return { label: f.label, avg, min: f.minValue!, max: f.maxValue!, answered: nums.length }
  })
  return axes.some(a => a.answered > 0) ? axes : null
}

export function computeOverview(subs: Submission[]): OverviewData {
  const formCounts = new Map<string, number>()
  subs.forEach(s => {
    const name = s.forms?.name ?? 'Unknown'
    formCounts.set(name, (formCounts.get(name) ?? 0) + 1)
  })

  const days = new Map<string, string>()
  for (let i = 13; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i)
    days.set(d.toISOString().slice(0, 10), d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }))
  }
  const dayCounts = new Map<string, number>(Array.from(days.keys()).map(k => [k, 0]))
  subs.forEach(s => {
    const iso = new Date(s.created_at).toISOString().slice(0, 10)
    if (dayCounts.has(iso)) dayCounts.set(iso, (dayCounts.get(iso) ?? 0) + 1)
  })

  return {
    totalResponses: subs.length,
    activeForms:    formCounts.size,
    byForm:         foldToOther(formCounts, 8),
    byDay:          Array.from(dayCounts.entries()).map(([iso, value]) => ({ label: days.get(iso)!, value })),
  }
}

export function exportCSV(subs: Submission[], form?: any): void {
  if (!subs.length) return
  
  // Build headers in form order, including section headers
  const headers: string[] = ['Form']
  const fieldKeys: string[] = []
  
  if (form?.fields && Array.isArray(form.fields)) {
    let currentSection = ''
    form.fields.forEach((field: any) => {
      if (field.section === 'SECTION_HEADER') {
        currentSection = field.label
        headers.push(field.label)
        fieldKeys.push(`__section__${field.id}`)
      } else {
        // Prefix with the section name so repeated question labels
        // across sections (e.g. "Appearance" for each sample) stay
        // distinguishable once opened in a spreadsheet.
        headers.push(currentSection ? `${currentSection} - ${field.label}` : field.label)
        fieldKeys.push(field.label)
      }
    })
  } else {
    // Fallback: extract all keys from submissions
    const keys = Array.from(new Set(subs.flatMap(s => Object.keys(s.data as any))))
    fieldKeys.push(...keys)
    headers.push(...keys)
  }
  
  headers.push('Submitted')

  // Image/file-upload answers are URLs — turn them into clickable
  // Excel/Sheets hyperlinks instead of dumping the raw link text.
  const imageFields = new Set(
    fieldKeys.filter(k => !k.startsWith('__section__') && /image|photo|product|supply/i.test(k))
  )

  const rows = [
    headers,
    ...subs.map(s => [
      s.forms?.name ?? '',
      ...fieldKeys.map(k => {
        if (k.startsWith('__section__')) return '' // Section headers have no data
        const val = (s.data as any)?.[k] ?? ''
        if (imageFields.has(k) && String(val).startsWith('https://')) {
          return `=HYPERLINK("${String(val).replace(/"/g, '""')}", "View Image")`
        }
        return val
      }),
      new Date(s.created_at).toISOString().slice(0, 16).replace('T', ' '),
    ]),
  ]

  const csv = rows
    .map(r => r.map(c => {
      const str = String(c)
      if (str.startsWith('=HYPERLINK')) return str // formulas must stay unquoted
      return `"${str.replace(/"/g, '""')}"`
    }).join(','))
    .join('\n')

  const pad = (n: number) => String(n).padStart(2, '0')
  const now = new Date()
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`

  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  a.download = `responses-${stamp}.csv`
  a.click()
}
