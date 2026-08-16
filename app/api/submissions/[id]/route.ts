import { deleteSubmission } from '@/app/actions/forms'
import { NextRequest, NextResponse } from 'next/server'
import { errorToStatus } from '@/lib/auth-helpers'

export const dynamic = 'force-dynamic'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    await deleteSubmission(id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[v0] Delete submission error:', error)
    return NextResponse.json(
      { error: 'Failed to delete response' },
      { status: errorToStatus(error) }
    )
  }
}
