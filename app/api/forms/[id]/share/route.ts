import { NextRequest, NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'
import { randomBytes } from 'crypto'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const sql = neon(process.env.DATABASE_URL!)

    // Verify form exists
    const forms = await sql`SELECT id FROM forms WHERE id = ${id} LIMIT 1`
    if (!forms.length) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 })
    }

    // Generate unique token (32-char hex)
    const token = randomBytes(16).toString('hex')

    // Create share token valid for 7 days
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    await sql`
      INSERT INTO share_tokens (form_id, token, expires_at)
      VALUES (${id}, ${token}, ${expiresAt.toISOString()})
    `

    // Derive base URL from request headers to work on any domain
    const host = request.headers.get('host') || 'localhost:3000'
    const protocol = host.includes('localhost') ? 'http' : 'https'
    const baseUrl = `${protocol}://${host}`
    const shareLink = `${baseUrl}/share/${token}`

    return NextResponse.json({ token, shareLink, expiresAt })
  } catch (error) {
    console.error('[v0] Error generating share token:', error)
    return NextResponse.json({ error: 'Failed to generate share link' }, { status: 500 })
  }
}
