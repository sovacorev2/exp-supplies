export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth-helpers'
import AdminShellClient from '@/components/AdminShellClient'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  if (!user) redirect('/sign-in')

  return <AdminShellClient user={user}>{children}</AdminShellClient>
}
