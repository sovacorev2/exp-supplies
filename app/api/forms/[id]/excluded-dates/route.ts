import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { forms } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    const form = await db.select().from(forms).where(eq(forms.id, id)).limit(1)
    
    if (!form || form.length === 0) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 })
    }
    
    return NextResponse.json({
      excludedDates: form[0].excluded_dates || []
    })
  } catch (error) {
    console.error('[v0] Error fetching excluded dates:', error)
    return NextResponse.json({ error: 'Failed to fetch excluded dates' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { excludedDates } = await request.json()
    
    // Update the form's excluded dates
    await db.update(forms)
      .set({ 
        excluded_dates: excludedDates,
        updated_at: new Date()
      })
      .where(eq(forms.id, id))
    
    return NextResponse.json({
      success: true,
      excludedDates
    })
  } catch (error) {
    console.error('[v0] Error updating excluded dates:', error)
    return NextResponse.json({ error: 'Failed to update excluded dates' }, { status: 500 })
  }
}
