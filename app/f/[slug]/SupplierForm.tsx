'use client'

import { useState } from 'react'
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

  function validate() {
    const errs: Record<string, string> = {}
    form.fields.forEach(f => {
      if (f.required && !values[f.label]?.trim()) {
        errs[f.label] = 'This field is required'
      }
      if (f.type === 'email' && values[f.label] && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values[f.label])) {
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
      <div className="text-center py-16">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 mb-6">
          <CheckCircle size={56} className="text-green-600" />
        </div>
        <h2 className="text-3xl font-bold text-gray-900 mb-3">Thank you!</h2>
        <p className="text-gray-600 text-lg leading-relaxed max-w-md mx-auto mb-8">
          Your response has been received and saved to our system.
        </p>
        <button
          onClick={() => {
            setSubmitted(false)
            setValues({})
            setErrors({})
          }}
          className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-brand-600 to-brand-700 text-white font-semibold rounded-lg hover:from-brand-700 hover:to-brand-800 transition-all shadow-md hover:shadow-lg"
        >
          Submit Another Response
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="card p-6 space-y-5">
      {form.fields.map(field => (
        <div key={field.id}>
          <label className="label text-gray-700">
            {field.label}
            {field.required && <span className="text-red-400 ml-0.5">*</span>}
          </label>

          {field.type === 'textarea' ? (
            <textarea
              className={`input ${errors[field.label] ? 'border-red-400' : ''}`}
              rows={3}
              placeholder={field.placeholder}
              value={values[field.label] || ''}
              onChange={e => set(field.label, e.target.value)}
            />
          ) : field.type === 'select' ? (
            <select
              className={`input ${errors[field.label] ? 'border-red-400' : ''}`}
              value={values[field.label] || ''}
              onChange={e => set(field.label, e.target.value)}
            >
              <option value="">Select an option…</option>
              {field.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          ) : field.type === 'checkbox' ? (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="rounded"
                checked={values[field.label] === 'true'}
                onChange={e => set(field.label, e.target.checked ? 'true' : 'false')}
              />
              <span className="text-sm text-gray-600">Yes</span>
            </label>
          ) : (
            <input
              type={field.type}
              className={`input ${errors[field.label] ? 'border-red-400' : ''}`}
              placeholder={field.placeholder}
              value={values[field.label] || ''}
              onChange={e => set(field.label, e.target.value)}
            />
          )}

          {errors[field.label] && (
            <p className="text-xs text-red-500 mt-1">{errors[field.label]}</p>
          )}
        </div>
      ))}

      <button
        type="submit"
        disabled={submitting}
        className="btn btn-primary w-full justify-center py-2.5 text-sm mt-2"
      >
        {submitting ? (
          <><Loader2 size={15} className="animate-spin" /> Submitting…</>
        ) : (
          'Submit registration'
        )}
      </button>

      <p className="text-xs text-gray-400 text-center">
        Your information is kept secure and only shared with the agency.
      </p>
    </form>
  )
}
