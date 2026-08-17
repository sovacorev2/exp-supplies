import { LayoutDashboard, FileText, PlusCircle, ClipboardList, BarChart2, type LucideIcon } from 'lucide-react'

export interface AdminShellUser {
  name: string
  email: string
  role: string
}

export interface NavItem {
  label: string
  href: string
  icon: LucideIcon
  section?: string
}

export const nav: NavItem[] = [
  { label: 'Dashboard',  href: '/admin',            icon: LayoutDashboard },
  { label: 'Forms',      href: '/admin/forms',      icon: FileText,      section: 'Forms' },
  { label: 'New form',   href: '/admin/forms/new',  icon: PlusCircle },
  { label: 'Responses',  href: '/admin/suppliers',  icon: ClipboardList },
  { label: 'Analytics',  href: '/admin/analytics',  icon: BarChart2,     section: 'Analytics' },
]
