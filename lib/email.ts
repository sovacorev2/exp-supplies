export async function sendEmail({
  to,
  subject,
  html,
  text,
}: {
  to: string
  subject: string
  html: string
  // A plain-text alternative. Mailbox providers weigh HTML-only mail as a
  // mild spam signal (real correspondence is almost always multipart) — this
  // matters most in the first weeks of a newly-verified sending domain,
  // before it has any reputation to fall back on. Falls back to a crude
  // HTML-stripped version if a caller doesn't supply one.
  text?: string
}): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM_EMAIL
  if (!apiKey || !from) return { ok: false, error: 'Email is not configured' }

  const plainText = text ?? html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to, subject, html, text: plainText }),
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
