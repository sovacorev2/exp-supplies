import { NextRequest, NextResponse } from 'next/server'
import { deleteInvitee } from '@/app/actions/forms'
import { errorToStatus } from '@/lib/auth-helpers'

export const dynamic = 'force-dynamic'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await deleteInvitee(id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: errorToStatus(err) })
  }
}
