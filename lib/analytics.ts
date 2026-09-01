import type { FormField, Submission, FieldValueMerge } from '@/app/actions/forms'

export type Bucket = { label: string; value: number }

// A count field's total (pegs issued, customers engaged) should read as a
// whole number the way anyone would actually write it down, not carry a
// meaningless decimal, while a genuinely fractional quantity still shows
// its precision instead of being silently rounded away.
export function formatCount(n: number): string {
  return Number.isInteger(n) ? n.toLocaleString() : n.toLocaleString(undefined, { maximumFractionDigits: 1 })
}

export function isPrivateField(label: string): boolean {
  const privatePatterns = /phone|tel|mobile|recruiter|interviewer|respondent.?name|email|ssn|tax|id.?number|credit|password|why.*choose|why.*select/i
  return privatePatterns.test(label)
}

// Admin-created mappings for free-text answers that are the same real
// answer spelled differently in a way normalization can't safely guess
// ("Sunton" / "Sunton Kasarani" — genuinely different strings, not just
// casing/whitespace). Applied before analysis so every consumer (charts,
// printed report, CSV, the LLM narrative) sees the same canonicalized
// data — analyzeField/exportCSV themselves never need to know merges
// exist at all.
export function applyFieldMerges(subs: Submission[], mergesByField: Record<string, FieldValueMerge[]>): Submission[] {
  const fieldsWithMerges = Object.keys(mergesByField).filter(k => mergesByField[k]?.length)
  if (!fieldsWithMerges.length) return subs
  return subs.map(s => {
    let data = s.data as Record<string, string>
    let changed = false
    for (const fieldLabel of fieldsWithMerges) {
      const v = data[fieldLabel]
      if (typeof v !== 'string') continue
      const hit = mergesByField[fieldLabel].find(m => m.variantValue === v.trim())
      if (hit) {
        if (!changed) { data = { ...data }; changed = true }
        data[fieldLabel] = hit.canonicalValue
      }
    }
    return changed ? { ...s, data } : s
  })
}

// Ratings are ordinal (1 reads as "worse" than 5), so an alternating
// red/silver categorical palette reads as noise — a light-to-dark ramp
// through the brand red scale reads naturally as low→high intensity
// instead. Sampled evenly across the tint scale so it works for any
// rating range, not just 1-5.
const RATING_TINT_SCALE = ['#fde7e7', '#fbcfcf', '#f7aaaa', '#f07878', '#ED1C24', '#d41820', '#b01319', '#920e15', '#7a0b11']
export function ratingGradient(steps: number): string[] {
  if (steps <= 1) return [RATING_TINT_SCALE[Math.floor(RATING_TINT_SCALE.length / 2)]]
  return Array.from({ length: steps }, (_, i) =>
    RATING_TINT_SCALE[Math.round((i * (RATING_TINT_SCALE.length - 1)) / (steps - 1))]
  )
}

export type CategoricalResult = { kind: 'categorical'; answered: number; unanswered: number; buckets: Bucket[] }
export type MultiResult      = { kind: 'multi';        respondents: number; totalSelections: number; buckets: Bucket[] }
export type BooleanResult    = { kind: 'boolean';      yes: number; no: number; unanswered: number }
export type NumericResult    = { kind: 'numeric';      answered: number; min: number; max: number; avg: number; sum: number; median: number; histogram: Bucket[] }
export type DateResult       = { kind: 'date';         answered: number; unanswered: number; buckets: Bucket[] }
export type TextResult       = { kind: 'text';         answered: number; total: number; topAnswers: Bucket[]; samples: string[]; allAnswers?: string[] }
export type MatrixRow        = { row: string; avg: number; distribution: Bucket[] }
export type MatrixResult     = { kind: 'matrix';       rows: MatrixRow[]; answered: number; scaleMin: number; scaleMax: number }
export type RatingResult     = { kind: 'rating';       answered: number; unanswered: number; avg: number; min: number; max: number; buckets: Bucket[] }
export type FieldResult      = CategoricalResult | MultiResult | BooleanResult | NumericResult | DateResult | TextResult | MatrixResult | RatingResult

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

function foldToOther(counts: Map<string, number>, cap: number, full: boolean = false): Bucket[] {
  const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])
  if (full || sorted.length <= cap) return sorted.map(([label, value]) => ({ label, value }))
  const head  = sorted.slice(0, cap - 1)
  const other = sorted.slice(cap - 1).reduce((s, [, v]) => s + v, 0)
  return [...head.map(([label, value]) => ({ label, value })), { label: 'Other', value: other }]
}

function normalizeKey(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, '')
}

