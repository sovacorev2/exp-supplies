import { NextRequest, NextResponse } from 'next/server'
import { getSharedFormData } from '@/app/actions/forms'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const result = await getSharedFormData(token)

    if ('error' in result) {
      const status = result.error === 'expired' ? 410 : 404
      return NextResponse.json({ error: result.error }, { status })
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('[v0] Error fetching shared responses:', error)
    return NextResponse.json({ error: 'Failed to fetch responses' }, { status: 500 })
  }
}
