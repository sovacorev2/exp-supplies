'use client'

import { useEffect, useRef, useState } from 'react'

const MAX_SHOWN = 8

// A closed-list combobox: type to filter, click/Enter to choose. Typing
// alone never commits an answer — onChange fires '' until an option is
// actually picked, so a half-typed name correctly reads as unanswered by
// the generic `field.required && !value` check every other field uses.
export function AutocompleteField({
  value,
  onChange,
  options,
  placeholder,
  error,
}: {
  value: string
  onChange: (v: string) => void
  options: string[]
  placeholder?: string
  error?: boolean
}) {
  const [query, setQuery] = useState(value || '')
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setQuery(value || '') }, [value])

  const filtered = (query.trim()
    ? options.filter(o => o.toLowerCase().includes(query.trim().toLowerCase()))
    : options
  ).slice(0, MAX_SHOWN)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function select(opt: string) {
    onChange(opt)
    setQuery(opt)
    setOpen(false)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlighted(h => Math.min(h + 1, filtered.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlighted(h => Math.max(h - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); if (filtered[highlighted]) select(filtered[highlighted]) }
    else if (e.key === 'Escape') setOpen(false)
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        className={`input dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 ${error ? 'border-red-400' : ''}`}
        value={query}
        placeholder={placeholder || 'Start typing…'}
        onChange={e => { setQuery(e.target.value); onChange(''); setOpen(true); setHighlighted(0) }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg">
          {filtered.map((opt, i) => (
            <li
              key={opt}
              onMouseDown={e => { e.preventDefault(); select(opt) }}
              className={`px-3 py-2 text-sm cursor-pointer ${
                i === highlighted
                  ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300'
                  : 'text-gray-700 dark:text-gray-200'
              }`}
            >
              {opt}
            </li>
          ))}
        </ul>
      )}
      {open && query.trim() && filtered.length === 0 && (
        <div className="absolute z-20 mt-1 w-full bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg px-3 py-2 text-sm text-gray-400">
          No matches
        </div>
      )}
    </div>
  )
}
