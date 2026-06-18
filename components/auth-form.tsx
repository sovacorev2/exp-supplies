'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { authClient } from '@/lib/auth-client'
import { Loader2 } from 'lucide-react'

export default function AuthForm({ mode = 'sign-in' }: { mode: 'sign-in' | 'sign-up' }) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (mode === 'sign-up') {
        if (!name) {
          setError('Name is required')
          setLoading(false)
          return
        }
        await authClient.signUp.email(
          { email, password, name },
          { onSuccess: () => { router.push('/'); router.refresh() } }
        )
      } else {
        await authClient.signIn.email(
          { email, password },
          { onSuccess: () => { router.push('/'); router.refresh() } }
        )
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md mx-auto">
      <div className="card p-6 space-y-4">
        <h1 className="text-2xl font-bold text-center">
          {mode === 'sign-up' ? 'Create Account' : 'Sign In'}
        </h1>

        {error && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
            {error}
          </div>
        )}

        {mode === 'sign-up' && (
          <div>
            <label className="label">Full Name</label>
            <input
              type="text"
              className="input"
              placeholder="Your name"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              disabled={loading}
            />
          </div>
        )}

        <div>
          <label className="label">Email Address</label>
          <input
            type="email"
            className="input"
            placeholder="you@company.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            disabled={loading}
          />
        </div>

        <div>
          <label className="label">Password</label>
          <input
            type="password"
            className="input"
            placeholder="At least 8 characters"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            disabled={loading}
            minLength={8}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn btn-primary w-full justify-center py-2.5 text-sm mt-2"
        >
          {loading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              {mode === 'sign-up' ? 'Creating account...' : 'Signing in...'}
            </>
          ) : (
            mode === 'sign-up' ? 'Create Account' : 'Sign In'
          )}
        </button>
      </div>
    </form>
  )
}