// Groups near-duplicate free-text answers that only differ by casing or
// spacing ("Clay City" / "Clay city" / "ClayCity") into one bucket instead
// of fragmenting into several near-identical slices — displayed under
// whichever exact spelling respondents used most often. A select field's
// options are already exact strings from a dropdown, so this is a no-op
// for those; it only matters for the free-text-as-categorical fallback.
function countNormalized(answers: string[]): Map<string, number> {
  const raw = new Map<string, number>()
  answers.forEach(v => { const t = v.trim(); if (t) raw.set(t, (raw.get(t) ?? 0) + 1) })

  const byKey = new Map<string, { label: string; labelCount: number; total: number }>()
  raw.forEach((count, label) => {
    const key = normalizeKey(label)
    const g = byKey.get(key)
    if (!g) byKey.set(key, { label, labelCount: count, total: count })
    else {
      g.total += count
      if (count > g.labelCount) { g.label = label; g.labelCount = count }
    }
  })
  const result = new Map<string, number>()
  byKey.forEach(g => result.set(g.label, g.total))
  return result
}

function analyzeSelect(field: FormField, subs: Submission[], full: boolean = false): CategoricalResult {
  const answers = answersFor(subs, field.label)
  const counts  = countNormalized(answers)
  return { kind: 'categorical', answered: answers.length, unanswered: subs.length - answers.length, buckets: foldToOther(counts, CATEGORY_CAP, full) }
}

function analyzeMulti(field: FormField, subs: Submission[], full: boolean = false): MultiResult {
  const answers = answersFor(subs, field.label)
  const counts  = new Map<string, number>()
  let total = 0
  answers.forEach(v => v.split('||').map(s => s.trim()).filter(Boolean).forEach(opt => {
    counts.set(opt, (counts.get(opt) ?? 0) + 1); total++
  }))
  return { kind: 'multi', respondents: answers.length, totalSelections: total, buckets: foldToOther(counts, MULTI_CAP, full) }
}

function analyzeBoolean(field: FormField, subs: Submission[], full: boolean = false): BooleanResult {
  const answers = answersFor(subs, field.label)
  return { kind: 'boolean', yes: answers.filter(v => v === 'true').length, no: answers.filter(v => v === 'false').length, unanswered: subs.length - answers.length }
}

function analyzeNumber(field: FormField, subs: Submission[], full: boolean = false): NumericResult {
  const nums = answersFor(subs, field.label).map(parseFloat).filter(v => !isNaN(v))
  if (!nums.length) return { kind: 'numeric', answered: 0, min: 0, max: 0, avg: 0, sum: 0, median: 0, histogram: [] }
  const sorted = [...nums].sort((a, b) => a - b)
  const min    = sorted[0], max = sorted[sorted.length - 1]
  const sum    = nums.reduce((s, v) => s + v, 0)
  const avg    = sum / nums.length
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
  return { kind: 'numeric', answered: nums.length, min, max, avg, sum, median, histogram }
}

function analyzeDate(field: FormField, subs: Submission[], full: boolean = false): DateResult {
  const answers = answersFor(subs, field.label).flatMap(v => v.includes('||') ? v.split('||').map(d => d.trim()).filter(Boolean) : [v.trim()])
  const counts  = new Map<string, number>()
  answers.forEach(v => counts.set(v, (counts.get(v) ?? 0) + 1))
  const entries = Array.from(counts.entries())
  let buckets: Bucket[]
  if (full || entries.length <= DATE_CAP) {
    buckets = entries.sort((a, b) => a[0].localeCompare(b[0])).map(([label, value]) => ({ label, value }))
  } else {
    const byCount = [...entries].sort((a, b) => b[1] - a[1])
    const head    = byCount.slice(0, DATE_CAP - 1).sort((a, b) => a[0].localeCompare(b[0]))
    const other   = byCount.slice(DATE_CAP - 1).reduce((s, [, v]) => s + v, 0)
    buckets = [...head.map(([label, value]) => ({ label, value })), { label: 'Other', value: other }]
  }
  return { kind: 'date', answered: answers.length, unanswered: subs.length - answers.length, buckets }
}

function analyzeText(field: FormField, subs: Submission[], full: boolean = false): TextResult {
  const answers = answersFor(subs, field.label)
  const counts  = new Map<string, number>()
  answers.forEach(v => counts.set(v, (counts.get(v) ?? 0) + 1))
  const repeated   = Array.from(counts.entries()).filter(([, c]) => c > 1)
  const topAnswers = repeated.length >= 2 ? repeated.sort((a, b) => b[1] - a[1]).slice(0, 6).map(([label, value]) => ({ label, value })) : []
  return { kind: 'text', answered: answers.length, total: subs.length, topAnswers, samples: answers.slice(0, 5), allAnswers: full ? answers : undefined }
}

