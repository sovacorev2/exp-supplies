import { NextRequest, NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const sql = neon(process.env.DATABASE_URL!)

    // Find valid share token
    const tokenRecords = await sql`
      SELECT * FROM share_tokens WHERE token = ${token} LIMIT 1
    `
    if (!tokenRecords.length) {
      return NextResponse.json({ error: 'Invalid share link' }, { status: 404 })
    }

    const record = tokenRecords[0]

    // Check if expired
    if (new Date(record.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Share link has expired' }, { status: 410 })
    }

    // Fetch form
    const forms = await sql`
      SELECT * FROM forms WHERE id = ${record.form_id} LIMIT 1
    `
    if (!forms.length) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 })
    }

    // Fetch submissions
    const formSubmissions = await sql`
      SELECT * FROM submissions WHERE form_id = ${record.form_id} ORDER BY created_at DESC
    `

    return NextResponse.json({
      form: forms[0],
      submissions: formSubmissions,
      expiresAt: record.expires_at,
    })
  } catch (error) {
    console.error('[v0] Error fetching shared responses:', error)
    return NextResponse.json({ error: 'Failed to fetch responses' }, { status: 500 })
  }
}
