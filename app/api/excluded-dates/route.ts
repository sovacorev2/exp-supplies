import { NextRequest, NextResponse } from 'next/server'

const STORAGE_KEY = 'excluded_dates_'

// In-memory storage (replace with DB later)
const excludedDatesStore: Record<string, string[]> = {}

export async function GET(request: NextRequest) {
  const formId = request.nextUrl.searchParams.get('formId')
  if (!formId) {
    return NextResponse.json({ excluded: [] })
  }
  
  const key = STORAGE_KEY + formId
  const excluded = excludedDatesStore[key] || []
  
  return NextResponse.json({ excluded })
}

export async function POST(request: NextRequest) {
  const { formId, excluded } = await request.json()
  
  if (!formId) {
    return NextResponse.json({ error: 'Missing formId' }, { status: 400 })
  }
  
  const key = STORAGE_KEY + formId
  excludedDatesStore[key] = excluded
  
  return NextResponse.json({ success: true, excluded })
}
