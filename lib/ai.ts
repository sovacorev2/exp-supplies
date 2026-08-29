function getGeminiKeys(): string[] {
  return (process.env.GEMINI_API_KEYS ?? '').split(',').map(k => k.trim()).filter(Boolean)
}

export function aiConfigured(): boolean {
  return getGeminiKeys().length > 0
}

// Tries each configured key in turn (starting from a random offset so load
// spreads across the whole pool over many calls instead of always hitting
// key[0] first). Any non-2xx response rotates to the next key — including
// 403, not just 429/5xx. That's not the textbook "only retry on rate
// limits" rule: in practice Gemini's "your project has been denied access"
// error comes back as a 403 that's specific to the *project behind that
// key*, not a request-shape problem, so treating 403 as fatal defeats the
// whole point of having a pool. The one thing that does NOT rotate is a
// successful response whose body isn't valid JSON — that's a prompt/schema
// issue, not a credential issue, and every key would fail it identically.
export async function callGemini<T>(
  prompt: string,
  responseSchema: object
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const keys = getGeminiKeys()
  if (!keys.length) return { ok: false, error: 'Smart Insights are not configured' }

  const model = process.env.GEMINI_MODEL || 'gemini-3.6-flash'
  const start = Math.floor(Math.random() * keys.length)
  let lastError = 'All Gemini keys failed'

  for (let i = 0; i < keys.length; i++) {
    const key = keys[(start + i) % keys.length]
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              responseMimeType: 'application/json',
              responseSchema,
              // Without an explicit ceiling this defaults to whatever the
              // model itself picks, which for a form with several
              // open-text questions (each summarized with up to 30 sample
              // answers) plus this model's own "thinking" tokens can run
              // long enough to get cut off mid-JSON — a real request that
              // failed, not a bad key, but rotating keys for it just wastes
              // the whole pool retrying the same doomed prompt. Generous
              // enough that a rich, many-question narrative always fits.
              maxOutputTokens: 8192,
            },
          }),
          // 45s, not 20s — a large form (many open-text questions, each
          // summarized with up to 30 sample answers) genuinely takes this
          // model longer to reason through and write a full narrative for;
          // the old, tighter timeout could abort a request that was going
          // to succeed, then repeat that same abort across every key in
          // the pool before finally giving up.
          signal: AbortSignal.timeout(45_000),
        }
      )

      if (!res.ok) {
        const body = await res.json().catch(() => null)
        lastError = body?.error?.message || `Gemini error (${res.status})`
        continue
      }

      const json = await res.json()
      const candidate = json.candidates?.[0]
      const text = candidate?.content?.parts?.[0]?.text
      // A hard truncation (finishReason MAX_TOKENS) produces the same
      // "can't parse this" symptom as a genuine format problem below, but
      // is worth surfacing distinctly — the fix for one is a bigger token
      // budget, not a prompt/schema change.
      if (candidate?.finishReason === 'MAX_TOKENS') {
        return { ok: false, error: 'Gemini response was cut off before completing (ran out of output tokens)' }
      }
      if (!text) { lastError = 'Gemini returned an empty response'; continue }
      try {
        return { ok: true, data: JSON.parse(text) }
      } catch {
        return { ok: false, error: 'Gemini returned an unexpected format' }
      }
    } catch (err) {
      console.error('[v0] Gemini call failed:', err)
      lastError = 'Network error calling Gemini'
      continue
    }
  }

  return { ok: false, error: lastError }
}
