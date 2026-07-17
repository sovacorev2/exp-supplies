import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { shareTokens, forms, submissions } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    
    // Find valid share token
    const tokenRecord = await db
      .select()
      .from(shareTokens)
      .where(eq(shareTokens.token, token))
      .limit(1)
    
    if (!tokenRecord.length) {
      return NextResponse.json({ error: 'Invalid share link' }, { status: 404 })
    }
    
    const record = tokenRecord[0]
    
    // Check if token is expired
    if (new Date(record.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Share link has expired' }, { status: 410 })
    }
    
    // Fetch form and submissions
    const form = await db
      .select()
      .from(forms)
      .where(eq(forms.id, record.form_id))
      .limit(1)
    
    if (!form.length) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 })
    }
    
    const formSubmissions = await db
      .select()
      .from(submissions)
      .where(eq(submissions.form_id, record.form_id))
    
    return NextResponse.json({
      form: form[0],
      submissions: formSubmissions,
      expiresAt: record.expires_at,
    })
  } catch (error) {
    console.error('[v0] Error fetching shared responses:', error)
    return NextResponse.json({ error: 'Failed to fetch responses' }, { status: 500 })
  }
}
