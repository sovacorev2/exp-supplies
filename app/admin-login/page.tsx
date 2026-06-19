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
    <div className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-silver-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo / Branding */}
        <div className="text-center mb-8">
          <div className="inline-block mb-4">
            <Image 
              src="/exp-logo.png" 
              alt="Exp Forms" 
              width={80} 
              height={80}
              className="drop-shadow-lg"
            />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Exp Forms</h1>
          <p className="text-sm text-gray-600 mt-1">Admin Access</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Enter Admin Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                disabled={loading}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500 focus:ring-opacity-20 transition-all bg-white"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600 font-medium">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !password}
              className="w-full px-4 py-3 bg-gradient-to-r from-brand-500 to-brand-600 text-white font-medium rounded-lg hover:from-brand-600 hover:to-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg"
            >
              {loading ? 'Verifying...' : 'Access Admin Panel'}
            </button>
          </form>

          <p className="text-xs text-gray-500 text-center mt-6">
            Data Collection Platform
          </p>
        </div>
      </div>
    </div>
  )
}
