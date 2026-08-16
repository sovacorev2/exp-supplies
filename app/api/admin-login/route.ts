import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { adminLoginAttempts } from '@/lib/db/schema'
import { and, eq, gt, lt } from 'drizzle-orm'

const WINDOW_MINUTES = 15
const MAX_ATTEMPTS = 5

function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) return forwardedFor.split(',')[0].trim()
  return request.headers.get('x-real-ip') || 'unknown'
}

export async function POST(request: NextRequest) {
  const adminEmail = process.env.SUPER_ADMIN_EMAIL
  if (!adminEmail) {
    return NextResponse.json({ error: 'Admin login is not configured' }, { status: 500 })
  }

  const { password } = (await request.json()) as { password?: string }
  if (!password) {
    return NextResponse.json({ error: 'Password is required' }, { status: 400 })
  }

  const ip = getClientIp(request)
  const windowStart = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000)

  try {
    await db.delete(adminLoginAttempts).where(lt(adminLoginAttempts.created_at, windowStart))

    const recentAttempts = await db
      .select()
      .from(adminLoginAttempts)
      .where(and(eq(adminLoginAttempts.ip, ip), gt(adminLoginAttempts.created_at, windowStart)))

    if (recentAttempts.length >= MAX_ATTEMPTS) {
      return NextResponse.json(
        { error: 'Too many attempts. Try again in a few minutes.' },
        { status: 429 }
      )
    }

    await db.insert(adminLoginAttempts).values({ ip })
  } catch (err) {
    console.error('[v0] Admin login rate-limit check failed:', err)
    return NextResponse.json({ error: 'Sign-in failed' }, { status: 500 })
  }

  try {
    const authResponse = await auth.api.signInEmail({
      body: { email: adminEmail, password },
      asResponse: true,
    })

    if (!authResponse.ok) {
      return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
    }

    const headers = new Headers()
    authResponse.headers.forEach((value, key) => {
      if (key.toLowerCase() === 'set-cookie') headers.append('set-cookie', value)
    })

    return new NextResponse(await authResponse.text(), { status: 200, headers })
  } catch (err) {
    console.error('[v0] Admin login error:', err)
    return NextResponse.json({ error: 'Sign-in failed' }, { status: 500 })
  }
}
