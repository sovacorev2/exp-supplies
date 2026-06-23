import { put } from '@vercel/blob'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File

    if (!file) {
      console.error('[v0] No file provided to upload API')
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    console.log('[v0] Upload API: Uploading file', file.name, `(${file.size} bytes, ${file.type})`)

    const filename = `submissions/${Date.now()}-${Math.random().toString(36).slice(2)}-${file.name}`
    const blob = await put(filename, file, { access: 'private' })

    console.log('[v0] Upload API: Success -', blob.url)
    return NextResponse.json({ url: blob.url }, { status: 200 })
  } catch (error) {
    console.error('[v0] Upload API error:', error)
    return NextResponse.json(
      { error: 'Failed to upload file', details: String(error) }, 
      { status: 500 }
    )
  }
}
