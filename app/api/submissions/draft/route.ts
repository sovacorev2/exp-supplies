import { NextRequest, NextResponse } from 'next/server'
import { saveDraft, getDraft } from '@/app/actions/forms'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const { formId, resumeToken, data } = (await request.json()) as {
    formId?: string
    resumeToken?: string
    data?: Record<string, string>
  }
  if (!formId || !data) {
    return NextResponse.json({ error: 'formId and data are required' }, { status: 400 })
  }

  try {
    const result = await saveDraft(formId, data, resumeToken)
    return NextResponse.json(result)
  } catch (err) {
    console.error('[v0] Error saving draft:', err)
    return NextResponse.json({ error: 'Failed to save draft' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  const formId = request.nextUrl.searchParams.get('formId')
  const token = request.nextUrl.searchParams.get('token')
  if (!formId || !token) {
    return NextResponse.json({ error: 'formId and token are required' }, { status: 400 })
  }

  const result = await getDraft(formId, token)
  if ('error' in result) {
    const status = result.error === 'expired' ? 410 : 404
    return NextResponse.json(result, { status })
  }
  return NextResponse.json(result)
}
