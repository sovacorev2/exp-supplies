'use client'

import { useState } from 'react'
import { Menu, X, Moon, Sun, LogOut } from 'lucide-react'

interface MobileNavProps {
  theme: 'light' | 'dark'
  onToggleTheme: () => void
  onLogout: () => void
}

export default function MobileNav({ theme, onToggleTheme, onLogout }: MobileNavProps) {
  const [isOpen, setIsOpen] = useState(false)

  const closeMenu = () => setIsOpen(false)

  return (
    <>
      {/* Mobile Header with Hamburger */}
      <div className="md:hidden sticky top-0 z-40 bg-gradient-to-r from-brand-600 to-brand-700 text-white px-4 py-4 flex items-center justify-between shadow-lg">
        <div>
          <h1 className="font-bold text-lg">Exp Forms</h1>
          <p className="text-xs text-brand-100">Admin</p>
        </div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 hover:bg-brand-500 rounded-lg transition-colors"
          aria-label="Toggle menu"
        >
          {isOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Menu Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={closeMenu}
        />
      )}

      {/* Mobile Menu Panel */}
      <div
        className={`fixed right-0 top-16 bottom-0 w-64 bg-white dark:bg-gray-800 shadow-2xl z-30 transform transition-transform duration-200 md:hidden ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Menu Items */}
          <nav className="flex-1 p-4 space-y-2">
            <a
              href="/admin"
              onClick={closeMenu}
              className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-brand-50 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300 font-medium"
            >
              <span>📊</span> Forms
            </a>
            <a
              href="/admin/suppliers"
              onClick={closeMenu}
              className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-brand-50 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300 font-medium"
            >
              <span>📋</span> Responses
            </a>
          </nav>

          {/* Menu Footer */}
          <div className="border-t border-gray-200 dark:border-gray-700 p-4 space-y-2">
            <button
              onClick={() => {
                onToggleTheme()
                closeMenu()
              }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-brand-50 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300 font-medium"
            >
              {theme === 'light' ? (
                <>
                  <Moon size={18} /> Dark Mode
                </>
              ) : (
                <>
                  <Sun size={18} /> Light Mode
                </>
              )}
            </button>
            <button
              onClick={() => {
                onLogout()
                closeMenu()
              }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-red-600 dark:text-red-400 font-medium"
            >
              <LogOut size={18} /> Logout
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
