import { toggleFormActive } from '@/app/actions/forms'
import { NextResponse } from 'next/server'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { is_active } = await request.json() as { is_active: boolean }
    await toggleFormActive(id, is_active)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
