import { NextRequest, NextResponse } from 'next/server'
import { resolveInvitee } from '@/app/actions/forms'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const formId = request.nextUrl.searchParams.get('formId')
  const token = request.nextUrl.searchParams.get('token')
  if (!formId || !token) {
    return NextResponse.json({ error: 'formId and token are required' }, { status: 400 })
  }

  const result = await resolveInvitee(formId, token)
  if ('error' in result) {
    return NextResponse.json(result, { status: 404 })
  }
  return NextResponse.json(result)
}
