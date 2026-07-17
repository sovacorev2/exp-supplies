import { NextRequest, NextResponse } from 'next/server'
import { createShareToken } from '@/app/actions/forms'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const token = await createShareToken(id)

    const host = request.headers.get('host') || 'localhost:3000'
    const protocol = host.includes('localhost') ? 'http' : 'https'
    const shareLink = `${protocol}://${host}/share/${token}`

    return NextResponse.json({ token, shareLink })
  } catch (error) {
    console.error('[v0] Error generating share token:', error)
    return NextResponse.json({ error: 'Failed to generate share link' }, { status: 500 })
  }
}
