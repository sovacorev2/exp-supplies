'use client'

import { useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend,
} from 'recharts'
import type { Bucket, FieldResult, RadarAxis, TextResult } from '@/lib/analytics'
import type { FormField } from '@/app/actions/forms'

// ── colour palette — built from the Exp brand red/silver scale (see
// tailwind.config.js) so charts stay on-brand instead of an arbitrary
// rainbow, while still alternating red/grey and dark/light to keep
// adjacent segments distinguishable at a glance.
const PRIMARY = '#ED1C24' // brand-500, Pantone 485 C
const SERIES  = ['#ED1C24','#6D6E71','#b01319','#d0d0d2','#f7aaaa','#575859','#920e15','#e7e7e8']
const OTHER   = '#b9b9bb' // silver-400

function color(idx: number, label: string) {
  return label === 'Other' ? OTHER : SERIES[idx % SERIES.length]
}

// ── Stat tile ───────────────────────────────────────────────────────────────
export function StatTile({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-gray-100 dark:bg-gray-700/60 border border-gray-200 dark:border-gray-600 rounded-xl p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">{label}</p>
      <p className="text-2xl font-black text-gray-900 dark:text-white">{value}</p>
      {sub && <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">{sub}</p>}
    </div>
  )
}

// ── Horizontal bar list ─────────────────────────────────────────────────────
export function BarList({ data, highlightMax }: { data: Bucket[]; highlightMax?: boolean }) {
  if (!data.length) return <p className="text-sm text-gray-400 py-4 text-center">No data yet</p>
  const max    = Math.max(...data.map(d => d.value), 1)
  const winner = highlightMax ? Math.max(...data.map(d => d.value)) : -1
  return (
    <div className="flex flex-col gap-3">
      {data.map((d, i) => {
        const pct   = (d.value / max) * 100
        const isWin = highlightMax && d.value === winner && winner > 0
        const col   = color(i, d.label)
        return (
          <div key={d.label}>
            <div className="flex justify-between items-baseline gap-2 mb-1">
              <span className={`text-[13px] text-gray-600 dark:text-gray-300 ${isWin ? 'font-bold' : 'font-medium'}`}>
                {isWin && <span className="text-yellow-500 mr-1">★</span>}{d.label}
              </span>
              <span className="text-[13px] font-bold text-gray-900 dark:text-white flex-shrink-0">{d.value}</span>
            </div>
            <div className="h-3 w-full bg-gray-200 dark:bg-gray-700 rounded-sm">
              <div className="h-full rounded-r-sm transition-all duration-500" style={{ width: `${pct}%`, background: col }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Donut chart ─────────────────────────────────────────────────────────────
export function DonutChart({ data }: { data: Bucket[] }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  if (!total) return <p className="text-sm text-gray-400 py-4 text-center">No data yet</p>
  const dataWithColor = data.map((d, i) => ({ ...d, fill: color(i, d.label) }))
  return (
    <div className="flex items-center gap-6 flex-wrap">
      <ResponsiveContainer width={180} height={180}>
        <PieChart>
          <Pie data={dataWithColor} dataKey="value" cx="50%" cy="50%" innerRadius={52} outerRadius={80} paddingAngle={2}>
            {dataWithColor.map((d, i) => <Cell key={i} fill={d.fill} />)}
          </Pie>
          <text x={90} y={84} textAnchor="middle" dominantBaseline="middle" className="fill-gray-900 dark:fill-white" style={{ fontSize: 22, fontWeight: 800 }}>{total}</text>
          <text x={90} y={102} textAnchor="middle" dominantBaseline="middle" style={{ fontSize: 11, fill: '#9ca3af' }}>responses</text>
        </PieChart>
      </ResponsiveContainer>
      <ul className="flex-1 min-w-[160px] flex flex-col gap-2">
        {dataWithColor.map((d, i) => (
          <li key={i} className="flex items-center gap-2 text-[13px]">
            <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: d.fill }} />
            <span className="flex-1 text-gray-600 dark:text-gray-300 truncate">{d.label}</span>
            <span className="font-bold text-gray-900 dark:text-white">{d.value} <span className="font-normal text-gray-400">({Math.round((d.value / total) * 100)}%)</span></span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ── Histogram bar chart ──────────────────────────────────────────────────────
export function HistogramChart({ data }: { data: Bucket[] }) {
  if (!data.length) return <p className="text-sm text-gray-400 py-4 text-center">No data yet</p>
  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={data} margin={{ top: 4, right: 0, left: -28, bottom: 0 }}>
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9ca3af' }} />
        <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} allowDecimals={false} />
        <Tooltip contentStyle={{ background: 'var(--tooltip-bg,#1f2937)', border: 'none', borderRadius: 8, fontSize: 12 }} />
        <Bar dataKey="value" radius={[4,4,0,0]}>
          {data.map((d, i) => <Cell key={i} fill={PRIMARY} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// ── Radar chart (pure SVG, no recharts) ─────────────────────────────────────
export function RadarChart({ axes }: { axes: RadarAxis[] }) {
  const SIZE = 280, CENTER = 140, MAX_R = 92
  const n = axes.length
  const RINGS = [0.25, 0.5, 0.75, 1]
  const pt = (angle: number, r: number) => ({ x: CENTER + r * Math.cos(angle), y: CENTER + r * Math.sin(angle) })
  const normalized = axes.map(a => { const span = a.max - a.min; return span > 0 ? Math.min(1, Math.max(0, (a.avg - a.min) / span)) : 0 })
  const poly = (vals: number[], scale: number) => vals.map((v, i) => { const a = -Math.PI / 2 + (i * 2 * Math.PI) / n; const p = pt(a, v * scale); return `${p.x},${p.y}` }).join(' ')

  return (
    <div className="flex justify-center">
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        {RINGS.map((r, ri) => (
          <polygon key={ri} points={poly(new Array(n).fill(1), MAX_R * r)} fill="none" stroke="var(--border-color,#374151)" strokeWidth={1} />
        ))}
        {axes.map((_, i) => {
          const a = -Math.PI / 2 + (i * 2 * Math.PI) / n
          const p = pt(a, MAX_R)
          return <line key={i} x1={CENTER} y1={CENTER} x2={p.x} y2={p.y} stroke="var(--border-color,#374151)" strokeWidth={1} />
        })}
        <polygon points={poly(normalized, MAX_R)} fill={SERIES[0]} fillOpacity={0.12} stroke={SERIES[0]} strokeWidth={2} strokeLinejoin="round" />
        {axes.map((a, i) => {
          const angle  = -Math.PI / 2 + (i * 2 * Math.PI) / n
          const vertex = pt(angle, normalized[i] * MAX_R)
          const lp     = pt(angle, MAX_R + 26)
          const cosv   = Math.cos(angle)
          const anchor = Math.abs(cosv) < 0.35 ? 'middle' : (cosv > 0 ? 'start' : 'end')
          const label  = a.label.length > 18 ? a.label.slice(0, 17) + '…' : a.label
          return (
            <g key={i}>
              <circle cx={vertex.x} cy={vertex.y} r={4} fill={SERIES[0]} stroke="var(--surface-color,#1f2937)" strokeWidth={2} />
              <text x={lp.x} y={lp.y} textAnchor={anchor} fontSize={11} fontWeight={600} fill="#9ca3af">{label}</text>
              <text x={vertex.x} y={vertex.y - 10} textAnchor="middle" fontSize={11} fontWeight={700} fill={SERIES[0]}>{a.avg.toFixed(1)}/{a.max}</text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

// ── Chart card (chart ⟷ table toggle) ───────────────────────────────────────
export function ChartCard({ title, meta, children, tableRows, tableValueHeader }: {
  title: string; meta?: string; children: React.ReactNode
  tableRows?: { label: string; value: string | number }[]
  tableValueHeader?: string
}) {
  const [showTable, setShowTable] = useState(false)
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="text-[14px] font-bold text-gray-900 dark:text-white">{title}</h3>
          {meta && <p className="text-[12px] text-gray-400 mt-0.5">{meta}</p>}
        </div>
        {tableRows && tableRows.length > 0 && (
          <button onClick={() => setShowTable(v => !v)} className="text-[12px] font-semibold text-gray-400 hover:text-brand-500 hover:bg-gray-100 dark:hover:bg-gray-700 px-2.5 py-1.5 rounded-lg transition-colors flex-shrink-0">
            {showTable ? 'Chart' : 'Table'}
          </button>
        )}
      </div>
      {showTable && tableRows ? (
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="text-left text-[11px] uppercase tracking-wider text-gray-400 pb-2">Label</th>
              <th className="text-right text-[11px] uppercase tracking-wider text-gray-400 pb-2">{tableValueHeader ?? 'Count'}</th>
            </tr>
          </thead>
          <tbody>
            {tableRows.map((r, i) => (
              <tr key={i} className="border-b border-gray-100 dark:border-gray-700/50 last:border-0">
                <td className="py-1.5 text-gray-600 dark:text-gray-300">{r.label}</td>
                <td className="py-1.5 text-right font-semibold text-gray-900 dark:text-white">{r.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : children}
    </div>
  )
}

// ── Per-field card composer ──────────────────────────────────────────────────
export function FieldCard({ field, result }: { field: FormField; result: FieldResult }) {
  if (result.kind === 'categorical') {
    const meta = `${result.answered} answered${result.unanswered > 0 ? ` · ${result.unanswered} skipped` : ''}`
    if (!result.buckets.length) return <ChartCard title={field.label} meta={meta}><p className="text-sm text-gray-400 py-4 text-center">No answers yet</p></ChartCard>
    const chart = result.buckets.length <= 2 ? <BarList data={result.buckets} highlightMax /> : <DonutChart data={result.buckets} />
    return <ChartCard title={field.label} meta={meta} tableRows={result.buckets}>{chart}</ChartCard>
  }
  if (result.kind === 'multi') {
    return (
      <ChartCard title={field.label} meta={`${result.respondents} respondents · ${result.totalSelections} selections`} tableRows={result.buckets}>
        <BarList data={result.buckets} highlightMax />
      </ChartCard>
    )
  }
  if (result.kind === 'boolean') {
    const total = result.yes + result.no
    const pct   = (n: number) => total > 0 ? `${Math.round((n / total) * 100)}%` : '—'
    return (
      <ChartCard title={field.label} meta={`${total} answered${result.unanswered > 0 ? ` · ${result.unanswered} skipped` : ''}`} tableRows={[{ label: 'Yes', value: result.yes }, { label: 'No', value: result.no }]}>
        <div className="grid grid-cols-2 gap-3">
          <StatTile label="Yes" value={result.yes} sub={pct(result.yes)} />
          <StatTile label="No"  value={result.no}  sub={pct(result.no)} />
        </div>
      </ChartCard>
    )
  }
  if (result.kind === 'numeric') {
    if (!result.answered) return <ChartCard title={field.label} meta="No answers yet"><p className="text-sm text-gray-400 py-4 text-center">No answers yet</p></ChartCard>
    return (
      <ChartCard title={field.label} meta={`${result.answered} answered`} tableRows={result.histogram}>
        <div className="grid grid-cols-4 gap-2 mb-4">
          <StatTile label="Average" value={result.avg.toFixed(1)} />
          <StatTile label="Median"  value={result.median} />
          <StatTile label="Min"     value={result.min} />
          <StatTile label="Max"     value={result.max} />
        </div>
        <HistogramChart data={result.histogram} />
      </ChartCard>
    )
  }
  if (result.kind === 'date') {
    const meta = `${result.answered} answered${result.unanswered > 0 ? ` · ${result.unanswered} skipped` : ''}`
    if (!result.buckets.length) return <ChartCard title={field.label} meta={meta}><p className="text-sm text-gray-400 py-4 text-center">No answers yet</p></ChartCard>
    return <ChartCard title={field.label} meta={meta} tableRows={result.buckets}><BarList data={result.buckets} highlightMax /></ChartCard>
  }
  // text
  return <TextFieldCard field={field} result={result} />
}

function TextFieldCard({ field, result }: { field: FormField; result: TextResult }) {
  const [showAll, setShowAll] = useState(false)
  const rate = result.total > 0 ? Math.round((result.answered / result.total) * 100) : 0
  const all  = result.allAnswers ?? []

  return (
    <>
      <ChartCard title={field.label} meta="Open-ended" tableRows={result.topAnswers.map(b => ({ label: b.label, value: b.value }))}>
        <StatTile label="Response rate" value={`${rate}%`} sub={`${result.answered} of ${result.total} answered`} />
        {(result.topAnswers.length >= 2 || result.samples.length > 0) && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                {result.topAnswers.length >= 2 ? 'Most repeated answers' : 'Sample responses'}
              </p>
              {result.answered > 0 && (
                <button
                  onClick={() => setShowAll(true)}
                  className="text-[12px] font-semibold text-brand-600 dark:text-brand-400 hover:underline flex-shrink-0"
                >
                  View all {result.answered} responses
                </button>
              )}
            </div>
            {result.topAnswers.length >= 2 ? (
              <BarList data={result.topAnswers} />
            ) : (
              <div className="flex flex-col gap-2">
                {result.samples.slice(0, 3).map((s, i) => (
                  <div key={i} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg px-3 py-2 text-[13px] text-gray-600 dark:text-gray-300 truncate">{s}</div>
                ))}
              </div>
            )}
          </div>
        )}
      </ChartCard>

      {showAll && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setShowAll(false)}>
          <div
            className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">{field.label}</h3>
                <p className="text-xs text-gray-400 mt-0.5">{all.length} response{all.length !== 1 ? 's' : ''}</p>
              </div>
              <button
                onClick={() => setShowAll(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl leading-none flex-shrink-0"
                aria-label="Close"
              >
                &times;
              </button>
            </div>
            <div className="overflow-y-auto px-5 py-4 flex flex-col gap-2">
              {all.map((s, i) => (
                <div key={i} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg px-3 py-2 text-[13px] text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{s}</div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
