import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { shareTokens, forms, submissions } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import SharedResponsesClient from './SharedResponsesClient'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ token: string }>
}

export default async function SharePage({ params }: Props) {
  const { token } = await params

  // Verify token validity
  const tokenRecord = await db
    .select()
    .from(shareTokens)
    .where(eq(shareTokens.token, token))
    .limit(1)

  if (!tokenRecord.length) {
    notFound()
  }

  const record = tokenRecord[0]

  // Check expiry
  if (new Date(record.expires_at) < new Date()) {
    notFound()
  }

  // Fetch form and submissions
  const form = await db
    .select()
    .from(forms)
    .where(eq(forms.id, record.form_id))
    .limit(1)

  if (!form.length) {
    notFound()
  }

  const formSubmissions = await db
    .select()
    .from(submissions)
    .where(eq(submissions.form_id, record.form_id))

  return (
    <SharedResponsesClient
      form={form[0]}
      submissions={formSubmissions}
      expiresAt={record.expires_at}
    />
  )
}
