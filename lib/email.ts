export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string
  subject: string
  html: string
}): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM_EMAIL
  if (!apiKey || !from) return { ok: false, error: 'Email is not configured' }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to, subject, html }),
    })

    if (!res.ok) {
      const body = await res.json().catch(() => null)
      return { ok: false, error: body?.message || `Resend error (${res.status})` }
    }

    return { ok: true }
  } catch (err) {
    console.error('[v0] Email send failed:', err)
    return { ok: false, error: 'Failed to send email' }
  }
}
