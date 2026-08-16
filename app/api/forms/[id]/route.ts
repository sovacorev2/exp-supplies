import { NextRequest, NextResponse } from 'next/server'
import { updateForm, deleteForm } from '@/app/actions/forms'
import { errorToStatus } from '@/lib/auth-helpers'

export const dynamic = 'force-dynamic'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { is_active } = await request.json()

    await updateForm(id, { is_active })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[v0] Error updating form:', error)
    return NextResponse.json({ error: 'Failed to update form' }, { status: errorToStatus(error) })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    await deleteForm(id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[v0] Error deleting form:', error)
    return NextResponse.json({ error: 'Failed to delete form' }, { status: errorToStatus(error) })
  }
}
