import { getSubmissions, getForms, type Form, type Submission } from '@/app/actions/forms'
import Link from 'next/link'

export const revalidate = 0

const ICONS: Record<string, string> = {
  'Tents & Shelter':       '⛺',
  'Electronics & AV':      '🔊',
  'Food & Catering':        '🍽️',
  'Transport & Logistics':  '🚛',
  'Furniture & Decor':      '🪑',
  'Security':               '🛡️',
  'Printing':               '🖨️',
  'General':                '📋',
  'Other':                  '📦',
}

interface CatStats {
  total: number
  pending: number
  approved: number
  forms: string[]
}

export default async function CategoriesPage() {
  const [submissions, forms]: [Submission[], Form[]] = await Promise.all([
    getSubmissions(),
    getForms(),
  ])

  const catMap: Record<string, CatStats> = {}

  submissions.forEach((s: Submission) => {
    const cat = s.forms?.category ?? 'Unknown'
    if (!catMap[cat]) catMap[cat] = { total: 0, pending: 0, approved: 0, forms: [] }
    catMap[cat].total++
    if (s.status === 'pending')  catMap[cat].pending++
    if (s.status === 'approved') catMap[cat].approved++
  })

  forms.forEach((f: Form) => {
    if (!catMap[f.category]) catMap[f.category] = { total: 0, pending: 0, approved: 0, forms: [] }
    if (!catMap[f.category].forms.includes(f.name)) {
      catMap[f.category].forms.push(f.name)
    }
  })

  return (
    <>
      <header className="bg-white border-b border-gray-100 px-6 h-14 flex items-center flex-shrink-0">
        <h1 className="font-semibold">By category</h1>
      </header>

      <main className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-3 gap-4">
          {Object.entries(catMap).map(([cat, stats]: [string, CatStats]) => (
            <Link
              key={cat}
              href={`/admin/suppliers?category=${encodeURIComponent(cat)}`}
              className="card p-5 hover:border-brand-200 hover:shadow transition-all block"
            >
              <div className="text-3xl mb-3">{ICONS[cat] ?? '📦'}</div>
              <h2 className="font-semibold text-sm mb-1">{cat}</h2>
              <p className="text-2xl font-bold text-gray-900 mb-3">{stats.total}</p>
              <div className="flex gap-3 text-xs text-gray-500 mb-3">
                <span className="text-amber-600 font-medium">{stats.pending} pending</span>
                <span className="text-brand-600 font-medium">{stats.approved} approved</span>
              </div>
              {stats.forms.length > 0 && (
                <p className="text-xs text-gray-400 truncate">Forms: {stats.forms.join(', ')}</p>
              )}
            </Link>
          ))}
        </div>
      </main>
    </>
  )
}
