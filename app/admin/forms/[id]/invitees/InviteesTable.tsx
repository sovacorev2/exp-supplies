'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Copy, Check, Trash2, UserPlus, Loader2 } from 'lucide-react'
import type { Invitee } from '@/app/actions/forms'

const STATUS_STYLES: Record<Invitee['status'], string> = {
  not_opened: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  opened: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  submitted: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
}

const STATUS_LABELS: Record<Invitee['status'], string> = {
  not_opened: 'Not opened',
  opened: 'Opened',
  submitted: 'Submitted',
}

function InviteeRow({
  invitee,
  formSlug,
  onDeleted,
}: {
  invitee: Invitee
  formSlug: string
  onDeleted: () => void
}) {
  const [copied, setCopied] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const link = typeof window !== 'undefined'
    ? `${window.location.origin}/f/${formSlug}?invite=${invitee.token}`
    : ''

  async function copyLink() {
    await navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleDelete() {
    if (!confirm(`Remove ${invitee.name} from the invite list?`)) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/invitees/${invitee.id}`, { method: 'DELETE' })
      if (res.ok) onDeleted()
    } finally {
      setDeleting(false)
    }
  }

  return (
    <tr className="border-b border-gray-100 dark:border-gray-700 last:border-0">
      <td className="py-3 pl-4 pr-4 text-sm font-medium text-gray-900 dark:text-white">{invitee.name}</td>
      <td className="py-3 pr-4 text-sm text-gray-600 dark:text-gray-400">{invitee.email}</td>
      <td className="py-3 pr-4">
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[invitee.status]}`}>
          {STATUS_LABELS[invitee.status]}
        </span>
      </td>
      <td className="py-3 pr-4">
        <button
          onClick={copyLink}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400"
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? 'Copied' : 'Copy link'}
        </button>
      </td>
      <td className="py-3 pr-4 text-right">
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 hover:text-red-600 transition-colors disabled:opacity-50"
          title="Remove invitee"
        >
          <Trash2 size={14} />
        </button>
      </td>
    </tr>
  )
}

export default function InviteesTable({
  formId,
  formSlug,
  invitees,
}: {
  formId: string
  formSlug: string
  invitees: Invitee[]
}) {
  const router = useRouter()
  const [bulkText, setBulkText] = useState('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState('')

  function parseBulkText(text: string): { name: string; email: string }[] {
    return text
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)
      .map(line => {
        const [name, email] = line.split(',').map(s => s.trim())
        return { name: name || '', email: email || '' }
      })
      .filter(entry => entry.name && entry.email)
  }

  async function handleAdd() {
    const list = parseBulkText(bulkText)
    if (!list.length) {
      setAddError('Add at least one "Name, email" line')
      return
    }
    setAdding(true)
    setAddError('')
    try {
      const res = await fetch(`/api/forms/${formId}/invitees`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ list }),
      })
      if (res.ok) {
        setBulkText('')
        router.refresh()
      } else {
        const data = await res.json()
        setAddError(data.error || 'Failed to add invitees')
      }
    } catch {
      setAddError('Failed to add invitees')
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 md:p-5">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-1.5">
          <UserPlus size={15} /> Add invitees
        </h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
          One per line, as <code className="font-mono">Name, email</code>
        </p>
        <textarea
          className="input font-mono text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
          rows={4}
          placeholder={'Jane Doe, jane@acme.com\nJohn Smith, john@example.com'}
          value={bulkText}
          onChange={e => setBulkText(e.target.value)}
          disabled={adding}
        />
        {addError && <p className="text-xs text-red-500 dark:text-red-400 mt-2">{addError}</p>}
        <button
          onClick={handleAdd}
          disabled={adding}
          className="btn btn-primary mt-3 text-sm py-2 px-4"
        >
          {adding ? <><Loader2 size={14} className="animate-spin" /> Adding…</> : 'Add invitees'}
        </button>
      </div>

      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-x-auto">
        {invitees.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-10">
            No invitees yet — add some above.
          </p>
        ) : (
          <table className="w-full min-w-[560px]">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 text-left">
                <th className="py-2.5 px-4 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Name</th>
                <th className="py-2.5 px-4 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Email</th>
                <th className="py-2.5 px-4 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Status</th>
                <th className="py-2.5 px-4 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Link</th>
                <th></th>
              </tr>
            </thead>
            <tbody className="px-4">
              {invitees.map(invitee => (
                <InviteeRow
                  key={invitee.id}
                  invitee={invitee}
                  formSlug={formSlug}
                  onDeleted={() => router.refresh()}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
