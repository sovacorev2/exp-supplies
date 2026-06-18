'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createForm, generateSlug, type FormField, type FieldType } from '@/app/actions/forms'
import { Plus, Trash2, GripVertical, ExternalLink, Copy } from 'lucide-react'

const CATEGORIES = [
  'General', 'Tents & Shelter', 'Electronics & AV', 'Food & Catering',
  'Transport & Logistics', 'Furniture & Decor', 'Security', 'Printing', 'Other',
]

const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: 'text',     label: 'Short text' },
  { value: 'textarea', label: 'Long text' },
  { value: 'email',    label: 'Email' },
  { value: 'tel',      label: 'Phone number' },
  { value: 'number',   label: 'Number' },
  { value: 'select',   label: 'Dropdown' },
  { value: 'date',     label: 'Date' },
  { value: 'checkbox', label: 'Checkbox' },
]

const DEFAULT_FIELDS: FormField[] = [
  { id: 'df1', label: 'Company name',     type: 'text',  required: true,  placeholder: 'e.g. Acme Supplies Ltd' },
  { id: 'df2', label: 'Contact person',   type: 'text',  required: true,  placeholder: 'Full name' },
  { id: 'df3', label: 'Email address',    type: 'email', required: true,  placeholder: 'you@company.com' },
  { id: 'df4', label: 'Phone number',     type: 'tel',   required: true,  placeholder: '+254 7XX XXX XXX' },
  { id: 'df5', label: 'County / location',type: 'text',  required: true,  placeholder: 'e.g. Nairobi' },
]

function uid() { return Math.random().toString(36).slice(2, 8) }

