import { updateSubmissionStatus, deleteSubmission } from '@/app/actions/forms'
import { NextResponse } from 'next/server'
import { errorToStatus } from '@/lib/auth-helpers'

export const dynamic = 'force-dynamic'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { status, notes } = await request.json() as { status: 'pending' | 'approved' | 'rejected'; notes?: string }
    const result = await updateSubmissionStatus(id, status, notes)
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: errorToStatus(err) })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await deleteSubmission(id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: errorToStatus(err) })
  }
}
