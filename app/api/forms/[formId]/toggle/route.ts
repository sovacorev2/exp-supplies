import { db } from '@/lib/db'
import { forms } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function POST(
  request: Request,
  { params }: { params: { formId: string } }
) {
  try {
    const { is_active } = await request.json()
    
    await db
      .update(forms)
      .set({ is_active })
      .where(eq(forms.id, params.formId))
    
    return Response.json({ success: true })
  } catch (error) {
    console.error('Toggle form error:', error)
    return Response.json({ error: 'Failed to toggle form' }, { status: 500 })
  }
}