export default function NewFormPage() {
  const router = useRouter()
  const [name, setName]               = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory]       = useState('General')
  const [fields, setFields]           = useState<FormField[]>(DEFAULT_FIELDS)
  const [saving, setSaving]           = useState(false)
  const [published, setPublished]     = useState('')

  const [newLabel, setNewLabel]           = useState('')
  const [newType, setNewType]             = useState<FieldType>('text')
  const [newRequired, setNewRequired]     = useState(true)
  const [newPlaceholder, setNewPlaceholder] = useState('')
  const [newOptions, setNewOptions]       = useState('')

  function addField() {
    if (!newLabel.trim()) return
    const field: FormField = {
      id:          uid(),
      label:       newLabel.trim(),
      type:        newType,
      required:    newRequired,
      placeholder: newPlaceholder || undefined,
      options:     newType === 'select'
                     ? newOptions.split('\n').map(s => s.trim()).filter(Boolean)
                     : undefined,
    }
    setFields(prev => [...prev, field])
    setNewLabel('')
    setNewPlaceholder('')
    setNewOptions('')
  }

  function removeField(id: string) {
    setFields(prev => prev.filter(f => f.id !== id))
  }

  async function publish() {
    if (!name.trim() || fields.length === 0) return
    setSaving(true)
    try {
      const slug = generateSlug(name)
      const form = await createForm({ name, description, category, fields, is_active: true, slug })
      setPublished(`/f/${form.slug}`)
    } catch {
      alert('Error publishing form. Check your DATABASE_URL environment variable.')
    } finally {
      setSaving(false)
    }
  }

  function copyLink() {
    if (published) {
      const fullUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}${published}`
      navigator.clipboard.writeText(fullUrl)
    }
  }

  return (
    <>
      <header className="bg-white border-b border-gray-100 px-6 h-14 flex items-center justify-between flex-shrink-0 shadow-sm">
        <h1 className="font-semibold text-gray-900">Create New Form</h1>
        <button onClick={publish} disabled={saving || !name} className="btn btn-primary text-xs py-1.5 px-4">
          {saving ? 'Publishing…' : 'Publish form'}
        </button>
      </header>

      <main className="flex-1 overflow-y-auto p-6">
        {published && (
          <div className="mb-5 flex items-center gap-3 p-4 rounded-xl bg-gradient-to-r from-brand-50 to-brand-100 border border-brand-200 text-brand-700 shadow-sm">
            <span className="text-sm font-semibold flex-1">Form Published Successfully!</span>
            <code className="text-xs bg-white px-3 py-1.5 rounded border border-brand-200 font-mono">
              {typeof window !== 'undefined' ? window.location.origin : ''}{published}
            </code>
            <button onClick={copyLink} className="btn text-xs py-1 px-2 bg-white border-brand-200 text-brand-600 hover:bg-brand-50">
              <Copy size={12} /> Copy
            </button>
            <a href={published} target="_blank" className="btn text-xs py-1 px-2 bg-brand-500 text-white hover:bg-brand-600">
              <ExternalLink size={12} /> Open
            </a>
            <button onClick={() => router.push('/admin/forms')} className="ml-auto btn text-xs py-1 px-2 bg-white border-brand-200">
              Done
            </button>
          </div>
        )}

        <div className="grid grid-cols-5 gap-5 items-start">
          <div className="col-span-3 space-y-4">
            <div className="card p-5 space-y-4">
              <div>
                <label className="label">Form name *</label>
                <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Catering Suppliers 2025" />
              </div>
              <div>
                <label className="label">Category</label>
                <select className="input" value={category} onChange={e => setCategory(e.target.value)}>
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Description (shown to suppliers)</label>
                <textarea className="input" rows={2} value={description} onChange={e => setDescription(e.target.value)} placeholder="Tell suppliers what this form is for…" />
              </div>
            </div>

            <div className="card">
              <div className="px-5 py-3.5 border-b border-gray-100">
                <h2 className="font-medium text-sm">Form fields ({fields.length})</h2>
              </div>
              <div className="p-4 space-y-2">
                {fields.map((f: FormField) => (
                  <div key={f.id} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors border border-gray-200 group">
                    <GripVertical size={15} className="text-gray-300 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {f.label} {f.required && <span className="text-brand-500 font-bold">*</span>}
                      </p>
                      <p className="text-xs text-gray-400">
                        {FIELD_TYPES.find(t => t.value === f.type)?.label}
                        {f.placeholder && ` • "${f.placeholder}"`}
                      </p>
                    </div>
                    <button 
                      onClick={() => removeField(f.id)} 
                      className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-red-500 hover:bg-red-50 p-2 rounded-lg"
                      title="Delete field"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
                {fields.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-8">No fields yet — add one on the right →</p>
                )}
              </div>
            </div>
          </div>

          <div className="col-span-2 card p-5 space-y-4 sticky top-0">
            <h2 className="font-medium text-sm">Add a field</h2>
            <div>
              <label className="label">Field label</label>
              <input className="input" value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="e.g. Delivery area" />
            </div>
            <div>
              <label className="label">Field type</label>
              <select className="input" value={newType} onChange={e => setNewType(e.target.value as FieldType)}>
                {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            {newType === 'select' && (
              <div>
                <label className="label">Options (one per line)</label>
                <textarea className="input" rows={4} value={newOptions} onChange={e => setNewOptions(e.target.value)} placeholder={"Option A\nOption B\nOption C"} />
              </div>
            )}
            {newType !== 'select' && newType !== 'checkbox' && (
              <div>
                <label className="label">Placeholder text</label>
                <input className="input" value={newPlaceholder} onChange={e => setNewPlaceholder(e.target.value)} placeholder="Hint text inside the field" />
              </div>
            )}
            <div className="flex items-center gap-2">
              <input type="checkbox" id="req" checked={newRequired} onChange={e => setNewRequired(e.target.checked)} className="rounded" />
              <label htmlFor="req" className="text-sm text-gray-600">Required field</label>
            </div>
            <button onClick={addField} disabled={!newLabel.trim()} className="btn btn-primary w-full justify-center">
              <Plus size={15} /> Add field
            </button>
          </div>
        </div>
      </main>
    </>
  )
}
