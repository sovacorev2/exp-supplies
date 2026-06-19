import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { forms, submissions } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    // Delete all submissions for this form first
    await db.delete(submissions).where(eq(submissions.form_id, id))
    
    // Delete the form
    await db.delete(forms).where(eq(forms.id, id))
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[v0] Error deleting form:', error)
    return NextResponse.json({ error: 'Failed to delete form' }, { status: 500 })
  }
}
