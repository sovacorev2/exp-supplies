'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { createSubmission, type Form } from '@/app/actions/forms'
import { CheckCircle, Loader2, Save } from 'lucide-react'

const AUTOSAVE_DELAY_MS = 1500

export default function SupplierForm({ form }: { form: Form }) {
  const [values, setValues] = useState<Record<string, string>>({})
  const [uploadStatus, setUploadStatus] = useState<Record<string, 'uploading' | 'done' | 'error'>>({})
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [resumeToken, setResumeToken] = useState<string | null>(null)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  const resumeTokenRef = useRef<string | null>(null)
  const inviteeIdRef = useRef<string | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inFlightRef = useRef(false)
  const pendingRef = useRef(false)
  const hydratedRef = useRef(false)

  // Hydrate from a resume link and/or resolve an invite link, if present,
  // before any autosave is allowed to fire. Both run in parallel and must
  // both settle before hydratedRef flips — otherwise a fast first autosave
  // could go out before the invitee id resolves and silently lose it.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const resumeTokenParam = params.get('resume')
    const inviteToken = params.get('invite')

    const resumePromise = resumeTokenParam
      ? fetch(`/api/submissions/draft?formId=${form.id}&token=${resumeTokenParam}`)
          .then(res => (res.ok ? res.json() : null))
          .then(result => {
            if (result?.data) {
              setValues(result.data)
              resumeTokenRef.current = resumeTokenParam
              setResumeToken(resumeTokenParam)
            }
          })
          .catch(() => {})
      : Promise.resolve()

    const invitePromise = inviteToken
      ? fetch(`/api/invitees/resolve?formId=${form.id}&token=${inviteToken}`)
          .then(res => (res.ok ? res.json() : null))
          .then(result => {
            if (result?.id) inviteeIdRef.current = result.id
          })
          .catch(() => {})
      : Promise.resolve()

    Promise.all([resumePromise, invitePromise]).finally(() => {
      hydratedRef.current = true
    })
  }, [form.id])

  async function triggerSave(currentValues: Record<string, string>) {
    if (inFlightRef.current) {
      pendingRef.current = true
      return
    }
    inFlightRef.current = true
    setSaveState('saving')
    try {
      const res = await fetch('/api/submissions/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          formId: form.id,
          resumeToken: resumeTokenRef.current,
          inviteeId: inviteeIdRef.current,
          data: currentValues,
        }),
      })
      if (!res.ok) throw new Error('draft save failed')
      const json = await res.json()
      if (json.resumeToken && json.resumeToken !== resumeTokenRef.current) {
        resumeTokenRef.current = json.resumeToken
        setResumeToken(json.resumeToken)
        const url = new URL(window.location.href)
        url.searchParams.set('resume', json.resumeToken)
        window.history.replaceState(null, '', url.toString())
      }
      setSaveState('saved')
    } catch {
      setSaveState('error')
    } finally {
      inFlightRef.current = false
      if (pendingRef.current) {
        pendingRef.current = false
        triggerSave(currentValues)
      }
    }
  }

  // Debounced autosave whenever the answers change.
  useEffect(() => {
    if (!hydratedRef.current || submitted || Object.keys(values).length === 0) return
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => triggerSave(values), AUTOSAVE_DELAY_MS)
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values, submitted])

  function set(id: string, value: string) {
    setValues(prev => ({ ...prev, [id]: value }))
    if (errors[id]) setErrors(prev => { const e = { ...prev }; delete e[id]; return e })
  }

  function evaluateCondition(fieldValue: string | undefined, operator: string, triggerValue: string | number): boolean {
    if (fieldValue === undefined || fieldValue === '') return false

    const numValue = parseFloat(fieldValue)
    const numTrigger = typeof triggerValue === 'number' ? triggerValue : parseFloat(triggerValue)

    switch (operator) {
      case '===':
        return fieldValue === String(triggerValue)
      case '!==':
        return fieldValue !== String(triggerValue)
      case '>':
        return !isNaN(numValue) && !isNaN(numTrigger) && numValue > numTrigger
      case '<':
        return !isNaN(numValue) && !isNaN(numTrigger) && numValue < numTrigger
      case '>=':
        return !isNaN(numValue) && !isNaN(numTrigger) && numValue >= numTrigger
      case '<=':
        return !isNaN(numValue) && !isNaN(numTrigger) && numValue <= numTrigger
      case 'contains':
        // For multiselect fields with || delimiter, check if value contains the trigger
        return fieldValue.toLowerCase().includes(String(triggerValue).toLowerCase())
      case 'not-contains':
        // For multiselect fields, check if value does NOT contain the trigger
        return !fieldValue.toLowerCase().includes(String(triggerValue).toLowerCase())
      default:
        return false
    }
  }

  function isFieldVisible(field: typeof form.fields[0]): boolean {
    if (!field.dependsOn) return true

    // Handle both single rule and array of rules
    const rules = Array.isArray(field.dependsOn) ? field.dependsOn : [field.dependsOn]

    // ALL rules must be true (AND logic)
    return rules.every(rule => {
      const dependentFieldValue = values[rule.fieldLabel]
      return evaluateCondition(dependentFieldValue, rule.operator, rule.triggerValue)
    })
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
      const value = values[f.label]?.trim()

      // Skip section headers
      if (f.section === 'SECTION_HEADER') return

      if (isVisible && f.required && !value) {
        errs[f.label] = 'This field is required'
        return
      }

      if (!isVisible) return

      // Type-specific validation
      if (f.type === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        errs[f.label] = 'Please enter a valid email'
      }

      // Number constraints
      if (f.type === 'number' && value) {
        const numValue = parseFloat(value)
        if (isNaN(numValue)) {
          errs[f.label] = 'Please enter a valid number'
        } else if (f.minValue !== undefined && numValue < f.minValue) {
          errs[f.label] = `Minimum value is ${f.minValue}`
        } else if (f.maxValue !== undefined && numValue > f.maxValue) {
          errs[f.label] = `Maximum value is ${f.maxValue}`
        }
      }

      // Text length constraints
      if ((f.type === 'text' || f.type === 'textarea') && value) {
        if (f.minLength !== undefined && value.length < f.minLength) {
          errs[f.label] = `Minimum ${f.minLength} characters`
        } else if (f.maxLength !== undefined && value.length > f.maxLength) {
          errs[f.label] = `Maximum ${f.maxLength} characters`
        }
      }
    })
    return errs
  }

  async function handleUploadChange(field: typeof form.fields[0], file: File | undefined) {
    if (!file) return
    setUploadStatus(prev => ({ ...prev, [field.label]: 'uploading' }))
    try {
      const formData = new FormData()
      formData.append('file', file)
      const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData })
      if (!uploadRes.ok) throw new Error(`Upload failed: ${uploadRes.status}`)
      const responseData = await uploadRes.json()
      set(field.label, responseData.url)
      setUploadStatus(prev => ({ ...prev, [field.label]: 'done' }))
    } catch (error) {
      console.error(`[v0] Failed to upload file for ${field.label}:`, error)
      setUploadStatus(prev => ({ ...prev, [field.label]: 'error' }))
      setErrors(prev => ({ ...prev, [field.label]: 'Upload failed — please try again' }))
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (Object.values(uploadStatus).some(s => s === 'uploading')) {
      setErrors({ submit: 'Please wait for file uploads to finish' })
      return
    }

    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setSubmitting(true)

    try {
      await createSubmission(form.id, values, resumeTokenRef.current ?? undefined, inviteeIdRef.current ?? undefined)
      setSubmitted(true)
      window.history.replaceState(null, '', window.location.pathname)
    } catch (error) {
      console.error('[v0] Submit error:', error)
      setErrors({ submit: String(error) })
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
            setUploadStatus({})
            resumeTokenRef.current = null
            setResumeToken(null)
            setSaveState('idle')
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

      {resumeToken && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 text-xs md:text-sm text-brand-700 dark:text-brand-300">
          <Save size={15} className="flex-shrink-0" />
          <span>
            Your progress is saved. Bookmark this page to finish later.
            {saveState === 'saving' && <span className="opacity-70"> Saving…</span>}
            {saveState === 'error' && <span className="text-red-600 dark:text-red-400"> Couldn&apos;t save — check your connection.</span>}
          </span>
        </div>
      )}

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
            <div className={`space-y-2 p-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600 ${errors[field.label] ? 'border-red-400' : 'border-gray-300'}`}>
              {field.options && field.options.length > 0 ? field.options.map((opt, idx) => {
                // Handle both string and object options
                let label = ''
                if (typeof opt === 'string') {
                  label = opt.trim()
                } else if (typeof opt === 'object' && opt !== null) {
                  label = (opt.label || (opt as any).value || '').toString().trim()
                }

                if (!label) {
                  return null // Skip empty labels
                }

                const selectedValues = (values[field.label] || '').split('||').filter(v => v.trim())
                const isChecked = selectedValues.some(v => v.trim() === label)

                return (
                  <label key={idx} className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-600 p-2 rounded transition-colors">
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded dark:accent-brand-500 cursor-pointer"
                      checked={isChecked}
                      onChange={e => {
                        const newSelected = e.target.checked
                          ? [...selectedValues, label.trim()]
                          : selectedValues.filter(v => v.trim() !== label.trim())
                        const finalValue = newSelected.filter(Boolean).join('||')
                        set(field.label, finalValue)
                      }}
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
                  </label>
                )
              }) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">No options available</p>
              )}
            </div>
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
                required={field.required && uploadStatus[field.label] !== 'done'}
                disabled={uploadStatus[field.label] === 'uploading'}
                className={`input dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-brand-100 file:text-brand-700 dark:file:bg-brand-900 dark:file:text-brand-300 hover:file:bg-brand-200 disabled:opacity-60 ${errors[field.label] ? 'border-red-400' : ''}`}
                onChange={e => handleUploadChange(field, e.target.files?.[0])}
              />
              {uploadStatus[field.label] === 'uploading' && (
                <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                  <Loader2 size={12} className="animate-spin" /> Uploading…
                </p>
              )}
              {uploadStatus[field.label] === 'done' && (
                <p className="text-xs text-green-600 dark:text-green-400 font-medium">✓ Uploaded</p>
              )}
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

      {errors.submit && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-700 dark:text-red-400">{errors.submit}</p>
        </div>
      )}

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