function analyzeRating(field: FormField, subs: Submission[]): RatingResult {
  const min = field.minValue ?? 1
  const max = field.maxValue ?? 5
  const nums = answersFor(subs, field.label).map(parseFloat).filter(v => !isNaN(v))
  // Every rating level gets a bucket even at zero responses, so the legend
  // is always complete instead of silently omitting untouched ratings.
  const counts = new Map<string, number>()
  for (let v = min; v <= max; v++) counts.set(`Rating ${v}`, 0)
  nums.forEach(v => {
    const label = `Rating ${v}`
    if (counts.has(label)) counts.set(label, (counts.get(label) ?? 0) + 1)
  })
  return {
    kind: 'rating',
    answered: nums.length,
    unanswered: subs.length - nums.length,
    avg: nums.length ? nums.reduce((s, v) => s + v, 0) / nums.length : 0,
    min, max,
    buckets: Array.from(counts.entries()).map(([label, value]) => ({ label, value })),
  }
}

function analyzeMatrix(field: FormField, subs: Submission[]): MatrixResult {
  const rowLabels = (field.options ?? []).map(o => typeof o === 'string' ? o : o.label)
  const min = field.minValue ?? 1
  const max = field.maxValue ?? 5
  const perRow = new Map<string, { total: number; count: number; dist: Map<number, number> }>(
    rowLabels.map(r => [r, { total: 0, count: 0, dist: new Map(Array.from({ length: max - min + 1 }, (_, i) => [min + i, 0])) }])
  )
  let answered = 0
  answersFor(subs, field.label).forEach(raw => {
    answered++
    raw.split('||').filter(Boolean).forEach(pair => {
      const [row, scoreStr] = pair.split(':')
      const score = parseFloat(scoreStr)
      const entry = perRow.get(row)
      if (entry && !isNaN(score)) {
        entry.total += score
        entry.count++
        entry.dist.set(score, (entry.dist.get(score) ?? 0) + 1)
      }
    })
  })
  const rows: MatrixRow[] = rowLabels.map(row => {
    const e = perRow.get(row)!
    return {
      row,
      avg: e.count ? Math.round((e.total / e.count) * 10) / 10 : 0,
      distribution: Array.from(e.dist.entries()).map(([v, c]) => ({ label: `${v}`, value: c })),
    }
  })
  return { kind: 'matrix', rows, answered, scaleMin: min, scaleMax: max }
}

// Free-text fields like "Occupation" or "Residence" aren't a dropdown, but
// their answers cluster into a small set of short, repeated values just
// like a select field would — worth a real bar/donut chart instead of the
// generic text treatment. Genuine open-ended feedback ("why did you choose
// this") has answers that are long and mostly unique, so it's excluded by
// requiring short answers AND meaningful repetition — conservative on
// purpose to avoid misreading real open text as categorical.
function analyzeShortAnswerAsCategorical(field: FormField, subs: Submission[], full: boolean): CategoricalResult | null {
  const answers = answersFor(subs, field.label)
  if (answers.length < 4) return null
  const distinct = new Set(answers)
  const avgLen = answers.reduce((s, a) => s + a.length, 0) / answers.length
  if (avgLen > 30 || distinct.size > 12 || distinct.size > answers.length * 0.6) return null
  return analyzeSelect(field, subs, full)
}

export function analyzeField(field: FormField, subs: Submission[], full: boolean = false): FieldResult {
  switch (field.type) {
    case 'select':      return analyzeSelect(field, subs, full)
    case 'autocomplete': return analyzeSelect(field, subs, full)
    case 'multiselect': return analyzeMulti(field, subs, full)
    case 'checkbox':    return analyzeBoolean(field, subs, full)
    case 'number':      return analyzeNumber(field, subs, full)
    case 'date':        return analyzeDate(field, subs, full)
    case 'rating':      return analyzeRating(field, subs)
    case 'matrix':      return analyzeMatrix(field, subs)
    default:            return analyzeShortAnswerAsCategorical(field, subs, full) ?? analyzeText(field, subs, full)
  }
}

