import { put } from '@vercel/blob'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    console.log('[v0] Upload API called')
    const formData = await req.formData()
    const file = formData.get('file') as File
    const submissionId = formData.get('submissionId') as string

    console.log('[v0] File:', file?.name, 'Size:', file?.size, 'Type:', file?.type)
    console.log('[v0] Submission ID:', submissionId)

    if (!file) {
      console.error('[v0] No file provided')
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const filename = `submissions/${submissionId}/${Date.now()}-${file.name}`
    console.log('[v0] Uploading to:', filename)
    const blob = await put(filename, file, { access: 'private' })

    console.log('[v0] Blob upload successful:', blob.url)
    return NextResponse.json({ url: blob.url })
  } catch (error) {
    console.error('[v0] Upload error:', error)
    return NextResponse.json({ error: 'Failed to upload file', details: String(error) }, { status: 500 })
  }
}
