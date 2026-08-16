import { NextRequest, NextResponse } from 'next/server'
import { getInvitees, addInvitees } from '@/app/actions/forms'
import { errorToStatus } from '@/lib/auth-helpers'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const result = await getInvitees(id)
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: errorToStatus(err) })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { list } = (await request.json()) as { list?: { name: string; email: string }[] }
    if (!Array.isArray(list)) {
      return NextResponse.json({ error: 'list is required' }, { status: 400 })
    }
    await addInvitees(id, list)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: errorToStatus(err) })
  }
}
