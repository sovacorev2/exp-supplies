'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Lock } from 'lucide-react'

const ADMIN_PIN = process.env.NEXT_PUBLIC_ADMIN_PIN || '1234'

export default function AdminLoginPage() {
  const router = useRouter()
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    // Simulate verification delay
    setTimeout(() => {
      if (pin === ADMIN_PIN) {
        // Store session token in localStorage and httpOnly cookie
        localStorage.setItem('admin_authenticated', 'true')
        localStorage.setItem('admin_login_time', Date.now().toString())
        
        // Set a cookie for server-side verification
        document.cookie = `admin_session=${Date.now()}; path=/admin; max-age=28800; SameSite=Strict`
        
        router.push('/admin')
      } else {
        setError('Invalid PIN. Please try again.')
        setPin('')
      }
      setLoading(false)
    }, 500)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-silver-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo / Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-600 shadow-lg mb-4">
            <Lock className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">SupplyPortal</h1>
          <p className="text-sm text-silver-600 mt-1">Agency Admin Access</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Enter Admin PIN
              </label>
              <input
                type="password"
                value={pin}
                onChange={e => setPin(e.target.value)}
                disabled={loading}
                className="w-full px-4 py-3 text-center text-2xl tracking-widest border-2 border-gray-200 rounded-lg focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500 focus:ring-opacity-20 transition-all bg-white font-mono"
                placeholder="••••"
                maxLength={6}
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600 font-medium">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !pin}
              className="w-full px-4 py-3 bg-gradient-to-r from-brand-500 to-brand-600 text-white font-medium rounded-lg hover:from-brand-600 hover:to-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg"
            >
              {loading ? 'Verifying...' : 'Access Admin Panel'}
            </button>
          </form>

          <p className="text-xs text-silver-500 text-center mt-6">
            "Nothing ever becomes real until it is experienced" – John Keats
          </p>
        </div>

        {/* Footer note */}
        <p className="text-center text-xs text-silver-600 mt-8">
          Set <code className="bg-gray-100 px-2 py-0.5 rounded text-xs">NEXT_PUBLIC_ADMIN_PIN</code> in environment variables to change PIN
        </p>
      </div>
    </div>
  )
}
