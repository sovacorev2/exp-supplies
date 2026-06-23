'use client'

import { useState } from 'react'
import Image from 'next/image'
import { createSubmission, type Form } from '@/app/actions/forms'
import { CheckCircle, Loader2 } from 'lucide-react'

export default function SupplierForm({ form }: { form: Form }) {
  const [values, setValues] = useState<Record<string, string>>({})
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  function set(id: string, value: string) {
    setValues(prev => ({ ...prev, [id]: value }))
    if (errors[id]) setErrors(prev => { const e = { ...prev }; delete e[id]; return e })
  }

  function isFieldVisible(field: typeof form.fields[0]): boolean {
    if (!field.dependsOn) return true
    const dependentFieldValue = values[field.dependsOn.fieldLabel]
    return dependentFieldValue === field.dependsOn.triggerValue
  }

  function getSuboptionsForCategory(categoryLabel: string, field: typeof form.fields[0]): string[] {
    if (!field.hasSuboptions || !field.options) return []
    const selectedOption = field.options.find(opt => (typeof opt === 'string' ? opt : opt.label) === categoryLabel)
    if (!selectedOption || typeof selectedOption === 'string') return []
    return selectedOption.suboptions || []
  }

  function validate() {
    const errs: Record<string, string> = {}
    form.fields.forEach(f => {
      const isVisible = isFieldVisible(f)
      
      // Skip section headers
      if (f.section === 'SECTION_HEADER') return
      
      if (isVisible && f.required && !values[f.label]?.trim()) {
        errs[f.label] = 'This field is required'
      }
      if (isVisible && f.type === 'email' && values[f.label] && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values[f.label])) {
        errs[f.label] = 'Please enter a valid email'
      }
    })
    return errs
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setSubmitting(true)
    try {
      await createSubmission(form.id, values)
      setSubmitted(true)
    } catch {
      alert('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="text-center py-12 md:py-16 px-4">
        <div className="inline-flex items-center justify-center w-16 md:w-20 h-16 md:h-20 rounded-full bg-green-100 dark:bg-green-900/30 mb-4 md:mb-6">
          <CheckCircle size={40} className="md:w-14 md:h-14 text-green-600 dark:text-green-400" />
        </div>
        <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-3">Thank you!</h2>
        <p className="text-gray-600 dark:text-gray-400 text-base md:text-lg leading-relaxed max-w-md mx-auto mb-6 md:mb-8">
          Your response has been received and saved.
        </p>
        <button
          onClick={() => {
            setSubmitted(false)
            setValues({})
            setErrors({})
          }}
          className="inline-flex items-center gap-2 px-4 md:px-6 py-2 md:py-3 bg-gradient-to-r from-brand-600 to-brand-700 text-white font-semibold rounded-lg hover:from-brand-700 hover:to-brand-800 transition-all shadow-md hover:shadow-lg text-sm md:text-base"
        >
          Submit Another
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="card p-4 md:p-6 space-y-4 md:space-y-6 dark:bg-gray-800 dark:border-gray-700">
      {/* Logo and title */}
      <div className="text-center mb-6 md:mb-8 pb-4 md:pb-6 border-b border-gray-100 dark:border-gray-700">
        <Image 
          src="/exp-logo.png" 
          alt="Exp Forms" 
          width={50}
          height={50}
          className="mx-auto mb-3 md:mb-4 w-12 md:w-16"
        />
        <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-gray-100">{form.name}</h1>
        {form.description && (
          <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400 mt-2">{form.description}</p>
        )}
      </div>

      {form.fields.map(field => {
        const isVisible = isFieldVisible(field)
        
        // Skip rendering section headers, just show them as dividers
        if (isVisible && field.section === 'SECTION_HEADER') {
          return (
            <div key={field.id} className="mt-6 mb-4 pt-4 border-t-2 border-brand-200 dark:border-brand-800">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">{field.label}</h3>
            </div>
          )
        }
        
        return isVisible ? (
        <div key={field.id}>
          <label className="label dark:text-gray-300">
            {field.label}
            {field.required && <span className="text-red-400 ml-0.5">*</span>}
            {field.hasSuboptions && !field.suboptionsRequired && <span className="text-gray-400 text-xs ml-1">(optional subcategory)</span>}
          </label>

          {field.type === 'textarea' ? (
            <textarea
              className={`input dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-500 ${errors[field.label] ? 'border-red-400' : ''}`}
              rows={3}
              placeholder={field.placeholder}
              value={values[field.label] || ''}
              onChange={e => set(field.label, e.target.value)}
            />
          ) : field.hasSuboptions ? (
            <div className="space-y-3">
              <select
                className={`input dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 ${errors[field.label] ? 'border-red-400' : ''}`}
                value={values[field.label] || ''}
                onChange={e => set(field.label, e.target.value)}
              >
                <option value="">Select {field.label}…</option>
                {field.options?.map((opt, idx) => {
                  const label = typeof opt === 'string' ? opt : opt.label
                  return <option key={idx} value={label}>{label}</option>
                })}
              </select>
              
              {values[field.label] && getSuboptionsForCategory(values[field.label], field).length > 0 && (
                <div>
                  <label className={`label dark:text-gray-300 text-sm ${field.suboptionsRequired ? '' : 'opacity-75'}`}>
                    Subcategory {field.suboptionsRequired && <span className="text-red-400">*</span>}
                  </label>
                  <select
                    className={`input dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 ${errors[`${field.label}_sub`] ? 'border-red-400' : ''}`}
                    value={values[`${field.label}_sub`] || ''}
                    onChange={e => set(`${field.label}_sub`, e.target.value)}
                  >
                    <option value="">Choose a subcategory…</option>
                    {getSuboptionsForCategory(values[field.label], field).map((sub, idx) => (
                      <option key={idx} value={sub}>{sub}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          ) : field.type === 'select' ? (
            <select
              className={`input dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 ${errors[field.label] ? 'border-red-400' : ''}`}
              value={values[field.label] || ''}
              onChange={e => set(field.label, e.target.value)}
            >
              <option value="">Select an option…</option>
              {field.options?.map((opt, idx) => {
                const label = typeof opt === 'string' ? opt : opt.label
                return <option key={idx} value={label}>{label}</option>
              })}
            </select>
          ) : field.type === 'multiselect' ? (
            <select
              multiple
              className={`input dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 ${errors[field.label] ? 'border-red-400' : ''}`}
              value={(values[field.label] || '').split(',').filter(Boolean)}
              onChange={e => {
                const selected = Array.from(e.target.selectedOptions, option => option.value)
                set(field.label, selected.join(','))
              }}
            >
              {field.options?.map((opt, idx) => {
                const label = typeof opt === 'string' ? opt : opt.label
                return <option key={idx} value={label}>{label}</option>
              })}
            </select>
          ) : field.type === 'checkbox' ? (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="rounded dark:accent-brand-500"
                checked={values[field.label] === 'true'}
                onChange={e => set(field.label, e.target.checked ? 'true' : 'false')}
              />
              <span className="text-sm text-gray-600 dark:text-gray-400">Yes</span>
            </label>
          ) : field.type === 'upload' ? (
            <div className="space-y-2">
              <input
                type="file"
                accept={field.acceptedFileTypes?.join(',')}
                className={`input dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-brand-100 file:text-brand-700 dark:file:bg-brand-900 dark:file:text-brand-300 hover:file:bg-brand-200 ${errors[field.label] ? 'border-red-400' : ''}`}
                onChange={e => set(field.label, e.target.files?.[0]?.name || '')}
              />
              {field.acceptedFileTypes && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Allowed: {field.acceptedFileTypes.map(t => {
                    const typeMap: Record<string, string> = {
                      'image/jpeg': 'JPEG',
                      'image/png': 'PNG',
                      'image/webp': 'WebP',
                      'image/gif': 'GIF',
                      'application/pdf': 'PDF',
                      'application/msword': 'Word'
                    }
                    return typeMap[t] || t
                  }).join(', ')}
                </p>
              )}
            </div>
          ) : (
            <input
              type={field.type}
              className={`input dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-500 ${errors[field.label] ? 'border-red-400' : ''}`}
              placeholder={field.placeholder}
              value={values[field.label] || ''}
              onChange={e => set(field.label, e.target.value)}
            />
          )}

          {errors[field.label] && (
            <p className="text-xs text-red-500 dark:text-red-400 mt-1">{errors[field.label]}</p>
          )}
        </div>
        ) : null
      })}

      <button
        type="submit"
        disabled={submitting}
        className="btn btn-primary w-full justify-center py-2 md:py-2.5 text-sm md:text-base mt-2"
      >
        {submitting ? (
          <><Loader2 size={15} className="animate-spin" /> Submitting…</>
        ) : (
          'Submit'
        )}
      </button>

      <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
        Your information is kept secure.
      </p>
    </form>
  )
}