// Human-readable single-line preview of a stored answer, aware of field
// type so matrix/rating/multiselect values don't leak their raw internal
// "Row:Score||Row:Score" encoding into admin list/preview columns.
export function formatAnswerPreview(value: unknown, fieldDef?: FormField): string {
  if (value === '' || value == null) return ''
  const str = String(value)
  if (fieldDef?.type === 'matrix') {
    return str.split('||').filter(Boolean)
      .map(pair => { const [row, score] = pair.split(':'); return `${row}: ${score}` })
      .join(', ')
  }
  if (fieldDef?.type === 'rating') return `${str}/${fieldDef.maxValue ?? 5}`
  if (str.includes('||')) return str.split('||').map(v => v.trim()).filter(Boolean).join(', ')
  return str
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

// Splits submissions by their answer to one field, e.g. a "Team" field
// with "Rig"/"Van" values, so every other question can be compared side by
// side per group. Answers arrive here already applyFieldMerges-canonicalized
// (see AnalyticsClient.tsx), and select/autocomplete answers are closed-list
// values chosen from the field's own options in the first place — so a
// plain trimmed exact match is the correct grouping, no fuzzy normalization
// needed the way free-text categorical fields sometimes require.
export function splitBySegment(field: FormField, subs: Submission[]): {
  segments: { label: string; subs: Submission[] }[]
  unanswered: Submission[]
} {
  const byValue = new Map<string, Submission[]>()
  const unanswered: Submission[] = []
  subs.forEach(s => {
    const raw = (s.data as any)[field.label]
    const v = typeof raw === 'string' ? raw.trim() : ''
    if (!v) { unanswered.push(s); return }
    const arr = byValue.get(v) ?? []
    arr.push(s)
    byValue.set(v, arr)
  })
  const segments = Array.from(byValue.entries())
    .sort((a, b) => b[1].length - a[1].length)
    .map(([label, segSubs]) => ({ label, subs: segSubs }))
  return { segments, unanswered }
}

// Which fields are worth offering as a "Compare by" axis. Restricted to
// select/autocomplete — closed-list, human-readable values with no
// membership ambiguity (unlike multiselect, where one response can belong
// to several groups at once) and no raw-value special-casing needed (unlike
// checkbox, which stores 'true'/'false'). Capped at 6 distinct values: past
// that a side-by-side comparison stops being "clear at a glance" and is
// just the normal single breakdown again.
export function getComparableFields(fields: FormField[], subs: Submission[]): FormField[] {
  return fields.filter(f => {
    if (f.type !== 'select' && f.type !== 'autocomplete') return false
    const { segments } = splitBySegment(f, subs)
    return segments.length >= 2 && segments.length <= 6
  })
}

export function computeOverview(subs: Submission[]): OverviewData {
  const formCounts = new Map<string, number>()
  subs.forEach(s => {
    const name = s.forms?.name ?? 'Unknown'
    formCounts.set(name, (formCounts.get(name) ?? 0) + 1)
  })

  // Anchored and formatted entirely in UTC — toLocaleDateString without an
  // explicit timeZone reads the runtime's local zone, which differs
  // between Vercel's server (UTC) and a visitor's browser. That mismatch
  // produced different label text on the server-rendered HTML vs the
  // client's hydration pass (React error #418, "text content does not
  // match"). Using a single UTC reference point removes the ambiguity.
  const days = new Map<string, string>()
  const todayUTC = new Date()
  todayUTC.setUTCHours(0, 0, 0, 0)
  for (let i = 13; i >= 0; i--) {
    const d = new Date(todayUTC)
    d.setUTCDate(d.getUTCDate() - i)
    days.set(d.toISOString().slice(0, 10), d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }))
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
  // Matrix fields expand into one pseudo-key per row; a plain string key
  // can't safely encode "which field, which row" if either label happens
  // to contain the same separator, so track that mapping out-of-band.
  const matrixKeyInfo = new Map<string, { fieldLabel: string; row: string }>()
  let matrixKeyCounter = 0

  if (form?.fields && Array.isArray(form.fields)) {
    let currentSection = ''
    form.fields.forEach((field: any) => {
      if (field.section === 'SECTION_HEADER') {
        currentSection = field.label
        headers.push(field.label)
        fieldKeys.push(`__section__${field.id}`)
      } else if (field.type === 'matrix' && Array.isArray(field.options)) {
        // One column per row instead of one dump-everything column —
        // mirrors the __section__ pseudo-key pattern above.
        field.options.forEach((opt: any) => {
          const row = typeof opt === 'string' ? opt : opt.label
          const label = `${field.label} — ${row}`
          headers.push(currentSection ? `${currentSection} - ${label}` : label)
          const pseudoKey = `__matrix__${matrixKeyCounter++}`
          matrixKeyInfo.set(pseudoKey, { fieldLabel: field.label, row })
          fieldKeys.push(pseudoKey)
        })
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
    fieldKeys.filter(k => !k.startsWith('__section__') && !k.startsWith('__matrix__') && /image|photo|product|supply/i.test(k))
  )

  const rows = [
    headers,
    ...subs.map(s => [
      s.forms?.name ?? '',
      ...fieldKeys.map(k => {
        if (k.startsWith('__section__')) return '' // Section headers have no data
        if (k.startsWith('__matrix__')) {
          const info = matrixKeyInfo.get(k)
          if (!info) return ''
          const pairs = String((s.data as any)?.[info.fieldLabel] ?? '').split('||').filter(Boolean)
          const match = pairs.find(p => p.split(':')[0] === info.row)
          return match ? (match.split(':')[1] ?? '') : ''
        }
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
