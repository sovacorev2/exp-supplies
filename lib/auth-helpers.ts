import { headers } from 'next/headers'
import { auth } from './auth'

export interface CurrentUser {
  id: string
  email: string
  name: string
  role: string
}

export class UnauthorizedError extends Error {
  constructor(message = 'Unauthorized') {
    super(message)
    this.name = 'UnauthorizedError'
  }
}

export class ForbiddenError extends Error {
  constructor(message = 'Forbidden') {
    super(message)
    this.name = 'ForbiddenError'
  }
}

function toCurrentUser(session: Awaited<ReturnType<typeof auth.api.getSession>>): CurrentUser | null {
  if (!session) return null
  const { id, email, name, role } = session.user as typeof session.user & { role?: string }
  return { id, email, name, role: role ?? 'user' }
}

// For RSC pages and Server Actions.
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await auth.api.getSession({ headers: await headers() })
  return toCurrentUser(session)
}

// For Route Handlers, which receive a Request/NextRequest directly.
export async function getCurrentUserFromRequest(request: Request): Promise<CurrentUser | null> {
  const session = await auth.api.getSession({ headers: request.headers })
  return toCurrentUser(session)
}

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser()
  if (!user) throw new UnauthorizedError()
  return user
}

export function errorToStatus(err: unknown): number {
  if (err instanceof UnauthorizedError) return 401
  if (err instanceof ForbiddenError) return 403
  return 500
}
