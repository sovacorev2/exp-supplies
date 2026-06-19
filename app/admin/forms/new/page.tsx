'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createForm, type FormField, type FieldType } from '@/app/actions/forms'
import { generateSlug } from '@/lib/utils'
import { Plus, Trash2, GripVertical, ExternalLink, Copy } from 'lucide-react'

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

function uid() { return Math.random().toString(36).slice(2, 8) }

export default function NewFormPage() {
  const router = useRouter()
  const [name, setName]               = useState('')
  const [description, setDescription] = useState('')
  const [fields, setFields]           = useState<FormField[]>([])
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
      const form = await createForm({ name, description, category: '', fields, is_active: true, slug })
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
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 md:px-6 py-4 md:py-5 flex flex-col md:flex-row md:items-center md:justify-between flex-shrink-0 shadow-sm gap-4">
        <div className="min-w-0">
          <h1 className="font-bold text-xl md:text-2xl text-gray-900 dark:text-white">Create Form</h1>
          <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400 mt-1">Design your form by adding any fields you need</p>
        </div>
        <button onClick={publish} disabled={saving || !name} className="btn btn-primary text-sm md:text-base py-3 px-4 md:px-6 font-bold flex-shrink-0 w-full md:w-auto justify-center">
          {saving ? 'Publishing…' : 'Publish Form'}
        </button>
      </header>

      <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-white dark:bg-gray-900">
        {published && (
          <div className="mb-6 flex flex-col md:flex-row md:items-center gap-3 p-4 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 shadow-sm">
            <span className="text-sm font-bold flex-1">Form Published Successfully!</span>
            <code className="text-xs bg-white dark:bg-gray-800 px-3 py-1.5 rounded border border-green-200 dark:border-green-700 font-mono text-green-900 dark:text-green-200 break-all">
              {typeof window !== 'undefined' ? window.location.origin : ''}{published}
            </code>
            <div className="flex gap-2 flex-shrink-0">
              <button onClick={copyLink} className="btn text-xs py-2 px-3 bg-white dark:bg-gray-800 border-green-200 dark:border-green-700 text-green-600 dark:text-green-300 hover:bg-green-50 dark:hover:bg-green-900/30">
                <Copy size={14} />
              </button>
              <a href={published} target="_blank" className="btn text-xs py-2 px-3 bg-green-600 text-white hover:bg-green-700">
                <ExternalLink size={14} />
              </a>
              <button onClick={() => router.push('/admin/forms')} className="btn text-xs py-2 px-3 bg-white dark:bg-gray-800 border-green-200 dark:border-green-700 text-gray-600 dark:text-gray-300">
                Done
              </button>
            </div>
          </div>
        )}

        {/* Step 1: Form Details at the top */}
        <div className="card p-5 md:p-6 space-y-5 mb-6 md:mb-8">
          <div>
            <h2 className="font-bold text-lg text-gray-900 dark:text-white">Step 1: Form Details</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Name your form and describe what you need from suppliers</p>
          </div>
          <div>
            <label className="label">Form name *</label>
            <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Catering Suppliers 2025" />
          </div>
          <div>
            <label className="label">Description (shown to suppliers)</label>
            <textarea className="input" rows={4} value={description} onChange={e => setDescription(e.target.value)} placeholder="Tell suppliers what this form is for…" />
          </div>
        </div>

        {/* Step 2: Add Fields Section */}
        <div className="space-y-6">
          <div className="card p-0 overflow-hidden">
            <div className="px-5 md:px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
              <h2 className="font-bold text-lg text-gray-900 dark:text-white">Step 2: Add Form Fields</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">({fields.length} fields added)</p>
            </div>
            <div className="p-4 md:p-6 space-y-3">
              {fields.map((f: FormField) => (
                <div key={f.id} className="flex items-center gap-3 p-4 rounded-lg bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors border border-gray-200 dark:border-gray-600 group">
                  <GripVertical size={16} className="text-gray-400 dark:text-gray-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                      {f.label} {f.required && <span className="text-brand-500 font-bold">*</span>}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {FIELD_TYPES.find(t => t.value === f.type)?.label}
                      {f.placeholder && ` • "${f.placeholder}"`}
                    </p>
                  </div>
                  <button 
                    onClick={() => removeField(f.id)} 
                    className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 p-2 rounded-lg"
                    title="Delete field"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              {fields.length === 0 && (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-12 font-medium">No fields yet - add one below</p>
              )}
            </div>
          </div>

          {/* Add Field Form */}
          <div className="card p-5 md:p-6 space-y-5 bg-gradient-to-b from-brand-50 dark:from-brand-900/20 to-white dark:to-gray-800">
            <div>
              <h3 className="font-bold text-base text-gray-900 dark:text-white">Add a new field</h3>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Fill in the details below and click Add field</p>
            </div>
            
            <div>
              <label className="label">Field label *</label>
              <input className="input" value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="e.g. Delivery area" />
            </div>
            
            <div>
              <label className="label">Field type</label>
              <select className="input" value={newType} onChange={e => setNewType(e.target.value as FieldType)}>
                {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              {newType === 'select' && (
                <p className="text-xs text-brand-700 dark:text-brand-300 mt-3 p-3 bg-brand-50 dark:bg-brand-900/30 rounded-lg font-medium">Dropdown list - Great for categories, options, or choices</p>
              )}
            </div>
            
            {newType === 'select' && (
              <div>
                <label className="label">Dropdown options (one per line)</label>
                <textarea className="input" rows={5} value={newOptions} onChange={e => setNewOptions(e.target.value)} placeholder={"Option 1\nOption 2\nOption 3"} />
              </div>
            )}
            {newType !== 'select' && newType !== 'checkbox' && (
              <div>
                <label className="label">Placeholder text</label>
                <input className="input" value={newPlaceholder} onChange={e => setNewPlaceholder(e.target.value)} placeholder="Hint text" />
              </div>
            )}
            <label className="flex items-center gap-3 p-3 rounded-lg border-2 border-gray-200 dark:border-gray-600 hover:border-brand-300 dark:hover:border-brand-600 cursor-pointer transition-colors">
              <input type="checkbox" id="req" checked={newRequired} onChange={e => setNewRequired(e.target.checked)} className="w-5 h-5 rounded" />
              <span className="text-base font-medium text-gray-700 dark:text-gray-300">Required field</span>
            </label>
            <button onClick={addField} disabled={!newLabel.trim()} className="btn btn-primary w-full justify-center py-3 text-base font-bold">
              <Plus size={18} /> Add field
            </button>
          </div>
        </div>
      </main>
    </>
  )
}
