import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { shareTokens, forms } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { randomBytes } from 'crypto'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    // Verify form exists
    const form = await db.select().from(forms).where(eq(forms.id, id)).limit(1)
    if (!form.length) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 })
    }
    
    // Generate unique token (32-char hex)
    const token = randomBytes(16).toString('hex')
    
    // Create share token valid for 7 days
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    
    await db.insert(shareTokens).values({
      form_id: id,
      token,
      expires_at: expiresAt,
    })
    
    // Return the share link
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const shareLink = `${baseUrl}/share/${token}`
    
    return NextResponse.json({ token, shareLink, expiresAt })
  } catch (error) {
    console.error('[v0] Error generating share token:', error)
    return NextResponse.json({ error: 'Failed to generate share link' }, { status: 500 })
  }
}
