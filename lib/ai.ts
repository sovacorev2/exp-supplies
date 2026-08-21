function getGeminiKeys(): string[] {
  return (process.env.GEMINI_API_KEYS ?? '').split(',').map(k => k.trim()).filter(Boolean)
}

export function aiConfigured(): boolean {
  return getGeminiKeys().length > 0
}

// Tries each configured key in turn (starting from a random offset so load
// spreads across the whole pool over many calls instead of always hitting
// key[0] first) and falls through to the next key only on 429/5xx/network
// errors — the exact failure modes a multi-key rotation exists to route
// around. A real request problem (bad key, malformed body) fails fast
// instead of burning through the rest of the pool for no reason.
export async function callGemini<T>(
  prompt: string,
  responseSchema: object
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const keys = getGeminiKeys()
  if (!keys.length) return { ok: false, error: 'AI insights are not configured' }

  const model = process.env.GEMINI_MODEL || 'gemini-3.6-flash'
  const start = Math.floor(Math.random() * keys.length)
  let lastError = 'All AI keys were rate-limited'

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
            generationConfig: { responseMimeType: 'application/json', responseSchema },
          }),
          signal: AbortSignal.timeout(20_000),
        }
      )

      if (res.status === 429 || res.status >= 500) {
        lastError = `Gemini key unavailable (${res.status})`
        continue
      }
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        return { ok: false, error: body?.error?.message || `Gemini error (${res.status})` }
      }

      const json = await res.json()
      const text = json.candidates?.[0]?.content?.parts?.[0]?.text
      if (!text) return { ok: false, error: 'Gemini returned an empty response' }
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
