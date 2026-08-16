import { NextRequest, NextResponse } from 'next/server'
import { sendBulkReminders } from '@/app/actions/forms'
import { errorToStatus } from '@/lib/auth-helpers'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const host = request.headers.get('host') || 'localhost:3000'
    const protocol = host.includes('localhost') ? 'http' : 'https'
    const origin = `${protocol}://${host}`

    const result = await sendBulkReminders(id, origin)
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: errorToStatus(err) })
  }
}
