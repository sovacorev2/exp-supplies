'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, FileText, Users, Tag, PlusCircle,
  Building2, LogOut, Loader
} from 'lucide-react'
import clsx from 'clsx'

const nav = [
  { label: 'Dashboard',    href: '/admin',             icon: LayoutDashboard },
  { label: 'Forms',        href: '/admin/forms',        icon: FileText,  section: 'Forms' },
  { label: 'New form',     href: '/admin/forms/new',    icon: PlusCircle },
  { label: 'All suppliers', href: '/admin/suppliers',   icon: Users, section: 'Suppliers' },
  { label: 'By category',  href: '/admin/categories',   icon: Tag },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [authenticated, setAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const isAuth = localStorage.getItem('admin_authenticated') === 'true'
    const loginTime = localStorage.getItem('admin_login_time')
    
    // Check if session is still valid (8 hours)
    if (isAuth && loginTime) {
      const elapsed = Date.now() - parseInt(loginTime)
      if (elapsed < 8 * 60 * 60 * 1000) {
        setAuthenticated(true)
      } else {
        localStorage.removeItem('admin_authenticated')
        localStorage.removeItem('admin_login_time')
        router.push('/admin-login')
      }
    } else {
      router.push('/admin-login')
    }
    setLoading(false)
  }, [router])

  function handleLogout() {
    localStorage.removeItem('admin_authenticated')
    localStorage.removeItem('admin_login_time')
    document.cookie = 'admin_session=; path=/admin; max-age=0'
    router.push('/admin-login')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-brand-50 to-white">
        <div className="flex flex-col items-center gap-3">
          <Loader className="w-8 h-8 text-brand-500 animate-spin" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!authenticated) {
    return null
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 bg-gradient-to-b from-white to-gray-50 border-r border-brand-100 flex flex-col shadow-sm">
        <div className="px-4 py-6 border-b border-brand-100 bg-gradient-to-r from-brand-50 to-transparent">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center shadow-md">
              <Building2 size={18} className="text-white" />
            </div>
            <div>
              <h1 className="font-bold text-gray-900 text-sm">SupplyPortal</h1>
              <p className="text-[10px] text-gray-500 font-medium">Exp Agency Admin</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-3 overflow-y-auto">
          {nav.map((item, i) => {
            const Icon = item.icon
            const active = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href))
            const showSection = item.section && (i === 0 || nav[i - 1].section !== item.section)
            return (
              <div key={item.href}>
                {item.section && (i === 1 || nav[i-1].section !== item.section) && (
                  <p className="text-[10px] uppercase tracking-wider text-gray-400 font-medium px-2 pt-4 pb-1">
                    {item.section}
                  </p>
                )}
                <Link
                  href={item.href}
                  className={clsx(
                    'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm mb-0.5 transition-colors',
                    active
                      ? 'bg-brand-50 text-brand-600 font-medium'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  )}
                >
                  <Icon size={16} />
                  {item.label}
                </Link>
              </div>
            )
          })}
        </nav>

        <div className="px-3 py-4 border-t border-gray-100 mt-auto">
          <p className="text-[10px] text-gray-500 italic text-center mb-4 leading-tight">
            "Nothing ever becomes real until it is experienced" – John Keats
          </p>
          <button 
            onClick={handleLogout}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-red-50 hover:text-red-600 w-full transition-colors font-medium"
          >
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {children}
      </div>
    </div>
  )
}
