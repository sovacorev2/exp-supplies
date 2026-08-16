import { NextRequest, NextResponse } from 'next/server'
import { createShareToken } from '@/app/actions/forms'
import { errorToStatus } from '@/lib/auth-helpers'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const token = await createShareToken(id)
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    // Derive base URL from request headers to work on any domain
    const host = request.headers.get('host') || 'localhost:3000'
    const protocol = host.includes('localhost') ? 'http' : 'https'
    const baseUrl = `${protocol}://${host}`
    const shareLink = `${baseUrl}/share/${token}`

    return NextResponse.json({ token, shareLink, expiresAt })
  } catch (error) {
    console.error('[v0] Error generating share token:', error)
    return NextResponse.json({ error: 'Failed to generate share link' }, { status: errorToStatus(error) })
  }
}
