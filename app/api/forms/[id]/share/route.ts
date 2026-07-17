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

    // Verify the form in the same database used by this production request.
    const forms = await sql`SELECT id FROM forms WHERE id = ${id} LIMIT 1`
    if (!forms.length) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 })
    }

    // Some deployments were connected to a different Neon database than the
    // one in DATABASE_URL. Ensure this feature's table exists where the forms
    // actually live. This is idempotent and prevents branch/env drift from
    // breaking share-link generation again.
    await sql`
      CREATE TABLE IF NOT EXISTS share_tokens (
        id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
        form_id text NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
        token text NOT NULL UNIQUE,
        created_at timestamp NOT NULL DEFAULT now(),
        expires_at timestamp NOT NULL
      )
    `

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
