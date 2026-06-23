'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { updateForm, deleteForm, getForms, type FormField, type FieldType } from '@/app/actions/forms'
import { Plus, Trash2, GripVertical, ExternalLink, AlertCircle, Check } from 'lucide-react'

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
  { value: 'multiselect', label: 'Multiple choice' },
  { value: 'date',     label: 'Date' },
  { value: 'checkbox', label: 'Checkbox' },
]

function uid() { return Math.random().toString(36).slice(2, 8) }

export default function EditFormPage() {
  const router = useRouter()
  const params = useParams()
  const formId = params.id as string

  const [form, setForm] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('General')
  const [fields, setFields] = useState<FormField[]>([])

  const [newLabel, setNewLabel] = useState('')
  const [newType, setNewType] = useState<FieldType>('text')
  const [newRequired, setNewRequired] = useState(true)
  const [newPlaceholder, setNewPlaceholder] = useState('')
  const [newOptions, setNewOptions] = useState('')
  const [newHasSuboptions, setNewHasSuboptions] = useState(false)
  const [newSuboptionsMap, setNewSuboptionsMap] = useState<Record<string, string>>({})

  const [editingField, setEditingField] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [editType, setEditType] = useState<FieldType>('text')
  const [editRequired, setEditRequired] = useState(true)

  useEffect(() => {
    async function loadForm() {
      try {
        const forms = await getForms()
        const targetForm = forms.find(f => f.id === formId)
        if (!targetForm) {
          setError('Form not found')
          return
        }
        setForm(targetForm)
        setName(targetForm.name)
        setDescription(targetForm.description || '')
        setCategory(targetForm.category)
        setFields(targetForm.fields)
      } catch (err) {
        setError('Failed to load form')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    loadForm()
  }, [formId])

  function addField() {
    if (!newLabel.trim()) return
    let options: (string | { label: string; suboptions?: string[] })[] | undefined
    
    if (newType === 'select' || newType === 'multiselect') {
      const baseOptions = newOptions.split('\n').map(s => s.trim()).filter(Boolean)
      if (newHasSuboptions) {
        options = baseOptions.map(opt => ({
          label: opt,
          suboptions: (newSuboptionsMap[opt] || '').split('\n').map(s => s.trim()).filter(Boolean)
        }))
      } else {
        options = baseOptions
      }
    }
    
    const field: FormField = {
      id: uid(),
      label: newLabel.trim(),
      type: newType,
      required: newRequired,
      placeholder: newPlaceholder || undefined,
      options: options,
      hasSuboptions: newHasSuboptions || undefined,
    }
    setFields(prev => [...prev, field])
    setNewLabel('')
    setNewPlaceholder('')
    setNewOptions('')
    setNewHasSuboptions(false)
    setNewSuboptionsMap({})
  }

  function removeField(id: string) {
    setFields(prev => prev.filter(f => f.id !== id))
  }

  function startEditField(field: FormField) {
    setEditingField(field.id)
    setEditLabel(field.label)
    setEditType(field.type)
    setEditRequired(field.required)
  }

  function saveEditField() {
    if (!editLabel.trim()) return
    setFields(prev => prev.map(f =>
      f.id === editingField
        ? { ...f, label: editLabel.trim(), type: editType, required: editRequired }
        : f
    ))
    setEditingField(null)
  }

  async function save() {
    if (!name.trim() || fields.length === 0) return
    setSaving(true)
    setSaved(false)
    setError('')

    try {
      await updateForm(formId, {
        name,
        description,
        category,
        fields,
      } as any)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setError('Failed to save form')
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!confirm('Delete this form and all its submissions? This cannot be undone.')) return

    try {
      await deleteForm(formId)
      router.push('/admin/forms')
    } catch (err) {
      alert('Failed to delete form')
      console.error(err)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-500">Loading form...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
          <AlertCircle size={20} />
          <p>{error}</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <header className="bg-brand-600 dark:bg-brand-700 border-b border-brand-700 dark:border-brand-800 px-4 md:px-6 py-4 md:py-5 flex flex-col md:flex-row md:items-center md:justify-between flex-shrink-0 shadow-sm gap-3">
        <h1 className="font-bold text-lg md:text-xl text-white">Edit Form</h1>
        <div className="flex items-center gap-2 flex-wrap">
          {saved && (
            <div className="flex items-center gap-1 px-3 py-1.5 bg-green-50 text-green-600 rounded-lg text-xs font-medium">
              <Check size={14} /> Saved
            </div>
          )}
          <button 
            onClick={save} 
            disabled={saving} 
            className="btn btn-primary text-xs py-1.5 px-4"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
          <button 
            onClick={handleDelete} 
            className="btn btn-danger text-xs py-1.5 px-4"
            title="Delete this form"
          >
            <Trash2 size={14} /> Delete
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-white dark:bg-gray-900">
        <div className="flex flex-col lg:grid lg:grid-cols-5 gap-4 md:gap-6 items-start">
          <div className="w-full lg:col-span-3 space-y-4">
            <div className="card p-5 md:p-6 space-y-4">
              <div>
                <label className="label">Form name *</label>
                <input 
                  className="input" 
                  value={name} 
                  onChange={e => setName(e.target.value)} 
                  placeholder="e.g. Catering Suppliers 2025"
                />
              </div>
              <div>
                <label className="label">Category</label>
                <select 
                  className="input" 
                  value={category} 
                  onChange={e => setCategory(e.target.value)}
                >
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Description (shown to suppliers)</label>
                <textarea 
                  className="input" 
                  rows={2} 
                  value={description} 
                  onChange={e => setDescription(e.target.value)} 
                  placeholder="Tell suppliers what this form is for…"
                />
              </div>
            </div>

            <div className="card">
              <div className="px-5 md:px-6 py-3.5 md:py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                <h2 className="font-bold text-base text-gray-900 dark:text-white">Form fields ({fields.length})</h2>
              </div>
              <div className="p-4 space-y-2">
                {fields.map((f: FormField) => (
                  editingField === f.id ? (
                    <div key={f.id} className="p-4 bg-brand-50 rounded-lg border-2 border-brand-200 space-y-3">
                      <div>
                        <label className="label">Label</label>
                        <input 
                          className="input" 
                          value={editLabel} 
                          onChange={e => setEditLabel(e.target.value)}
                          autoFocus
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="label">Type</label>
                          <select 
                            className="input" 
                            value={editType} 
                            onChange={e => setEditType(e.target.value as FieldType)}
                          >
                            {FIELD_TYPES.map(t => (
                              <option key={t.value} value={t.value}>{t.label}</option>
                            ))}
                          </select>
                        </div>
                        <div className="flex items-end">
                          <label className="flex items-center gap-2 cursor-pointer w-full mb-2">
                            <input 
                              type="checkbox" 
                              checked={editRequired} 
                              onChange={e => setEditRequired(e.target.checked)}
                              className="rounded"
                            />
                            <span className="text-sm text-gray-600">Required</span>
                          </label>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={saveEditField}
                          className="flex-1 btn bg-brand-500 text-white hover:bg-brand-600 text-xs py-1.5"
                        >
                          <Check size={14} /> Save
                        </button>
                        <button 
                          onClick={() => setEditingField(null)}
                          className="flex-1 btn text-xs py-1.5"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div 
                      key={f.id}
                      className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors border border-gray-200 group cursor-pointer"
                      onClick={() => startEditField(f)}
                    >
                      <GripVertical size={15} className="text-gray-300 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {f.label} {f.required && <span className="text-brand-500 font-bold">*</span>}
                        </p>
                        <p className="text-xs text-gray-400">
                          {FIELD_TYPES.find(t => t.value === f.type)?.label}
                        </p>
                      </div>
                      <button 
                        onClick={e => {
                          e.stopPropagation()
                          removeField(f.id)
                        }}
                        className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-red-500 hover:bg-red-50 p-2 rounded-lg"
                        title="Delete field"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )
                ))}
                {fields.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-8">No fields yet - add one on the right</p>
                )}
              </div>
            </div>
          </div>

          <div className="w-full lg:col-span-2 card p-5 md:p-6 space-y-4 lg:sticky lg:top-0">
            <h2 className="font-bold text-base md:text-lg">Add a field</h2>
            <div>
              <label className="label">Field label</label>
              <input 
                className="input" 
                value={newLabel} 
                onChange={e => setNewLabel(e.target.value)} 
                placeholder="e.g. Delivery area"
              />
            </div>
            <div>
              <label className="label">Field type</label>
              <select 
                className="input" 
                value={newType} 
                onChange={e => setNewType(e.target.value as FieldType)}
              >
                {FIELD_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            {(newType === 'select' || newType === 'multiselect') && (
              <>
                <div>
                  <label className="label">Options (one per line)</label>
                  <textarea 
                    className="input" 
                    rows={4} 
                    value={newOptions} 
                    onChange={e => setNewOptions(e.target.value)} 
                    placeholder={"Option A\nOption B\nOption C"}
                  />
                </div>
                
                <label className="flex items-center gap-3 p-3 rounded-lg border-2 border-gray-200 dark:border-gray-600 hover:border-brand-300 dark:hover:border-brand-600 cursor-pointer transition-colors">
                  <input type="checkbox" checked={newHasSuboptions} onChange={e => setNewHasSuboptions(e.target.checked)} className="w-5 h-5 rounded" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Add subcategories for each option</span>
                </label>

                {newHasSuboptions && (
                  <div className="bg-brand-50 dark:bg-brand-900/20 p-4 rounded-lg border border-brand-200 dark:border-brand-800 space-y-3">
                    <p className="text-xs text-brand-700 dark:text-brand-300 font-medium">For each option, define its subcategories:</p>
                    {newOptions.split('\n').map((opt, idx) => {
                      const trimmed = opt.trim()
                      return trimmed ? (
                        <div key={idx}>
                          <label className="label text-xs">{trimmed} - subcategories</label>
                          <textarea 
                            className="input text-xs py-2" 
                            rows={3}
                            value={newSuboptionsMap[trimmed] || ''} 
                            onChange={e => setNewSuboptionsMap(prev => ({ ...prev, [trimmed]: e.target.value }))} 
                            placeholder="Subcategory 1&#10;Subcategory 2&#10;Subcategory 3"
                          />
                        </div>
                      ) : null
                    })}
                  </div>
                )}
              </>
            )}
            {newType !== 'select' && newType !== 'checkbox' && (
              <div>
                <label className="label">Placeholder text</label>
                <input 
                  className="input" 
                  value={newPlaceholder} 
                  onChange={e => setNewPlaceholder(e.target.value)} 
                  placeholder="Hint text inside the field"
                />
              </div>
            )}
            <div className="flex items-center gap-2">
              <input 
                type="checkbox" 
                id="req" 
                checked={newRequired} 
                onChange={e => setNewRequired(e.target.checked)} 
                className="rounded"
              />
              <label htmlFor="req" className="text-sm text-gray-600">Required field</label>
            </div>
            <button 
              onClick={addField} 
              disabled={!newLabel.trim()} 
              className="btn btn-primary w-full justify-center text-xs py-2"
            >
              <Plus size={15} /> Add field
            </button>
          </div>
        </div>
      </main>
    </>
  )
}
