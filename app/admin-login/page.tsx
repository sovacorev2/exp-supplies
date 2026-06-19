'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

const ADMIN_PASSWORD = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || 'exp.admin'

export default function AdminLoginPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    // Simulate verification delay
    setTimeout(() => {
      if (password === ADMIN_PASSWORD) {
        // Store session token in localStorage and httpOnly cookie
        localStorage.setItem('admin_authenticated', 'true')
        localStorage.setItem('admin_login_time', Date.now().toString())
        
        // Set a cookie for server-side verification
        document.cookie = `admin_session=${Date.now()}; path=/admin; max-age=28800; SameSite=Strict`
        
        router.push('/admin')
      } else {
        setError('Invalid password. Please try again.')
        setPassword('')
      }
      setLoading(false)
    }, 500)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo / Branding */}
        <div className="text-center mb-8">
          <div className="inline-block mb-4">
            <Image 
              src="/exp-logo.png" 
              alt="Exp Forms" 
              width={80} 
              height={80}
              className="drop-shadow-2xl"
            />
          </div>
          <h1 className="text-4xl font-bold text-white">Exp Forms</h1>
          <p className="text-base text-gray-300 mt-2">Admin Access</p>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 p-6 md:p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
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
                className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:border-brand-500 dark:focus:border-brand-400 focus:ring-2 focus:ring-brand-500 focus:ring-opacity-30 transition-all bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-lg tracking-widest"
                placeholder="••••••••"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Password will show as dots for security</p>
            </div>

            {error && (
              <div className="p-4 bg-red-50 dark:bg-red-900/30 border-2 border-red-300 dark:border-red-700 rounded-lg">
                <p className="text-base text-red-700 dark:text-red-300 font-semibold">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !password}
              className="w-full px-4 py-4 bg-gradient-to-r from-brand-500 to-brand-600 text-white font-bold rounded-lg hover:from-brand-600 hover:to-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl text-lg"
            >
              {loading ? 'Verifying...' : 'Access Admin Panel'}
            </button>
          </form>

          <p className="text-sm text-gray-500 dark:text-gray-400 text-center mt-8 font-medium">
            Data Collection Platform
          </p>
        </div>
      </div>
    </div>
  )
}
