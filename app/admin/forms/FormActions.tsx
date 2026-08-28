'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Copy, Check, Pause, Play, Trash2, Share2, Users, UserPlus, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { getFormCollaborators, addFormCollaborator, removeFormCollaborator } from '@/app/actions/forms'

declare global {
  interface Window { __reloadForms?: () => void }
}

export default function FormActions({
  formId,
  formUrl,
  isActive,
  canManageAccess,
}: {
  formId: string
  formUrl: string
  isActive: boolean
  canManageAccess: boolean
}) {
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(false)
  const [toggleError, setToggleError] = useState('')
  const [currentActive, setCurrentActive] = useState(isActive)
  const [shareOpen, setShareOpen] = useState(false)
  const [shareLink, setShareLink] = useState('')
  const [shareCopied, setShareCopied] = useState(false)
  const [shareError, setShareError] = useState('')
  const [shareLoading, setShareLoading] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [accessOpen, setAccessOpen] = useState(false)
  const [collaborators, setCollaborators] = useState<{ email: string; created_at: Date }[]>([])
  const [collabsLoading, setCollabsLoading] = useState(false)
  const [collabEmail, setCollabEmail] = useState('')
  const [collabError, setCollabError] = useState('')
  const [collabAdding, setCollabAdding] = useState(false)
  const router = useRouter()

  async function openAccessModal() {
    setAccessOpen(true)
    setCollabError('')
    setCollabsLoading(true)
    try {
      setCollaborators(await getFormCollaborators(formId))
    } finally {
      setCollabsLoading(false)
    }
  }

  async function handleAddCollaborator() {
    if (!collabEmail.trim()) return
    setCollabAdding(true)
    setCollabError('')
    try {
      const result = await addFormCollaborator(formId, collabEmail.trim(), window.location.origin)
      if (result.ok) {
        setCollabEmail('')
        setCollaborators(await getFormCollaborators(formId))
      } else {
        setCollabError(result.error || 'Failed to add')
      }
    } finally {
      setCollabAdding(false)
    }
  }

  async function handleRemoveCollaborator(email: string) {
    await removeFormCollaborator(formId, email)
    setCollaborators(await getFormCollaborators(formId))
  }

  async function copyLink() {
    await navigator.clipboard.writeText(`${window.location.origin}${formUrl}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function generateShareLink() {
    setShareLoading(true)
    setShareError('')
    try {
      const res = await fetch(`/api/forms/${formId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await res.json()
      if (res.ok) {
        setShareLink(data.shareLink)
      } else {
        setShareError(data.error || 'Failed to generate share link')
      }
    } catch (error) {
      setShareError('Error generating share link')
    } finally {
      setShareLoading(false)
    }
  }

  function copyShareLink() {
    navigator.clipboard.writeText(shareLink)
    setShareCopied(true)
    setTimeout(() => setShareCopied(false), 2000)
  }

  async function handleToggle() {
    setLoading(true)
    setToggleError('')
    try {
      const res = await fetch(`/api/forms/${formId}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !currentActive }),
      })
      if (res.ok) {
        // Optimistic update - flip the icon immediately without full page refresh
        setCurrentActive(prev => !prev)
      } else {
        const data = await res.json()
        setToggleError(data.error || 'Failed to toggle form')
      }
    } catch (error) {
      setToggleError('Error toggling form')
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete() {
    setLoading(true)
    setDeleteError('')
    try {
      const res = await fetch(`/api/forms/${formId}`, { method: 'DELETE' })
      if (res.ok) {
        setDeleteConfirm(false)
        router.refresh()
      } else {
        const data = await res.json()
        setDeleteError(data.error || 'Failed to delete form')
      }
    } catch (error) {
      setDeleteError('Error deleting form')
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
          title={currentActive ? 'Pause form' : 'Resume form'}
        >
          {currentActive ? <Pause size={13} /> : <Play size={13} />}
        </button>
        <button
          onClick={() => setShareOpen(true)}
          className="p-1 rounded hover:bg-gray-200 text-gray-500 hover:text-green-600 transition-colors"
          title="Share responses"
        >
          <Share2 size={13} />
        </button>
        <Link
          href={`/admin/forms/${formId}/invitees`}
          className="p-1 rounded hover:bg-gray-200 text-gray-500 hover:text-brand-600 transition-colors"
          title="Manage invitees"
        >
          <Users size={13} />
        </Link>
        {canManageAccess && (
          <button
            onClick={openAccessModal}
            className="p-1 rounded hover:bg-gray-200 text-gray-500 hover:text-purple-600 transition-colors"
            title="Share access to this form"
          >
            <UserPlus size={13} />
          </button>
        )}
        {canManageAccess && (
          <button
            onClick={() => setDeleteConfirm(true)}
            className="p-1 rounded hover:bg-gray-200 text-gray-500 hover:text-red-600 transition-colors"
            title="Delete form"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>

      {shareOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-sm p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Share Responses</h3>
            {!shareLink ? (
              <>
                <p className="text-sm text-gray-600 mb-4">Generate a shareable link for these form responses. The link will be valid for 7 days.</p>
                <button
                  onClick={generateShareLink}
                  disabled={shareLoading}
                  className="w-full px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50"
                >
                  {shareLoading ? 'Generating...' : 'Generate Share Link'}
                </button>
                {shareError && <p className="text-sm text-red-600 mt-2">{shareError}</p>}
              </>
            ) : (
              <>
                <div className="bg-gray-50 p-3 rounded-lg mb-4">
                  <input
                    type="text"
                    value={shareLink}
                    readOnly
                    className="w-full text-sm font-mono bg-transparent text-gray-700 outline-none"
                  />
                </div>
                <button
                  onClick={copyShareLink}
                  className="w-full px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 flex items-center justify-center gap-2"
                >
                  {shareCopied ? <Check size={16} /> : <Copy size={16} />}
                  {shareCopied ? 'Copied!' : 'Copy Link'}
                </button>
                <p className="text-xs text-gray-500 mt-3 text-center">Anyone with this link can view the responses without a password (7 days).</p>
              </>
            )}
            <button
              onClick={() => {
                setShareOpen(false)
                setShareLink('')
                setShareError('')
              }}
              className="w-full mt-4 px-4 py-2 border border-gray-200 rounded-lg font-medium text-gray-700 hover:bg-gray-50"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {accessOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-1">Share Access</h3>
            <p className="text-sm text-gray-600 mb-4">
              Give someone else full access to this form (responses, analytics, invitees, everything you can do here) using their own account — no need to share your login.
            </p>

            <div className="flex gap-2 mb-2">
              <input
                type="email"
                value={collabEmail}
                onChange={e => setCollabEmail(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAddCollaborator() }}
                placeholder="their.email@example.com"
                className="flex-1 text-sm border-2 border-gray-200 rounded-lg px-3 py-2 focus:border-brand-500 focus:outline-none"
              />
              <button
                onClick={handleAddCollaborator}
                disabled={collabAdding || !collabEmail.trim()}
                className="px-3 py-2 bg-brand-500 text-white rounded-lg text-sm font-semibold hover:bg-brand-600 disabled:opacity-50 flex-shrink-0"
              >
                {collabAdding ? 'Adding…' : 'Add'}
              </button>
            </div>
            {collabError && <p className="text-xs text-red-600 mb-2">{collabError}</p>}

            <div className="mt-4 space-y-1.5 max-h-56 overflow-y-auto">
              {collabsLoading ? (
                <p className="text-sm text-gray-400 text-center py-3">Loading…</p>
              ) : collaborators.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-3">No one else has access yet</p>
              ) : (
                collaborators.map(c => (
                  <div key={c.email} className="flex items-center justify-between gap-2 bg-gray-50 rounded-lg px-3 py-2">
                    <span className="text-sm text-gray-700 truncate">{c.email}</span>
                    <button
                      onClick={() => handleRemoveCollaborator(c.email)}
                      className="flex-shrink-0 text-gray-400 hover:text-red-500 p-1 rounded hover:bg-red-50"
                      title="Remove access"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>

            <button
              onClick={() => { setAccessOpen(false); setCollabEmail(''); setCollabError('') }}
              className="w-full mt-4 px-4 py-2 border border-gray-200 rounded-lg font-medium text-gray-700 hover:bg-gray-50"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-sm p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Delete Form</h3>
            <p className="text-sm text-gray-600 mb-4">This will permanently delete this form and all its submissions. This action cannot be undone.</p>

            {deleteError && (
              <p className="text-xs text-red-600 mb-4">{deleteError}</p>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setDeleteConfirm(false)
                  setDeleteError('')
                }}
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={loading}
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
