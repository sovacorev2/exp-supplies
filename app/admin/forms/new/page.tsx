'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createForm, generateSlug, FormField, FieldType } from '@/lib/supabase'
import { Plus, Trash2, GripVertical, ExternalLink } from 'lucide-react'

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

  return (
    <>
      <header className="bg-white border-b border-gray-100 px-6 h-14 flex items-center justify-between flex-shrink-0">
        <h1 className="font-semibold">New form</h1>
        <button onClick={publish} disabled={saving || !name} className="btn btn-primary text-xs py-1.5 px-4">
          {saving ? 'Publishing…' : 'Publish form'}
        </button>
      </header>

      <main className="flex-1 overflow-y-auto p-6">
        {published && (
          <div className="mb-5 flex items-center gap-3 p-4 rounded-xl bg-brand-50 border border-brand-100 text-brand-700">
            <span className="text-sm font-medium">✓ Form published!</span>
            <code className="text-xs bg-white px-2 py-1 rounded border border-brand-200">
              {typeof window !== 'undefined' ? window.location.origin : ''}{published}
            </code>
            <a href={published} target="_blank" className="btn text-xs py-1 px-2 border-brand-200 text-brand-700 hover:bg-brand-100">
              <ExternalLink size={12} /> Open
            </a>
            <button onClick={() => router.push('/admin/forms')} className="ml-auto btn text-xs py-1 px-2">
              Back to forms
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
                  <div key={f.id} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50">
                    <GripVertical size={15} className="text-gray-300" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {f.label} {f.required && <span className="text-red-400">*</span>}
                      </p>
                      <p className="text-xs text-gray-400">
                        {FIELD_TYPES.find(t => t.value === f.type)?.label}
                      </p>
                    </div>
                    <button onClick={() => removeField(f.id)} className="text-gray-300 hover:text-red-500 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                {fields.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-6">No fields yet — add one →</p>
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
