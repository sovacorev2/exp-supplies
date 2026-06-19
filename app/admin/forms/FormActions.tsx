'use client'

import { useState } from 'react'
import { Copy, Check, Pause, Play, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

const ADMIN_PASSWORD = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || 'exp.admin'

export default function FormActions({
  formId,
  formUrl,
  isActive,
}: {
  formId: string
  formUrl: string
  isActive: boolean
}) {
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deletePassword, setDeletePassword] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const router = useRouter()

  async function copyLink() {
    await navigator.clipboard.writeText(`${window.location.origin}${formUrl}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleToggle() {
    setLoading(true)
    await fetch(`/api/forms/${formId}/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !isActive }),
    })
    setLoading(false)
    router.refresh()
  }

  async function handleDelete() {
    if (deletePassword !== ADMIN_PASSWORD) {
      setDeleteError('Invalid password')
      return
    }
    
    setLoading(true)
    try {
      const res = await fetch(`/api/forms/${formId}`, { method: 'DELETE' })
      if (res.ok) {
        router.refresh()
        setDeleteConfirm(false)
        setDeletePassword('')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="flex items-center gap-1">
        <button
          onClick={copyLink}
          className="p-1 rounded hover:bg-gray-200 text-gray-500 hover:text-brand-600 transition-colors"
          title="Copy link"
        >
          {copied ? <Check size={13} className="text-brand-600" /> : <Copy size={13} />}
        </button>
        <button
          onClick={handleToggle}
          disabled={loading}
          className="p-1 rounded hover:bg-gray-200 text-gray-500 hover:text-amber-600 transition-colors"
          title={isActive ? 'Pause form' : 'Resume form'}
        >
          {isActive ? <Pause size={13} /> : <Play size={13} />}
        </button>
        <button
          onClick={() => setDeleteConfirm(true)}
          className="p-1 rounded hover:bg-gray-200 text-gray-500 hover:text-red-600 transition-colors"
          title="Delete form"
        >
          <Trash2 size={13} />
        </button>
      </div>

      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-sm p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Delete Form</h3>
            <p className="text-sm text-gray-600 mb-4">Enter your admin password to delete this form. This action cannot be undone.</p>
            
            <input
              type="password"
              placeholder="Admin password"
              value={deletePassword}
              onChange={e => {
                setDeletePassword(e.target.value)
                setDeleteError('')
              }}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg mb-2 text-sm focus:outline-none focus:border-red-500"
            />
            
            {deleteError && (
              <p className="text-xs text-red-600 mb-4">{deleteError}</p>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setDeleteConfirm(false)
                  setDeletePassword('')
                  setDeleteError('')
                }}
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={loading || !deletePassword}
                className="flex-1 px-3 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {loading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
