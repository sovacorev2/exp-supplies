'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, ShieldCheck } from 'lucide-react'

export default function AdminLoginForm() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Sign-in failed')
        return
      }

      router.push('/admin')
      router.refresh()
    } catch (err) {
      setError('Sign-in failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <ShieldCheck size={48} className="mx-auto text-brand-400 drop-shadow-2xl" />
          <h1 className="text-4xl font-bold text-white mt-4">Exp Forms</h1>
          <p className="text-base text-gray-300 mt-2">Admin Access</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 p-6 md:p-8 space-y-6">
          <div>
            <label className="block text-base font-semibold text-gray-900 dark:text-gray-100 mb-3">
              Enter Admin Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              disabled={loading}
              autoComplete="current-password"
              autoFocus
              required
              className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:border-brand-500 dark:focus:border-brand-400 focus:ring-2 focus:ring-brand-500 focus:ring-opacity-30 transition-all bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-lg tracking-widest"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/30 border-2 border-red-300 dark:border-red-700 rounded-lg">
              <p className="text-base text-red-700 dark:text-red-300 font-semibold">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            className="w-full px-4 py-4 bg-gradient-to-r from-brand-500 to-brand-600 text-white font-bold rounded-lg hover:from-brand-600 hover:to-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl text-lg flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Verifying...
              </>
            ) : (
              'Access Admin Panel'
            )}
          </button>

          <p className="text-sm text-gray-500 dark:text-gray-400 text-center font-medium">
            Data Collection Platform
          </p>
        </form>
      </div>
    </div>
  )
}
