'use client'

import { useState } from 'react'
import { Copy, Check, Pause, Play } from 'lucide-react'
import { useRouter } from 'next/navigation'

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

  return (
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
    </div>
  )
}
