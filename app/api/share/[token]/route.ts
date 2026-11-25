import { NextRequest, NextResponse } from 'next/server'
import { getPool } from '@/lib/db/pool'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const pool = getPool()

    // Find valid share token
    const tokenRecords = (await pool.query('SELECT * FROM share_tokens WHERE token = $1 LIMIT 1', [token])).rows
    if (!tokenRecords.length) {
      return NextResponse.json({ error: 'Invalid share link' }, { status: 404 })
    }

    const record = tokenRecords[0]

    // Check if expired
    if (new Date(record.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Share link has expired' }, { status: 410 })
    }

    // Fetch form
    const forms = (await pool.query('SELECT * FROM forms WHERE id = $1 LIMIT 1', [record.form_id])).rows
    if (!forms.length) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 })
    }

    // Fetch submissions
    const formSubmissions = (await pool.query('SELECT * FROM submissions WHERE form_id = $1 ORDER BY created_at DESC', [record.form_id])).rows

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
