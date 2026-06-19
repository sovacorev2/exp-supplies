'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, FileText, PlusCircle, LogOut, Loader, Moon, Sun
} from 'lucide-react'
import clsx from 'clsx'
import MobileNav from '@/components/MobileNav'


const nav = [
  { label: 'Dashboard',    href: '/admin',             icon: LayoutDashboard },
  { label: 'Forms',        href: '/admin/forms',        icon: FileText,  section: 'Forms' },
  { label: 'New form',     href: '/admin/forms/new',    icon: PlusCircle },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [authenticated, setAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)

  function toggleTheme() {
    const newTheme = theme === 'light' ? 'dark' : 'light'
    setTheme(newTheme)
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    localStorage.setItem('theme', newTheme)
  }

  useEffect(() => {
    // Initialize theme from localStorage or system preference
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const initialTheme = savedTheme || (prefersDark ? 'dark' : 'light')
    setTheme(initialTheme)
    if (initialTheme === 'dark') {
      document.documentElement.classList.add('dark')
    }

    // Check authentication
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
    <>
      <MobileNav theme={theme} onToggleTheme={toggleTheme} onLogout={handleLogout} />
      <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-900">
        {/* Sidebar */}
        <aside className="hidden md:flex w-56 flex-shrink-0 bg-gradient-to-b from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 border-r border-brand-100 dark:border-gray-700 flex-col shadow-sm">
        <div className="px-4 py-6 border-b border-brand-100 bg-gradient-to-r from-brand-50 to-transparent flex items-center gap-3">
          <Image 
            src="/exp-logo.png" 
            alt="Exp Forms" 
            width={40} 
            height={40}
            className="rounded-lg"
          />
          <div>
            <h1 className="font-bold text-gray-900 text-sm">Exp Forms</h1>
            <p className="text-[10px] text-gray-500 font-medium">Data Collection</p>
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

        <div className="px-3 py-4 border-t border-gray-100 dark:border-gray-700 mt-auto space-y-2">
          <button 
            onClick={toggleTheme}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 w-full transition-colors font-medium"
            title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          >
            {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
            {theme === 'light' ? 'Dark' : 'Light'}
          </button>
          <button 
            onClick={handleLogout}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 w-full transition-colors font-medium"
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
    </>
  )
}
